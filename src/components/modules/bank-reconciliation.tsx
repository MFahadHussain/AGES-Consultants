'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Landmark,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCheck,
  XCircle,
  Lock,
  Download,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(amount))
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

interface BankAccount {
  id: string
  code: string
  name: string
  accountType: string
  subType: string | null
}

interface VoucherItem {
  voucherId: string
  voucherNumber: string
  voucherType: string
  voucherTypeName: string
  date: string
  narration: string
  payeeName: string | null
  chequeNumber: string | null
  amount: number
  isReconciled: boolean
  clearanceDate: string | null
  status: string
}

export function BankReconciliation() {
  const { toast } = useToast()

  // ─── State ───────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [statementBalance, setStatementBalance] = useState<string>('')
  const [bookBalance, setBookBalance] = useState(0)
  const [payments, setPayments] = useState<VoucherItem[]>([])
  const [receipts, setReceipts] = useState<VoucherItem[]>([])
  const [checkedVoucherIds, setCheckedVoucherIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [lastReconciled, setLastReconciled] = useState<Record<string, { period: string; finalizedAt: string | null }>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isFinalized, setIsFinalized] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [activeTab, setActiveTab] = useState('payments')

  // Refs for stale closure safety
  const selectedAccountIdRef = useRef(selectedAccountId)
  const selectedPeriodRef = useRef(selectedPeriod)
  useEffect(() => { selectedAccountIdRef.current = selectedAccountId }, [selectedAccountId])
  useEffect(() => { selectedPeriodRef.current = selectedPeriod }, [selectedPeriod])

  // ─── Initialization ─────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/bank-reconciliation?action=init')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setBankAccounts(data.bankAccounts || [])
        setLastReconciled(data.lastReconciled || {})
      } catch (e) {
        console.error(e)
        toast({ title: 'Error', description: 'Failed to load bank accounts', variant: 'destructive' })
      }
      setInitializing(false)
    }
    queueMicrotask(() => init())
  }, [toast])

  // ─── Fetch data when account or period changes ──────────
  const fetchData = useCallback(async () => {
    if (!selectedAccountId || !selectedPeriod) return
    setLoading(true)
    try {
      // Fetch book balance
      const balanceRes = await fetch(`/api/bank-reconciliation?action=book-balance&accountId=${selectedAccountId}&period=${selectedPeriod}`)
      if (!balanceRes.ok) throw new Error('Failed to fetch balance')
      const balanceData = await balanceRes.json()
      setBookBalance(balanceData.bookBalance || 0)

      // Fetch vouchers
      const vouchersRes = await fetch(`/api/bank-reconciliation?action=vouchers&accountId=${selectedAccountId}&period=${selectedPeriod}`)
      if (!vouchersRes.ok) throw new Error('Failed to fetch vouchers')
      const vouchersData = await vouchersRes.json()
      setPayments(vouchersData.payments || [])
      setReceipts(vouchersData.receipts || [])

      // Pre-check reconciled vouchers
      const preChecked = new Set<string>()
      ;[...(vouchersData.payments || []), ...(vouchersData.receipts || [])].forEach((v: VoucherItem) => {
        if (v.isReconciled) {
          preChecked.add(v.voucherId)
        }
      })
      setCheckedVoucherIds(preChecked)

      // Check if this period is already finalized
      const statusRes = await fetch(`/api/bank-reconciliation?action=reconciliation-status&accountId=${selectedAccountId}&period=${selectedPeriod}`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setIsFinalized(statusData.reconciliation?.status === 'finalized')
      } else {
        setIsFinalized(false)
      }
    } catch (e) {
      console.error(e)
      toast({ title: 'Error', description: 'Failed to load reconciliation data', variant: 'destructive' })
    }
    setLoading(false)
  }, [selectedAccountId, selectedPeriod, toast])

  useEffect(() => {
    if (selectedAccountId && selectedPeriod) {
      fetchData()
    }
  }, [selectedAccountId, selectedPeriod, fetchData])

  // ─── Computed values ────────────────────────────────────
  const selectedAccount = useMemo(
    () => bankAccounts.find(a => a.id === selectedAccountId),
    [bankAccounts, selectedAccountId]
  )

  const filteredPayments = useMemo(
    () => payments.filter(p =>
      !searchQuery ||
      p.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.payeeName && p.payeeName.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [payments, searchQuery]
  )

  const filteredReceipts = useMemo(
    () => receipts.filter(r =>
      !searchQuery ||
      r.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.payeeName && r.payeeName.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [receipts, searchQuery]
  )

  // Unpresented = unchecked payments (cheques issued but not yet cleared by bank)
  const unpresentedCheques = useMemo(
    () => filteredPayments.filter(p => !checkedVoucherIds.has(p.voucherId)).reduce((sum, p) => sum + p.amount, 0),
    [filteredPayments, checkedVoucherIds]
  )

  // Uncredited = unchecked receipts (deposits made but not yet cleared by bank)
  const uncreditedCheques = useMemo(
    () => filteredReceipts.filter(r => !checkedVoucherIds.has(r.voucherId)).reduce((sum, r) => sum + r.amount, 0),
    [filteredReceipts, checkedVoucherIds]
  )

  const uncheckedPaymentsCount = filteredPayments.filter(p => !checkedVoucherIds.has(p.voucherId)).length
  const uncheckedReceiptsCount = filteredReceipts.filter(r => !checkedVoucherIds.has(r.voucherId)).length

  const impliedBankBalance = bookBalance + unpresentedCheques - uncreditedCheques
  const adjustedBookBalance = bookBalance - uncreditedCheques
  const adjustedBankBalance = (parseFloat(statementBalance) || 0) - unpresentedCheques

  const parsedStatementBalance = parseFloat(statementBalance) || 0
  const isMatch = Math.abs(adjustedBookBalance - adjustedBankBalance) < 0.01
  const proofMatch = Math.abs(impliedBankBalance - parsedStatementBalance) < 0.01
  const difference = Math.abs(adjustedBookBalance - adjustedBankBalance)

  // ─── Event Handlers ─────────────────────────────────────
  const toggleVoucher = (voucherId: string, isAlreadyReconciled: boolean) => {
    if (isAlreadyReconciled || isFinalized) return
    setCheckedVoucherIds(prev => {
      const next = new Set(prev)
      if (next.has(voucherId)) next.delete(voucherId)
      else next.add(voucherId)
      return next
    })
  }

  const selectAll = (type: 'payments' | 'receipts') => {
    if (isFinalized) return
    const items = type === 'payments' ? filteredPayments : filteredReceipts
    setCheckedVoucherIds(prev => {
      const next = new Set(prev)
      items.forEach(item => {
        if (!item.isReconciled) next.add(item.voucherId)
      })
      return next
    })
  }

  const deselectAll = (type: 'payments' | 'receipts') => {
    if (isFinalized) return
    const items = type === 'payments' ? filteredPayments : filteredReceipts
    const itemIds = new Set(items.map(i => i.voucherId))
    setCheckedVoucherIds(prev => {
      const next = new Set(prev)
      itemIds.forEach(id => {
        if (!payments.find(p => p.voucherId === id)?.isReconciled &&
            !receipts.find(r => r.voucherId === id)?.isReconciled) {
          next.delete(id)
        }
      })
      return next
    })
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      const res = await fetch('/api/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          accountId: selectedAccountId,
          period: selectedPeriod,
          statementBalance: parsedStatementBalance,
          bookBalance,
          unpresentedTotal: unpresentedCheques,
          uncreditedTotal: uncreditedCheques,
          adjustedBookBalance,
          adjustedBankBalance,
          checkedVoucherIds: Array.from(checkedVoucherIds),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to finalize')
      }
      setIsFinalized(true)
      setConfirmModalOpen(false)
      toast({
        title: 'Reconciliation Finalized',
        description: `Bank Reconciliation for ${formatPeriod(selectedPeriod)} — ${selectedAccount?.name} finalized successfully.`,
      })
      // Refresh data
      fetchData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to finalize reconciliation', variant: 'destructive' })
    }
    setFinalizing(false)
  }

  const handleExportPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bank Reconciliation Report - ${selectedAccount?.code} ${selectedAccount?.name} - ${formatPeriod(selectedPeriod)}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          h2 { font-size: 14px; color: #555; font-weight: normal; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .right { text-align: right; }
          .summary-table { margin-top: 20px; }
          .summary-table td { padding: 4px 8px; }
          .total-row { font-weight: 700; border-top: 2px solid #333; }
          .section-title { font-size: 13px; font-weight: 600; margin-top: 20px; margin-bottom: 8px; }
          .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 16px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
          .badge-green { background: #dcfce7; color: #166534; }
          .cleared { text-decoration: line-through; color: #999; }
          .footer { margin-top: 40px; font-size: 10px; color: #777; border-top: 1px solid #ddd; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div>
            <h1>Bank Reconciliation Statement</h1>
            <h2>${selectedAccount?.code} — ${selectedAccount?.name} | Period: ${formatPeriod(selectedPeriod)}</h2>
          </div>
          <div class="badge badge-green">FINALIZED</div>
        </div>

        <div class="section-title">Payments (Unpresented Cheques)</div>
        <table>
          <thead>
            <tr><th>Voucher No.</th><th>Date</th><th>Payee / Narration</th><th>Cheque No.</th><th class="right">Amount (PKR)</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${filteredPayments.map(p => `
              <tr class="${checkedVoucherIds.has(p.voucherId) ? 'cleared' : ''}">
                <td>${p.voucherNumber}</td>
                <td>${new Date(p.date).toLocaleDateString()}</td>
                <td>${p.payeeName || p.narration}</td>
                <td>${p.chequeNumber || '-'}</td>
                <td class="right">${formatCurrency(p.amount)}</td>
                <td>${checkedVoucherIds.has(p.voucherId) ? 'Cleared' : 'Unpresented'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">Receipts (Uncredited Deposits)</div>
        <table>
          <thead>
            <tr><th>Voucher No.</th><th>Date</th><th>Received From / Narration</th><th class="right">Amount (PKR)</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${filteredReceipts.map(r => `
              <tr class="${checkedVoucherIds.has(r.voucherId) ? 'cleared' : ''}">
                <td>${r.voucherNumber}</td>
                <td>${new Date(r.date).toLocaleDateString()}</td>
                <td>${r.payeeName || r.narration}</td>
                <td class="right">${formatCurrency(r.amount)}</td>
                <td>${checkedVoucherIds.has(r.voucherId) ? 'Cleared' : 'Uncredited'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">Reconciliation Summary</div>
        <table class="summary-table">
          <tr><td>Book Balance (DR)</td><td class="right">${formatCurrency(bookBalance)}</td></tr>
          <tr><td>&nbsp;&nbsp;+ Unpresented Cheques</td><td class="right">${formatCurrency(unpresentedCheques)}</td></tr>
          <tr><td>&nbsp;&nbsp;− Uncredited Deposits</td><td class="right">(${formatCurrency(uncreditedCheques)})</td></tr>
          <tr class="total-row"><td>= Implied Bank Statement Balance</td><td class="right">${formatCurrency(impliedBankBalance)}</td></tr>
        </table>

        <table class="summary-table">
          <tr><td>Adjusted Book Balance</td><td class="right">${formatCurrency(adjustedBookBalance)}</td></tr>
          <tr><td>Adjusted Bank Balance</td><td class="right">${formatCurrency(adjustedBankBalance)}</td></tr>
          <tr class="total-row"><td>Difference</td><td class="right">${isMatch ? 'NIL' : formatCurrency(difference)}</td></tr>
        </table>

        <div class="footer">
          <p>Prepared by: Admin | Date: ${new Date().toLocaleDateString()} | Generated from AcctFin ERP</p>
        </div>
      </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.onload = () => { printWindow.print() }
    }
  }

  // ─── Render: Initialization Panel ───────────────────────
  const lastReconInfo = selectedAccountId ? lastReconciled[selectedAccountId] : null

  const renderInitPanel = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Reconciliation Setup</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bank Account */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Bank Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code} — {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bankAccounts.length === 0 && !initializing && (
              <p className="text-[10px] text-amber-600">No bank accounts found in Chart of Accounts</p>
            )}
          </div>

          {/* Reconciliation Period */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reconciliation Period</Label>
            <Input
              type="month"
              className="h-8 text-xs"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
            />
            {lastReconInfo && (
              <p className="text-[10px] text-muted-foreground">
                Last reconciled: {formatPeriod(lastReconInfo.period)}
              </p>
            )}
          </div>

          {/* Bank Statement Balance */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Bank Statement Balance (CR)</Label>
            <Input
              type="number"
              step="0.01"
              className="h-8 text-xs text-right"
              placeholder="Enter statement balance"
              value={statementBalance}
              onChange={e => setStatementBalance(e.target.value)}
              disabled={isFinalized}
            />
          </div>

          {/* Book Balance (auto-computed) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Book Balance (DR)</Label>
            <div className="h-8 px-3 flex items-center justify-end rounded-md border bg-muted/50 text-xs font-semibold">
              {formatCurrency(bookBalance)}
            </div>
            <p className="text-[10px] text-muted-foreground">Auto-computed from ledger entries</p>
          </div>
        </div>

        {selectedAccountId && (
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {isFinalized && (
              <Badge className="text-[9px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Lock className="h-3 w-3 mr-1" /> Period Locked
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // ─── Render: Voucher Row ────────────────────────────────
  const renderVoucherRow = (item: VoucherItem, type: 'payment' | 'receipt') => {
    const isChecked = checkedVoucherIds.has(item.voucherId)
    const isLocked = item.isReconciled
    const isCleared = isChecked

    return (
      <TableRow
        key={item.voucherId}
        className={`${isCleared && !isLocked ? 'opacity-60' : ''} ${isLocked ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}`}
      >
        <TableCell className="w-10">
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleVoucher(item.voucherId, isLocked)}
            disabled={isLocked || isFinalized}
            className={isLocked ? 'opacity-50' : ''}
          />
        </TableCell>
        <TableCell className={`text-xs font-mono ${isCleared ? 'line-through' : ''}`}>
          {item.voucherNumber}
        </TableCell>
        <TableCell className={`text-xs ${isCleared ? 'line-through' : ''}`}>
          {new Date(item.date).toLocaleDateString()}
        </TableCell>
        <TableCell className={`text-xs ${isCleared ? 'line-through' : ''}`}>
          {type === 'payment'
            ? (item.payeeName || item.narration)
            : (item.payeeName || item.narration)
          }
        </TableCell>
        {type === 'payment' && (
          <TableCell className={`text-xs font-mono ${isCleared ? 'line-through' : ''}`}>
            {item.chequeNumber || '-'}
          </TableCell>
        )}
        <TableCell className={`text-xs text-right font-semibold ${isCleared ? 'line-through' : ''}`}>
          {formatCurrency(item.amount)}
        </TableCell>
        <TableCell>
          {isLocked ? (
            <Badge className="text-[8px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <Lock className="h-2.5 w-2.5 mr-0.5" /> Locked
            </Badge>
          ) : isCleared ? (
            <Badge className="text-[8px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Cleared
            </Badge>
          ) : (
            <Badge className="text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Pending
            </Badge>
          )}
        </TableCell>
      </TableRow>
    )
  }

  // ─── Render: Reconciliation Grid ────────────────────────
  const renderGrid = () => {
    if (!selectedAccountId) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Landmark className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Select a Bank Account</p>
            <p className="text-xs text-muted-foreground mt-1">Choose a bank account and period to start reconciliation</p>
          </CardContent>
        </Card>
      )
    }

    if (loading) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">Loading vouchers...</p>
          </CardContent>
        </Card>
      )
    }

    if (payments.length === 0 && receipts.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Landmark className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No Bank Vouchers Found</p>
            <p className="text-xs text-muted-foreground mt-1">
              No posted bank payment (BP) or bank receipt (BR) vouchers exist for this account in {formatPeriod(selectedPeriod)}.
              Create and post vouchers in Voucher Management first.
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Transaction Reconciliation</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search vouchers..."
                  className="h-7 w-48 pl-7 text-xs"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4">
              <TabsList className="h-7">
                <TabsTrigger value="payments" className="text-xs h-6">
                  Payments ({filteredPayments.length})
                </TabsTrigger>
                <TabsTrigger value="receipts" className="text-xs h-6">
                  Receipts ({filteredReceipts.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="payments" className="mt-0">
              <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30">
                <span className="text-[10px] text-muted-foreground">
                  {uncheckedPaymentsCount} of {filteredPayments.length} unpresented
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => selectAll('payments')}
                    disabled={isFinalized}
                  >
                    <CheckCheck className="h-3 w-3 mr-0.5" /> Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => deselectAll('payments')}
                    disabled={isFinalized}
                  >
                    <XCircle className="h-3 w-3 mr-0.5" /> Deselect All
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-10">☐</TableHead>
                      <TableHead className="text-[10px]">Voucher No.</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px]">Payee / Narration</TableHead>
                      <TableHead className="text-[10px]">Cheque No.</TableHead>
                      <TableHead className="text-[10px] text-right">Amount (PKR)</TableHead>
                      <TableHead className="text-[10px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                          No payment vouchers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map(p => renderVoucherRow(p, 'payment'))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="receipts" className="mt-0">
              <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30">
                <span className="text-[10px] text-muted-foreground">
                  {uncheckedReceiptsCount} of {filteredReceipts.length} uncredited
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => selectAll('receipts')}
                    disabled={isFinalized}
                  >
                    <CheckCheck className="h-3 w-3 mr-0.5" /> Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => deselectAll('receipts')}
                    disabled={isFinalized}
                  >
                    <XCircle className="h-3 w-3 mr-0.5" /> Deselect All
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] w-10">☐</TableHead>
                      <TableHead className="text-[10px]">Voucher No.</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px]">Received From / Narration</TableHead>
                      <TableHead className="text-[10px] text-right">Amount (PKR)</TableHead>
                      <TableHead className="text-[10px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                          No receipt vouchers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReceipts.map(r => renderVoucherRow(r, 'receipt'))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    )
  }

  // ─── Render: Summary Panel ──────────────────────────────
  const renderSummary = () => {
    if (!selectedAccountId) return null

    return (
      <div className="sticky bottom-0 z-10 border-t bg-card shadow-lg">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Block 1 — Proof of Bank Balance */}
            <Card className="border-l-4 border-l-blue-400">
              <CardContent className="p-3 space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Proof of Bank Balance
                </h4>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Book Balance (DR)</span>
                  <span className="font-mono">{formatCurrency(bookBalance)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">+ Unpresented Cheques</span>
                  <span className="font-mono">{formatCurrency(unpresentedCheques)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">− Uncredited Deposits</span>
                  <span className="font-mono">({formatCurrency(uncreditedCheques)})</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs font-bold">
                  <span>= Implied Bank Balance</span>
                  <span className="font-mono">{formatCurrency(impliedBankBalance)}</span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  {proofMatch ? (
                    <Badge className="text-[9px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" /> Matches statement balance
                    </Badge>
                  ) : parsedStatementBalance > 0 ? (
                    <Badge className="text-[9px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <XCircle className="h-3 w-3 mr-1" /> Gap: {formatCurrency(Math.abs(impliedBankBalance - parsedStatementBalance))}
                    </Badge>
                  ) : (
                    <Badge className="text-[9px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Enter statement balance
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Block 2 — Adjusted Book Balance */}
            <Card className="border-l-4 border-l-emerald-400">
              <CardContent className="p-3 space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Adjusted Book Balance
                </h4>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Book Balance (DR)</span>
                  <span className="font-mono">{formatCurrency(bookBalance)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">− Uncredited Deposits</span>
                  <span className="font-mono">({formatCurrency(uncreditedCheques)})</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs font-bold">
                  <span>= Adjusted Book Balance</span>
                  <span className="font-mono">{formatCurrency(adjustedBookBalance)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Block 3 — Adjusted Bank Balance */}
            <Card className="border-l-4 border-l-violet-400">
              <CardContent className="p-3 space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Adjusted Bank Balance
                </h4>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Bank Statement (CR)</span>
                  <span className="font-mono">{formatCurrency(parsedStatementBalance)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">− Unpresented Cheques</span>
                  <span className="font-mono">({formatCurrency(unpresentedCheques)})</span>
                </div>
                <Separator />
                <div className="flex justify-between text-xs font-bold">
                  <span>= Adjusted Bank Balance</span>
                  <span className="font-mono">{formatCurrency(adjustedBankBalance)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Master Status + Action */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <div className="flex items-center gap-2">
              {isMatch && parsedStatementBalance > 0 ? (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-3 py-1">
                  <CheckCircle className="h-4 w-4 mr-1.5" /> RECONCILED — Balances match. Ready to finalize.
                </Badge>
              ) : parsedStatementBalance > 0 ? (
                <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-3 py-1">
                  <XCircle className="h-4 w-4 mr-1.5" /> UNRECONCILED — Difference of PKR {formatCurrency(difference)} remains.
                </Badge>
              ) : (
                <Badge className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-3 py-1">
                  Enter bank statement balance to reconcile
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFinalized && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleExportPDF}
                >
                  <Download className="h-3 w-3 mr-1" /> Export to PDF
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!isMatch || parsedStatementBalance <= 0 || isFinalized || payments.length + receipts.length === 0}
                onClick={() => setConfirmModalOpen(true)}
              >
                <CheckCircle className="h-3 w-3 mr-1" /> Finalize & Approve
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    )
  }

  // ─── Render: Confirmation Modal ─────────────────────────
  const renderConfirmModal = () => (
    <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Confirm Bank Reconciliation</DialogTitle>
          <DialogDescription className="text-xs">
            Review the reconciliation details before finalizing. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <p className="text-muted-foreground">Account</p>
              <p className="font-medium">{selectedAccount?.code} — {selectedAccount?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Period</p>
              <p className="font-medium">{formatPeriod(selectedPeriod)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Book Balance (DR)</p>
              <p className="font-medium font-mono">{formatCurrency(bookBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Bank Statement (CR)</p>
              <p className="font-medium font-mono">{formatCurrency(parsedStatementBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Unpresented Cheques</p>
              <p className="font-medium font-mono">{formatCurrency(unpresentedCheques)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Uncredited Deposits</p>
              <p className="font-medium font-mono">{formatCurrency(uncreditedCheques)}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <p className="text-muted-foreground">Adjusted Book Balance</p>
              <p className="font-bold font-mono">{formatCurrency(adjustedBookBalance)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Adjusted Bank Balance</p>
              <p className="font-bold font-mono">{formatCurrency(adjustedBankBalance)}</p>
            </div>
          </div>
          <Separator />
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p>Prepared by: Admin (admin@acctfin.com)</p>
            <p>Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setConfirmModalOpen(false)}
            disabled={finalizing}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleFinalize}
            disabled={finalizing}
          >
            {finalizing ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-1" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-3 w-3 mr-1" /> Confirm & Lock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ─── Main Render ────────────────────────────────────────
  if (initializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading Bank Reconciliation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-2">
      {/* Page Title */}
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">Bank Reconciliation</h3>
      </div>

      {/* Step A — Initialization Panel */}
      {renderInitPanel()}

      {/* Step B — Reconciliation Grid */}
      {renderGrid()}

      {/* Step C — Live Summary Panel */}
      {renderSummary()}

      {/* Confirmation Modal */}
      {renderConfirmModal()}
    </div>
  )
}
