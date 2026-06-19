'use client'

import { useState, useCallback } from 'react'
import { Mail, Eye, EyeOff, AlertCircle, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react'
import { BRAND } from '@/lib/config/branding'

// ─── Props ───────────────────────────────────────────────────────────────────
interface LoginPageProps {
  onLoginSuccess: (user: {
    id: string
    email: string
    name: string
    username: string | null
    phone: string | null
    role: string
    isActive: boolean
    isLocked: boolean
    avatarUrl: string | null
    lastLoginAt: string | null
    lastLoginIp: string | null
    branchId: string | null
    departmentId: string | null
    employeeId: string | null
    designation: string | null
    forcePasswordChange: boolean
    createdAt: string
    roles?: { id: string; code: string; name: string; isPrimary: boolean }[]
  }) => void
}

// ─── Validation helpers ──────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(v: string) {
  if (!v) return ''
  return EMAIL_RE.test(v) ? '' : 'Please enter a valid email address'
}

function validatePassword(v: string) {
  if (!v) return ''
  return v.length >= 8 ? '' : 'Password must be at least 8 characters'
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Validation
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [alertKey, setAlertKey] = useState(0)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('Invalid credentials. Please check your email and password.')

  // Forgot password overlay
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Clear errors & alert on any input change (handled inline in onChange)

  // ─── Sign in handler ────────────────────────────────────────────────────
  const handleSignIn = useCallback(async () => {
    // Run validation
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)

    if (!email) setEmailError('Please enter a valid email address')
    else if (eErr) setEmailError(eErr)

    if (!password) setPasswordError('Password must be at least 8 characters')
    else if (pErr) setPasswordError(pErr)

    if (!email || !password || eErr || pErr) return

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      })

      const data = await res.json()

      if (res.status === 401 || res.status === 403) {
        // Show specific error message from the server
        setAlertMessage(data.error || 'Invalid credentials. Please check your email and password.')
        setShowAlert(true)
        setAlertKey(k => k + 1)
        setLoading(false)
        return
      }

      if (res.ok && data.success && data.data?.user) {
        onLoginSuccess(data.data.user)
        return
      }

      // Unexpected error
      setAlertMessage('An unexpected error occurred. Please try again.')
      setShowAlert(true)
      setAlertKey(k => k + 1)
      setLoading(false)
    } catch {
      setAlertMessage('Network error. Please check your connection.')
      setShowAlert(true)
      setAlertKey(k => k + 1)
      setLoading(false)
    }
  }, [email, password, rememberMe, onLoginSuccess])

  // ─── Reset password handler ─────────────────────────────────────────────
  const sendReset = useCallback(async () => {
    if (!resetEmail || !EMAIL_RE.test(resetEmail)) return
    setResetLoading(true)

    // Backend Integration: sendReset() should call:
    //   POST /api/auth/reset-password with { email }
    try {
      await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
    } catch {
      // Silently handle — always show success to prevent email enumeration
    }

    setResetSent(true)
    setResetLoading(false)
  }, [resetEmail])

  // ─── Keyboard submit ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) handleSignIn()
    },
    [handleSignIn, loading]
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-8">
      {/* ── Card ───────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[420px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* ── Brand block ──────────────────────────────────────────────── */}
        <div className="flex flex-col items-center pt-8 pb-6 border-b border-slate-100">
          {/* Logo Image */}
          <img
            src={BRAND.logoPath}
            alt={BRAND.companyName}
            className="h-16 w-auto object-contain"
          />

          {/* Product name */}
          <h1 className="mt-4 text-[18px] font-semibold tracking-tight text-slate-900">
            <span className="text-[#0F2D78]">AGES </span>Consultants
          </h1>

          {/* Tagline */}
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Accounting &amp; Finance System
          </p>
          {/* Tagline */}
          <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.12em] text-slate-400">
            Engineered by Fahad Hussain
          </p>
        </div>

        {/* ── Form area ────────────────────────────────────────────────── */}
        <div className="px-7 pt-6 pb-7">
          {/* Invalid-credentials alert */}
          {showAlert && (
            <div
              key={alertKey}
              className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[13px] text-red-700 animate-[slideDownFade_0.25s_ease-out]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{alertMessage}</span>
            </div>
          )}

          {/* Section heading */}
          <h2 className="text-[17px] font-semibold text-slate-900">
            Sign in to your account
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Enter your credentials to access the system
          </p>

          {/* ── Email ──────────────────────────────────────────────────── */}
          <div className="mt-5">
            <label
              htmlFor="login-email"
              className="block text-[13px] font-medium text-slate-700 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  setEmailError('')
                  setShowAlert(false)
                }}
                onKeyDown={handleKeyDown}
                placeholder="name@company.com"
                className={`h-10 w-full rounded-lg border bg-white px-3 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:ring-2 ${emailError
                  ? 'border-red-500 focus:ring-red-100'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                  }`}
              />
              <Mail className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            {/* Error */}
            <div
              className={`flex items-center gap-1 mt-1 transition-all duration-200 ${emailError
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
            >
              <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
              <span className="text-[12px] text-red-600">{emailError}</span>
            </div>
          </div>

          {/* ── Password ───────────────────────────────────────────────── */}
          <div className="mt-4">
            <label
              htmlFor="login-password"
              className="block text-[13px] font-medium text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  setPasswordError('')
                  setShowAlert(false)
                }}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                className={`h-10 w-full rounded-lg border bg-white px-3 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:ring-2 ${passwordError
                  ? 'border-red-500 focus:ring-red-100'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                  }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {/* Error */}
            <div
              className={`flex items-center gap-1 mt-1 transition-all duration-200 ${passwordError
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1 pointer-events-none'
                }`}
            >
              <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
              <span className="text-[12px] text-red-600">{passwordError}</span>
            </div>
          </div>

          {/* ── Remember me + Forgot password ──────────────────────────── */}
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-blue-600"
              />
              <span className="text-[13px] text-slate-600">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowForgot(true)
                setResetSent(false)
                setResetEmail('')
              }}
              className="text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* ── Sign In button ──────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 h-[42px] rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-[14px] font-medium transition-all disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>



          {/* ── Security badge ──────────────────────────────────────────── */}
          <div className="border-t border-slate-50 mt-5 pt-4">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">
                Secured with 256-bit TLS encryption
              </span>
            </div>
          </div>
        </div>

        {/* ── Forgot password overlay ────────────────────────────────────── */}
        <div
          className={`absolute inset-0 bg-white/[0.97] rounded-2xl flex flex-col transition-opacity duration-200 ${showForgot
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
            }`}
        >
          <div className="flex-1 flex flex-col px-7 pt-8 pb-7">
            {/* Back button */}
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="flex items-center gap-1 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>

            <h2 className="text-[17px] font-semibold text-slate-900">
              Reset your password
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {/* Success alert */}
            {resetSent && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#EEF1F8] border border-[#A5B4D2] px-3 py-2.5 text-[13px] text-[#0A1F54]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#1E3C87]" />
                <span>Reset link sent — check your inbox</span>
              </div>
            )}

            {/* Reset email input */}
            <div className="mt-5">
              <label
                htmlFor="reset-email"
                className="block text-[13px] font-medium text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !resetLoading) sendReset()
                  }}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <Mail className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Send reset button */}
            <button
              type="button"
              onClick={sendReset}
              disabled={resetLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 h-[42px] rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-[14px] font-medium transition-all disabled:opacity-80 disabled:cursor-not-allowed"
            >
              {resetLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Page footer ──────────────────────────────────────────────────── */}
      <div className="mt-6 text-center font-mono text-[11px] text-slate-400 leading-relaxed">
        <div>v1.0.0 &bull; Multi-Project &bull; Multi-Client</div>
        <div>Multi-Currency &bull; Multi-Location</div>
        <div>Engineered by Fahad Hussain</div>

      </div>

    </div>
  )
}
