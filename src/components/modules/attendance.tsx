'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarCheck, Users, AlertTriangle, Clock, Save, RotateCcw, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Constants ──────────────────────────────────────────────
const VALID_STATUSES = ['P', 'W', 'H', 'CL', 'SL', 'EL', 'CO', 'T', 'WH', 'CD', 'A'] as const
type AttendanceStatus = (typeof VALID_STATUSES)[number]

const WORKING_STATUSES = new Set(['P', 'W', 'H', 'WH', 'T', 'CO'])

const STATUS_LABELS: Record<string, string> = {
  P: 'Present',
  W: 'Weekend Working',
  H: 'Holiday Working',
  CL: 'Casual Leave',
  SL: 'Sick Leave',
  EL: 'Earned Leave',
  CO: 'Comp Off',
  T: 'Training',
  WH: 'Work from Home',
  CD: 'Credit Day',
  A: 'Absent',
}

const SC_EARN_STATUSES = new Set(['P', 'W', 'H', 'T', 'WH'])
const SC_DEDUCT_STATUSES = new Set(['CL', 'SL', 'EL', 'CO'])
const SC_NO_IMPACT_STATUSES = new Set(['A', 'CD'])

function getScCategory(status: string): 'earn' | 'deduct' | 'none' {
  if (SC_EARN_STATUSES.has(status)) return 'earn'
  if (SC_DEDUCT_STATUSES.has(status)) return 'deduct'
  return 'none'
}

// Color mapping for status badges in the grid
const STATUS_COLORS: Record<string, string> = {
  P: 'bg-green-100 text-green-800 border-green-200',
  W: 'bg-blue-100 text-blue-800 border-blue-200',
  H: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  CL: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SL: 'bg-orange-100 text-orange-800 border-orange-200',
  EL: 'bg-amber-100 text-amber-800 border-amber-200',
  CO: 'bg-purple-100 text-purple-800 border-purple-200',
  T: 'bg-teal-100 text-teal-800 border-teal-200',
  WH: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CD: 'bg-gray-100 text-gray-800 border-gray-200',
  A: 'bg-red-100 text-red-800 border-red-200',
}

