'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalSearch } from '@/components/layout/global-search'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react'

// ── Forced Password Change Dialog ─────────────────────────────────────────────

function ForcedPasswordChangeDialog({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false })
  const [loading, setLoading] = useState(false)

  const checks = {
    minLength: form.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(form.newPassword),
    lowercase: /[a-z]/.test(form.newPassword),
    number: /[0-9]/.test(form.newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.newPassword),
    match: form.confirmPassword.length > 0 && form.newPassword === form.confirmPassword,
  }

  const allMet = Object.values(checks).every(v => v)

  const handleSubmit = useCallback(async () => {
    if (!allMet) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          currentPassword: '__force_change__',
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
          forceChange: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Password Set', description: 'Your password has been set successfully.' })
        onComplete()
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to set password', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to set password', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [userId, form, allMet, onComplete, toast])

  return (
    <Dialog open={true} onOpenChange={() => { /* cannot dismiss */ }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Set Your Password
          </DialogTitle>
          <DialogDescription className="text-xs">
            You must set a new password before accessing the system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-amber-50 border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-amber-800">Password Change Required</p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Your account requires a password change. You cannot access the system until you set a new password.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New Password</Label>
            <div className="relative">
              <Input
                type={showPasswords.new ? 'text' : 'password'}
                className="h-9 text-sm pr-10"
                placeholder="Enter new password"
                value={form.newPassword}
                onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
                autoFocus
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.newPassword.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                {Object.entries(checks).map(([key, met]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    {met ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-gray-300 shrink-0" />}
                    <span className={`text-[10px] ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {key === 'minLength' ? 'At least 8 characters' :
                       key === 'uppercase' ? 'One uppercase letter' :
                       key === 'lowercase' ? 'One lowercase letter' :
                       key === 'number' ? 'One number' :
                       key === 'special' ? 'One special character' :
                       'Passwords match'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showPasswords.confirm ? 'text' : 'password'}
                className="h-9 text-sm pr-10"
                placeholder="Re-enter new password"
                value={form.confirmPassword}
                onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <Button className="w-full h-9 text-xs" onClick={handleSubmit} disabled={loading || !allMet}>
          {loading ? 'Setting Password...' : 'Set Password & Continue'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen, authUser, setAuthUser } = useAppStore()
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathname = usePathname()
  const lastUserIdRef = useRef<string | null>(null)
  const [forcePasswordResolved, setForcePasswordResolved] = useState(false)

  // Track user changes to reset force password state
  if (authUser?.id !== lastUserIdRef.current) {
    lastUserIdRef.current = authUser?.id ?? null
    if (forcePasswordResolved) {
      setForcePasswordResolved(false)
    }
  }

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authUser) {
      router.replace('/login')
    }
  }, [authUser, router])

  // On mobile, auto-close sidebar when route changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [pathname, isMobile, setSidebarOpen])

  // Show spinner while redirecting (not logged in)
  if (!authUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A7A4A] border-t-transparent" />
      </div>
    )
  }

  const needsPasswordChange = authUser.forcePasswordChange && !forcePasswordResolved

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:block print:overflow-visible bg-background print:bg-white">
      {/* Desktop Sidebar */}
      {!isMobile && <div className="print:hidden h-full flex-shrink-0"><Sidebar /></div>}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-w-0 print:block print:h-auto print:overflow-visible">
        <div className="print:hidden">
          <Header
            onSearchOpen={() => {}}
            authUser={authUser}
            onLogout={() => {
              setAuthUser(null)
              router.replace('/login')
            }}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:h-auto print:p-0 print:block print:!bg-transparent" style={{ background: '#F5F7FA' }}>
          {children}
        </main>
        <footer className="border-t px-5 py-2.5 bg-white shrink-0 print:border-none print:mt-12 print:bg-transparent" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between text-[10px]" style={{ color: '#6B7280' }}>
            <span>AcctFin ERP v1.0.0 &bull; Accounting &amp; Financial Management System</span>
            <span className="hidden sm:inline print:inline">Multi-Project &bull; Multi-Donor &bull; Multi-Currency &bull; Multi-Location</span>
          </div>
        </footer>
      </div>

      <GlobalSearch />

      {needsPasswordChange && (
        <ForcedPasswordChangeDialog
          userId={authUser.id}
          onComplete={() => {
            setForcePasswordResolved(true)
            setAuthUser({ ...authUser, forcePasswordChange: false })
          }}
        />
      )}
    </div>
  )
}
