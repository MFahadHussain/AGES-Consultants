import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { createHash } from 'crypto'
import path from 'path'

// ============================================================
// Single Document API
// GET    /api/documents/[id] — Fetch document, serve file for viewing
// PUT    /api/documents/[id] — Update metadata or replace file
// DELETE /api/documents/[id] — Soft delete (archive)
// ============================================================

// CNIC format: XXXXX-XXXXXXX-X (5 digits, 7 digits, 1 digit)
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/

/**
 * Compute SHA-256 hash of a buffer for file integrity verification.
 */
function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Get file extension from filename.
 */
function getFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase().replace('.', '')
}

/**
 * Map file extension to MIME type for content-type headers.
 */
function getContentType(fileName: string, fileType: string): string {
  if (fileType && fileType.includes('/')) return fileType

  const ext = getFileExtension(fileName)
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// GET /api/documents/[id]
// Query params:
//   download (optional) — if "true", set Content-Disposition to attachment
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const isDownload = searchParams.get('download') === 'true'

    // Fetch document with documentType
    const document = await db.employeeDocument.findUnique({
      where: { id },
      include: { documentType: true },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (document.isArchived) {
      return NextResponse.json(
        { error: 'Document has been archived' },
        { status: 410 }
      )
    }

    // Try to serve the file from disk
    const fullPath = path.join('/home/z/my-project', document.filePath)
    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(fullPath)
    } catch {
      // File not found on disk — return metadata only
      return NextResponse.json({
        ...document,
        fileAvailable: false,
        message: 'File not found on disk. Metadata is still available.',
      })
    }

    // Create VIEWED audit log entry (non-blocking)
    try {
      await db.documentAuditLog.create({
        data: {
          documentId: document.id,
          action: isDownload ? 'DOWNLOADED' : 'VIEWED',
          performedBy: 'system',
          details: JSON.stringify({
            fileName: document.fileName,
            action: isDownload ? 'download' : 'view',
          }),
          ipAddress: request.headers.get('x-forwarded-for') || null,
        },
      })
    } catch (auditError) {
      console.error('Audit log error (non-critical):', auditError)
    }

    // Determine content type
    const contentType = getContentType(document.fileName, document.fileType)

    // Set Content-Disposition based on download flag
    const contentDisposition = isDownload
      ? `attachment; filename="${document.fileName}"`
      : `inline; filename="${document.fileName}"`

    // Return file as stream with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('Document GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT /api/documents/[id] — Update document metadata or replace file
// Supports two modes:
//   1. Metadata update: JSON body with title, documentNumber, issueDate, expiryDate, notes
//   2. File replace: multipart/form-data with new file — archives old, creates new version
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch existing document
    const existing = await db.employeeDocument.findUnique({
      where: { id },
      include: { documentType: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (existing.isArchived) {
      return NextResponse.json(
        { error: 'Cannot update an archived document' },
        { status: 400 }
      )
    }

    // Determine if this is a file replacement or metadata update
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // ── FILE REPLACEMENT MODE ──
      const formData = await request.formData()
      const newFile = formData.get('file') as File | null
      const uploadedBy = (formData.get('uploadedBy') as string) || 'system'
      const title = (formData.get('title') as string) || existing.title
      const documentNumber = (formData.get('documentNumber') as string) || existing.documentNumber || ''
      const issueDate = (formData.get('issueDate') as string) || ''
      const expiryDate = (formData.get('expiryDate') as string) || ''
      const notes = (formData.get('notes') as string) || existing.notes || ''

      if (!newFile) {
        return NextResponse.json(
          { error: 'No file provided for replacement' },
          { status: 400 }
        )
      }

      // Validate file size
      const maxSizeKB = existing.documentType.maxFileSizeKB || 5120
      const maxFileSizeBytes = maxSizeKB * 1024
      if (newFile.size > maxFileSizeBytes) {
        return NextResponse.json(
          {
            error: `File size (${Math.round(newFile.size / 1024)}KB) exceeds maximum allowed size (${maxSizeKB}KB)`,
          },
          { status: 400 }
        )
      }

      // Validate file format
      const fileExtension = getFileExtension(newFile.name)
      const allowedFormats = existing.documentType.allowedFormats
      const allowed = allowedFormats
        .split(',')
        .map((f) => f.trim().toLowerCase())
      if (!allowed.includes(fileExtension.toLowerCase())) {
        return NextResponse.json(
          {
            error: `File format "${fileExtension}" is not allowed. Allowed formats: ${allowedFormats}`,
          },
          { status: 400 }
        )
      }

      // For CNIC documents, validate document number format
      if (
        documentNumber &&
        (existing.documentType.code === 'CNIC_FRONT' ||
          existing.documentType.code === 'CNIC_BACK')
      ) {
        if (!CNIC_REGEX.test(documentNumber)) {
          return NextResponse.json(
            {
              error:
                'CNIC number must be in format XXXXX-XXXXXXX-X (e.g., 35202-1234567-1)',
            },
            { status: 400 }
          )
        }
      }

      // Read new file into buffer
      const bytes = await newFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const fileHash = computeFileHash(buffer)

      // Get employee code for filename
      const employee = await db.employee.findUnique({
        where: { id: existing.employeeId },
        select: { employeeCode: true },
      })

      // Generate new unique filename
      const timestamp = Date.now()
      const sanitizedFileName = `EMP-${employee?.employeeCode || 'UNKNOWN'}-${existing.documentType.code}-${timestamp}.${fileExtension}`

      // Ensure upload directory exists
      const uploadDir = path.join('/home/z/my-project/uploads/employee-docs')
      await mkdir(uploadDir, { recursive: true })

      // Write new file to disk
      const newFilePath = path.join(uploadDir, sanitizedFileName)
      await writeFile(newFilePath, buffer)

      // Archive old document
      await db.employeeDocument.update({
        where: { id: existing.id },
        data: { isArchived: true },
      })

      // Create new version document
      const newVersion = existing.version + 1
      const newDocument = await db.employeeDocument.create({
        data: {
          employeeId: existing.employeeId,
          documentTypeId: existing.documentTypeId,
          title,
          documentNumber: documentNumber || null,
          issueDate: issueDate ? new Date(issueDate) : existing.issueDate,
          expiryDate: expiryDate ? new Date(expiryDate) : existing.expiryDate,
          notes: notes || null,
          fileName: newFile.name,
          filePath: `uploads/employee-docs/${sanitizedFileName}`,
          fileSize: newFile.size,
          fileType: newFile.type || fileExtension,
          fileHash,
          version: newVersion,
          previousVersionId: existing.id,
          uploadedBy,
        },
        include: {
          documentType: true,
        },
      })

      // Create REPLACED audit log for old document
      await db.documentAuditLog.create({
        data: {
          documentId: existing.id,
          action: 'REPLACED',
          performedBy: uploadedBy,
          details: JSON.stringify({
            oldFileName: existing.fileName,
            oldVersion: existing.version,
            newDocumentId: newDocument.id,
            newFileName: newFile.name,
            newVersion,
            reason: 'File replacement',
          }),
          ipAddress: request.headers.get('x-forwarded-for') || null,
        },
      })

      // Create UPLOADED audit log for new document
      await db.documentAuditLog.create({
        data: {
          documentId: newDocument.id,
          action: 'UPLOADED',
          performedBy: uploadedBy,
          details: JSON.stringify({
            fileName: newFile.name,
            fileSize: newFile.size,
            fileType: newFile.type || fileExtension,
            fileHash,
            version: newVersion,
            previousVersionId: existing.id,
            reason: 'File replacement (new version)',
          }),
          ipAddress: request.headers.get('x-forwarded-for') || null,
        },
      })

      return NextResponse.json(newDocument)
    } else {
      // ── METADATA UPDATE MODE ──
      const body = await request.json()

      // For CNIC documents, validate document number format
      if (
        body.documentNumber !== undefined &&
        (existing.documentType.code === 'CNIC_FRONT' ||
          existing.documentType.code === 'CNIC_BACK')
      ) {
        if (body.documentNumber && !CNIC_REGEX.test(body.documentNumber)) {
          return NextResponse.json(
            {
              error:
                'CNIC number must be in format XXXXX-XXXXXXX-X (e.g., 35202-1234567-1)',
            },
            { status: 400 }
          )
        }
      }

      // Build update data — only include fields that are explicitly provided
      const updateData: Record<string, unknown> = {}

      if (body.title !== undefined) updateData.title = body.title
      if (body.documentNumber !== undefined)
        updateData.documentNumber = body.documentNumber || null
      if (body.issueDate !== undefined)
        updateData.issueDate = body.issueDate
          ? new Date(body.issueDate)
          : null
      if (body.expiryDate !== undefined)
        updateData.expiryDate = body.expiryDate
          ? new Date(body.expiryDate)
          : null
      if (body.notes !== undefined) updateData.notes = body.notes || null

      const updated = await db.employeeDocument.update({
        where: { id },
        data: updateData,
        include: {
          documentType: true,
        },
      })

      // Create audit log for metadata update
      try {
        await db.documentAuditLog.create({
          data: {
            documentId: id,
            action: 'VIEWED', // Use VIEWED as a generic update marker since no specific UPDATE action exists
            performedBy: body.updatedBy || 'system',
            details: JSON.stringify({
              action: 'metadata_update',
              updatedFields: Object.keys(updateData),
              previousValues: {
                title: existing.title,
                documentNumber: existing.documentNumber,
                issueDate: existing.issueDate,
                expiryDate: existing.expiryDate,
                notes: existing.notes,
              },
            }),
            ipAddress: request.headers.get('x-forwarded-for') || null,
          },
        })
      } catch (auditError) {
        console.error('Audit log error (non-critical):', auditError)
      }

      return NextResponse.json(updated)
    }
  } catch (error) {
    console.error('Document PUT error:', error)
    let message = 'Failed to update document'
    if (error instanceof Error) {
      message = error.message
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/documents/[id] — Soft delete (archive)
// Sets isArchived = true, does not delete the file from disk (kept for audit)
// ---------------------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch existing document
    const existing = await db.employeeDocument.findUnique({
      where: { id },
      include: { documentType: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (existing.isArchived) {
      return NextResponse.json(
        { error: 'Document is already archived' },
        { status: 400 }
      )
    }

    // Soft delete: archive the document
    const archived = await db.employeeDocument.update({
      where: { id },
      data: { isArchived: true },
      include: {
        documentType: true,
      },
    })

    // Create DELETED audit log
    await db.documentAuditLog.create({
      data: {
        documentId: id,
        action: 'DELETED',
        performedBy: 'system',
        details: JSON.stringify({
          fileName: existing.fileName,
          fileSize: existing.fileSize,
          fileType: existing.fileType,
          title: existing.title,
          documentNumber: existing.documentNumber,
          version: existing.version,
          reason: 'Document archived (soft delete)',
          filePreserved: true,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Document "${existing.title}" archived successfully. File preserved on disk for audit.`,
      document: archived,
    })
  } catch (error) {
    console.error('Document DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