// Status cycle order for click-to-cycle
const STATUS_CYCLE: AttendanceStatus[] = ['P', 'WH', 'W', 'H', 'CL', 'SL', 'EL', 'CO', 'T', 'CD', 'A']

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
  recordId: string | null
  changed: boolean
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
  // If name starts with "Proj ", strip it
  if (name.startsWith('Proj ')) return name.slice(5)
  // If name has a hyphen code prefix like "HO - Head Office", take short code
  if (name.includes(' - ')) return name.split(' - ')[0].trim()
  // Otherwise truncate to 8 chars
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

  // ── Click outside to close popover ─────────────────────
  useEffect(() => {
    if (!popoverCell) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverCell(null)
      }
    }
    // Use a small delay so the click that opened the popover doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [popoverCell])

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
            const isWorking = WORKING_STATUSES.has(recStatus)
            const projName = day.record?.projectId ? projectIdToName(day.record.projectId) : null

            dayMap[day.day] = {
              status: recStatus,
              project: isWorking ? (projName || 'Unallocated') : null,
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
          const isWorking = WORKING_STATUSES.has(rec.status)
          const projName = rec.projectId ? projectIdToName(rec.projectId) : null

          newGrid[rec.employeeId][day] = {
            status: rec.status as AttendanceStatus,
            project: isWorking ? (projName || 'Unallocated') : null,
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
  /** Handle cell click - cycles status, and opens popover for working statuses */
  const handleCellClick = (employeeId: string, day: number) => {
    const empGrid = gridData[employeeId] || {}
    const currentStatus = empGrid[day]?.status || ''
    const currentIndex = STATUS_CYCLE.indexOf(currentStatus as AttendanceStatus)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
    const isNextWorking = WORKING_STATUSES.has(nextStatus)

    // Cycle the status
    setGridData(prev => {
      const empGrid = { ...(prev[employeeId] || {}) }
      const existingProject = empGrid[day]?.project

      empGrid[day] = {
        status: nextStatus,
        project: isNextWorking ? (existingProject || 'Unallocated') : null,
        recordId: empGrid[day]?.recordId || null,
        changed: true,
      }
      return { ...prev, [employeeId]: empGrid }
    })
    setHasChanges(true)

    // Open popover for working statuses
    if (isNextWorking) {
      const existingProject = empGrid[day]?.project || 'Unallocated'
      setPopoverProject(existingProject)
      setPopoverCell({ empId: employeeId, day })
    } else {
      setPopoverCell(null)
    }
  }

  /** Confirm project selection in popover */
  const confirmPopoverProject = () => {
    if (!popoverCell) return
    const { empId, day } = popoverCell
    setGridData(prev => {
      const empGrid = { ...(prev[empId] || {}) }
      empGrid[day] = {
        ...empGrid[day],
        status: empGrid[day]?.status || 'P',
        project: popoverProject,
        changed: true,
      }
      return { ...prev, [empId]: empGrid }
    })
    setHasChanges(true)
    setPopoverCell(null)
  }

  /** Update project from popover select without closing */
  const handlePopoverProjectChange = (value: string) => {
    setPopoverProject(value)
  }

  const resetChanges = () => {
    setPopoverCell(null)
    fetchAttendanceData()
  }

  // ── Bulk Save ──────────────────────────────────────────
  const handleBulkSave = async () => {
    const bulkRecords: { employeeId: string; date: string; status: string; project?: string | null }[] = []
    const daysInMonth = getDaysInMonth(selectedMonth)
    const [year, month] = selectedMonth.split('-').map(Number)

    for (const [employeeId, dayMap] of Object.entries(gridData)) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dayData = dayMap[day]
        if (dayData?.changed && dayData.status) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          bulkRecords.push({
            employeeId,
            date: dateStr,
            status: dayData.status,
            project: dayData.project || null,
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
    ? ((displayStats.totalPresent / displayStats.totalRecords) * 100).toFixed(1)
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
        <Card>
          <ScrollArea className="w-full">
            <div className="min-w-[1200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] sticky left-0 bg-card z-10 min-w-[140px]">Employee</TableHead>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                      const dow = getDayOfWeek(selectedMonth, day)
                      const isWeekend = dow === 0 || dow === 6
                      return (
                        <TableHead
                          key={day}
                          className={`text-[9px] text-center p-0 w-8 min-w-8 ${isWeekend ? 'bg-muted/50 text-orange-600' : ''}`}
                        >
                          <div>{day}</div>
                          <div className="text-[7px] font-normal">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow]}
                          </div>
                        </TableHead>
                      )
                    })}
                    <TableHead className="text-[9px] text-center sticky right-0 bg-card z-10 min-w-[56px]">Present</TableHead>
                    <TableHead className="text-[9px] text-center sticky right-0 bg-card z-10 min-w-[56px]">Absent</TableHead>
                    <TableHead className="text-[9px] text-center sticky right-0 bg-card z-10 min-w-[56px]">Leave</TableHead>
                    <TableHead className="text-[9px] text-center sticky right-0 bg-card z-10 min-w-[56px]">SC-Earn</TableHead>
                    <TableHead className="text-[9px] text-center sticky right-0 bg-card z-10 min-w-[56px]">SC-De</TableHead>
                    <TableHead className="text-[9px] text-center sticky right-0 bg-card z-10 min-w-[100px]">Projects</TableHead>
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
                        if (proj && WORKING_STATUSES.has(s)) {
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

                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="text-xs sticky left-0 bg-card z-10 min-w-[140px]">
                          <div>
                            <p className="font-medium text-[11px] truncate">{emp.name}</p>
                            <p className="text-[9px] text-muted-foreground">{emp.employeeCode}</p>
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
                          const isWorking = WORKING_STATUSES.has(status)
                          const isPopoverOpen = popoverCell?.empId === emp.id && popoverCell?.day === day

                          return (
                            <TableCell
                              key={day}
                              className={`p-0 text-center cursor-pointer select-none relative ${isWeekend ? 'bg-orange-50/30' : ''}`}
                              onClick={() => handleCellClick(emp.id, day)}
                              title={status ? `${STATUS_LABELS[status]} (${status})${project && isWorking ? ` - ${project}` : ''}${changed ? ' - Modified' : ''}` : 'Click to set status'}
                            >
                              <div
                                className={`flex flex-col items-center justify-center mx-0.5 my-0.5 transition-colors rounded-sm
                                  ${changed ? 'ring-2 ring-primary/40' : ''}
                                `}
                                style={{ minHeight: isWorking && project && project !== 'Unallocated' ? '40px' : '32px' }}
                              >
                                <div
                                  className={`text-[10px] font-bold leading-tight
                                    ${status ? colorClass : 'text-gray-300 hover:bg-muted/50'}
                                  `}
                                  style={{ padding: '2px 4px' }}
                                >
                                  {status || '·'}
                                </div>
                                {isWorking && project && project !== 'Unallocated' && (
                                  <div className="text-[9px] bg-slate-100 text-slate-500 rounded px-1 truncate max-w-[52px] leading-tight">
                                    {getShortProjectName(project)}
                                  </div>
                                )}
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
                                    onChange={(e) => handlePopoverProjectChange(e.target.value)}
                                  >
                                    {projectNames.map(name => (
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
                        <TableCell className="text-[10px] text-center font-bold text-green-700 sticky right-0 bg-card z-10">{present}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-red-700 sticky right-0 bg-card z-10">{absent}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-amber-700 sticky right-0 bg-card z-10">{leave}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-emerald-700 sticky right-0 bg-card z-10">{scEarn}</TableCell>
                        <TableCell className="text-[10px] text-center font-bold text-orange-700 sticky right-0 bg-card z-10">{scDeduct}</TableCell>
                        <TableCell className="text-[10px] text-left sticky right-0 bg-card z-10 min-w-[100px]">
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
          </ScrollArea>
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
              return (
                <div key={s} className="flex items-center gap-1">
                  <Badge className={`text-[9px] h-5 px-1.5 ${STATUS_COLORS[s] || ''}`}>{s}</Badge>
                  <span className="text-[9px] text-muted-foreground">{STATUS_LABELS[s]}</span>
                  <span className={`text-[8px] font-medium ${scColor}`}>{scLabel}</span>
                </div>
              )
            })}
          </div>
          {/* Quick-fill toolbar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <span className="text-[10px] text-muted-foreground">Quick fill selected employee:</span>
            {(['P', 'WH', 'A', 'CL', 'SL', 'H'] as AttendanceStatus[]).map(s => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="h-6 text-[9px] px-2"
                disabled={!selectedEmployeeId}
                onClick={() => {
                  if (!selectedEmployeeId) return
                  const isWorking = WORKING_STATUSES.has(s)
                  setGridData(prev => {
                    const newGrid = { ...prev }
                    const empGrid = { ...(newGrid[selectedEmployeeId] || {}) }
                    for (let day = 1; day <= daysInMonth; day++) {
                      empGrid[day] = {
                        status: s,
                        project: isWorking ? 'Unallocated' : null,
                        recordId: empGrid[day]?.recordId || null,
                        changed: true,
                      }
                    }
                    newGrid[selectedEmployeeId] = empGrid
                    return newGrid
                  })
                  setHasChanges(true)
                }}
              >
                Fill {s} ({STATUS_LABELS[s]})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
