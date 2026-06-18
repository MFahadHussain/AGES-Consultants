import { db } from './db'
import { unstable_cache } from 'next/cache'

// Internal function to fetch user permissions from DB
async function fetchUserPermissions(userId: string): Promise<Set<string>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                where: { isGranted: true },
                include: { permission: true }
              }
            }
          }
        }
      },
      userPermissions: {
        include: { permission: true }
      }
    }
  })

  if (!user || !user.isActive) return new Set<string>()

  const isSuperAdmin = user.userRoles.some(
    ur => (ur.role.code === 'SUPER_ADMIN' || ur.role.code === 'SYSTEM_ADMIN') && ur.role.isActive
  )

  const permissions = new Set<string>()

  // If super admin, fetch all active permissions and grant them
  if (isSuperAdmin) {
    const allPerms = await db.permission.findMany({ where: { isActive: true } })
    allPerms.forEach(p => permissions.add(p.code))
    return permissions
  }

  // Collect role-based permissions
  for (const ur of user.userRoles) {
    if (!ur.role.isActive) continue
    for (const rp of ur.role.rolePermissions) {
      if (rp.permission.isActive) {
        permissions.add(rp.permission.code)
      }
    }
  }

  // Collect user-level overrides
  for (const up of user.userPermissions) {
    if (!up.permission.isActive) continue
    
    // Check expiration
    if (up.expiresAt && new Date(up.expiresAt) < new Date()) {
      continue
    }

    if (up.isGranted) {
      permissions.add(up.permission.code)
    } else {
      // Explicit deny overrides role grants
      permissions.delete(up.permission.code)
    }
  }

  return permissions
}

// Cached wrapper around the permission fetcher
// Using Next.js unstable_cache to cache the result per user, invalidated by tags
const getCachedUserPermissions = unstable_cache(
  async (userId: string) => {
    const perms = await fetchUserPermissions(userId)
    return Array.from(perms) // Convert to array for JSON serialization
  },
  ['user-permissions-cache'], // key parts
  { tags: ['permissions'] } // tag for invalidation
)

/**
 * Server-side permission check.
 * Use this in API routes or Server Components.
 */
export async function hasPermission(userId: string | null | undefined, permissionCode: string): Promise<boolean> {
  if (!userId) return false

  try {
    const permissionsArray = await getCachedUserPermissions(userId)
    return permissionsArray.includes(permissionCode)
  } catch (error) {
    console.error(`Permission check failed for user ${userId}, permission ${permissionCode}:`, error)
    return false // Deny by default
  }
}

/**
 * Check multiple permissions at once (returns true if ANY match)
 */
export async function hasAnyPermission(userId: string | null | undefined, permissionCodes: string[]): Promise<boolean> {
  if (!userId) return false
  
  try {
    const permissionsArray = await getCachedUserPermissions(userId)
    return permissionCodes.some(code => permissionsArray.includes(code))
  } catch {
    return false
  }
}

/**
 * Check multiple permissions at once (returns true only if ALL match)
 */
export async function hasAllPermissions(userId: string | null | undefined, permissionCodes: string[]): Promise<boolean> {
  if (!userId) return false
  
  try {
    const permissionsArray = await getCachedUserPermissions(userId)
    return permissionCodes.every(code => permissionsArray.includes(code))
  } catch {
    return false
  }
}

/**
 * Revalidate the permissions cache globally.
 * Call this whenever a role, permission, or user assignment is changed.
 */
export async function revalidatePermissionsCache() {
  const { revalidateTag } = await import('next/cache')
  revalidateTag('permissions')
}
