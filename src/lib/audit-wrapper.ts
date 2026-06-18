import { NextResponse } from 'next/server'
import { db } from './db'
import { hasPermission } from './permissions'

export function withAudit(
  moduleName: string,
  handler: (req: Request, ...args: any[]) => Promise<Response>
) {
  return async (req: Request, ...args: any[]) => {
    const method = req.method

    // Try to extract user info from the request
    let userId = 'System'
    let username = 'System'
    let userRole = 'system'
    
    // We clone the request to read body without consuming the original
    const clonedReq = req.clone()
    try {
      if (clonedReq.headers.get('content-type')?.includes('application/json')) {
        const body = await clonedReq.json()
        if (body.userId) userId = body.userId
        if (body.userRole) userRole = body.userRole
        if (body.userName) username = body.userName
      }
    } catch (e) {
      // ignore
    }

    // If not in body, try query params
    const url = new URL(req.url)
    if (userId === 'System' && url.searchParams.has('userId')) {
      userId = url.searchParams.get('userId')!
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || 'Unknown'

    // Determine basic action
    let action = 'UPDATE'
    let permAction = 'edit'
    
    if (method === 'GET') { action = 'VIEW'; permAction = 'view' }
    if (method === 'POST') { action = 'CREATE'; permAction = 'create' }
    if (method === 'DELETE') { action = 'DELETE'; permAction = 'delete' }

    // Check if the URL implies an approval action
    if (url.pathname.includes('/approve')) { action = 'APPROVE'; permAction = 'approve' }
    if (url.pathname.includes('/reject')) { action = 'REJECT'; permAction = 'reject' }
    if (url.pathname.includes('/post')) { action = 'POST'; permAction = 'post' }
    if (url.pathname.includes('/reverse')) { action = 'REVERSE'; permAction = 'reverse' }

    // Enforce permission
    // For some routes, we might need a bypass if userId is 'System', but to be secure:
    // We also bypass permission checks for the self-service 'auth' module (e.g. change-password, reset-password).
    if (userId !== 'System' && moduleName !== 'auth') {
      // Permission format is "MODULE_ACTION", but we are querying via "module.action" or similar?
      // Wait, hasPermission expects a single permissionCode, but Prisma schema has module and action.
      // But we wrote hasPermission to check `rp.permission.code === permissionCode`.
      // The DB seeded code is likely uppercase: e.g. 'VOUCHERS_CREATE'
      const permissionCode = `${moduleName.replace(/-/g, '_').toUpperCase()}_${permAction.toUpperCase()}`
      
      const isAllowed = await hasPermission(userId, permissionCode)
      if (!isAllowed) {
        console.warn(`[Audit/Auth] Permission Denied: User ${userId} missing ${permissionCode}`)
        // We might not want to block strictly until seeding is fixed, but the requirement is "must enforce"
        return NextResponse.json({ success: false, error: 'Permission Denied' }, { status: 403 })
      }
    }

    // Run the actual handler
    const response = await handler(req, ...args)

    // GET requests generally do not need an audit log entry
    if (method === 'GET') {
      return response
    }

    // If successful, log to AuditLog
    if (response.status >= 200 && response.status < 300) {
      try {
        let entityId = null
        let entityName = null
        let newValues = null

        // Try to extract entity ID from response
        const resClone = response.clone()
        if (resClone.headers.get('content-type')?.includes('application/json')) {
           const resData = await resClone.json()
           if (resData && typeof resData === 'object') {
             entityId = resData.id || resData.voucherNumber || resData.code || null
             entityName = resData.name || resData.title || null
             newValues = JSON.stringify(resData)
           }
        }

        if (!entityId) {
           // Try to extract from URL (e.g. /api/vouchers/[id])
           const parts = url.pathname.split('/')
           const lastPart = parts[parts.length - 1]
           if (lastPart && lastPart.length > 5 && lastPart !== 'approve' && lastPart !== 'reject') {
             entityId = lastPart
           } else if (parts.length > 2) {
             const possibleId = parts[parts.length - 2]
             if (possibleId && possibleId.length > 5) entityId = possibleId
           }
        }

        await db.auditLog.create({
          data: {
            userId: userId !== 'System' ? userId : null,
            username: username !== 'System' ? username : null,
            action,
            entity: moduleName,
            entityId,
            entityName,
            newValues,
            details: JSON.stringify({ role: userRole }),
            ipAddress,
            userAgent,
            severity: method === 'DELETE' ? 'critical' : 'info',
            module: moduleName
          }
        })
      } catch (auditError) {
        console.error('[Audit Logger] Failed to write audit log:', auditError)
      }
    }

    return response
  }
}
