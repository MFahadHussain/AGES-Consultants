import type { Metadata } from 'next'
import { LoginPageWrapper } from '@/components/auth/login-page-wrapper'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to Fahad ERP',
}

export default function LoginPage() {
  return <LoginPageWrapper />
}
