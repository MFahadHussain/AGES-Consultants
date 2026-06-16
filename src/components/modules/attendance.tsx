'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CalendarCheck, Users, AlertTriangle, Clock, Save, RotateCcw, Check, Layers, Loader2, Eye, Play } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Constants ──────────────────────────────────────────────
const VALID_STATUSES = ['P', 'W', 'H', 'CL', 'SL', 'EL', 'CO', 'T', 'WH', 'A', 'PW', 'TW', 'WHW', 'PH', 'TH', 'WHH', 'WW', 'CD'] as const
type AttendanceStatus = (typeof VALID_STATUSES)[number]

/** Billable statuses — require a projectId */
const BILLABLE_STATUSES = new Set<string>(['P', 'W', 'H', 'WH', 'T', 'CO', 'PW', 'TW', 'WHW', 'PH', 'TH', 'WHH', 'WW'])

/** Statuses that require/allow a project assignment — billable + paid leave */
const PROJECT_REQUIRED_STATUSES = new Set<string>([
  'P', 'W', 'H', 'WH', 'T', 'CO', 'PW', 'TW', 'WHW', 'PH', 'TH', 'WHH', 'WW', 'CL', 'SL', 'EL', 'A'
])

/** Alias kept for backward compat in grid rendering */
const WORKING_STATUSES = BILLABLE_STATUSES

const STATUS_LABELS: Record<string, string> = {
  P: 'Present',
  W: 'Weekend',
  H: 'Holiday Working',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  EL: 'Earned Leave',
  CO: 'Comp Off',
  T: 'Tour',
  WH: 'Work from Home',
  A: 'Absent',
  PW: 'Present on Weekend',
  TW: 'Tour on Weekend',
  WHW: 'Work from Home on Weekend',
  PH: 'Present on Holiday',
  TH: 'Tour on Holiday',
  WHH: 'Work from Home on Holiday',
  WW: 'Work on Weekend',
  CD: 'Compensatory Deduction',
}

const SC_EARN_STATUSES = new Set<string>(['P', 'W', 'H', 'T', 'WH', 'PW', 'TW', 'WHW', 'PH', 'TH', 'WHH', 'WW'])
const SC_DEDUCT_STATUSES = new Set<string>(['CL', 'SL', 'EL', 'CO'])
const SC_NO_IMPACT_STATUSES = new Set<string>(['A', 'CD'])

function getScCategory(status: string): 'earn' | 'deduct' | 'none' {
  if (SC_EARN_STATUSES.has(status)) return 'earn'
  if (SC_DEDUCT_STATUSES.has(status)) return 'deduct'
  return 'none'
}

// Color mapping for status badges in the grid (premium styling matching the prototype)
const STATUS_COLORS: Record<string, string> = {
  P: 'bg-[#EAF3DE] text-[#27500A] border-[#D6ECBD]',
  W: 'bg-[#E6F1FB] text-[#0C447C] border-[#CBE0FA]',
  H: 'bg-[#B5D4F4] text-[#042C53] border-[#91C1F2]',
  CL: 'bg-[#FAEEDA] text-[#633806] border-[#F7DFB6]',
  SL: 'bg-[#FAC775] text-[#412402] border-[#F9B74F]',
  EL: 'bg-[#F5C4B3] text-[#4A1B0C] border-[#F0AA92]',
  CO: 'bg-[#D3D1C7] text-[#2C2C2A] border-[#BCB9AD]',
  T: 'bg-[#9FE1CB] text-[#04342C] border-[#7FD6B7]',
  WH: 'bg-[#CECBF6] text-[#26215C] border-[#B2ADF2]',
  A: 'bg-[#FCEBEB] text-[#791F1F] border-[#FAC8C8]',
  PW: 'bg-[#C0DD97] text-[#173404] border-[#A8CE74]',
  TW: 'bg-[#5DCAA5] text-[#04342C] border-[#3FBC91]',
  WHW: 'bg-[#AFA9EC] text-[#26215C] border-[#8D84E5]',
  PH: 'bg-[#97C459] text-[#173404] border-[#7FAD3D]',
  TH: 'bg-[#1D9E75] text-[#04342C] border-[#167D5D]',
  WHH: 'bg-[#7F77DD] text-[#EEEDFE] border-[#5E55CE]',
  WW: 'bg-[#E6F1FB] text-[#0C447C] border-[#CBE0FA]',
  CD: 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]',
}

// Dynamic cycle categories
const CYCLE: Record<'regular' | 'weekend' | 'holiday', (AttendanceStatus | '')[]> = {
  regular: ['P', 'WH', 'T', 'CO', 'CL', 'SL', 'EL', 'A', ''],
  weekend: ['W', 'PW', 'TW', 'WHW', ''],
  holiday: ['H', 'PH', 'TH', 'WHH', ''],
}

// Default project list (fallback if API fails)
const DEFAULT_PROJECTS = ['Unallocated', 'Proj Alpha', 'Proj Beta', 'Proj Gamma', 'Proj Delta']

// ── Types ──────────────────────────────────────────────────
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
  status?: string
}

interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  status: string
  projectId?: string | null
  checkInTime?: string | null
  checkOutTime?: string | null
  remarks?: string | null
}

interface DayData {
  status: AttendanceStatus | ''
  project: string | null
  projectId: string | null
  recordId: string | null
  changed: boolean
  autoAssigned?: boolean
  manuallyOverridden?: boolean
}

