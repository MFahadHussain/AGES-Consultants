import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { createHash } from 'crypto'
import path from 'path'

// ============================================================
// Document Upload API
// POST /api/documents/upload — Upload a file and create document metadata
// Accepts multipart/form-data with file + metadata fields
// ============================================================

// CNIC format: XXXXX-XXXXXXX-X (5 digits, 7 digits, 1 digit)
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/

const DEFAULT_MAX_FILE_SIZE_KB = 5120 // 5MB

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
 * Validate that the file format is allowed by the document type settings.
 */
function isFormatAllowed(allowedFormats: string, fileExtension: string): boolean {
  const allowed = allowedFormats
    .split(',')
    .map((f) => f.trim().toLowerCase())
  return allowed.includes(fileExtension.toLowerCase())
}

// ---------------------------------------------------------------------------
// POST /api/documents/upload
// Multipart form fields:
//   file            (required) — The file to upload
//   employeeId      (required) — Employee ID
//   documentTypeId  (required) — Document type ID
//   title           (required) — Document title
//   documentNumber  (optional)
//   issueDate       (optional)
//   expiryDate      (optional)
//   notes           (optional)
//   uploadedBy      (optional) — User who uploaded
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Extract file
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Extract metadata fields
    const employeeId = (formData.get('employeeId') as string) || ''
    const documentTypeId = (formData.get('documentTypeId') as string) || ''
    const title = (formData.get('title') as string) || ''
    const documentNumber = (formData.get('documentNumber') as string) || ''
    const issueDate = (formData.get('issueDate') as string) || ''
    const expiryDate = (formData.get('expiryDate') as string) || ''
    const notes = (formData.get('notes') as string) || ''
    const uploadedBy = (formData.get('uploadedBy') as string) || 'system'

    // Validate required fields
    if (!employeeId || !documentTypeId || !title) {
      return NextResponse.json(
        { error: 'employeeId, documentTypeId, and title are required' },
        { status: 400 }
      )
    }

    // Verify employee exists and get employeeCode
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, employeeCode: true, name: true },
    })
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Verify document type exists
    const documentType = await db.documentType.findUnique({
      where: { id: documentTypeId },
    })
    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      )
    }

    // Validate file size
    const maxSizeKB = documentType.maxFileSizeKB || DEFAULT_MAX_FILE_SIZE_KB
    const maxFileSizeBytes = maxSizeKB * 1024
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        {
          error: `File size (${Math.round(file.size / 1024)}KB) exceeds maximum allowed size (${maxSizeKB}KB)`,
        },
        { status: 400 }
      )
    }

    // Validate file format
    const fileExtension = getFileExtension(file.name)
    if (!isFormatAllowed(documentType.allowedFormats, fileExtension)) {
      return NextResponse.json(
        {
          error: `File format "${fileExtension}" is not allowed. Allowed formats: ${documentType.allowedFormats}`,
        },
        { status: 400 }
      )
    }

    // For CNIC documents, validate document number format
    if (
      documentNumber &&
      (documentType.code === 'CNIC_FRONT' || documentType.code === 'CNIC_BACK')
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

    // Read file into buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Compute file hash
    const fileHash = computeFileHash(buffer)

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFileName = `EMP-${employee.employeeCode}-${documentType.code}-${timestamp}.${fileExtension}`

    // Ensure upload directory exists
    const uploadDir = path.join(
      '/home/z/my-project/uploads/employee-docs'
    )
    await mkdir(uploadDir, { recursive: true })

    // Write file to disk
    const filePath = path.join(uploadDir, sanitizedFileName)
    await writeFile(filePath, buffer)

    // Auto-increment version: find the latest version for this employee + document type
    const latestDoc = await db.employeeDocument.findFirst({
      where: {
        employeeId,
        documentTypeId,
        isArchived: false,
      },
      orderBy: { version: 'desc' },
    })

    const nextVersion = latestDoc ? latestDoc.version + 1 : 1

    // Create the document record
    const document = await db.employeeDocument.create({
      data: {
        employeeId,
        documentTypeId,
        title,
        documentNumber: documentNumber || null,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
        fileName: file.name, // Original file name
        filePath: `uploads/employee-docs/${sanitizedFileName}`, // Relative path for DB
        fileSize: file.size,
        fileType: file.type || fileExtension,
        fileHash,
        version: nextVersion,
        previousVersionId: latestDoc?.id || null,
        uploadedBy,
      },
      include: {
        documentType: true,
      },
    })

    // Create audit log entry
    await db.documentAuditLog.create({
      data: {
        documentId: document.id,
        action: 'UPLOADED',
        performedBy: uploadedBy,
        details: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || fileExtension,
          fileHash,
          version: nextVersion,
          title,
          documentNumber: documentNumber || null,
          storedAs: sanitizedFileName,
        }),
      },
    })

    // Return the document with documentType, but don't expose full server path
    const safeDocument = {
      ...document,
      filePath: document.filePath, // Relative path is fine to return
    }

    return NextResponse.json(safeDocument, { status: 201 })
  } catch (error) {
    console.error('Document Upload POST error:', error)
    let message = 'Failed to upload document'
    if (error instanceof Error) {
      message = error.message
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
