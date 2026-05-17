import type { Metadata } from 'next'
import { SettingsModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Settings',
}

export default function SettingsModulePage() {
  return <SettingsModuleClient />
}
