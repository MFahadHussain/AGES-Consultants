import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// Employee Documents API
// GET  /api/documents — List documents for an employee with status & summary
// POST /api/documents — Create document metadata (no file upload)
// ============================================================

// CNIC format: XXXXX-XXXXXXX-X (5 digits, 7 digits, 1 digit)
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/

type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'no-expiry' | 'missing'

interface DocumentWithType {
  id: string
  employeeId: string
  documentTypeId: string
  title: string
  documentNumber: string | null
  issueDate: Date | null
  expiryDate: Date | null
  notes: string | null
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  fileHash: string | null
  version: number
  previousVersionId: string | null
  isArchived: boolean
  uploadedBy: string
  createdAt: Date
  updatedAt: Date
  documentType: {
    id: string
    name: string
    code: string
    isRequired: boolean
    hasExpiry: boolean
    allowedFormats: string
    maxFileSizeKB: number
    sortOrder: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }
  status?: DocumentStatus
}

/**
 * Compute the status of a document based on its expiry date.
 * "expiring" = expires within 30 days from now.
 */
function computeDocumentStatus(
  expiryDate: Date | null,
  hasExpiry: boolean
): DocumentStatus {
  if (!hasExpiry) return 'no-expiry'
  if (!expiryDate) return 'missing'

  const now = new Date()
  const expiry = new Date(expiryDate)

  if (expiry < now) return 'expired'

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  if (expiry <= thirtyDaysFromNow) return 'expiring'

  return 'valid'
}

// ---------------------------------------------------------------------------
// GET /api/documents
// Query params:
//   employeeId     (required) — Employee ID to fetch documents for
//   includeExpired (optional) — Whether to include expired docs (default: true)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')?.trim() || ''
    const includeExpired = searchParams.get('includeExpired') !== 'false' // default true

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employeeId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify employee exists
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

    // Fetch all non-archived documents for this employee
    const documents = await db.employeeDocument.findMany({
      where: {
        employeeId,
        isArchived: false,
      },
      include: {
        documentType: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Compute status for each document
    const enrichedDocuments: DocumentWithType[] = documents.map((doc) => ({
      ...doc,
      status: computeDocumentStatus(doc.expiryDate, doc.documentType.hasExpiry),
    }))

    // Filter out expired documents if not included
    const filteredDocuments = includeExpired
      ? enrichedDocuments
      : enrichedDocuments.filter((doc) => doc.status !== 'expired')

    // Find missing required document types
    const allRequiredTypes = await db.documentType.findMany({
      where: { isRequired: true, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    const uploadedTypeIds = new Set(
      documents.map((doc) => doc.documentTypeId)
    )

    const missingRequired = allRequiredTypes.filter(
      (dt) => !uploadedTypeIds.has(dt.id)
    )

    // Compute summary
    const summary = {
      total: filteredDocuments.length,
      valid: filteredDocuments.filter((d) => d.status === 'valid').length,
      expiring: filteredDocuments.filter((d) => d.status === 'expiring').length,
      expired: filteredDocuments.filter((d) => d.status === 'expired').length,
      noExpiry: filteredDocuments.filter((d) => d.status === 'no-expiry').length,
      missing: missingRequired.length,
    }

    return NextResponse.json({
      documents: filteredDocuments,
      missingRequired,
      summary,
    })
  } catch (error) {
    console.error('Documents GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents — Create document metadata (no file upload)
// Body: { employeeId, documentTypeId, title, documentNumber?, issueDate?, expiryDate?,
//         notes?, fileName, filePath, fileSize, fileType }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.employeeId || !body.documentTypeId || !body.title) {
      return NextResponse.json(
        { error: 'employeeId, documentTypeId, and title are required' },
        { status: 400 }
      )
    }

    // Verify employee exists
    const employee = await db.employee.findUnique({
      where: { id: body.employeeId },
      select: { id: true, employeeCode: true },
    })
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Verify document type exists
    const documentType = await db.documentType.findUnique({
      where: { id: body.documentTypeId },
    })
    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      )
    }

    // For CNIC documents, validate document number format
    if (
      body.documentNumber &&
      (documentType.code === 'CNIC_FRONT' || documentType.code === 'CNIC_BACK')
    ) {
      if (!CNIC_REGEX.test(body.documentNumber)) {
        return NextResponse.json(
          {
            error:
              'CNIC number must be in format XXXXX-XXXXXXX-X (e.g., 35202-1234567-1)',
          },
          { status: 400 }
        )
      }
    }

    // Auto-increment version: find the latest version for this employee + document type
    const latestDoc = await db.employeeDocument.findFirst({
      where: {
        employeeId: body.employeeId,
        documentTypeId: body.documentTypeId,
        isArchived: false,
      },
      orderBy: { version: 'desc' },
    })

    const nextVersion = latestDoc ? latestDoc.version + 1 : 1

    // Create the document record
    const document = await db.employeeDocument.create({
      data: {
        employeeId: body.employeeId,
        documentTypeId: body.documentTypeId,
        title: body.title,
        documentNumber: body.documentNumber || null,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        notes: body.notes || null,
        fileName: body.fileName || '',
        filePath: body.filePath || '',
        fileSize: body.fileSize || 0,
        fileType: body.fileType || '',
        fileHash: body.fileHash || null,
        version: nextVersion,
        previousVersionId: latestDoc?.id || null,
        uploadedBy: body.uploadedBy || 'system',
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
        performedBy: body.uploadedBy || 'system',
        details: JSON.stringify({
          fileName: document.fileName,
          fileSize: document.fileSize,
          fileType: document.fileType,
          version: document.version,
          title: document.title,
          documentNumber: document.documentNumber,
        }),
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Documents POST error:', error)
    let message = 'Failed to create document'
    if (error instanceof Error) {
      message = error.message
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
