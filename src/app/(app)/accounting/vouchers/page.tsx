import type { Metadata } from 'next'
import { VoucherManagementClient } from './_client'

export const metadata: Metadata = {
  title: 'Voucher Management',
}

export default function VoucherManagementPage() {
  return <VoucherManagementClient />
}
