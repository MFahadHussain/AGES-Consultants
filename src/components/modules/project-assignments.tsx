'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  Users,
  UserX,
  Layers,
  RefreshCw,
  Power,
  Search,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const allocationTypeLabels: Record<string, string> = {
  fixed: 'Fixed',
  percentage: 'Percentage',
  attendance_based: 'Attendance Based',
}

const allocationTypeBadgeStyles: Record<string, string> = {
  fixed: 'bg-amber-100 text-amber-800',
  percentage: 'bg-violet-100 text-violet-800',
  attendance_based: 'bg-cyan-100 text-cyan-800',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Assignment {
  id: string
  employeeId: string
  projectId: string
  role: string | null
  salaryAmount: number
  allocationType: string
  allocationValue: number
  startDate: string
  endDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  employee: {
    id: string
    employeeCode: string
    name: string
    designation: string | null
    department: string | null
    status: string
    baseSalary: number
  }
  project: {
    id: string
    code: string
    name: string
    projectType: string
    status: string
  }
}

interface Employee {
  id: string
  employeeCode: string
  name: string
  designation: string | null
  department: string | null
  status: string
  baseSalary: number
}

interface Project {
  id: string
  code: string
  name: string
  projectType: string
  status: string
}

interface AssignmentForm {
  employeeId: string
  projectId: string
  role: string
  salaryAmount: number
  allocationType: string
  allocationValue: number
  startDate: string
  endDate: string
  isActive: boolean
}

const emptyForm: AssignmentForm = {
  employeeId: '',
  projectId: '',
  role: '',
  salaryAmount: 0,
  allocationType: 'percentage',
  allocationValue: 100,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectAssignments() {
  const { toast } = useToast()

  // Data state
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [filterEmployee, setFilterEmployee] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchText, setSearchText] = useState('')

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<Assignment | null>(null)
  const [form, setForm] = useState<AssignmentForm>({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterEmployee) params.set('employeeId', filterEmployee)
      if (filterProject) params.set('projectId', filterProject)
      if (filterStatus) params.set('isActive', filterStatus)
      const qs = params.toString()
      const res = await fetch(`/api/project-assignments${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      setAssignments(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'Failed to load assignments', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterEmployee, filterProject, filterStatus, toast])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?pageSize=500')
      const data = await res.json()
      // The employees API returns { data: [...], pagination: {...} }
      setEmployees(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [])
    } catch {
      setEmployees([])
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch {
      setProjects([])
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      fetchAssignments()
      fetchEmployees()
      fetchProjects()
    })
  }, [fetchAssignments, fetchEmployees, fetchProjects])

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredAssignments = useMemo(() => {
    if (!searchText.trim()) return assignments
    const s = searchText.toLowerCase()
    return assignments.filter(
      (a) =>
        a.employee?.name?.toLowerCase().includes(s) ||
        a.employee?.employeeCode?.toLowerCase().includes(s) ||
        a.project?.name?.toLowerCase().includes(s) ||
        a.project?.code?.toLowerCase().includes(s) ||
        a.role?.toLowerCase().includes(s)
    )
  }, [assignments, searchText])

  // KPI computation
  const totalAssignments = assignments.length
  const activeAssignments = assignments.filter((a) => a.isActive).length

  // Employees with multiple active assignments
  const activeByEmployee = useMemo(() => {
    const map: Record<string, Assignment[]> = {}
    assignments
      .filter((a) => a.isActive)
      .forEach((a) => {
        if (!map[a.employeeId]) map[a.employeeId] = []
        map[a.employeeId].push(a)
      })
    return map
  }, [assignments])

  const multiProjectEmployeeCount = Object.values(activeByEmployee).filter(
    (list) => list.length > 1
  ).length

  // Unassigned employees (active employees with zero active assignments)
  const unassignedEmployeeCount = useMemo(() => {
    const assignedIds = new Set(
      assignments.filter((a) => a.isActive).map((a) => a.employeeId)
    )
    return employees.filter((e) => e.status === 'active' && !assignedIds.has(e.id)).length
  }, [assignments, employees])

  // Per-employee allocation totals (for visual indicator)
  const employeeAllocationTotals = useMemo(() => {
    const map: Record<string, { total: number; assignments: Assignment[] }> = {}
    assignments
      .filter((a) => a.isActive && a.allocationType === 'percentage')
      .forEach((a) => {
        if (!map[a.employeeId]) map[a.employeeId] = { total: 0, assignments: [] }
        map[a.employeeId].total += a.allocationValue
        map[a.employeeId].assignments.push(a)
      })
    return map
  }, [assignments])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (!form.employeeId || !form.projectId || !form.startDate) {
      toast({ title: 'Validation Error', description: 'Employee, Project, and Start Date are required', variant: 'destructive' })
      return
    }
    if (form.allocationType === 'percentage' && (form.allocationValue < 1 || form.allocationValue > 100)) {
      toast({ title: 'Validation Error', description: 'Percentage allocation must be between 1 and 100', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        employeeId: form.employeeId,
        projectId: form.projectId,
        role: form.role || null,
        salaryAmount: form.salaryAmount,
        allocationType: form.allocationType,
        allocationValue: form.allocationValue,
        startDate: form.startDate,
        endDate: form.endDate || null,
        isActive: form.isActive,
      }
      const res = await fetch('/api/project-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create assignment')
      }
      toast({ title: 'Created', description: 'Project assignment created successfully' })
      setCreateOpen(false)
      setForm({ ...emptyForm })
      fetchAssignments()
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        role: form.role || null,
        salaryAmount: form.salaryAmount,
        allocationType: form.allocationType,
        allocationValue: form.allocationValue,
        startDate: form.startDate,
        endDate: form.endDate || null,
        isActive: form.isActive,
      }
      const res = await fetch(`/api/project-assignments?id=${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update assignment')
      }
      toast({ title: 'Updated', description: 'Project assignment updated successfully' })
      setEditOpen(false)
      setSelected(null)
      fetchAssignments()
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/project-assignments?id=${selected.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete assignment')
      }
      toast({ title: 'Deleted', description: 'Project assignment deleted successfully' })
      setDeleteOpen(false)
      setSelected(null)
      fetchAssignments()
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (assignment: Assignment) => {
    try {
      const payload = assignment.isActive
        ? { deactivate: true }
        : { reactivate: true }
      const res = await fetch(`/api/project-assignments?id=${assignment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to toggle status')
      }
      toast({
        title: assignment.isActive ? 'Deactivated' : 'Reactivated',
        description: `Assignment ${assignment.isActive ? 'deactivated' : 'reactivated'} successfully`,
      })
      fetchAssignments()
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const openEditDialog = (a: Assignment) => {
    setSelected(a)
    setForm({
      employeeId: a.employeeId,
      projectId: a.projectId,
      role: a.role || '',
      salaryAmount: a.salaryAmount,
      allocationType: a.allocationType,
      allocationValue: a.allocationValue,
      startDate: a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : '',
      endDate: a.endDate ? new Date(a.endDate).toISOString().slice(0, 10) : '',
      isActive: a.isActive,
    })
    setEditOpen(true)
  }

  const openDeleteDialog = (a: Assignment) => {
    setSelected(a)
    setDeleteOpen(true)
  }

  const resetFilters = () => {
    setFilterEmployee('')
    setFilterProject('')
    setFilterStatus('')
    setSearchText('')
  }

  const hasActiveFilters = filterEmployee || filterProject || filterStatus || searchText

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ────────────── KPI Cards ────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Assignments</p>
                <p className="text-sm font-bold">{totalAssignments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Active Assignments</p>
                <p className="text-sm font-bold">{activeAssignments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Multi-Project Employees</p>
                <p className="text-sm font-bold">{multiProjectEmployeeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Unassigned Employees</p>
                <p className="text-sm font-bold text-orange-600">{unassignedEmployeeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ────────────── Header + Filters ────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Project Assignments
          </h3>
          <Button size="sm" className="h-8 text-xs" onClick={() => { setForm({ ...emptyForm }); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Assign Employee
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-7 text-xs pl-7"
              placeholder="Search by name, code, project..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <Select value={filterEmployee} onValueChange={(v) => setFilterEmployee(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.employeeCode} — {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProject} onValueChange={(v) => setFilterProject(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={resetFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}

          <Button variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={() => fetchAssignments()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ────────────── Assignments Table ────────────── */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Employee</TableHead>
                  <TableHead className="text-[10px]">Code</TableHead>
                  <TableHead className="text-[10px]">Project</TableHead>
                  <TableHead className="text-[10px]">Role</TableHead>
                  <TableHead className="text-[10px] text-right">Salary Amount</TableHead>
                  <TableHead className="text-[10px]">Allocation Type</TableHead>
                  <TableHead className="text-[10px] text-right">Allocation</TableHead>
                  <TableHead className="text-[10px]">Start Date</TableHead>
                  <TableHead className="text-[10px]">End Date</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((a) => {
                  const isMulti = (activeByEmployee[a.employeeId]?.length ?? 0) > 1
                  const allocTotal = employeeAllocationTotals[a.employeeId]

                  return (
                    <TableRow key={a.id} className={!a.isActive ? 'opacity-50' : ''}>
                      {/* Employee Name + multi-project indicator */}
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{a.employee?.name || '—'}</span>
                          {isMulti && a.isActive && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    className="text-[8px] px-1 py-0 cursor-help bg-violet-100 text-violet-800 border-violet-200"
                                  >
                                    <Layers className="h-2.5 w-2.5 mr-0.5" />
                                    {activeByEmployee[a.employeeId]?.length}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-xs">
                                  <p className="font-semibold mb-1">
                                    {a.employee?.name} — Multiple Active Assignments
                                  </p>
                                  {allocTotal && (
                                    <div className="space-y-1 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px]">Total allocation:</span>
                                        <span className="font-bold">{allocTotal.total}%</span>
                                      </div>
                                      <Progress
                                        value={Math.min(allocTotal.total, 100)}
                                        className="h-1.5 w-24"
                                      />
                                    </div>
                                  )}
                                  <ul className="space-y-0.5">
                                    {activeByEmployee[a.employeeId]?.map((asgn) => (
                                      <li key={asgn.id} className="text-[10px] flex items-center gap-1">
                                        <span className="font-medium">{asgn.project?.name}</span>
                                        {asgn.allocationType === 'percentage' && (
                                          <Badge className="text-[8px] px-1 py-0 bg-violet-50 text-violet-700">
                                            {asgn.allocationValue}%
                                          </Badge>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-mono">
                        {a.employee?.employeeCode || '—'}
                      </TableCell>

                      <TableCell className="text-xs">
                        <div>
                          <span className="font-medium">{a.project?.name || '—'}</span>
                          <span className="text-[9px] text-muted-foreground ml-1">
                            ({a.project?.code})
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">{a.role || '—'}</TableCell>

                      <TableCell className="text-xs text-right font-mono">
                        {a.salaryAmount > 0 ? formatCurrency(a.salaryAmount) : '—'}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={`text-[9px] ${allocationTypeBadgeStyles[a.allocationType] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {allocationTypeLabels[a.allocationType] || a.allocationType}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-right">
                        {a.allocationType === 'percentage' ? (
                          <span className="font-semibold">{a.allocationValue}%</span>
                        ) : a.allocationType === 'fixed' ? (
                          <span className="font-mono">{formatCurrency(a.allocationValue)}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-[10px]">Dynamic</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">{formatDate(a.startDate)}</TableCell>
                      <TableCell className="text-xs">{formatDate(a.endDate)}</TableCell>

                      <TableCell>
                        <Badge
                          className={`text-[9px] ${
                            a.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {a.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleToggleActive(a)}
                                >
                                  <Power
                                    className={`h-3 w-3 ${
                                      a.isActive ? 'text-orange-500' : 'text-green-500'
                                    }`}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {a.isActive ? 'Deactivate' : 'Reactivate'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openEditDialog(a)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openDeleteDialog(a)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">Loading assignments...</span>
            </div>
          )}

          {!loading && filteredAssignments.length === 0 && (
            <div className="text-center py-8">
              <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? 'No assignments match the current filters.'
                  : 'No assignments found. Click "Assign Employee" to create one.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────────── Create Assignment Dialog ────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Assign Employee to Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Employee + Project row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Employee <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.employeeId}
                  onValueChange={(v) => setForm((p) => ({ ...p, employeeId: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {employees
                      .filter((e) => e.status === 'active')
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.employeeCode} — {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => setForm((p) => ({ ...p, projectId: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {projects
                      .filter((p) => p.status === 'active')
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Role / Designation</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g., Site Engineer, Project Manager"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              />
            </div>

            {/* Salary Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Salary Amount (PKR)</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="Project-specific salary"
                value={form.salaryAmount || ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, salaryAmount: parseFloat(e.target.value) || 0 }))
                }
              />
              <p className="text-[9px] text-muted-foreground">
                Override salary for this project assignment. Leave 0 to use employee default.
              </p>
            </div>

            {/* Allocation Configuration */}
            <div className="border rounded-md p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Allocation Configuration
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Allocation Type</Label>
                  <Select
                    value={form.allocationType}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        allocationType: v,
                        allocationValue: v === 'percentage' ? 100 : v === 'fixed' ? 0 : 0,
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="attendance_based">Attendance Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {form.allocationType === 'percentage'
                      ? 'Allocation %'
                      : form.allocationType === 'fixed'
                        ? 'Fixed Amount (PKR)'
                        : 'Default Value'}
                  </Label>
                  {form.allocationType === 'attendance_based' ? (
                    <Input
                      className="h-8 text-xs bg-muted"
                      value="Calculated dynamically"
                      disabled
                    />
                  ) : (
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      min={form.allocationType === 'percentage' ? 1 : 0}
                      max={form.allocationType === 'percentage' ? 100 : undefined}
                      value={form.allocationValue || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          allocationValue: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  )}
                </div>
              </div>

              {/* Allocation preview for percentage type */}
              {form.allocationType === 'percentage' && form.employeeId && (
                <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                  {(() => {
                    const existing = assignments.filter(
                      (a) =>
                        a.employeeId === form.employeeId &&
                        a.isActive &&
                        a.allocationType === 'percentage'
                    )
                    const currentTotal = existing.reduce((s, a) => s + a.allocationValue, 0)
                    const newTotal = currentTotal + form.allocationValue
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span>Current allocation:</span>
                          <span className="font-mono font-semibold">{currentTotal}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>After adding:</span>
                          <span
                            className={`font-mono font-bold ${
                              newTotal > 100 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {newTotal}%
                          </span>
                        </div>
                        {newTotal > 100 && (
                          <p className="text-red-600 font-medium">
                            ⚠ Total allocation exceeds 100%
                          </p>
                        )}
                        <Progress value={Math.min(newTotal, 100)} className="h-1.5" />
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Info for attendance_based */}
              {form.allocationType === 'attendance_based' && (
                <div className="text-[10px] text-muted-foreground bg-cyan-50 rounded p-2 border border-cyan-200">
                  Attendance-based allocation is calculated dynamically during payroll processing
                  based on the employee&apos;s actual attendance records for each project.
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">End Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
                <p className="text-[9px] text-muted-foreground">Leave blank for ongoing assignment</p>
              </div>
            </div>

            {/* Active toggle hint */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Badge className={`text-[9px] ${form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {form.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <span>
                Status is auto-determined based on dates. You can override it.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Assignment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────── Edit Assignment Dialog ────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Assignment</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Read-only employee/project info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Employee</Label>
                  <Input
                    className="h-8 text-xs bg-muted"
                    value={`${selected.employee?.employeeCode} — ${selected.employee?.name}`}
                    disabled
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Project</Label>
                  <Input
                    className="h-8 text-xs bg-muted"
                    value={`${selected.project?.code} — ${selected.project?.name}`}
                    disabled
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Role / Designation</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g., Site Engineer, Project Manager"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                />
              </div>

              {/* Salary Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Salary Amount (PKR)</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={form.salaryAmount || ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, salaryAmount: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>

              {/* Allocation Configuration */}
              <div className="border rounded-md p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Allocation Configuration
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Allocation Type</Label>
                    <Select
                      value={form.allocationType}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          allocationType: v,
                          allocationValue:
                            v === 'percentage' ? 100 : v === 'fixed' ? 0 : 0,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="attendance_based">Attendance Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {form.allocationType === 'percentage'
                        ? 'Allocation %'
                        : form.allocationType === 'fixed'
                          ? 'Fixed Amount (PKR)'
                          : 'Default Value'}
                    </Label>
                    {form.allocationType === 'attendance_based' ? (
                      <Input
                        className="h-8 text-xs bg-muted"
                        value="Calculated dynamically"
                        disabled
                      />
                    ) : (
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        min={form.allocationType === 'percentage' ? 1 : 0}
                        max={form.allocationType === 'percentage' ? 100 : undefined}
                        value={form.allocationValue || ''}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            allocationValue: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    )}
                  </div>
                </div>

                {/* Allocation preview for percentage type */}
                {form.allocationType === 'percentage' && selected && (
                  <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2">
                    {(() => {
                      const existing = assignments.filter(
                        (a) =>
                          a.employeeId === selected.employeeId &&
                          a.isActive &&
                          a.allocationType === 'percentage' &&
                          a.id !== selected.id
                      )
                      const currentTotal = existing.reduce(
                        (s, a) => s + a.allocationValue,
                        0
                      )
                      const newTotal = currentTotal + form.allocationValue
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Other active allocations:</span>
                            <span className="font-mono font-semibold">{currentTotal}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Total after update:</span>
                            <span
                              className={`font-mono font-bold ${
                                newTotal > 100 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {newTotal}%
                            </span>
                          </div>
                          {newTotal > 100 && (
                            <p className="text-red-600 font-medium">
                              ⚠ Total allocation exceeds 100%
                            </p>
                          )}
                          <Progress value={Math.min(newTotal, 100)} className="h-1.5" />
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">End Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Active status */}
              <div className="flex items-center gap-3">
                <Label className="text-xs font-medium">Status</Label>
                <Badge
                  className={`text-[9px] ${
                    form.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {form.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                >
                  Toggle
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleEdit} disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Assignment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────── Delete Confirmation Dialog ────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {selected && (
                <>
                  Are you sure you want to delete the assignment of{' '}
                  <span className="font-semibold">{selected.employee?.name}</span> to project{' '}
                  <span className="font-semibold">{selected.project?.name}</span>?
                  {selected.isActive && (
                    <span className="block mt-2 text-orange-600 font-medium">
                      This assignment is currently active. Consider deactivating it instead of
                      deleting.
                    </span>
                  )}
                  {selected.salaryAmount > 0 && (
                    <span className="block mt-1">
                      Salary amount: <span className="font-mono">{formatCurrency(selected.salaryAmount)}</span>
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8" disabled={submitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