interface ProjectAssignment {
  id: string
  employeeId: string
  projectId: string
  project: { id: string; code: string; name: string }
  employee: { id: string; name: string; employeeCode: string }
  isActive: boolean
  startDate: string
  endDate: string | null
  allocationType: string
  allocationValue: number
}

// ── Helpers ────────────────────────────────────────────────
function getDaysInMonth(yearMonth: string): number {
  if (!yearMonth) return 31
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function getDayOfWeek(yearMonth: string, day: number): number {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

function formatMonthLabel(yearMonth: string): string {
  if (!yearMonth) return ''
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Get a short display name for a project (e.g. "Proj Alpha" → "Alpha") */
function getShortProjectName(name: string): string {
  if (name === 'Unallocated') return 'Unalloc'
  if (name.startsWith('Proj ')) return name.slice(5)
  if (name.includes(' - ')) return name.split(' - ')[0].trim()
  return name.length > 8 ? name.slice(0, 8) : name
}

// ── Component ──────────────────────────────────────────────
export function AttendanceModule() {
  const { toast } = useToast()

  // Data
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth())

  // Grid state: employeeId -> day -> DayData
  const [gridData, setGridData] = useState<Record<string, Record<number, DayData>>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // Popover state for project selection
  const [popoverCell, setPopoverCell] = useState<{ empId: string; day: number } | null>(null)
  const [popoverProject, setPopoverProject] = useState<string>('Unallocated')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Project assignments from API
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([])

  // Quick-fill project picker state
  const [quickFillProjectPicker, setQuickFillProjectPicker] = useState<{
    employeeId: string
    status: AttendanceStatus
    filledCount: number
  } | null>(null)
  const [quickFillSelectedProject, setQuickFillSelectedProject] = useState<string>('')

  // Bulk Fill state
  const [bulkFillOpen, setBulkFillOpen] = useState(false)
  const [bulkFillStartDate, setBulkFillStartDate] = useState<string>('')
  const [bulkFillEndDate, setBulkFillEndDate] = useState<string>('')
  const [bulkFillProjectId, setBulkFillProjectId] = useState<string>('')
  const [bulkFillPreview, setBulkFillPreview] = useState<{ unassignedDays: number; totalBillableDays: number; alreadyAssignedDays: number } | null>(null)
  const [bulkFillLoading, setBulkFillLoading] = useState(false)
  const [bulkFillApplying, setBulkFillApplying] = useState(false)

  // Holiday state (persisted by month in localStorage)
  const [holidays, setHolidays] = useState<number[]>([])
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false)

  // Load holidays whenever selectedMonth changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`holidays_${selectedMonth}`)
      if (stored) {
        try {
          setHolidays(JSON.parse(stored))
        } catch (e) {
          setHolidays([])
        }
      } else {
        setHolidays([])
      }
    }
  }, [selectedMonth])

  // Save holidays helper
  const saveHolidays = (days: number[]) => {
    setHolidays(days)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`holidays_${selectedMonth}`, JSON.stringify(days))
    }
  }

  // Stats from API (single employee view)
  const [summaryStats, setSummaryStats] = useState<{
    presentDays: number
    absentDays: number
    leaveDays: number
    earnedSC: number
    deductedSC: number
    netSC: number
  } | null>(null)

  // ── Project name list for dropdown ─────────────────────
  const projectNames = useMemo(() => {
    if (projects.length > 0) {
      return ['Unallocated', ...projects.map(p => p.name)]
    }
    return DEFAULT_PROJECTS
  }, [projects])

  /** Map a projectId to a project name */
  const projectIdToName = useCallback((projectId: string | null | undefined): string | null => {
    if (!projectId) return null
    const proj = projects.find(p => p.id === projectId)
    return proj ? proj.name : null
  }, [projects])

  /** Map a project name to a projectId */
  const projectNameToId = useCallback((projectName: string | null | undefined): string | null => {
    if (!projectName || projectName === 'Unallocated') return null
    const proj = projects.find(p => p.name === projectName)
    return proj ? proj.id : null
  }, [projects])

  /** Get employee's active project assignments */
  const getEmployeeProjects = useCallback((empId: string) => {
    return projectAssignments.filter(a => a.employeeId === empId && a.isActive === true)
  }, [projectAssignments])

  // ── Click outside to close popover ─────────────────────
  useEffect(() => {
    if (!popoverCell) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverCell(null)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [popoverCell])

  // ── Bulk Fill: set default date range when dialog opens ──
  useEffect(() => {
    if (bulkFillOpen && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number)
      const lastDay = getDaysInMonth(selectedMonth)
      setBulkFillStartDate(`${y}-${String(m).padStart(2, '0')}-01`)
      setBulkFillEndDate(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
      setBulkFillPreview(null)
      setBulkFillProjectId('')
    }
  }, [bulkFillOpen, selectedMonth])

  // ── Fetches ────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?pageSize=200')
      const data = await res.json()
      const emps = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      setEmployees(emps.filter((e: Employee) => e.status === 'active'))
    } catch { /* ignore */ }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (Array.isArray(data)) {
        setProjects(data.filter((p: Project) => p.status === 'active' || !p.status))
      }
    } catch { /* ignore */ }
  }, [])

  const fetchProjectAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/project-assignments?currentActive=true')
      const data = await res.json()
      if (Array.isArray(data)) {
        setProjectAssignments(data)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchAttendanceData = useCallback(async () => {
    if (!selectedMonth) return
    setLoading(true)
    try {
      if (selectedEmployeeId) {
        // Single employee view - use the monthly view from API
        const res = await fetch(`/api/attendance?employeeId=${selectedEmployeeId}&month=${selectedMonth}&view=monthly`)
        const data = await res.json()
        if (data.calendar) {
          const newGrid: Record<string, Record<number, DayData>> = {}
          const dayMap: Record<number, DayData> = {}
          for (const day of data.calendar) {
            const recStatus = day.record?.status || ''
            const needsProject = PROJECT_REQUIRED_STATUSES.has(recStatus)
            // Use dailyProject data if available, else fall back to record.projectId
            const dpProjectId = day.dailyProject?.projectId || day.record?.projectId || null
            const projName = dpProjectId ? projectIdToName(dpProjectId) : null

            dayMap[day.day] = {
              status: recStatus,
              project: needsProject ? (projName || 'Unallocated') : null,
              projectId: needsProject ? (dpProjectId || null) : null,
              recordId: day.record?.id || null,
              changed: false,
            }
          }
          newGrid[selectedEmployeeId] = dayMap
          setGridData(newGrid)
          setSummaryStats({
            presentDays: data.presentDays || 0,
            absentDays: data.absentDays || 0,
            leaveDays: data.leaveDays || 0,
            earnedSC: data.earnedSC || 0,
            deductedSC: data.deductedSC || 0,
            netSC: data.netSC || 0,
          })
        }
        setRecords([])
      } else {
        // All employees view - fetch records for the month
        const res = await fetch(`/api/attendance?month=${selectedMonth}&pageSize=500`)
        const data = await res.json()
        const recs = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
        setRecords(recs)

        // Build grid from records
        const newGrid: Record<string, Record<number, DayData>> = {}
        for (const rec of recs) {
          const day = new Date(rec.date).getUTCDate()
          if (!newGrid[rec.employeeId]) newGrid[rec.employeeId] = {}
          const isBillable = BILLABLE_STATUSES.has(rec.status)
          const needsProject = PROJECT_REQUIRED_STATUSES.has(rec.status)
          const projName = rec.projectId ? projectIdToName(rec.projectId) : null

          // Check if API provided dailyProject data
          const dpData = (rec as any).dailyProject
          const dpProjectId = dpData?.projectId || rec.projectId || null
          const dpProjName = dpProjectId ? projectIdToName(dpProjectId) : projName

          newGrid[rec.employeeId][day] = {
            status: rec.status as AttendanceStatus,
            project: needsProject ? (dpProjName || 'Unallocated') : null,
            projectId: needsProject ? (dpProjectId || null) : null,
            recordId: rec.id,
            changed: false,
          }
        }
        // Ensure all active employees have entries in grid
        for (const emp of employees) {
          if (!newGrid[emp.id]) newGrid[emp.id] = {}
        }
        setGridData(newGrid)
        setSummaryStats(null)
      }
      setHasChanges(false)
    } catch {
      toast({ title: 'Error', description: 'Failed to load attendance data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [selectedEmployeeId, selectedMonth, employees, toast, projectIdToName])

  useEffect(() => {
    queueMicrotask(() => { fetchEmployees() })
  }, [fetchEmployees])

  useEffect(() => {
    queueMicrotask(() => { fetchProjects() })
  }, [fetchProjects])

  useEffect(() => {
    queueMicrotask(() => { fetchProjectAssignments() })
  }, [fetchProjectAssignments])

  useEffect(() => {
    if (employees.length > 0 || selectedEmployeeId) {
      fetchAttendanceData()
    }
  }, [selectedEmployeeId, selectedMonth, fetchAttendanceData])

  // Re-fetch when employees list loads
  useEffect(() => {
    if (employees.length > 0 && selectedMonth) {
      fetchAttendanceData()
    }
  }, [employees.length, selectedMonth, fetchAttendanceData])

  // ── Grid interaction ───────────────────────────────────
  /** Handle cell click - cycles status based on day category and always opens project selector if project required */
  const handleCellClick = (employeeId: string, day: number) => {
    const empGrid = gridData[employeeId] || {}
    const dow = getDayOfWeek(selectedMonth, day)
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = holidays.includes(day)
    const cellType: 'regular' | 'weekend' | 'holiday' = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'regular'

    const cyc = CYCLE[cellType]
    const currentStatus = (empGrid[day]?.status || '') as AttendanceStatus | ''
    const idx = cyc.indexOf(currentStatus)
    const nextStatus = cyc[(idx + 1) % cyc.length]

    const needsProject = PROJECT_REQUIRED_STATUSES.has(nextStatus)

    // Determine project for the selected status
    let projectValue: string | null = null
    let projectIdValue: string | null = null
    const existingDayData = empGrid[day]
    const employeeProjects = getEmployeeProjects(employeeId)

    if (needsProject) {
      const existingProject = existingDayData?.project
      if (existingProject && existingProject !== 'Unallocated') {
        projectValue = existingProject
        projectIdValue = existingDayData?.projectId || null
      } else if (employeeProjects.length > 0) {
        projectValue = employeeProjects[0].project.name
        projectIdValue = employeeProjects[0].projectId
      } else {
        projectValue = 'Unallocated'
        projectIdValue = null
      }
    }

    // Cycle the status
    setGridData(prev => {
      const empGrid = { ...(prev[employeeId] || {}) }
      empGrid[day] = {
        status: nextStatus,
        project: projectValue,
        projectId: projectIdValue,
        recordId: empGrid[day]?.recordId || null,
        changed: true,
      }
      return { ...prev, [employeeId]: empGrid }
    })
    setHasChanges(true)

    // ALWAYS open the project popover picker if nextStatus requires a project
    if (nextStatus && needsProject) {
      setPopoverProject(projectValue || 'Unallocated')
      setPopoverCell({ empId: employeeId, day })
    } else {
      setPopoverCell(null)
    }
  }

  /** Handle click on project chip — always opens popover to select/change project */
  const handleProjectChipClick = (e: React.MouseEvent, employeeId: string, day: number) => {
    e.stopPropagation()
    const dayData = gridData[employeeId]?.[day]
    if (!dayData || !PROJECT_REQUIRED_STATUSES.has(dayData.status)) return

    setPopoverProject(dayData.project || 'Unallocated')
    setPopoverCell({ empId: employeeId, day })
  }

  /** Confirm project selection in popover */
  const confirmPopoverProject = () => {
    if (!popoverCell) return
    const { empId, day } = popoverCell
    const resolvedProjectId = projectNameToId(popoverProject)
    setGridData(prev => {
      const empGrid = { ...(prev[empId] || {}) }
      empGrid[day] = {
        ...empGrid[day],
        project: popoverProject,
        projectId: resolvedProjectId,
        changed: true,
        manuallyOverridden: true,
      }
      return { ...prev, [empId]: empGrid }
    })
    setHasChanges(true)
    setPopoverCell(null)
  }

  /** Get filtered project names for an employee's popover */
  const getFilteredProjectNames = useCallback((empId: string) => {
    const employeeProjects = getEmployeeProjects(empId)
    if (employeeProjects.length > 0) {
      return ['Unallocated', ...employeeProjects.map(a => a.project.name)]
    }
    return projectNames
  }, [getEmployeeProjects, projectNames])

  const resetChanges = () => {
    setPopoverCell(null)
    fetchAttendanceData()
  }

  // ── Bulk Fill Handlers ──────────────────────────────────
  const handleBulkFillPreview = async () => {
    if (!selectedEmployeeId || !bulkFillStartDate || !bulkFillEndDate) return
    setBulkFillLoading(true)
    try {
      const res = await fetch('/api/attendance/bulk-fill/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          startDate: bulkFillStartDate,
          endDate: bulkFillEndDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setBulkFillPreview({
        unassignedDays: data.unassignedDays || 0,
        totalBillableDays: data.totalBillableDays || 0,
        alreadyAssignedDays: data.alreadyAssignedDays || 0,
      })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBulkFillLoading(false)
    }
  }

  const handleBulkFillApply = async () => {
    if (!selectedEmployeeId || !bulkFillStartDate || !bulkFillEndDate || !bulkFillProjectId) return
    setBulkFillApplying(true)
    try {
      const res = await fetch('/api/attendance/bulk-fill/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          startDate: bulkFillStartDate,
          endDate: bulkFillEndDate,
          projectId: bulkFillProjectId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Apply failed')
      toast({
        title: 'Bulk Fill Applied',
        description: `Assigned project to ${data.filled || 0} unassigned billable days`,
      })
      setBulkFillOpen(false)
      setBulkFillPreview(null)
      // Refresh data
      fetchAttendanceData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setBulkFillApplying(false)
    }
  }

  // ── Bulk Save ──────────────────────────────────────────
  const handleBulkSave = async () => {
    const bulkRecords: { employeeId: string; date: string; status: string; projectId?: string | null }[] = []
    const daysInMonth = getDaysInMonth(selectedMonth)
    const [year, month] = selectedMonth.split('-').map(Number)

    for (const [employeeId, dayMap] of Object.entries(gridData)) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = dayMap[day]
        if (dayData?.changed && dayData.status) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isBillable = BILLABLE_STATUSES.has(dayData.status)
          const needsProject = PROJECT_REQUIRED_STATUSES.has(dayData.status)

          // Resolve projectId: prefer stored projectId, else resolve from name
          let resolvedProjectId: string | null = dayData.projectId || null
          if (!resolvedProjectId && needsProject && dayData.project && dayData.project !== 'Unallocated') {
            resolvedProjectId = projectNameToId(dayData.project)
          }

          // Project-required statuses need projectId; truly non-project statuses should clear it
          bulkRecords.push({
            employeeId,
            date: dateStr,
            status: dayData.status,
            projectId: needsProject ? resolvedProjectId : null,
          })
        }
      }
    }

    if (bulkRecords.length === 0) {
      toast({ title: 'No Changes', description: 'No changes to save' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: bulkRecords }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      const { summary } = data
      toast({
        title: 'Saved',
        description: `Created: ${summary?.created || 0}, Updated: ${summary?.updated || 0}, Failed: ${summary?.failed || 0}`,
      })
      setHasChanges(false)
      fetchAttendanceData()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Computed Stats (for all-employees view) ────────────
  const computedStats = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedMonth)
    let totalPresent = 0
    let totalAbsent = 0
    let totalLeave = 0
    let totalRecords = 0
    let scEligible = 0
    let scDeduct = 0

    for (const dayMap of Object.values(gridData)) {
      for (let day = 1; day <= daysInMonth; day++) {
        const status = dayMap[day]?.status
        if (status) {
          totalRecords++
          const cat = getScCategory(status)
          if (cat === 'earn') {
            totalPresent++
            scEligible++
          } else if (cat === 'deduct') {
            totalLeave++
            scDeduct++
          } else if (status === 'A' || status === 'CD') {
            totalAbsent++
          } else {
            totalPresent++
          }
        }
      }
    }
    return { totalRecords, totalPresent, totalAbsent, totalLeave, scEligible, scDeduct }
  }, [gridData, selectedMonth])

  // For single employee view, use API stats
  const displayStats = selectedEmployeeId && summaryStats
    ? {
        totalRecords: summaryStats.presentDays + summaryStats.absentDays + summaryStats.leaveDays,
        totalPresent: summaryStats.presentDays,
        totalAbsent: summaryStats.absentDays,
        totalLeave: summaryStats.leaveDays,
        scEligible: summaryStats.earnedSC,
        scDeduct: summaryStats.deductedSC,
      }
    : computedStats

  const daysInMonth = getDaysInMonth(selectedMonth)
  const presentPct = displayStats.totalRecords > 0
    ? Math.round((displayStats.totalPresent / displayStats.totalRecords) * 100)
    : '0'

  // ── Month navigation ──────────────────────────────────
  const goToPrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    setSelectedMonth(prev)
  }

  const goToNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    setSelectedMonth(next)
  }

  // ── Bulk Fill: employee assigned projects for dropdown ──
  const bulkFillEmployeeProjects = useMemo(() => {
    if (!selectedEmployeeId) return []
    return getEmployeeProjects(selectedEmployeeId)
  }, [selectedEmployeeId, getEmployeeProjects])

  // ── Render ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total Records</p>
                <p className="text-sm font-bold">{displayStats.totalRecords}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Present %</p>
                <p className="text-sm font-bold text-green-600">{presentPct}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Leave Days</p>
                <p className="text-sm font-bold">{displayStats.totalLeave}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-[10px] text-muted-foreground">Absent Days</p>
                <p className="text-sm font-bold text-red-600">{displayStats.totalAbsent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={goToPrevMonth}>
            &larr;
          </Button>
          <Input
            type="month"
            className="h-8 text-xs w-40"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={goToNextMonth}>
            &rarr;
          </Button>
          <span className="text-xs font-medium text-muted-foreground">{formatMonthLabel(selectedMonth)}</span>
        </div>
        <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Employees</SelectItem>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.employeeCode} - {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          {/* Holidays Configurator Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-blue-200 text-blue-700 bg-blue-50/10 hover:bg-blue-100/50"
            onClick={() => setHolidayDialogOpen(true)}
          >
            <Clock className="h-3.5 w-3.5 mr-1" />Select Holidays
          </Button>

          {/* Bulk Fill Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!selectedEmployeeId}
            onClick={() => setBulkFillOpen(true)}
          >
            <Layers className="h-3.5 w-3.5 mr-1" />Bulk Fill
          </Button>
          {hasChanges && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={resetChanges}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs" onClick={handleBulkSave} disabled={!hasChanges || saving}>
            <Save className="h-3.5 w-3.5 mr-1" />{saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Monthly Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="ml-2 text-xs text-muted-foreground">Loading attendance data...</span>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[600px] overflow-auto border rounded-md relative scrollbar-thin">
            <div className="min-w-[1300px]">
              <Table className="relative border-collapse">
                <TableHeader className="sticky top-0 bg-card z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                  <TableRow>
                    <TableHead className="text-[10px] sticky left-0 top-0 bg-card z-40 min-w-[140px] border-r shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Employee</TableHead>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const dow = getDayOfWeek(selectedMonth, day)
                      const isWeekend = dow === 0 || dow === 6
                      const isHoliday = holidays.includes(day)
                      return (
                        <TableHead
                          key={day}
                          className={`text-[9px] text-center p-0 w-8 min-w-8 cursor-pointer select-none transition-colors hover:bg-blue-100/30 sticky top-0 bg-card z-20 ${
                            isHoliday
                              ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold border-x border-blue-200/50'
                              : isWeekend
                                ? 'bg-muted/50 text-orange-600'
                                : ''
                          }`}
                          onClick={() => {
                            const updated = isHoliday
                              ? holidays.filter(d => d !== day)
                              : [...holidays, day]
                            saveHolidays(updated)
                            
                            // Automatically default to H for empty/default statuses
                            setGridData(prev => {
                              const next = { ...prev }
                              for (const empId of Object.keys(next)) {
                                const empGrid = { ...next[empId] }
                                const currentDay = empGrid[day] || {}
                                if (!currentDay.status || currentDay.status === 'P' || currentDay.status === 'A' || currentDay.status === '') {
                                  empGrid[day] = {
                                    ...currentDay,
                                    status: isHoliday ? '' : 'H',
                                    changed: true
                                  }
                                }
                                next[empId] = empGrid
                              }
                              setHasChanges(true)
                              return next
                            })
                          }}
                          title="Click to toggle Holiday"
                        >
                          <div>{day}</div>
                          <div className="text-[7px] font-normal">
                            {isHoliday ? 'Holi' : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow]}
                          </div>
                        </TableHead>
                      )
                    })}
                    <TableHead className="text-[9px] text-center sticky top-0 bg-card z-20 min-w-[56px]">Present</TableHead>
                    <TableHead className="text-[9px] text-center sticky top-0 bg-card z-20 min-w-[56px]">Absent</TableHead>
                    <TableHead className="text-[9px] text-center sticky top-0 bg-card z-20 min-w-[56px]">Leave</TableHead>
                    <TableHead className="text-[9px] text-center sticky top-0 bg-card z-20 min-w-[56px]">SC-Earn</TableHead>
                    <TableHead className="text-[9px] text-center sticky top-0 bg-card z-20 min-w-[56px]">SC-De</TableHead>
                    <TableHead className="text-[9px] text-center sticky top-0 bg-card z-20 min-w-[100px]">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedEmployeeId
                    ? employees.filter(e => e.id === selectedEmployeeId)
                    : employees
                  ).map(emp => {
                    const empGrid = gridData[emp.id] || {}
                    let present = 0
                    let absent = 0
                    let leave = 0
                    let scEarn = 0
                    let scDeduct = 0

                    // Compute project summary for this employee
                    const projectCounts: Record<string, number> = {}

                    for (let day = 1; day <= daysInMonth; day++) {
                      const s = empGrid[day]?.status
                      if (s) {
                        const cat = getScCategory(s)
                        if (cat === 'earn') { present++; scEarn++ }
                        else if (cat === 'deduct') { leave++; scDeduct++ }
                        else if (s === 'A' || s === 'CD') absent++
                        else present++

                        // Count projects
                        const proj = empGrid[day]?.project
                        if (proj && PROJECT_REQUIRED_STATUSES.has(s)) {
                          projectCounts[proj] = (projectCounts[proj] || 0) + 1
                        }
                      }
                    }

                    // Build project summary lines
                    const projectLines = Object.entries(projectCounts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, count]) => ({
                        short: getShortProjectName(name),
                        count,
                      }))

                    const hasOnlyUnallocated = projectLines.length === 1 && projectLines[0].short === 'Unalloc'
                    const showDash = projectLines.length === 0 || hasOnlyUnallocated

                    let coCount = 0
                    for (let day = 1; day <= daysInMonth; day++) {
                      const s = empGrid[day]?.status
                      if (s && ['PW', 'TW', 'WHW', 'PH', 'TH', 'WHH'].includes(s)) {
                        coCount++
                      }
                    }

                    return (
                      <TableRow key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <TableCell className="text-xs sticky left-0 bg-card z-10 min-w-[140px] border-r shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                          <div>
                            <p className="font-semibold text-[11px] truncate text-foreground">{emp.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-muted-foreground">{emp.employeeCode}</span>
                              {coCount > 0 && (
                                <Badge className="text-[8px] h-3.5 px-1 bg-amber-100 text-amber-800 border-amber-200">
                                  CO: {coCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                          const dow = getDayOfWeek(selectedMonth, day)
                          const isWeekend = dow === 0 || dow === 6
                          const dayData = empGrid[day]
                          const status = dayData?.status || ''
                          const changed = dayData?.changed || false
                          const project = dayData?.project
                          const colorClass = status ? (STATUS_COLORS[status] || 'bg-gray-50 text-gray-800') : ''
                          const isBillable = BILLABLE_STATUSES.has(status)
                          const showsProject = isBillable || PROJECT_REQUIRED_STATUSES.has(status)
                          const isPopoverOpen = popoverCell?.empId === emp.id && popoverCell?.day === day

                          return (
                            <TableCell
                              key={day}
                              className={`p-0 text-center cursor-pointer select-none relative ${
                                holidays.includes(day)
                                  ? 'bg-blue-50/20 dark:bg-blue-950/10 border-x border-blue-100/30'
                                  : isWeekend
                                    ? 'bg-orange-50/30'
                                    : ''
                              }`}
                              onClick={() => handleCellClick(emp.id, day)}
                              title={status ? `${STATUS_LABELS[status]} (${status})${project && showsProject ? ` - ${project}` : ''}${changed ? ' - Modified' : ''}` : 'Click to set status'}
                            >
                              <div
                                className={`flex flex-col items-center justify-center mx-0.5 my-0.5 transition-colors rounded-sm
                                  ${changed ? 'ring-2 ring-primary/40' : ''}
                                `}
                                style={{ minHeight: showsProject && project && project !== 'Unallocated' ? '40px' : '32px' }}
                              >
                                <div
                                  className={`text-[10px] font-bold leading-tight
                                    ${status ? colorClass : 'text-gray-300 hover:bg-muted/50'}
                                  `}
                                  style={{ padding: '2px 4px' }}
                                >
                                  {status || '·'}
                                </div>
                                {showsProject && project && (() => {
                                  const shortName = getShortProjectName(project)
                                  const isAuto = dayData?.autoAssigned === true
                                  const isOverridden = dayData?.manuallyOverridden === true
                                  const isUnalloc = project === 'Unallocated'

                                  let chipClass = 'bg-slate-100 text-slate-500'
                                  if (isAuto) chipClass = 'bg-slate-50 text-slate-600 italic'
                                  else if (isOverridden) chipClass = 'bg-amber-50 text-slate-600'
                                  else if (isUnalloc) chipClass = 'bg-slate-50 text-slate-400 italic'

                                  let chipTitle = project
                                  if (isAuto) chipTitle = `${project} (auto-assigned, click to override)`
                                  else if (isOverridden) chipTitle = `${project} (manually overridden)`

                                  return (
                                    <div
                                      className={`text-[8px] rounded px-1 truncate max-w-[64px] leading-tight cursor-pointer hover:bg-slate-200 transition-colors ${chipClass}`}
                                      onClick={(e) => handleProjectChipClick(e, emp.id, day)}
                                      title={chipTitle}
                                    >
                                      {isUnalloc
                                        ? 'Unalloc'
                                        : isAuto
                                          ? `${shortName} •auto`
                                          : isOverridden
                                            ? `${shortName} ✎`
                                            : shortName
                                      }
                                    </div>
                                  )
                                })()}
                              </div>

                              {/* Project Popover */}
                              {isPopoverOpen && (
                                <div
                                  ref={popoverRef}
                                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-md p-3 w-[200px] z-50"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="text-[11px] text-slate-500 font-medium mb-1">Project</div>
                                  <select
                                    className="w-full h-7 text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                                    value={popoverProject}
                                    onChange={(e) => setPopoverProject(e.target.value)}
                                  >
                                    {getFilteredProjectNames(popoverCell.empId).map(name => (
                                      <option key={name} value={name}>{name}</option>
                                    ))}
                                  </select>
                                  <div className="flex justify-end mt-2">
                                    <button
                                      className="bg-slate-900 text-white rounded px-2 py-1 text-[11px] flex items-center gap-1 hover:bg-slate-700 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        confirmPopoverProject()
                                      }}
                                    >
                                      <Check className="h-3 w-3" />
                                      Confirm
                                    </button>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-[10px] text-center font-bold text-green-700">{present}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-red-700">{absent}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-amber-700">{leave}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-emerald-700">{scEarn}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-orange-700">{scDeduct}</TableCell>
                        <TableCell className="text-[10px] text-left min-w-[100px]">
                          {showDash ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="space-y-0">
                              {projectLines.map(pl => (
                                <div key={pl.short} className="text-[10px] text-slate-500 leading-tight truncate">
                                  {pl.short} ×{pl.count}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {employees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={daysInMonth + 7} className="text-xs text-muted-foreground text-center py-8">
                        No active employees found. Add employees in the Employee Master module.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Status Legend */}
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] font-semibold text-muted-foreground mb-2">Status Legend (click cells to cycle, or use dropdown below)</p>
          <div className="flex flex-wrap gap-2">
            {VALID_STATUSES.map(s => {
              const cat = getScCategory(s)
              const scLabel = cat === 'earn' ? 'SC ✓' : cat === 'deduct' ? 'SC ✗' : 'SC —'
              const scColor = cat === 'earn' ? 'text-green-600' : cat === 'deduct' ? 'text-orange-600' : 'text-gray-400'
              const isBillable = BILLABLE_STATUSES.has(s)
              return (
                <div key={s} className="flex items-center gap-1">
                  <Badge className={`text-[9px] h-5 px-1.5 ${STATUS_COLORS[s] || ''}`}>{s}</Badge>
                  <span className="text-[9px] text-muted-foreground">{STATUS_LABELS[s]}</span>
                  <span className={`text-[8px] font-medium ${scColor}`}>{scLabel}</span>
                  {isBillable && <span className="text-[7px] text-blue-500">Proj</span>}
                </div>
              )
            })}
          </div>
          {/* Quick-fill toolbar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-[10px] text-muted-foreground">Quick fill selected employee:</span>
            {(['P', 'WH', 'W', 'WW', 'A', 'CL', 'SL', 'H'] as AttendanceStatus[]).map(s => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="h-6 text-[9px] px-2"
                disabled={!selectedEmployeeId}
                onClick={() => {
                  if (!selectedEmployeeId) return
                  const needsProject = PROJECT_REQUIRED_STATUSES.has(s)
                  const employeeProjects = getEmployeeProjects(selectedEmployeeId)

                  if (needsProject && employeeProjects.length > 1) {
                    // Multi-project: show picker instead of immediately filling
                    setQuickFillProjectPicker({
                      employeeId: selectedEmployeeId,
                      status: s,
                      filledCount: daysInMonth,
                    })
                    setQuickFillSelectedProject(employeeProjects[0].project.name)
                    return
                  }

                  setGridData(prev => {
                    const newGrid = { ...prev }
                    const empGrid = { ...(newGrid[selectedEmployeeId] || {}) }
                    for (let day = 1; day <= daysInMonth; day++) {
                      let projectValue: string | null = null
                      let projectIdValue: string | null = null
                      let autoAssigned = false
                      if (needsProject) {
                        if (employeeProjects.length === 1) {
                          projectValue = employeeProjects[0].project.name
                          projectIdValue = employeeProjects[0].projectId
                          autoAssigned = true
                        } else {
                          projectValue = 'Unallocated'
                          projectIdValue = null
                        }
                      }
                      empGrid[day] = {
                        status: s,
                        project: projectValue,
                        projectId: projectIdValue,
                        recordId: empGrid[day]?.recordId || null,
                        changed: true,
                        autoAssigned,
                        manuallyOverridden: false,
                      }
                    }
                    newGrid[selectedEmployeeId] = empGrid
                    return newGrid
                  })
                  setHasChanges(true)
                  if (needsProject && employeeProjects.length === 1) {
                    toast({ title: 'Auto-assigned', description: `Auto-assigned to ${employeeProjects[0].project.name}` })
                  } else if (needsProject && employeeProjects.length === 0) {
                    toast({ title: 'Warning', description: 'No active project assignment found', variant: 'destructive' })
                  }
                }}
              >
                Fill {s} ({STATUS_LABELS[s]})
              </Button>
            ))}
          </div>
          {/* Quick-fill project picker for multi-project employees */}
          {quickFillProjectPicker && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 rounded-lg">
              <span className="text-[10px] text-amber-700">
                Select project for all {quickFillProjectPicker.filledCount} filled days:
              </span>
              <select
                className="h-6 text-[10px] border rounded px-1 bg-white"
                value={quickFillSelectedProject}
                onChange={(e) => setQuickFillSelectedProject(e.target.value)}
              >
                {getEmployeeProjects(quickFillProjectPicker.employeeId).map(p => (
                  <option key={p.project.id} value={p.project.name}>{p.project.name}</option>
                ))}
              </select>
              <button
                className="bg-slate-900 text-white rounded px-2 py-0.5 text-[10px] hover:bg-slate-700 transition-colors"
                onClick={() => {
                  if (!quickFillProjectPicker) return
                  const { employeeId, status } = quickFillProjectPicker
                  const resolvedProjectId = projectNameToId(quickFillSelectedProject)
                  setGridData(prev => {
                    const newGrid = { ...prev }
                    const empGrid = { ...(newGrid[employeeId] || {}) }
                    for (let day = 1; day <= daysInMonth; day++) {
                      empGrid[day] = {
                        status,
                        project: quickFillSelectedProject,
                        projectId: resolvedProjectId,
                        recordId: empGrid[day]?.recordId || null,
                        changed: true,
                        autoAssigned: false,
                        manuallyOverridden: false,
                      }
                    }
                    newGrid[employeeId] = empGrid
                    return newGrid
                  })
                  setHasChanges(true)
                  setQuickFillProjectPicker(null)
                  toast({ title: 'Applied', description: `Project "${quickFillSelectedProject}" applied to all filled days` })
                }}
              >Apply</button>
              <button
                className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                onClick={() => setQuickFillProjectPicker(null)}
              >Cancel</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Fill Dialog */}
      <Dialog open={bulkFillOpen} onOpenChange={setBulkFillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Bulk Project Fill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!selectedEmployeeId && (
              <p className="text-xs text-muted-foreground">Select a single employee first to use bulk fill.</p>
            )}
            {selectedEmployeeId && (
              <>
                {/* Employee Info */}
                <div className="text-xs text-muted-foreground">
                  Employee: <span className="font-medium text-foreground">
                    {employees.find(e => e.id === selectedEmployeeId)?.name || selectedEmployeeId}
                  </span>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Start Date</label>
                    <Input
                      type="date"
                      className="h-8 text-xs mt-1"
                      value={bulkFillStartDate}
                      onChange={e => { setBulkFillStartDate(e.target.value); setBulkFillPreview(null) }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">End Date</label>
                    <Input
                      type="date"
                      className="h-8 text-xs mt-1"
                      value={bulkFillEndDate}
                      onChange={e => { setBulkFillEndDate(e.target.value); setBulkFillPreview(null) }}
                    />
                  </div>
                </div>

                {/* Project Selector */}
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium">Assign Project</label>
                  <Select value={bulkFillProjectId} onValueChange={setBulkFillProjectId}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkFillEmployeeProjects.length > 0 ? (
                        bulkFillEmployeeProjects.map(pa => (
                          <SelectItem key={pa.projectId} value={pa.projectId}>
                            {pa.project.name} ({pa.project.code})
                          </SelectItem>
                        ))
                      ) : (
                        projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview Result */}
                {bulkFillPreview && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">Preview Results</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-lg font-bold text-orange-600">{bulkFillPreview.unassignedDays}</div>
                        <div className="text-[9px] text-muted-foreground">Unassigned</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{bulkFillPreview.alreadyAssignedDays}</div>
                        <div className="text-[9px] text-muted-foreground">Assigned</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{bulkFillPreview.totalBillableDays}</div>
                        <div className="text-[9px] text-muted-foreground">Total Billable</div>
                      </div>
                    </div>
                    {bulkFillPreview.unassignedDays === 0 && (
                      <div className="text-[10px] text-center text-muted-foreground py-1">
                        No unassigned billable days found in this range.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!selectedEmployeeId || !bulkFillStartDate || !bulkFillEndDate || bulkFillLoading}
              onClick={handleBulkFillPreview}
            >
              {bulkFillLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              Preview
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={
                !selectedEmployeeId ||
                !bulkFillStartDate ||
                !bulkFillEndDate ||
                !bulkFillProjectId ||
                bulkFillApplying ||
                (bulkFillPreview !== null && bulkFillPreview.unassignedDays === 0)
              }
              onClick={handleBulkFillApply}
            >
              {bulkFillApplying ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Holiday configuration Dialog ── */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Configure Holidays for {formatMonthLabel(selectedMonth)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Select the days of the month that are public holidays. Tip: You can also toggle holidays by directly clicking the day numbers in the table header!
            </p>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dow = getDayOfWeek(selectedMonth, day)
                const isWeekend = dow === 0 || dow === 6
                const isSelected = holidays.includes(day)
                return (
                  <Button
                    key={day}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className={`h-9 w-full text-xs font-semibold ${
                      isSelected
                        ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300'
                        : isWeekend
                          ? 'border-orange-200 text-orange-600 bg-orange-50/10'
                          : ''
                    }`}
                    onClick={() => {
                      const updated = isSelected
                        ? holidays.filter(d => d !== day)
                        : [...holidays, day]
                      saveHolidays(updated)

                      // Toggle default status to H for empty or default statuses
                      setGridData(prev => {
                        const next = { ...prev }
                        for (const empId of Object.keys(next)) {
                          const empGrid = { ...next[empId] }
                          const currentDay = empGrid[day] || {}
                          if (!currentDay.status || currentDay.status === 'P' || currentDay.status === 'A' || currentDay.status === '') {
                            empGrid[day] = {
                              ...currentDay,
                              status: isSelected ? '' : 'H',
                              changed: true
                            }
                          }
                          next[empId] = empGrid
                        }
                        setHasChanges(true)
                        return next
                      })
                    }}
                  >
                    {day}
                  </Button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setHolidayDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
