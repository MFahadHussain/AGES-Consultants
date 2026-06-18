import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// ============================================================
// Voucher Attachment API - List & Upload
// Security: File type validation, size limits, sanitized filenames
// ============================================================

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES_PER_VOUCHER = 10

function sanitizeFileName(name: string): string {
  // Remove path traversal and special characters
  return name
    .replace(/[^\w\s.-]/g, '')
    .replace(/\.\./g, '')
    .replace(/[\\/]/g, '_')
    .trim()
}

function validateFileExtension(fileName: string, mimeType: string): boolean {
  const ext = path.extname(fileName).toLowerCase()
  const allowedExtensions = ALLOWED_MIME_TYPES[mimeType]
  if (!allowedExtensions) return false
  return allowedExtensions.includes(ext)
}

// GET: List all attachments for a voucher
async function GET_HANDLER(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const voucher = await db.voucher.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })

    const attachments = await db.voucherAttachment.findMany({
      where: { voucherId: id },
      orderBy: { createdAt: 'desc' },
    })

    // Don't expose full server paths to client
    const safeAttachments = attachments.map(a => ({
      ...a,
      filePath: undefined, // Never expose server path
      downloadUrl: `/api/vouchers/${id}/attachments/${a.id}`,
    }))

    return NextResponse.json(safeAttachments)
  } catch (error) {
    console.error('GET attachments error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// POST: Upload attachments for a voucher
async function POST_HANDLER(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const systemUserId = await getSystemUserId()

    // Verify voucher exists
    const voucher = await db.voucher.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })

    // Check existing attachment count
    const existingCount = await db.voucherAttachment.count({ where: { voucherId: id } })
    if (existingCount >= MAX_FILES_PER_VOUCHER) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES_PER_VOUCHER} attachments per voucher reached` }, { status: 400 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const category = (formData.get('category') as string) || 'other'
    const description = (formData.get('description') as string) || null
    const uploadedBy = (formData.get('uploadedBy') as string) || systemUserId

    // Fetch user details for uploadedByName
    let uploadedByName = 'System User'
    if (uploadedBy && uploadedBy !== 'system') {
      const user = await db.user.findUnique({ where: { id: uploadedBy }, select: { name: true } })
      if (user) {
        uploadedByName = user.name
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (existingCount + files.length > MAX_FILES_PER_VOUCHER) {
      return NextResponse.json({ error: `Uploading ${files.length} files would exceed the limit of ${MAX_FILES_PER_VOUCHER} per voucher` }, { status: 400 })
    }

    // Validate category
    const validCategories = ['invoice', 'receipt', 'contract', 'other']
    const safeCategory = validCategories.includes(category) ? category : 'other'

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'vouchers', id)
    await mkdir(uploadDir, { recursive: true })

    const uploadedAttachments = []
    const errors = []

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push({ fileName: file.name, error: `File exceeds maximum size of 10MB` })
        continue
      }

      // Validate MIME type and extension
      const mimeType = file.type || 'application/octet-stream'
      if (!validateFileExtension(file.name, mimeType)) {
        errors.push({ fileName: file.name, error: `File type not allowed. Allowed: PDF, JPEG, PNG, GIF, DOC, DOCX, XLS, XLSX` })
        continue
      }

      // Sanitize filename and make unique
      const safeName = sanitizeFileName(file.name)
      const ext = path.extname(safeName)
      const baseName = path.basename(safeName, ext)
      const uniqueName = `${baseName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
      const filePath = path.join(uploadDir, uniqueName)

      // Write file to disk
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Save metadata to database
      try {
        const attachment = await db.voucherAttachment.create({
          data: {
            voucherId: id,
            fileName: safeName,
            filePath: `uploads/vouchers/${id}/${uniqueName}`, // Relative path
            fileSize: file.size,
            fileType: ext.replace('.', '').toUpperCase(),
            mimeType,
            category: safeCategory,
            description,
            uploadedBy: uploadedBy,
            uploadedByName: uploadedByName,
          },
        })

        uploadedAttachments.push({
          ...attachment,
          filePath: undefined, // Don't expose path
          downloadUrl: `/api/vouchers/${id}/attachments/${attachment.id}`,
        })
      } catch (dbError) {
        // If DB save fails, still keep the file but report error
        console.error('Attachment DB save error:', dbError)
        errors.push({ fileName: safeName, error: 'Failed to save file metadata' })
      }
    }

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          userId: uploadedBy,
          action: 'UPLOAD',
          entity: 'VoucherAttachment',
          entityId: id,
          details: `Uploaded ${uploadedAttachments.length} files to voucher${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
        },
      })
    } catch (auditError) {
      console.error('Audit log error (non-critical):', auditError)
    }

    return NextResponse.json({
      uploaded: uploadedAttachments,
      errors: errors.length > 0 ? errors : undefined,
      totalAttachments: existingCount + uploadedAttachments.length,
    }, { status: 201 })
  } catch (error) {
    console.error('POST attachments error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const POST = withAudit('vouchers', POST_HANDLER);

export const GET = withAudit('vouchers', GET_HANDLER);
