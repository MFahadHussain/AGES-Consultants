import { AsyncLocalStorage } from 'async_hooks'

export const auditContext = new AsyncLocalStorage<{
  userId?: string;
  username?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  actionTypeOverride?: string;
  comment?: string;
}>()
