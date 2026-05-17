import type { Metadata } from 'next'
import { AttendanceModuleClient } from './_client'

export const metadata: Metadata = {
  title: 'Attendance',
}

export default function AttendanceModulePage() {
  return <AttendanceModuleClient />
}
