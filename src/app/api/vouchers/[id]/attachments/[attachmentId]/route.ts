import { withAudit } from '@/lib/audit-wrapper'
import { NextResponse } from 'next/server'
import { db, getSystemUserId } from '@/lib/db'
import { readFile, unlink } from 'fs/promises'
import path from 'path'

// ============================================================
// Single Attachment API - Download & Delete
// Security: Serve files through API (not public), validate access
// ============================================================

// GET: Download a single attachment
async function GET_HANDLER(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params

    const attachment = await db.voucherAttachment.findUnique({
      where: { id: attachmentId },
      include: { voucher: { select: { id: true } } },
    })

    if (!attachment || attachment.voucherId !== id) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Read file from disk
    const fullPath = path.join(process.cwd(), attachment.filePath)
    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(fullPath)
    } catch {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
    }

    // Determine content type
    const contentType = attachment.mimeType || 'application/octet-stream'

    // Return file with proper headers for download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('GET attachment error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}


// DELETE: Remove an attachment
async function DELETE_HANDLER(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params
    const { searchParams } = new URL(request.url)
    const systemUserId = await getSystemUserId()
    const userId = searchParams.get('userId') || systemUserId

    const attachment = await db.voucherAttachment.findUnique({
      where: { id: attachmentId },
      include: { voucher: { select: { id: true, status: true } } },
    })

    if (!attachment || attachment.voucherId !== id) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Only allow deletion for draft/rejected/pending vouchers
    if (attachment.voucher.status === 'posted') {
      return NextResponse.json(
        { error: 'Cannot delete attachments from posted vouchers. Revoke the voucher first.' },
        { status: 400 }
      )
    }

    // Delete file from disk
    try {
      const fullPath = path.join(process.cwd(), attachment.filePath)
      await unlink(fullPath)
    } catch (fileError) {
      console.error('File deletion error (non-critical):', fileError)
      // Continue to delete DB record even if file is already gone
    }

    // Delete from database
    await db.voucherAttachment.delete({ where: { id: attachmentId } })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: userId,
          action: 'DELETE',
          entity: 'VoucherAttachment',
          entityId: attachmentId,
          details: `Deleted attachment "${attachment.fileName}" from voucher`,
        },
      })
    } catch (auditError) {
      console.error('Audit log error (non-critical):', auditError)
    }

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  } catch (error) {
    console.error('DELETE attachment error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export const DELETE = withAudit('vouchers', DELETE_HANDLER);

export const GET = withAudit('vouchers', GET_HANDLER);
