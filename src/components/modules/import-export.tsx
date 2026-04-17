'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Upload, FileSpreadsheet, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function ImportExport() {
  const [logs, setLogs] = useState<{ imports: any[]; exports: any[] }>({ imports: [], exports: [] })
  const [importType, setImportType] = useState('DONOR_INVOICE')
  const [exportType, setExportType] = useState('trial_balance')
  const [exportFormat, setExportFormat] = useState('PDF')
  const { toast } = useToast()

  const fetchLogs = async () => {
    const res = await fetch('/api/import-export')
    setLogs(await res.json())
  }

  useEffect(() => { queueMicrotask(() => fetchLogs()) }, [])

  const handleImport = async () => {
    await fetch('/api/import-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', importType, fileName: 'upload.csv', fileType: 'CSV', recordCount: 0, successCount: 0, failCount: 0 }),
    })
    toast({ title: 'Import Initiated', description: `Importing ${importType} from file` })
    fetchLogs()
  }

  const handleExport = async () => {
    await fetch('/api/import-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export', exportType, format: exportFormat, parameters: {} }),
    })
    toast({ title: 'Export Started', description: `Exporting ${exportType} as ${exportFormat}` })
    fetchLogs()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Import */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" />Import Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Import Type</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DONOR_INVOICE">Donor Invoices</SelectItem>
                  <SelectItem value="CHART_OF_ACCOUNTS">Chart of Accounts</SelectItem>
                  <SelectItem value="BANK_STATEMENT">Bank Statement</SelectItem>
                  <SelectItem value="BUDGET_DATA">Budget Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Upload File (CSV/Excel)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center mt-1 hover:border-primary/50 transition-colors cursor-pointer">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Click or drag file to upload</p>
                <p className="text-[10px] text-muted-foreground mt-1">Supports .csv, .xlsx formats</p>
              </div>
            </div>
            <Button size="sm" className="w-full h-8 text-xs" onClick={handleImport}><Upload className="h-3.5 w-3.5 mr-1" />Import</Button>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Download className="h-4 w-4" />Export Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs">Report Type</Label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['trial_balance', 'balance_sheet', 'pnl', 'cash_flow', 'donor_wise', 'project_wise', 'location_wise', 'aging', 'budget_utilization'].map(r => (
                    <SelectItem key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="XLSX">Excel (XLSX)</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="DOCX">Word (DOCX)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="w-full h-8 text-xs" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Import/Export History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-[10px]">Type</TableHead>
              <TableHead className="text-[10px]">Format</TableHead>
              <TableHead className="text-[10px]">Records</TableHead>
              <TableHead className="text-[10px]">Date</TableHead>
              <TableHead className="text-[10px]">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {[...logs.imports.map(l => ({ ...l, dir: 'Import' })), ...logs.exports.map(l => ({ ...l, dir: 'Export' }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((log: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">
                    <Badge className={`text-[8px] ${log.dir === 'Import' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{log.dir}</Badge>
                    <span className="ml-1">{log.importType || log.exportType}</span>
                  </TableCell>
                  <TableCell className="text-xs">{log.fileType || log.format}</TableCell>
                  <TableCell className="text-xs">{log.recordCount || '-'}</TableCell>
                  <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs"><Badge className="text-[9px] bg-green-100 text-green-800">Completed</Badge></TableCell>
                </TableRow>
              ))}
              {logs.imports.length === 0 && logs.exports.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs py-4 text-muted-foreground">No import/export history</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
