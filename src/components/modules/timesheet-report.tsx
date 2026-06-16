'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Printer, Calendar } from 'lucide-react'
import { EmployeeCombobox } from '@/components/ui/employee-combobox'
import { useRouter } from 'next/navigation'

export interface TimesheetDayData {
  status: string
  projectName?: string
  projectCode?: string
  checkIn?: string
  checkOut?: string
  overtime?: number
  remarks?: string
}

export interface TimesheetReportProps {
  employees: Array<{ 
    id: string 
    name: string 
    employeeCode: string 
    designation?: string | null 
    projectAssignments?: Array<{ projectId: string }>
  }>
  projects: Array<{ id: string; name: string; code: string }>
  selectedEmployee: {
    id: string
    name: string
    employeeCode: string
    designation?: string | null
    department?: string | null
    status: string
    projectAssignments: Array<{
      project: { id: string; name: string; code: string }
    }>
  } | null
  month: number
  year: number
  projectId: string
  attendanceMap: Record<number, TimesheetDayData>
  totalDays: number
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function TimesheetReportClient({
  employees,
  projects,
  selectedEmployee,
  month,
  year,
  projectId,
  attendanceMap,
  totalDays,
}: TimesheetReportProps) {
  const router = useRouter()
  const [empId, setEmpId] = useState(selectedEmployee?.id || '')
  const [selectedMonth, setSelectedMonth] = useState(String(month))
  const [selectedYear, setSelectedYear] = useState(String(year))
  const [projId, setProjId] = useState(projectId || '')

  const handleFilterChange = (newEmp: string, newMonth: string, newYear: string, newProj: string) => {
    router.push(`/reports/timesheet?employeeId=${newEmp}&month=${newMonth}&year=${newYear}&projectId=${newProj}`)
  }

  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1)

