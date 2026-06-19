'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Download, Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Trash2, Eye, ArrowRight, ArrowDownToLine, History, FileType, Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────────────

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: { row: number; message: string }[]
  totalRows: number
}

interface ExportData {
  success: boolean
  entity: string
  headers: string[]
  data: Record<string, any>[]
  totalRows: number
  fileName: string
}

interface LogEntry {
  id: string
  fileName?: string
  fileType?: string
  importType?: string
  exportType?: string
  format?: string
  recordCount?: number
  successCount?: number
  failCount?: number
  parameters?: string
  createdAt: string
}

// ─── Entity/Report type configs ─────────────────────────────────────

const IMPORT_ENTITIES = [
  { value: 'accounts', label: 'Chart of Accounts', icon: '📋', description: 'Import account codes, names, types, and sub-types' },
  { value: 'customers', label: 'Customers', icon: '👥', description: 'Import customer codes, names, and contact info' },
  { value: 'suppliers', label: 'Suppliers', icon: '🏭', description: 'Import supplier codes, names, and bank details' },
  { value: 'projects', label: 'Projects', icon: '🏗️', description: 'Import project codes, names, and types' },
  { value: 'vouchers', label: 'Vouchers', icon: '📄', description: 'Import voucher entries with account codes' },
] as const

const EXPORT_ENTITY_TYPES = [
  { value: 'accounts', label: 'Chart of Accounts', group: 'Master Data' },
  { value: 'customers', label: 'Customers', group: 'Master Data' },
  { value: 'suppliers', label: 'Suppliers', group: 'Master Data' },
  { value: 'projects', label: 'Projects', group: 'Master Data' },
  { value: 'vouchers', label: 'Vouchers', group: 'Master Data' },
  { value: 'trial_balance', label: 'Trial Balance', group: 'Reports' },
  { value: 'balance_sheet', label: 'Balance Sheet', group: 'Reports' },
  { value: 'pnl', label: 'Profit & Loss', group: 'Reports' },
  { value: 'general_ledger', label: 'General Ledger', group: 'Reports' },
] as const

const ENTITY_FIELD_MAP: Record<string, string[]> = {
  accounts: ['Code*', 'Name*', 'Account Type*', 'Sub Type', 'Level', 'Allow Posting', 'Active', 'Description', 'Parent Code'],
  customers: ['Code*', 'Name*', 'Contact Person', 'Email', 'Phone', 'Address', 'Credit Terms', 'Credit Limit', 'Tax Number', 'Active', 'Opening Balance'],
  suppliers: ['Code*', 'Name*', 'Contact Person', 'Email', 'Phone', 'Address', 'Credit Terms', 'Tax Number', 'Bank Name', 'Bank Account', 'Active', 'Opening Balance'],
  projects: ['Code*', 'Name*', 'Project Type', 'Description', 'Status', 'Start Date', 'End Date', 'Is Head Office', 'Reporting Currency', 'Sort Order'],
  vouchers: ['Voucher Number', 'Type', 'Date', 'Narration', 'Reference', 'Payee', 'Project', 'Account Code*', 'Debit', 'Credit', 'Description'],
}

// ─── CSV Parser ─────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
}

// ─── CSV Generator ──────────────────────────────────────────────────

