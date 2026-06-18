import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// Document Types API
// GET  /api/document-types — List all active document types (with optional document counts)
// POST /api/document-types — Create a new custom document type
// ============================================================

const DEFAULT_DOCUMENT_TYPES = [
  { code: 'CNIC_FRONT', name: 'CNIC (Front)', isRequired: true, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png', maxFileSizeKB: 5120, sortOrder: 1 },
  { code: 'CNIC_BACK', name: 'CNIC (Back)', isRequired: true, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png', maxFileSizeKB: 5120, sortOrder: 2 },
  { code: 'APPOINTMENT_LETTER', name: 'Appointment Letter', isRequired: true, hasExpiry: false, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 3 },
  { code: 'EMPLOYMENT_CONTRACT', name: 'Employment Contract', isRequired: true, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 4 },
  { code: 'PASSPORT', name: 'Passport', isRequired: false, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png', maxFileSizeKB: 5120, sortOrder: 5 },
  { code: 'DRIVING_LICENSE', name: 'Driving License', isRequired: false, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png', maxFileSizeKB: 5120, sortOrder: 6 },
  { code: 'EDUCATIONAL_CERT', name: 'Educational Certificate', isRequired: false, hasExpiry: false, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 7 },
  { code: 'EXPERIENCE_LETTER', name: 'Experience Letter', isRequired: false, hasExpiry: false, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 8 },
  { code: 'MEDICAL_CERT', name: 'Medical Certificate', isRequired: false, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 9 },
  { code: 'NTN_REGISTRATION', name: 'Tax Registration (NTN)', isRequired: false, hasExpiry: false, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 10 },
  { code: 'BANK_ACCOUNT_LETTER', name: 'Bank Account Letter', isRequired: false, hasExpiry: false, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 11 },
  { code: 'POLICE_CLEARANCE', name: 'Police Clearance Certificate', isRequired: false, hasExpiry: true, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc', maxFileSizeKB: 5120, sortOrder: 12 },
  { code: 'OTHER', name: 'Other', isRequired: false, hasExpiry: false, allowedFormats: 'pdf,jpg,jpeg,png,docx,doc,xls,xlsx', maxFileSizeKB: 5120, sortOrder: 99 },
]

// ---------------------------------------------------------------------------
// GET /api/document-types
// Query params:
//   employeeId (optional) — if provided, include document counts per type for this employee
// ---------------------------------------------------------------------------
async function GET_HANDLER(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')?.trim() || ''

    // Seed default document types if none exist
    const existingCount = await db.documentType.count()
    if (existingCount === 0) {
      for (const dt of DEFAULT_DOCUMENT_TYPES) {
        await db.documentType.create({ data: dt })
      }
    }

    // Fetch all active document types sorted by sortOrder
    const documentTypes = await db.documentType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // If employeeId is provided, compute document counts per type
    if (employeeId) {
      const documents = await db.employeeDocument.findMany({
        where: {
          employeeId,
          isArchived: false,
        },
        select: {
          documentTypeId: true,
        },
      })

      // Build a count map: documentTypeId -> count
      const countMap: Record<string, number> = {}
      for (const doc of documents) {
        countMap[doc.documentTypeId] = (countMap[doc.documentTypeId] || 0) + 1
      }

      // Attach counts to each document type
      const enriched = documentTypes.map((dt) => ({
        ...dt,
        documentCount: countMap[dt.id] || 0,
      }))

      return NextResponse.json(enriched)
    }

    return NextResponse.json(documentTypes)
  } catch (error) {
    console.error('DocumentTypes GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document types' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/document-types — Create a new custom document type
// Body: { name, code, isRequired?, hasExpiry?, allowedFormats?, maxFileSizeKB?, sortOrder? }
// ---------------------------------------------------------------------------
async function POST_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Validate unique name
    const existingName = await db.documentType.findUnique({
      where: { name: body.name },
    })
    if (existingName) {
      return NextResponse.json(
        { error: `Document type with name "${body.name}" already exists` },
        { status: 409 }
      )
    }

    // Validate unique code
    const existingCode = await db.documentType.findUnique({
      where: { code: body.code },
    })
    if (existingCode) {
      return NextResponse.json(
        { error: `Document type with code "${body.code}" already exists` },
        { status: 409 }
      )
    }

    const documentType = await db.documentType.create({
      data: {
        name: body.name,
        code: body.code.toUpperCase(),
        isRequired: body.isRequired === true,
        hasExpiry: body.hasExpiry === true,
        allowedFormats: body.allowedFormats || 'pdf,jpg,jpeg,png,docx,doc',
        maxFileSizeKB: body.maxFileSizeKB || 5120,
        sortOrder: body.sortOrder ?? 100,
        isActive: true,
      },
    })

    return NextResponse.json(documentType, { status: 201 })
  } catch (error) {
    console.error('DocumentTypes POST error:', error)
    let message = 'Failed to create document type'
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      message = 'A document type with this name or code already exists'
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAudit('document-types', POST_HANDLER);

export const GET = withAudit('document-types', GET_HANDLER);
