'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Gift, Users, CheckCircle, Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { EmployeeCombobox } from '@/components/ui/employee-combobox'

// ── Types ──────────────────────────────────────────────────
interface Allowance {
  id: string
  code: string
  name: string
  allowanceType: string
  value: number
  baseOnSalary: boolean
  isTaxable: boolean
  isProjectSpecific: boolean
  isInclusive: boolean
  isSocialCharges: boolean
  isActive: boolean
  _count?: { employeeAllowances: number }
  createdAt: string
  updatedAt: string
}

interface EmployeeAllowance {
  id: string
  employeeId: string
  allowanceId: string
  customValue: number | null
  projectId: string | null
  isActive: boolean
  effectiveDate: string
  employee: { id: string; name: string; employeeCode: string; designation?: string; department?: string }
  allowance: Allowance
  createdAt: string
  updatedAt: string
}

interface Employee {
  id: string
  employeeCode: string
  name: string
  designation?: string
  department?: string
  status: string
}

interface Project {
  id: string
  code: string
  name: string
}

// ── Form defaults ──────────────────────────────────────────
const emptyAllowanceForm = {
  code: '',
  name: '',
  allowanceType: 'fixed',
  value: 0,
  baseOnSalary: false,
  isTaxable: true,
  isProjectSpecific: false,
  isActive: true,
  isInclusive: false,
  isSocialCharges: false,
}

const emptyEmpAllowanceForm = {
  employeeId: '',
  allowanceId: '',
  customValue: '' as string | number,
  projectId: '',
  isActive: true,
  effectiveDate: new Date().toISOString().slice(0, 10),
}

