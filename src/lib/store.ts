import { create } from "zustand";

// Keep ModuleKey exported for backward compat but as a string alias
export type ModuleKey = string;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  branchId: string | null;
  departmentId: string | null;
  employeeId: string | null;
  designation: string | null;
  forcePasswordChange: boolean;
  createdAt: string;
  roles?: { id: string; code: string; name: string; isPrimary: boolean }[];
  effectivePermissions?: { permissionId: string; code: string; name: string; module: string; action: string; resource: string; isGranted: boolean; source: string }[];
}

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  authUser: AuthUser | null;
  setAuthUser: (user: AuthUser | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  authUser: null,
  setAuthUser: (user) => set({ authUser: user }),
}));

export function hasPermission(authUser: AuthUser | null | undefined, permissionCode: string): boolean {
  if (!authUser) return false;
  
  // Super Admin/System Admin bypass
  const isSuperAdmin = authUser.roles?.some(r => r.code === 'SUPER_ADMIN' || r.code === 'SYSTEM_ADMIN') || authUser.role === 'super_admin' || authUser.role === 'system_admin' || authUser.role === 'admin';
  if (isSuperAdmin) return true;
  
  if (!authUser.effectivePermissions) return false;
  return authUser.effectivePermissions.some(p => p.code === permissionCode && p.isGranted);
}