function generateCSV(headers: string[], data: Record<string, any>[]): string {
  const escapeCSV = (val: any): string => {
    const str = val === null || val === undefined ? '' : String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = data.map(row => headers.map(h => escapeCSV(row[h])).join(','))
  return [headerLine, ...dataLines].join('\n')
}

function triggerDownload(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Main Component ─────────────────────────────────────────────────

export function ImportExport() {
  const [logs, setLogs] = useState<{ imports: LogEntry[]; exports: LogEntry[] }>({ imports: [], exports: [] })
  const { toast } = useToast()

  // Import states
  const [importEntity, setImportEntity] = useState('accounts')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export states
  const [exportEntity, setExportEntity] = useState('accounts')
  const [exportFormat, setExportFormat] = useState('CSV')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [downloadHistory, setDownloadHistory] = useState<{ fileName: string; entity: string; format: string; rows: number; timestamp: Date }[]>([])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/import-export')
      if (res.ok) setLogs(await res.json())
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => { queueMicrotask(() => fetchLogs()) }, [fetchLogs])

  // ─── File handling ──────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    if (!file) return

    const validExtensions = ['.csv', '.txt']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(ext)) {
      toast({ title: 'Invalid File', description: 'Please upload a CSV file (.csv or .txt)', variant: 'destructive' })
      return
    }

    setSelectedFile(file)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const { headers, rows } = parseCSV(text)
      setParsedHeaders(headers)
      setParsedRows(rows)

      if (headers.length === 0) {
        toast({ title: 'Empty File', description: 'The CSV file appears to be empty', variant: 'destructive' })
      } else {
        toast({
          title: 'File Parsed',
          description: `${rows.length} rows with ${headers.length} columns detected`,
        })
      }
    }
    reader.onerror = () => {
      toast({ title: 'Read Error', description: 'Failed to read the file', variant: 'destructive' })
    }
    reader.readAsText(file)
  }, [toast])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const clearFile = () => {
    setSelectedFile(null)
    setParsedHeaders([])
    setParsedRows([])
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Import handler ─────────────────────────────────────────────

  const handleImport = async () => {
    if (!selectedFile || parsedRows.length === 0) {
      toast({ title: 'No Data', description: 'Please upload and parse a CSV file first', variant: 'destructive' })
      return
    }

    setIsImporting(true)
    setImportProgress(10)
    setImportResult(null)

    try {
      setImportProgress(30)

      const res = await fetch('/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: importEntity,
          data: parsedRows,
          fileName: selectedFile.name,
        }),
      })

      setImportProgress(80)

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Import failed')
      }

      const result: ImportResult = await res.json()
      setImportProgress(100)
      setImportResult(result)

      toast({
        title: 'Import Complete',
        description: `${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`,
        variant: result.errors.length > 0 ? 'destructive' : 'default',
      })

      fetchLogs()
    } catch (err: any) {
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [{ row: 0, message: err.message || 'Import failed' }],
        totalRows: parsedRows.length,
      })
      toast({ title: 'Import Failed', description: err.message, variant: 'destructive' })
    } finally {
      setIsImporting(false)
    }
  }

  // ─── Export handler ─────────────────────────────────────────────

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const params = new URLSearchParams({
        mode: 'export',
        entity: exportEntity,
      })
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const res = await fetch(`/api/import-export?${params.toString()}`)

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Export failed')
      }

      const result: ExportData = await res.json()

      if (result.data.length === 0) {
        toast({ title: 'No Data', description: 'No data found for the selected export', variant: 'destructive' })
        return
      }

      // Generate file based on format
      const fileExt = exportFormat === 'XLSX' ? 'csv' : exportFormat.toLowerCase()
      const fileName = `${result.fileName || exportEntity}_${new Date().toISOString().split('T')[0]}.${fileExt}`

      if (exportFormat === 'CSV' || exportFormat === 'XLSX') {
        const csvContent = generateCSV(result.headers, result.data)
        const mimeType = 'text/csv;charset=utf-8;'
        triggerDownload(csvContent, fileName, mimeType)
      }

      // Add to download history
      setDownloadHistory(prev => [{
        fileName,
        entity: exportEntity,
        format: exportFormat,
        rows: result.totalRows,
        timestamp: new Date(),
      }, ...prev])

      toast({
        title: 'Export Complete',
        description: `${result.totalRows} rows exported as ${exportFormat}`,
      })

      fetchLogs()
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err.message, variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }

  // ─── Download sample CSV ────────────────────────────────────────

  const handleDownloadTemplate = () => {
    const fields = ENTITY_FIELD_MAP[importEntity] || []
    if (fields.length === 0) return
    const csvContent = fields.join(',') + '\n'
    triggerDownload(csvContent, `${importEntity}_template.csv`, 'text/csv;charset=utf-8;')
    toast({ title: 'Template Downloaded', description: `CSV template for ${importEntity} import` })
  }

  // ─── Computed values ────────────────────────────────────────────

  const selectedEntityConfig = IMPORT_ENTITIES.find(e => e.value === importEntity)
  const selectedExportConfig = EXPORT_ENTITY_TYPES.find(e => e.value === exportEntity)
  const isReportExport = selectedExportConfig?.group === 'Reports'
  const allLogs = [
    ...logs.imports.map(l => ({ ...l, dir: 'Import' as const, type: l.importType || '', format: l.fileType || 'CSV', records: l.recordCount || 0, success: l.successCount || 0, fails: l.failCount || 0 })),
    ...logs.exports.map(l => ({ ...l, dir: 'Export' as const, type: l.exportType || '', format: l.format || 'CSV', records: 0, success: 0, fails: 0 })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs defaultValue="import" className="w-full">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="import" className="flex-1 gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import
          </TabsTrigger>
          <TabsTrigger value="export" className="flex-1 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Export
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════
            IMPORT TAB
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="import" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Step 1: Select Entity & Upload File */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">1</span>
                  Select & Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Entity type selector */}
                <div>
                  <Label className="text-xs font-medium">Import Entity</Label>
                  <Select value={importEntity} onValueChange={(v) => { setImportEntity(v); clearFile() }}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_ENTITIES.map(e => (
                        <SelectItem key={e.value} value={e.value}>
                          <span className="flex items-center gap-2">
                            <span>{e.icon}</span>
                            <span>{e.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedEntityConfig && (
                    <p className="text-[10px] text-muted-foreground mt-1">{selectedEntityConfig.description}</p>
                  )}
                </div>

                {/* File upload area */}
                <div>
                  <Label className="text-xs font-medium">Upload CSV File</Label>
                  <div
                    className={`mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                      isDragOver
                        ? 'border-primary bg-primary/5 scale-[1.02]'
                        : selectedFile
                        ? 'border-green-300 bg-[#EEF1F8] dark:bg-green-950/20'
                        : 'border-muted-foreground/25 hover:border-primary/50'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-[#1E3C87]" />
                        <p className="text-xs font-medium text-[#0A1F54] dark:text-[#96A5C3]">{selectedFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{Math.round(selectedFile.size / 1024)} KB • {parsedRows.length} rows</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); clearFile() }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Drop CSV file here or click to browse</p>
                        <p className="text-[10px] text-muted-foreground/60">Supports .csv files</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      id="file-upload"
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </div>
                </div>

                {/* Template download */}
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleDownloadTemplate}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Template
                </Button>

                {/* Field reference */}
                {ENTITY_FIELD_MAP[importEntity] && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Required CSV Columns:</p>
                    <div className="flex flex-wrap gap-1">
                      {ENTITY_FIELD_MAP[importEntity].map(field => (
                        <Badge
                          key={field}
                          variant="outline"
                          className={`text-[9px] h-5 ${
                            field.endsWith('*')
                              ? 'border-primary/50 text-primary font-medium'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          }`}
                        >
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Preview Data */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">2</span>
                  Preview & Import
                  {parsedRows.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-5 ml-auto">
                      {parsedRows.length} rows • {parsedHeaders.length} columns
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {parsedRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Eye className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-xs">Upload a CSV file to preview data</p>
                    <p className="text-[10px] mt-1">First 5 rows will be shown here</p>
                  </div>
                ) : (
                  <>
                    {/* Preview table */}
                    <div className="rounded-md border overflow-hidden">
                      <div className="overflow-x-auto max-h-64">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-[10px] w-10 text-center">#</TableHead>
                              {parsedHeaders.map((header, idx) => (
                                <TableHead key={idx} className="text-[10px] whitespace-nowrap min-w-[100px]">
                                  {header}
                                  {ENTITY_FIELD_MAP[importEntity]?.some(f =>
                                    f.replace('*', '').toLowerCase() === header.toLowerCase()
                                  ) && (
                                    <span className="text-primary ml-0.5">*</span>
                                  )}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedRows.slice(0, 5).map((row, rowIdx) => (
                              <TableRow key={rowIdx}>
                                <TableCell className="text-[10px] text-muted-foreground text-center">{rowIdx + 1}</TableCell>
                                {parsedHeaders.map((header, colIdx) => (
                                  <TableCell key={colIdx} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                                    {row[header] || <span className="text-muted-foreground/40">—</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {parsedRows.length > 5 && (
                        <div className="border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground text-center">
                          Showing 5 of {parsedRows.length} rows
                        </div>
                      )}
                    </div>

                    {/* Import action */}
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        className="h-9 text-xs flex-1"
                        onClick={handleImport}
                        disabled={isImporting || parsedRows.length === 0}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                            Import {parsedRows.length} {importEntity} Records
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Progress bar */}
                    {isImporting && (
                      <div className="space-y-1">
                        <Progress value={importProgress} className="h-2" />
                        <p className="text-[10px] text-muted-foreground text-center">
                          Processing... {importProgress}%
                        </p>
                      </div>
                    )}

                    {/* Import Results */}
                    {importResult && (
                      <Card className={`border-2 ${importResult.success ? 'border-[#A5B4D2] bg-[#EEF1F8]/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'}`}>
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-xs flex items-center gap-2">
                            {importResult.success ? (
                              <CheckCircle2 className="h-4 w-4 text-[#1E3C87]" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            Import Results
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-3">
                          {/* Summary stats */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="rounded-md border bg-background p-2 text-center">
                              <p className="text-[10px] text-muted-foreground">Total</p>
                              <p className="text-sm font-bold">{importResult.totalRows}</p>
                            </div>
                            <div className="rounded-md border border-[#A5B4D2] bg-[#EEF1F8] dark:bg-green-950/30 p-2 text-center">
                              <p className="text-[10px] text-[#0F2D78]">Imported</p>
                              <p className="text-sm font-bold text-[#0A1F54] dark:text-[#96A5C3]">{importResult.imported}</p>
                            </div>
                            <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 p-2 text-center">
                              <p className="text-[10px] text-yellow-600">Skipped</p>
                              <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">{importResult.skipped}</p>
                            </div>
                            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-2 text-center">
                              <p className="text-[10px] text-red-600">Errors</p>
                              <p className="text-sm font-bold text-red-700 dark:text-red-400">{importResult.errors.length}</p>
                            </div>
                          </div>

                          {/* Error details */}
                          {importResult.errors.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium text-destructive">Error Details:</p>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {importResult.errors.map((err, i) => (
                                  <div key={i} className="flex items-start gap-2 text-[10px] rounded border border-red-100 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20 p-1.5">
                                    <Badge variant="outline" className="text-[8px] h-4 shrink-0 border-red-200 text-red-600">Row {err.row}</Badge>
                                    <span className="text-red-700 dark:text-red-400">{err.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            EXPORT TAB
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="export" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Export Configuration */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileType className="h-4 w-4" /> Export Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Entity/Report type selector */}
                <div>
                  <Label className="text-xs font-medium">Data Source</Label>
                  <Select value={exportEntity} onValueChange={setExportEntity}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] font-semibold">Master Data</SelectLabel>
                        {EXPORT_ENTITY_TYPES.filter(e => e.group === 'Master Data').map(e => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] font-semibold">Reports</SelectLabel>
                        {EXPORT_ENTITY_TYPES.filter(e => e.group === 'Reports').map(e => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range for reports */}
                {isReportExport && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">From</Label>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">To</Label>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Export format */}
                <div>
                  <Label className="text-xs font-medium">Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CSV">
                        <span className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-[#1E3C87]" />
                          CSV (Comma Separated)
                        </span>
                      </SelectItem>
                      <SelectItem value="XLSX">
                        <span className="flex items-center gap-2">
                          <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                          Excel Compatible (CSV)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {exportFormat === 'CSV' ? 'Standard comma-separated values format' : 'CSV format compatible with Excel'}
                  </p>
                </div>

                <Separator />

                {/* Export info */}
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground">
                      {isReportExport
                        ? 'Report exports use data from posted/approved vouchers within the selected date range.'
                        : 'Master data exports include all active records from the selected entity.'
                      }
                    </p>
                  </div>
                </div>

                {/* Export button */}
                <Button
                  size="sm"
                  className="w-full h-9 text-xs"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                      Export {selectedExportConfig?.label || exportEntity}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Download History & Info */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" /> Recent Downloads
                  {downloadHistory.length > 0 && (
                    <Badge variant="outline" className="text-[9px] h-5 ml-auto">
                      {downloadHistory.length} files
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {downloadHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Download className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-xs">No downloads yet</p>
                    <p className="text-[10px] mt-1">Exported files will appear here for quick re-download</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[10px]">File Name</TableHead>
                          <TableHead className="text-[10px]">Type</TableHead>
                          <TableHead className="text-[10px]">Format</TableHead>
                          <TableHead className="text-[10px]">Rows</TableHead>
                          <TableHead className="text-[10px]">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {downloadHistory.map((dl, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">
                              <div className="flex items-center gap-2">
                                {dl.format === 'CSV' ? (
                                  <FileText className="h-3.5 w-3.5 text-[#1E3C87]" />
                                ) : (
                                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                                )}
                                {dl.fileName}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[9px] h-5">
                                {EXPORT_ENTITY_TYPES.find(e => e.value === dl.entity)?.label || dl.entity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{dl.format}</TableCell>
                            <TableCell className="text-xs font-mono">{dl.rows}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">
                              {dl.timestamp.toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════
            HISTORY TAB
            ═══════════════════════════════════════════════════════════ */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> Import/Export History
              </CardTitle>
              <CardDescription className="text-xs">Complete log of all import and export operations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Direction</TableHead>
                      <TableHead className="text-[10px]">Type</TableHead>
                      <TableHead className="text-[10px]">Format</TableHead>
                      <TableHead className="text-[10px]">Records</TableHead>
                      <TableHead className="text-[10px]">Success</TableHead>
                      <TableHead className="text-[10px]">Failed</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLogs.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge className={`text-[8px] ${log.dir === 'Import' ? 'bg-blue-100 text-blue-800' : 'bg-[#EEF1F8] text-[#0F2D78]'}`}>
                            {log.dir === 'Import' ? <Upload className="h-2.5 w-2.5 mr-0.5" /> : <Download className="h-2.5 w-2.5 mr-0.5" />}
                            {log.dir}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{log.type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-xs">{log.format}</TableCell>
                        <TableCell className="text-xs font-mono">{log.records || '-'}</TableCell>
                        <TableCell className="text-xs font-mono text-[#0F2D78]">{log.success || '-'}</TableCell>
                        <TableCell className="text-xs font-mono text-red-600">{log.fails || '-'}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {log.dir === 'Import' ? (
                            log.fails > 0 ? (
                              <Badge className="text-[9px] bg-yellow-100 text-yellow-800">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Partial
                              </Badge>
                            ) : (
                              <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78]">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Complete
                              </Badge>
                            )
                          ) : (
                            <Badge className="text-[9px] bg-[#EEF1F8] text-[#0F2D78]">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Downloaded
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {allLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-xs py-8 text-muted-foreground">
                          No import/export history yet. Start by importing or exporting data.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
