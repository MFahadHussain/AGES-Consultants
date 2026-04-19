'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function BudgetManagement() {
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [financialYears, setFinancialYears] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [donors, setDonors] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', financialYearId: '', projectId: '', donorId: '', period: 'ANNUAL', lines: [{ accountId: '', budgetAmount: 0 }] as any[] })
  const { toast } = useToast()

  const fetchData = async () => {

    try { const res = await fetch('/api/budgets'); setBudgets(await res.json()) } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { queueMicrotask(() => { fetchData(); fetch('/api/accounts?accountType=EXPENSE').then(r => r.json()).then(d => setAccounts(d)); fetch('/api/financial-year').then(r => r.json()).then(d => setFinancialYears(d)); fetch('/api/projects').then(r => r.json()).then(d => setProjects(d)); fetch('/api/donors').then(r => r.json()).then(d => setDonors(d)) }) }, [])

  const handleCreate = async () => {
    if (!form.name || !form.financialYearId) { toast({ title: 'Error', description: 'Name and financial year required', variant: 'destructive' }); return }
    try {
      await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Created', description: 'Budget created' })
      setDialogOpen(false)
      fetchData()
    } catch (e) { toast({ title: 'Error', description: 'Failed to create budget', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Budget Management</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Budget</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle className="text-sm">Create Budget</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Budget Name *</Label><Input className="h-8 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Financial Year *</Label>
                  <Select value={form.financialYearId} onValueChange={v => setForm(p => ({ ...p, financialYearId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select FY" /></SelectTrigger>
                    <SelectContent>{financialYears.filter((f: any) => f.status === 'open').map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Project</Label>
                  <Select value={form.projectId} onValueChange={v => setForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Donor</Label>
                  <Select value={form.donorId} onValueChange={v => setForm(p => ({ ...p, donorId: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {donors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Budget Lines</Label>
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setForm(p => ({ ...p, lines: [...p.lines, { accountId: '', budgetAmount: 0 }] }))}><Plus className="h-3 w-3 mr-1" />Add Line</Button>
                </div>
                {form.lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-8">
                      <Select value={line.accountId} onValueChange={v => setForm(p => ({ ...p, lines: p.lines.map((l, idx) => idx === i ? { ...l, accountId: v } : l) }))}>
                        <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input type="number" className="h-7 text-[10px]" placeholder="Amount" value={line.budgetAmount || ''} onChange={e => setForm(p => ({ ...p, lines: p.lines.map((l, idx) => idx === i ? { ...l, budgetAmount: parseFloat(e.target.value) || 0 } : l) }))} /></div>
                    <div className="col-span-1">{form.lines.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setForm(p => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }))}>×</Button>}</div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button><Button size="sm" onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {budgets.map(budget => (
        <Card key={budget.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs">{budget.name}</CardTitle>
                <CardDescription className="text-[10px]">
                  {budget.project?.name && `Project: ${budget.project.name} | `}Total Budget: {formatCurrency(budget.totalAmount)}
                </CardDescription>
              </div>
              <Badge className="text-[9px]">{budget.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Account</TableHead>
                  <TableHead className="text-[10px] text-right">Budget</TableHead>
                  <TableHead className="text-[10px] text-right">Actual</TableHead>
                  <TableHead className="text-[10px] text-right">Variance</TableHead>
                  <TableHead className="text-[10px] w-32">Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budget.lines?.map((line: any) => {
                  const variance = line.budgetAmount - line.actualAmount
                  const utilization = line.budgetAmount > 0 ? (line.actualAmount / line.budgetAmount) * 100 : 0
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-xs">{line.account?.code} - {line.account?.name}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(line.budgetAmount)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(line.actualAmount)}</TableCell>
                      <TableCell className={`text-xs text-right ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(variance)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(utilization, 100)} className="h-2" />
                          <span className={`text-[10px] ${utilization > 100 ? 'text-red-600 font-bold' : ''}`}>{utilization.toFixed(0)}%</span>
                        </div>
                        {utilization > 100 && <div className="flex items-center gap-1 mt-0.5"><AlertTriangle className="h-3 w-3 text-red-500" /><span className="text-[9px] text-red-600">Budget overrun!</span></div>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      {!loading && budgets.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No budgets defined</p>}
    </div>
  )
}