// ── Component ──────────────────────────────────────────────
export function AllowancesModule() {
  const { toast } = useToast()

  // Data
  const [allowances, setAllowances] = useState<Allowance[]>([])
  const [empAllowances, setEmpAllowances] = useState<EmployeeAllowance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Filters
  const [empFilter, setEmpFilter] = useState<string>('')
  const [allowanceActiveFilter, setAllowanceActiveFilter] = useState<string>('')

  // Allowance CRUD dialog state
  const [allowDialogOpen, setAllowDialogOpen] = useState(false)
  const [allowEditId, setAllowEditId] = useState<string | null>(null)
  const [allowForm, setAllowForm] = useState({ ...emptyAllowanceForm })
  const [allowDeleteId, setAllowDeleteId] = useState<string | null>(null)
  const [allowDeleteDialogOpen, setAllowDeleteDialogOpen] = useState(false)

  // Employee allowance CRUD dialog state
  const [empAllowDialogOpen, setEmpAllowDialogOpen] = useState(false)
  const [empAllowEditId, setEmpAllowEditId] = useState<string | null>(null)
  const [empAllowForm, setEmpAllowForm] = useState({ ...emptyEmpAllowanceForm })
  const [empAllowDeleteId, setEmpAllowDeleteId] = useState<string | null>(null)
  const [empAllowDeleteDialogOpen, setEmpAllowDeleteDialogOpen] = useState(false)
  const [isBulkAssign, setIsBulkAssign] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Fetches ────────────────────────────────────────────
  const fetchAllowances = useCallback(async () => {
    try {
      const query = allowanceActiveFilter ? `?isActive=${allowanceActiveFilter}` : ''
      const res = await fetch(`/api/allowances${query}`)
      const data = await res.json()
      setAllowances(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load allowances', variant: 'destructive' })
    }
  }, [allowanceActiveFilter, toast])

  const fetchEmpAllowances = useCallback(async () => {
    try {
      const query = empFilter ? `?employeeId=${empFilter}` : ''
      const res = await fetch(`/api/employee-allowances${query}`)
      const data = await res.json()
      setEmpAllowances(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load employee allowances', variant: 'destructive' })
    }
  }, [empFilter, toast])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?pageSize=200')
      const data = await res.json()
      setEmployees(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      fetchAllowances()
      fetchEmpAllowances()
      fetchEmployees()
      fetchProjects()
    })
  }, [fetchAllowances, fetchEmpAllowances, fetchEmployees, fetchProjects])

  // ── Allowance CRUD ─────────────────────────────────────
  const openCreateAllowance = () => {
    setAllowEditId(null)
    setAllowForm({ ...emptyAllowanceForm })
    setAllowDialogOpen(true)
  }

  const openEditAllowance = (a: Allowance) => {
    setAllowEditId(a.id)
    setAllowForm({
      code: a.code,
      name: a.name,
      allowanceType: a.allowanceType,
      value: a.value,
      baseOnSalary: a.baseOnSalary,
      isTaxable: a.isTaxable,
      isProjectSpecific: a.isProjectSpecific,
      isActive: a.isActive,
      isInclusive: a.isInclusive ?? false,
      isSocialCharges: a.isSocialCharges ?? false,
    })
    setAllowDialogOpen(true)
  }

  const saveAllowance = async () => {
    if (!allowForm.code || !allowForm.name) {
      toast({ title: 'Validation', description: 'Code and Name are required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const url = allowEditId ? `/api/allowances?id=${allowEditId}` : '/api/allowances'
      const method = allowEditId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allowForm),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      toast({ title: allowEditId ? 'Updated' : 'Created', description: `Allowance ${allowEditId ? 'updated' : 'created'} successfully` })
      setAllowDialogOpen(false)
      fetchAllowances()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const deleteAllowance = async () => {
    if (!allowDeleteId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/allowances?id=${allowDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      toast({ title: 'Deleted', description: 'Allowance deleted/deactivated' })
      setAllowDeleteDialogOpen(false)
      setAllowDeleteId(null)
      fetchAllowances()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ── Employee Allowance CRUD ────────────────────────────
  const openCreateEmpAllowance = () => {
    setIsBulkAssign(false)
    setEmpAllowEditId(null)
    setEmpAllowForm({ ...emptyEmpAllowanceForm })
    setEmpAllowDialogOpen(true)
  }

  const openBulkAssignAllowance = () => {
    setIsBulkAssign(true)
    setEmpAllowEditId(null)
    setEmpAllowForm({
      ...emptyEmpAllowanceForm,
      employeeId: 'all',
    })
    setEmpAllowDialogOpen(true)
  }

  const openEditEmpAllowance = (ea: EmployeeAllowance) => {
    setIsBulkAssign(false)
    setEmpAllowEditId(ea.id)
    setEmpAllowForm({
      employeeId: ea.employeeId,
      allowanceId: ea.allowanceId,
      customValue: ea.customValue ?? '',
      projectId: ea.projectId ?? '',
      isActive: ea.isActive,
      effectiveDate: ea.effectiveDate ? new Date(ea.effectiveDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    setEmpAllowDialogOpen(true)
  }

  const saveEmpAllowance = async () => {
    if (!isBulkAssign && (!empAllowForm.employeeId || !empAllowForm.allowanceId)) {
      toast({ title: 'Validation', description: 'Employee and Allowance are required', variant: 'destructive' })
      return
    }
    if (isBulkAssign && !empAllowForm.allowanceId) {
      toast({ title: 'Validation', description: 'Allowance is required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...empAllowForm,
        customValue: empAllowForm.customValue === '' ? null : Number(empAllowForm.customValue),
        projectId: empAllowForm.projectId || null,
        effectiveDate: empAllowForm.effectiveDate || new Date().toISOString().slice(0, 10),
        assignToAll: isBulkAssign,
      }
      const url = empAllowEditId ? `/api/employee-allowances?id=${empAllowEditId}` : '/api/employee-allowances'
      const method = empAllowEditId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      toast({ 
        title: empAllowEditId ? 'Updated' : 'Assigned', 
        description: isBulkAssign 
          ? `Allowance successfully assigned to all active employees!` 
          : `Employee allowance ${empAllowEditId ? 'updated' : 'assigned'} successfully` 
      })
      setEmpAllowDialogOpen(false)
      fetchEmpAllowances()
      fetchAllowances()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const deleteEmpAllowance = async () => {
    if (!empAllowDeleteId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employee-allowances?id=${empAllowDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      toast({ title: 'Deleted', description: 'Employee allowance removed' })
      setEmpAllowDeleteDialogOpen(false)
      setEmpAllowDeleteId(null)
      fetchEmpAllowances()
      fetchAllowances()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // ── KPIs ───────────────────────────────────────────────
  const totalAllowances = allowances.length
  const activeAssignments = empAllowances.filter(ea => ea.isActive).length
  const taxableCount = allowances.filter(a => a.isTaxable).length
  const projectSpecificCount = allowances.filter(a => a.isProjectSpecific).length

  // ── Get selected allowance to check isProjectSpecific for project field ──
  const selectedAllowanceForForm = allowances.find(a => a.id === empAllowForm.allowanceId)
  const showProjectField = empAllowEditId
    ? (empAllowances.find(ea => ea.id === empAllowEditId)?.allowance?.isProjectSpecific ?? selectedAllowanceForForm?.isProjectSpecific ?? false)
    : (selectedAllowanceForForm?.isProjectSpecific ?? false)

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Allowances</p>
                <p className="text-sm font-bold">{totalAllowances}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Active Assignments</p>
                <p className="text-sm font-bold">{activeAssignments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Taxable Count</p>
                <p className="text-sm font-bold">{taxableCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Project-Specific</p>
                <p className="text-sm font-bold">{projectSpecificCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="definitions" className="space-y-3">
        <TabsList>
          <TabsTrigger value="definitions" className="text-xs">Allowance Definitions</TabsTrigger>
          <TabsTrigger value="assignments" className="text-xs">Employee Assignments</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Allowance Definitions ── */}
        <TabsContent value="definitions" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Gift className="h-4 w-4" />Allowance Definitions</h3>
              <Select value={allowanceActiveFilter} onValueChange={setAllowanceActiveFilter}>
                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={openCreateAllowance}>
              <Plus className="h-3.5 w-3.5 mr-1" />New Allowance
            </Button>
          </div>

          <Card>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Code</TableHead>
                    <TableHead className="text-[10px]">Name</TableHead>
                    <TableHead className="text-[10px]">Type</TableHead>
                    <TableHead className="text-[10px] text-right">Value</TableHead>
                    <TableHead className="text-[10px] text-center">Taxable</TableHead>
                    <TableHead className="text-[10px] text-center">Project-Specific</TableHead>
                    <TableHead className="text-[10px] text-center">Status</TableHead>
                    <TableHead className="text-[10px] text-center">Assignments</TableHead>
                    <TableHead className="text-[10px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowances.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs font-mono">{a.code}</TableCell>
                      <TableCell className="text-xs">{a.name}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[9px]">{a.allowanceType === 'fixed' ? 'Fixed' : 'Percentage'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {a.allowanceType === 'percentage' ? `${a.value}%` : `PKR ${a.value.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {a.isTaxable ? <span className="text-green-600">Yes</span> : <span className="text-gray-400">No</span>}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {a.isProjectSpecific ? <span className="text-violet-600">Yes</span> : <span className="text-gray-400">No</span>}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge className={`text-[9px] ${a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center">{a._count?.employeeAllowances ?? 0}</TableCell>
                      <TableCell className="text-xs text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAllowance(a)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => { setAllowDeleteId(a.id); setAllowDeleteDialogOpen(true) }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {allowances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-xs text-muted-foreground text-center py-8">
                        No allowances found. Click &ldquo;New Allowance&rdquo; to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Employee Allowance Assignments ── */}
        <TabsContent value="assignments" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Employee Assignments</h3>
              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger className="h-7 w-48 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Employees</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.employeeCode} - {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs border-dashed text-primary hover:text-primary-foreground hover:bg-primary" onClick={openBulkAssignAllowance}>
                <Users className="h-3.5 w-3.5 mr-1" />Assign to All
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={openCreateEmpAllowance}>
                <Plus className="h-3.5 w-3.5 mr-1" />Assign Allowance
              </Button>
            </div>
          </div>

          <Card>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Employee</TableHead>
                    <TableHead className="text-[10px]">Allowance</TableHead>
                    <TableHead className="text-[10px] text-right">Custom Value</TableHead>
                    <TableHead className="text-[10px]">Project</TableHead>
                    <TableHead className="text-[10px]">Effective Date</TableHead>
                    <TableHead className="text-[10px] text-center">Status</TableHead>
                    <TableHead className="text-[10px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empAllowances.map(ea => (
                    <TableRow key={ea.id}>
                      <TableCell className="text-xs">
                        <div>
                          <p className="font-medium">{ea.employee?.name || '-'}</p>
                          <p className="text-[10px] text-muted-foreground">{ea.employee?.employeeCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>
                          <p className="font-medium">{ea.allowance?.name || '-'}</p>
                          <p className="text-[10px] text-muted-foreground">{ea.allowance?.code} • {ea.allowance?.allowanceType === 'fixed' ? `PKR ${ea.allowance?.value}` : `${ea.allowance?.value}%`}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {ea.customValue !== null && ea.customValue !== undefined
                          ? (ea.allowance?.allowanceType === 'percentage' ? `${ea.customValue}%` : `PKR ${Number(ea.customValue).toLocaleString()}`)
                          : <span className="text-muted-foreground">Default</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ea.projectId
                          ? (projects.find(p => p.id === ea.projectId)?.name || ea.projectId)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ea.effectiveDate ? new Date(ea.effectiveDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge className={`text-[9px] ${ea.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {ea.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEmpAllowance(ea)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => { setEmpAllowDeleteId(ea.id); setEmpAllowDeleteDialogOpen(true) }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {empAllowances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-xs text-muted-foreground text-center py-8">
                        No employee allowance assignments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Allowance Create/Edit Dialog ── */}
      <Dialog open={allowDialogOpen} onOpenChange={setAllowDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{allowEditId ? 'Edit Allowance' : 'Create Allowance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Code *</Label>
                <Input className="h-8 text-xs" value={allowForm.code} onChange={e => setAllowForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. HRA" />
              </div>
              <div>
                <Label className="text-xs">Name *</Label>
                <Input className="h-8 text-xs" value={allowForm.name} onChange={e => setAllowForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. House Rent Allowance" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={allowForm.allowanceType} onValueChange={v => setAllowForm(p => ({ ...p, allowanceType: v, value: v === 'percentage' && p.value > 100 ? 0 : p.value }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value {allowForm.allowanceType === 'percentage' ? '(%)' : '(PKR)'}</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={allowForm.value || ''}
                  onChange={e => setAllowForm(p => ({ ...p, value: parseFloat(e.target.value) || 0 }))}
                  max={allowForm.allowanceType === 'percentage' ? 100 : undefined}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={allowForm.baseOnSalary} onCheckedChange={v => setAllowForm(p => ({ ...p, baseOnSalary: v }))} disabled={allowForm.allowanceType === 'fixed'} />
                <Label className="text-xs">Base on Salary</Label>
               </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowForm.isTaxable} onCheckedChange={v => setAllowForm(p => ({ ...p, isTaxable: v }))} />
                <Label className="text-xs">Taxable</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowForm.isProjectSpecific} onCheckedChange={v => setAllowForm(p => ({ ...p, isProjectSpecific: v }))} />
                <Label className="text-xs">Project-Specific</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={allowForm.isInclusive} 
                  onCheckedChange={v => setAllowForm(p => {
                    const updated = { ...p, isInclusive: v }
                    if (v) {
                      updated.allowanceType = 'percentage'
                      updated.baseOnSalary = true
                    }
                    return updated
                  })}
                  disabled={allowForm.allowanceType === 'fixed'}
                />
                <Label className="text-xs font-semibold text-amber-600 dark:text-amber-500">Inclusive of Gross</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={allowForm.isSocialCharges} 
                  onCheckedChange={v => setAllowForm(p => ({ ...p, isSocialCharges: v }))} 
                />
                <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">Social Charges</Label>
              </div>
            </div>
            {allowForm.isInclusive && (
              <div className="text-[10px] text-amber-700 bg-amber-500/5 dark:text-amber-500 p-2 rounded border border-amber-500/10">
                <strong>Inclusive Carve-out Active:</strong> This allowance is reverse-calculated from Gross Salary (e.g. Gross 100,000 with 10% Medical =&gt; Basic: 90,909, Medical: 9,091).
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={allowForm.isActive} onCheckedChange={v => setAllowForm(p => ({ ...p, isActive: v }))} />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAllowDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveAllowance} disabled={loading}>
              {loading ? 'Saving...' : allowEditId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Allowance Delete Confirmation ── */}
      <AlertDialog open={allowDeleteDialogOpen} onOpenChange={setAllowDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Allowance</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete this allowance? If it is assigned to employees, it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteAllowance}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Employee Allowance Create/Edit Dialog ── */}
      <Dialog open={empAllowDialogOpen} onOpenChange={setEmpAllowDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {empAllowEditId 
                ? 'Edit Employee Allowance' 
                : isBulkAssign 
                  ? 'Assign Allowance to All Employees' 
                  : 'Assign Allowance to Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Employee *</Label>
                {isBulkAssign ? (
                  <div className="h-8 flex items-center px-3 text-xs bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded border border-amber-500/10 font-semibold">
                    All Active Employees
                  </div>
                ) : (
                  <EmployeeCombobox
                    employees={employees}
                    value={empAllowForm.employeeId}
                    onChange={v => setEmpAllowForm(p => ({ ...p, employeeId: v }))}
                    disabled={!!empAllowEditId}
                    placeholder="Search employee..."
                  />
                )}
              </div>
              <div>
                <Label className="text-xs">Allowance *</Label>
                <Select value={empAllowForm.allowanceId} onValueChange={v => setEmpAllowForm(p => ({ ...p, allowanceId: v, projectId: '' }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Allowance" /></SelectTrigger>
                  <SelectContent>
                    {allowances.filter(a => a.isActive).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Custom Value {selectedAllowanceForForm ? (selectedAllowanceForForm.allowanceType === 'percentage' ? '(%)' : '(PKR)') : ''}</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder={selectedAllowanceForForm ? `Default: ${selectedAllowanceForForm.value}` : 'Leave blank for default'}
                  value={empAllowForm.customValue}
                  onChange={e => setEmpAllowForm(p => ({ ...p, customValue: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Effective Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={empAllowForm.effectiveDate}
                  onChange={e => setEmpAllowForm(p => ({ ...p, effectiveDate: e.target.value }))}
                />
              </div>
            </div>
            {showProjectField && (
              <div>
                <Label className="text-xs">Project</Label>
                <Select value={empAllowForm.projectId} onValueChange={v => setEmpAllowForm(p => ({ ...p, projectId: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={empAllowForm.isActive} onCheckedChange={v => setEmpAllowForm(p => ({ ...p, isActive: v }))} />
              <Label className="text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEmpAllowDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveEmpAllowance} disabled={loading}>
              {loading ? 'Saving...' : empAllowEditId ? 'Update' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Employee Allowance Delete Confirmation ── */}
      <AlertDialog open={empAllowDeleteDialogOpen} onOpenChange={setEmpAllowDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Remove Employee Allowance</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to remove this allowance assignment from the employee?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteEmpAllowance}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
