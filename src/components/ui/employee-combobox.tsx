'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface EmployeeOption {
  id: string
  employeeCode: string
  name: string
  designation?: string | null
  department?: string | null
}

interface EmployeeComboboxProps {
  employees: EmployeeOption[]
  value: string            // Selected employee ID
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function EmployeeCombobox({
  employees,
  value,
  onChange,
  placeholder = 'Select employee...',
  className,
  disabled = false,
}: EmployeeComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Find selected employee
  const selectedEmployee = employees.find(e => e.id === value)

  // Filter employees dynamically by code or name
  const filteredEmployees = React.useMemo(() => {
    if (!searchQuery.trim()) return employees

    const q = searchQuery.toLowerCase().trim()
    return employees.filter(e => 
      e.name.toLowerCase().includes(q) || 
      e.employeeCode.toLowerCase().includes(q) ||
      (e.designation && e.designation.toLowerCase().includes(q))
    )
  }, [employees, searchQuery])

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-8 text-xs justify-between font-normal w-full border-slate-200 bg-white hover:bg-slate-50',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selectedEmployee ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded shrink-0 font-medium">
                {selectedEmployee.employeeCode}
              </span>
              <span className="truncate text-slate-900 font-medium">{selectedEmployee.name}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 ml-1 text-slate-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0 border border-slate-200 shadow-md rounded-lg"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} className="rounded-lg">
          <div className="flex items-center border-b border-slate-100 px-3">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-50 mr-2 text-slate-500" />
            <input
              className="flex h-9 w-full bg-transparent py-2.5 text-xs outline-none placeholder:text-slate-400 text-slate-900"
              placeholder="Search by code, name, designation..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[240px] overflow-y-auto overscroll-contain">
            <CommandEmpty className="py-6 text-center text-xs text-slate-500 font-medium">
              {searchQuery ? `No employees matching "${searchQuery}"` : 'No employees found'}
            </CommandEmpty>
            <CommandGroup heading={<span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Employees ({filteredEmployees.length})</span>}>
              {filteredEmployees.map(emp => (
                <CommandItem
                  key={emp.id}
                  value={emp.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue)
                    setOpen(false)
                    setSearchQuery('')
                  }}
                  className="text-xs py-2 px-2.5 cursor-pointer hover:bg-slate-50 flex items-center justify-between data-[selected=true]:bg-slate-100/85"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-[#0F2D78] mr-0.5',
                        value === emp.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-semibold shrink-0">
                      {emp.employeeCode}
                    </span>
                    <span className="font-medium text-slate-900 truncate">{emp.name}</span>
                    {emp.designation && (
                      <span className="text-[10px] text-slate-400 truncate font-normal">
                        ({emp.designation})
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {/* Footer count info */}
          <div className="border-t border-slate-100 px-3 py-2 text-[9px] text-slate-400 flex items-center justify-between bg-slate-50/50">
            <span>
              Showing {filteredEmployees.length} of {employees.length} employees
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-slate-200 text-[8px] bg-white">↑↓</kbd> navigate
              <kbd className="px-1 py-0.5 rounded border border-slate-200 text-[8px] bg-white">↵</kbd> select
            </span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
