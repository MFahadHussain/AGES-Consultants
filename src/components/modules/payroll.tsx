'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Banknote, ArrowRight, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function PayrollIntegration() {
  const [batches, setBatches] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/payroll')
      setBatches(await res.json())
    } catch {
      toast({ title: 'Error', description: 'Failed to load payroll batches', variant: 'destructive' })
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchData()
      fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(d))
    })
  }, [])

  const handlePostToGL = async () => {
    if (!selectedBatch) return
    const fy = financialYears.find((f: any) => f.status === 'open')
    if (!fy) { toast({ title: 'Error', description: 'No open financial year', variant: 'destructive' }); return }

    // INTEGRATION: Payroll → GL
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post-to-gl', batchId: selectedBatch.id, financialYearId: fy.id }),
      })
      const result = await res.json()
      toast({ title: 'Posted to GL', description: `INTEGRATION: Payroll → GL - Voucher ${result.voucherNumber} created with total debit ${formatCurrency(result.totalDebit)}` })
      setPostDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Error', description: 'Failed to post payroll to GL', variant: 'destructive' })
    }
  }

  const statusStyles: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    posted: 'bg-emerald-100 text-emerald-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" />Payroll Integration</h3>
          <p className="text-[10px] text-muted-foreground">INTEGRATION: Payroll → GL - Post payroll journals after approval</p>
        </div>
      </div>

      {/* Integration Touchpoints Info */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-2">Payroll → GL Integration Touchpoints</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Salary expense posts to Basic Salary account (7110)</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Net pay reduces Bank account (1121)</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Income tax deducted creates Income Tax Payable (3310)</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>EOBI deducted creates EOBI Payable (3410)</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Provident Fund deducted creates PF Payable (3420)</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Employer social charges post to Social Charges (7700)</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Cross-charged salary costs post to project cost centers</span></div>
            <div className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-purple-600 mt-0.5 shrink-0" /><span>Loan/advance deductions update Loans/Advances ledger</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Batches */}
      {batches.map(batch => (
        <Card key={batch.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs font-mono">{batch.batchNumber}</CardTitle>
                <CardDescription className="text-[10px]">Period: {batch.period} | {batch.lines?.length} employees</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {batch.postedToGL && <Badge className="text-[9px] bg-purple-100 text-purple-800"><CheckCircle className="h-3 w-3 mr-1" />Posted to GL</Badge>}
                <Badge className={`text-[9px] ${statusStyles[batch.status]}`}>{batch.status}</Badge>
                {!batch.postedToGL && (
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setSelectedBatch(batch); setPostDialogOpen(true) }}>
                    Post to GL
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Gross Salary</p>
                <p className="text-xs font-bold">{formatCurrency(batch.totalGross)}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Deductions</p>
                <p className="text-xs font-bold text-red-600">{formatCurrency(batch.totalDeductions)}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Net Pay</p>
                <p className="text-xs font-bold text-green-600">{formatCurrency(batch.totalNetPay)}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground">Employer Charges</p>
                <p className="text-xs font-bold">{formatCurrency(batch.totalEmployerCharges)}</p>
              </div>
            </div>
            {batch.lines?.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Employee</TableHead>
                  <TableHead className="text-[10px] text-right">Gross</TableHead>
                  <TableHead className="text-[10px] text-right">Tax</TableHead>
                  <TableHead className="text-[10px] text-right">EOBI</TableHead>
                  <TableHead className="text-[10px] text-right">PF</TableHead>
                  <TableHead className="text-[10px] text-right">Net Pay</TableHead>
                  <TableHead className="text-[10px]">Project</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {batch.lines.map((line: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{line.employeeName}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(line.grossSalary)}</TableCell>
                      <TableCell className="text-xs text-right text-red-600">{line.incomeTax > 0 ? formatCurrency(line.incomeTax) : '-'}</TableCell>
                      <TableCell className="text-xs text-right text-red-600">{line.eobiDeduction > 0 ? formatCurrency(line.eobiDeduction) : '-'}</TableCell>
                      <TableCell className="text-xs text-right text-red-600">{line.providentFund > 0 ? formatCurrency(line.providentFund) : '-'}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-green-600">{formatCurrency(line.netPay)}</TableCell>
                      <TableCell className="text-xs">{line.projectId ? 'Cross-charged' : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Post to GL Confirmation */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Post Payroll to General Ledger</DialogTitle></DialogHeader>
          <p className="text-[10px] text-muted-foreground">INTEGRATION: Payroll → GL - This will create journal entries in the General Ledger for:</p>
          <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-1">
            <li>Salary expense (debit) and Bank payment (credit)</li>
            <li>Deductions: Income Tax, EOBI, Provident Fund (credit to payables)</li>
            <li>Employer social charges: EOBI + PF contributions</li>
            <li>Cross-charging to project cost centers</li>
          </ul>
          {selectedBatch && (
            <div className="p-3 rounded bg-muted/50 text-xs space-y-1">
              <div className="flex justify-between"><span>Batch:</span><strong>{selectedBatch.batchNumber}</strong></div>
              <div className="flex justify-between"><span>Total Amount:</span><strong>{formatCurrency(selectedBatch.totalGross + selectedBatch.totalEmployerCharges)}</strong></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPostDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handlePostToGL}><Banknote className="h-3.5 w-3.5 mr-1" />Post to GL</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
