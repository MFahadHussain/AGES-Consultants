'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  FileText,
  CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  CheckSquare,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentFinancialYear } from '@/lib/report-utils';

interface ReportControlPanelProps {
  onGenerate: (params: {
    reportType: string;
    viewMode: string;
    projectIds: string[];
    fromDate: string;
    toDate: string;
    detailLevel: string;
  }) => void;
  loading?: boolean;
  validationStatus?: 'ready' | 'validating' | 'errors';
}

interface Project {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  status?: string;
}

const REPORT_TYPES = [
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'profit_loss', label: 'P&L' },
  { value: 'cash_flow', label: 'Cash Flow' },
  { value: 'fixed_assets', label: 'Fixed Asset Schedule' },
  { value: 'intangible_asset_schedule', label: 'Intangible Asset Schedule' },
];

export default function ReportControlPanel({
  onGenerate,
  loading = false,
  validationStatus = 'ready',
}: ReportControlPanelProps) {
  const fy = getCurrentFinancialYear();

  const [reportType, setReportType] = useState('balance_sheet');
  const [viewMode, setViewMode] = useState('single');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(fy.fromDate);
  const [toDate, setToDate] = useState(fy.toDate);
  const [detailLevel, setDetailLevel] = useState('summary');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to fetch projects');
        const data = await res.json();
        // Sort by sortOrder, then by code
        const sorted = (Array.isArray(data) ? data : []).sort(
          (a: Project, b: Project) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code)
        );
        setProjects(sorted);
        // Auto-select first project
        if (sorted.length > 0) {
          setSelectedProjectIds([sorted[0].id]);
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    }
    fetchProjects();
  }, []);

  // Show project selector only for single or multi_column view modes
  const showProjectSelector = viewMode === 'single' || viewMode === 'multi_column';

  // Show detail level for Balance Sheet and Asset Schedules
  const showDetailLevel = reportType === 'balance_sheet' || reportType === 'fixed_assets' || reportType === 'intangible_asset_schedule';

  // Validation: at least one project and both dates selected
  const isValid =
    selectedProjectIds.length > 0 &&
    fromDate !== '' &&
    toDate !== '' &&
    (showProjectSelector || viewMode === 'consolidated');

  const handleGenerate = useCallback(() => {
    if (!isValid) return;
    onGenerate({
      reportType,
      viewMode,
      projectIds: selectedProjectIds,
      fromDate,
      toDate,
      detailLevel,
    });
  }, [reportType, viewMode, selectedProjectIds, fromDate, toDate, detailLevel, isValid, onGenerate]);

  const handleSelectAll = useCallback(() => {
    setSelectedProjectIds(projects.map((p) => p.id));
  }, [projects]);

  const handleSelectNone = useCallback(() => {
    setSelectedProjectIds([]);
  }, []);

  const handleToggleProject = useCallback((projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  }, []);

  // Parse date for Calendar
  const parseDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined;
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? undefined : d;
  };

  const formatDateForInput = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Validation status chip
  const validationChip = () => {
    switch (validationStatus) {
      case 'ready':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1">
            <CheckCircle2 className="size-3" /> ✓ Ready
          </Badge>
        );
      case 'validating':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
            <AlertTriangle className="size-3" /> ⚠ Validating
          </Badge>
        );
      case 'errors':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300 gap-1">
            <XCircle className="size-3" /> ✗ Errors Found
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="size-5" />
            Statutory Report Controls
          </CardTitle>
          {validationChip()}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Row 1: Report Type & View Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">View Mode</Label>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(val) => {
                if (val) setViewMode(val);
              }}
              className="border rounded-md"
            >
              <ToggleGroupItem
                value="single"
                className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Single Project
              </ToggleGroupItem>
              <ToggleGroupItem
                value="multi_column"
                className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Multi-Column
              </ToggleGroupItem>
              <ToggleGroupItem
                value="consolidated"
                className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Consolidated Only
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Project Selector */}
        {showProjectSelector && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Projects</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectAll}
                >
                  <CheckSquare className="size-3 mr-1" /> Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectNone}
                >
                  <Square className="size-3 mr-1" /> Select None
                </Button>
              </div>
            </div>
            <div className="border rounded-md">
              <ScrollArea className="h-36">
                <div className="p-2 space-y-1">
                  {projectsLoading ? (
                    <div className="text-sm text-muted-foreground p-2">Loading projects...</div>
                  ) : projects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">No projects available</div>
                  ) : (
                    projects.map((project) => (
                      <label
                        key={project.id}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-1.5 cursor-pointer hover:bg-accent transition-colors',
                          selectedProjectIds.includes(project.id) && 'bg-accent/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedProjectIds.includes(project.id)}
                          onCheckedChange={() => handleToggleProject(project.id)}
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          {project.code}
                        </span>
                        <span className="text-sm">{project.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            {selectedProjectIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''}{' '}
                selected
              </p>
            )}
          </div>
        )}

        {/* Row 2: Period fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">From Date</Label>
            <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !fromDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {fromDate ? new Date(fromDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseDate(fromDate)}
                  onSelect={(date) => {
                    if (date) {
                      setFromDate(formatDateForInput(date));
                      setFromDateOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">To Date</Label>
            <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !toDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {toDate ? new Date(toDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseDate(toDate)}
                  onSelect={(date) => {
                    if (date) {
                      setToDate(formatDateForInput(date));
                      setToDateOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Row 3: Detail Level (Balance Sheet only) */}
        {showDetailLevel && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Detail Level</Label>
            <ToggleGroup
              type="single"
              value={detailLevel}
              onValueChange={(val) => {
                if (val) setDetailLevel(val);
              }}
              className="border rounded-md w-fit"
            >
              <ToggleGroupItem
                value="summary"
                className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Summary
              </ToggleGroupItem>
              <ToggleGroupItem
                value="detailed"
                className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Detailed
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleGenerate}
            disabled={!isValid || loading}
            className="min-w-[180px]"
          >
            {loading ? (
              <>
                <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Play className="size-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
          {!isValid && (
            <p className="text-xs text-muted-foreground">
              Select at least one project and both date fields
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