  const isWeekend = (d: number) => {
    const date = new Date(year, month - 1, d)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  // 1. Gather all unique projects for row generation
  const assignedProjects = selectedEmployee?.projectAssignments.map(a => a.project) || []
  
  // Make sure we have a unique list of projects
  const uniqueProjectsMap = new Map<string, { id: string; name: string; code: string }>()
  assignedProjects.forEach(p => uniqueProjectsMap.set(p.id, p))
  
  // Add projects actually present in attendance logs but maybe not assigned currently
  Object.values(attendanceMap).forEach(day => {
    if (day.projectName && day.projectCode) {
      const found = assignedProjects.find(ap => ap.name === day.projectName)
      const id = found ? found.id : day.projectCode
      uniqueProjectsMap.set(id, { id, name: day.projectName, code: day.projectCode })
    }
  })

  const projectsList = Array.from(uniqueProjectsMap.values())

  // Calculate statistics
  const stats = daysArray.reduce((acc, d) => {
    const status = attendanceMap[d]?.status || '-'
    if (['P', 'W', 'WH', 'WW', 'T', 'Co'].includes(status)) {
      acc.present++
    } else if (status === 'H') {
      acc.holidays++
    } else if (['CL', 'SL', 'EL'].includes(status)) {
      acc.leaves++
    } else if (status === 'A') {
      acc.absent++
    } else {
      acc.unrecorded++
    }
    acc.overtime += attendanceMap[d]?.overtime || 0
    return acc
  }, { present: 0, holidays: 0, leaves: 0, absent: 0, unrecorded: 0, overtime: 0 })

  const handlePrint = () => {
    window.print()
  }

  const filteredEmployees = projId
    ? employees.filter(e => e.projectAssignments?.some(pa => pa.projectId === projId))
    : employees

  return (
    <div className="voucher-print-area space-y-6 p-1 sm:p-4 print:p-0 print:space-y-4 print:w-full print:block print:overflow-visible">
      {/* ── FILTERS SECTION (Hidden in print) ── */}
      <Card className="print:hidden border-slate-200/80 shadow-sm bg-gradient-to-tr from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Project Filter</Label>
                <Select
                  value={projId || 'all'}
                  onValueChange={(val) => {
                    const nextProjId = val === 'all' ? '' : val
                    setProjId(nextProjId)
                    
                    // Filter employees and auto-select the first one if current is not in list
                    const updatedEmployees = nextProjId
                      ? employees.filter(e => e.projectAssignments?.some(pa => pa.projectId === nextProjId))
                      : employees
                    
                    const isCurrentValid = updatedEmployees.some(e => e.id === empId)
                    const nextEmpId = isCurrentValid ? empId : (updatedEmployees.length > 0 ? updatedEmployees[0].id : '')
                    
                    setEmpId(nextEmpId)
                    handleFilterChange(nextEmpId, selectedMonth, selectedYear, nextProjId)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Employee</Label>
                <EmployeeCombobox
                  employees={filteredEmployees}
                  value={empId}
                  onChange={(val) => {
                    setEmpId(val)
                    handleFilterChange(val, selectedMonth, selectedYear, projId)
                  }}
                  placeholder="Select employee..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Month</Label>
                <Select
                  value={selectedMonth}
                  onValueChange={(val) => {
                    setSelectedMonth(val)
                    handleFilterChange(empId, val, selectedYear, projId)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500">Year</Label>
                <Select
                  value={selectedYear}
                  onValueChange={(val) => {
                    setSelectedYear(val)
                    handleFilterChange(empId, selectedMonth, val, projId)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handlePrint}
              disabled={!selectedEmployee}
              className="h-8 text-xs px-4 bg-[#1A7A4A] hover:bg-[#15633a] text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Timesheet
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedEmployee ? (
        <Card className="text-center py-16 border-dashed border-2 border-slate-200 print:hidden">
          <CardContent className="space-y-3">
            <Calendar className="h-12 w-12 mx-auto text-slate-300 animate-pulse" />
            <p className="text-sm font-medium text-slate-600">Please select an employee to view their timesheet report.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── METADATA & GRID CONTAINER ── */}
          <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200/80 print:border-none print:p-0 print:shadow-none shadow-sm space-y-6 print:w-full print:block print:overflow-visible">
            
            {/* ── HEADER DETAILS PANEL ── */}
            <div className="pb-4 border-b border-slate-100 print:border-b-2 print:border-black space-y-3 print:w-full">
              <div className="flex justify-between items-center print:w-full">
                <div>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">AGES ERP SYSTEM</h2>
                  <h1 className="text-lg font-extrabold text-slate-900 print:text-black mt-1 leading-none">MONTHLY STAFF TIMESHEET REPORT</h1>
                </div>
                <div className="text-right text-[10px] text-slate-400 print:text-black font-mono">
                  Generated: {new Date().toLocaleDateString('en-PK')}
                </div>
              </div>
              
              {/* Executive Metadata Columns in a beautiful grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 pt-2 text-xs print:flex print:flex-row print:justify-between print:gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500 print:text-black">Name:</span>
                  <span className="font-bold border-b border-slate-400 print:border-black pb-0.5 px-1 min-w-[120px] print:text-black">
                    {selectedEmployee.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500 print:text-black">Position:</span>
                  <span className="font-bold border-b border-slate-400 print:border-black pb-0.5 px-1 min-w-[120px] print:text-black">
                    {selectedEmployee.designation || 'Staff'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500 print:text-black">Status:</span>
                  <span className="font-bold border-b border-slate-400 print:border-black pb-0.5 px-1 min-w-[80px] text-emerald-600 print:text-black">
                    {selectedEmployee.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-500 print:text-black">Month:</span>
                  <span className="font-bold border-b border-slate-400 print:border-black pb-0.5 px-1 min-w-[100px] print:text-black">
                    {MONTH_NAMES[month - 1]}, {year}
                  </span>
                </div>
              </div>
            </div>

            {/* ── TIMESHEET CROSS-TAB GRID ── */}
            <div className="overflow-x-auto print:overflow-visible print:block print:w-full">
              <table className="w-full border-collapse border border-slate-300 print:border-black table-fixed text-[10px] print:text-[8px] print:w-full print:table-fixed font-sans print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-200 border-b border-slate-300 print:border-black font-bold text-center print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                    <th className="w-48 print:w-24 text-left px-2 py-2 border-r border-slate-300 print:border-black font-bold text-slate-700 print:text-black text-[11px] print:text-[8px]">
                      Projects
                    </th>
                    {daysArray.map(d => {
                      const weekend = isWeekend(d)
                      const isHoliday = attendanceMap[d]?.status === 'H'
                      let headerBg = ''
                      if (isHoliday) {
                        headerBg = 'bg-indigo-100 dark:bg-indigo-950/60 print:bg-indigo-100/60 text-indigo-900 dark:text-indigo-200'
                      } else if (weekend) {
                        headerBg = 'bg-slate-200/80 dark:bg-slate-800/80 print:bg-slate-300'
                      }
                      return (
                        <th 
                          key={d} 
                          className={`px-0.5 py-1 border-r border-slate-300 print:border-black font-bold text-slate-700 print:text-black w-7 print:w-4 print:text-[8px] ${headerBg}`}
                        >
                          <div className="leading-none">{d}</div>
                          {isHoliday && (
                            <div className="text-[7px] text-indigo-700 dark:text-indigo-300 font-extrabold leading-none mt-0.5 print:text-indigo-900">
                              H
                            </div>
                          )}
                        </th>
                      )
                    })}
                    <th className="w-16 print:w-10 px-1 py-2 border-r border-slate-300 print:border-black font-bold text-slate-700 print:text-black text-[9px] print:text-[7px] uppercase leading-tight">
                      Total (hrs)
                    </th>
                    <th className="w-16 print:w-10 px-1 py-2 border-r border-slate-300 print:border-black font-bold text-slate-700 print:text-black text-[9px] print:text-[7px] uppercase leading-tight">
                      Total (days)
                    </th>
                    <th className="w-28 print:w-16 text-left px-2 py-2 font-bold text-slate-700 print:text-black text-[11px] print:text-[8px]">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectsList.map(project => {
                    let projectDaysCount = 0
                    let projectHoursSum = 0
                    let projectRemarksList: string[] = []

                    return (
                      <tr key={project.id} className="border-b border-slate-200 print:border-black hover:bg-slate-50/50 transition-colors print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                        {/* Project title */}
                        <td className="px-2 py-1.5 border-r border-slate-300 print:border-black font-bold text-slate-800 print:text-black truncate text-[10px] print:text-[8px]">
                          {project.name}
                        </td>
                        
                        {/* 1 to 30/31 Daily Grid Columns */}
                        {daysArray.map(d => {
                          const dayData = attendanceMap[d]
                          let cellContent = ''

                          if (dayData) {
                            const isLeaveOrAbsent = ['CL', 'SL', 'EL', 'A'].includes(dayData.status)
                            
                            if (dayData.projectName) {
                              // If a project is assigned, only show the marker on the matching project row!
                              if (dayData.projectName === project.name) {
                                cellContent = dayData.status
                                if (['W', 'P', 'Co', 'WH', 'WW', 'T', 'PW', 'TW', 'WHW', 'PH', 'TH', 'WHH'].includes(dayData.status)) {
                                  projectDaysCount++
                                  projectHoursSum += dayData.overtime || 0
                                  if (dayData.remarks) projectRemarksList.push(dayData.remarks)
                                }
                              }
                            } else {
                              // Fallback if no project is assigned
                              if (isLeaveOrAbsent) {
                                cellContent = dayData.status
                              }
                            }
                          }

                          const weekend = isWeekend(d)
                          const isHoliday = dayData?.status === 'H'

                          // Color classes for specific status codes
                          let statusColor = ''
                          if (cellContent === 'W' || cellContent === 'P' || cellContent === 'Co') {
                            statusColor = 'text-blue-700 dark:text-blue-400 font-extrabold bg-blue-50/40 dark:bg-blue-500/5 print:bg-blue-100/50 print:text-blue-800'
                          } else if (cellContent === 'H') {
                            statusColor = 'text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-50/40 dark:bg-indigo-500/5 print:bg-indigo-100/50 print:text-indigo-800'
                          } else if (['CL', 'SL', 'EL'].includes(cellContent)) {
                            statusColor = 'text-amber-600 dark:text-amber-400 font-extrabold bg-amber-50/40 dark:bg-amber-500/5 print:bg-amber-100/50 print:text-amber-800'
                          } else if (cellContent === 'A') {
                            statusColor = 'text-red-600 dark:text-red-400 font-extrabold bg-red-50/40 print:bg-red-100/50 print:text-red-800'
                          }

                          // Apply entire column holiday shading (marker H is hidden in project rows)
                          let holidayShading = ''
                          if (isHoliday) {
                            holidayShading = 'bg-indigo-50/50 dark:bg-indigo-950/20 print:bg-indigo-100/30'
                          } else if (weekend) {
                            holidayShading = 'bg-slate-100/70 dark:bg-slate-900/40 print:bg-slate-200/50'
                          }

                          return (
                            <td 
                              key={d} 
                              className={`border-r border-slate-300 print:border-black text-center font-bold text-[10px] print:text-[8px] p-0 font-mono ${statusColor} ${holidayShading} print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]`}
                            >
                              {cellContent}
                            </td>
                          )
                        })}

                        {/* Total Hours for this project */}
                        <td className="px-1 py-1.5 border-r border-slate-300 print:border-black text-center font-bold text-slate-700 print:text-black font-mono print:text-[8px]">
                          {projectHoursSum > 0 ? `${projectHoursSum} hrs` : ''}
                        </td>

                        {/* Total Days worked on this project */}
                        <td className="px-1 py-1.5 border-r border-slate-300 print:border-black text-center font-bold text-slate-700 print:text-black font-mono print:text-[8px]">
                          {projectDaysCount > 0 ? projectDaysCount : ''}
                        </td>

                        {/* Remarks */}
                        <td className="px-2 py-1.5 text-slate-500 print:text-black truncate italic text-[9px] print:text-[7px]">
                          {Array.from(new Set(projectRemarksList)).join(', ') || ''}
                        </td>
                      </tr>
                    )
                  })}

                  {/* ── COMBINED BOTTOM TOTAL ROW ── */}
                  <tr className="bg-slate-50 print:bg-slate-200 border-t border-slate-300 print:border-black font-bold print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]">
                    <td className="px-2 py-2 border-r border-slate-300 print:border-black font-extrabold text-slate-800 print:text-black text-[11px] print:text-[8px]">
                      Total
                    </td>
                    
                    {daysArray.map(d => {
                      const status = attendanceMap[d]?.status || ''
                      const weekend = isWeekend(d)
                      const isHoliday = status === 'H'
                      
                      let statusColor = ''
                      if (['W', 'P', 'Co'].includes(status)) {
                        statusColor = 'text-blue-700 print:text-blue-900 font-extrabold bg-blue-100/30'
                      } else if (isHoliday) {
                        statusColor = 'text-indigo-600 dark:text-indigo-300 font-extrabold bg-indigo-100/60 dark:bg-indigo-950/80 print:bg-indigo-100/60'
                      } else if (['CL', 'SL', 'EL'].includes(status)) {
                        statusColor = 'text-amber-600 print:text-amber-900 font-extrabold bg-amber-100/30'
                      } else if (status === 'A') {
                        statusColor = 'text-red-600 print:text-red-900 font-extrabold bg-red-100/30'
                      } else if (weekend) {
                        statusColor = 'bg-slate-200/50 dark:bg-slate-800/50 print:bg-slate-300/40'
                      }

                      return (
                        <td 
                          key={d} 
                          className={`border-r border-slate-300 print:border-black text-center font-extrabold text-[10px] print:text-[8px] font-mono ${statusColor} print:[print-color-adjust:exact] print:[-webkit-print-color-adjust:exact]`}
                        >
                          {status !== '-' ? status : ''}
                        </td>
                      )
                    })}

                    <td className="px-1 py-2 border-r border-slate-300 print:border-black text-center font-extrabold text-slate-900 print:text-black font-mono text-[10px] print:text-[8px]">
                      {stats.overtime > 0 ? `${stats.overtime} hrs` : '0'}
                    </td>

                    <td className="px-1 py-2 border-r border-slate-300 print:border-black text-center font-extrabold text-slate-900 print:text-black font-mono text-[10px] print:text-[8px]">
                      {stats.present}
                    </td>

                    <td className="px-2 py-2 text-slate-800 print:text-black text-[10px] print:text-[8px]">
                      Status: {stats.present} W / {stats.holidays} H / {stats.leaves} L
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── STATUS INDICATOR LEGEND PANEL ── */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-4 border-t border-slate-100 text-[10px] text-slate-500 print:text-black print:border-black print:pt-3">
              <span className="font-bold uppercase text-slate-700 print:text-black text-[9px]">Status Keys:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-blue-50/60 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">P</span>
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-blue-50/60 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">W</span>
                <span>Weekend</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-indigo-50/60 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">H</span>
                <span>Holiday</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-amber-50/60 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">CL</span>
                <span>Casual Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-amber-50/60 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">SL</span>
                <span>Sick Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-amber-50/60 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">EL</span>
                <span>Earned Leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-amber-50/60 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">CO</span>
                <span>Comp Off</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-blue-50/60 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">T</span>
                <span>Tour / Field</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-blue-50/60 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">WH</span>
                <span>WFH</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-8 h-4 rounded bg-red-50/60 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 flex items-center justify-center font-bold text-[8px] print:bg-white print:text-black print:border-black">A</span>
                <span>Absent</span>
              </div>
            </div>

            {/* ── EXECUTIVE SIGNATURE WORKFLOW PANEL (Visible in Print) ── */}
            <div className="hidden print:grid grid-cols-3 gap-8 pt-10 text-center text-[10px] font-bold text-black print:w-full print:block print:flex print:flex-row print:justify-between">
              <div className="space-y-8 flex-1">
                <div className="border-t border-black pt-1">Prepared By</div>
                <div className="text-[8px] text-gray-500 font-normal leading-none">(HR Officer / Executive)</div>
              </div>
              <div className="space-y-8 flex-1">
                <div className="border-t border-black pt-1">Reviewed By</div>
                <div className="text-[8px] text-gray-500 font-normal leading-none">(Department Head)</div>
              </div>
              <div className="space-y-8 flex-1">
                <div className="border-t border-black pt-1">Authorized Approval</div>
                <div className="text-[8px] text-gray-500 font-normal leading-none">(Managing Director / CFO)</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PRINT-SPECIFIC CSS STYLES ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Force container heights and flex rules to expand naturally for printing */
          html, body, #__next, [class*="h-screen"], main, .flex-1, .overflow-y-auto, [class*="AppShell"], [class*="app-shell"] {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            overflow-y: visible !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
            box-shadow: none !important;
          }

          /* Force global visibility for the printed timesheet to override globals.css "body * { visibility: hidden; }" */
          body, .voucher-print-area, .voucher-print-area * {
            visibility: visible !important;
          }

          /* Ensure all backgrounds and colors are rendered in PDF previews exactly */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Setup landscape A4 format */
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          
          body {
            background-color: white !important;
            color: black !important;
            font-size: 10px !important;
          }
          
          /* Hide sidebar, headers, footers and filter blocks */
          nav, header, footer, sidebar, aside, .print\\:hidden, button, [role="combobox"], [data-radix-popper-content-wrapper] {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          .print\\:w-full {
            width: 100% !important;
            max-width: 100% !important;
          }
          .print\\:overflow-visible {
            overflow: visible !important;
            overflow-x: visible !important;
          }
          
          /* Force standard crisp grid table borders */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            max-width: 100% !important;
            border: 1.5px solid #000000 !important;
            table-layout: fixed !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 3px 4px !important;
            color: #000000 !important;
          }
          
          /* Underline text elements for handwritten appearance */
          .print-underline {
            border-bottom: 1px solid #000000 !important;
            padding-bottom: 1px !important;
          }
        }
      ` }} />
    </div>
  )
}
