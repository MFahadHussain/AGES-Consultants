'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import LoginPage from '@/components/auth/LoginPage'

export function LoginPageWrapper() {
  const { setAuthUser, authUser } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (authUser) {
      router.replace('/dashboard')
    }
  }, [authUser, router])

  return (
    <LoginPage
      onLoginSuccess={(user) => {
        setAuthUser(user)
        router.replace('/dashboard')
      }}
    />
  )
}
