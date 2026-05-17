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
