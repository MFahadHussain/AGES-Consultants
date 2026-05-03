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

// ============================================================
// Account Data Interface
// ============================================================

export interface AccountOption {
  id: string
  code: string         // e.g., "01-01-01-0001"
  name: string         // e.g., "Turbon Pro"
  accountType: string  // e.g., "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"
  subType?: string     // e.g., "CURRENT_ASSET", "FIXED_ASSET"
  level?: number       // Hierarchy level: 0=Category, 1=Group, 2=Sub-Group, 3=Detail
  allowPosting?: boolean
  isActive?: boolean
}

// ============================================================
// Account Type Group Config
// ============================================================

const ACCOUNT_TYPE_GROUPS: Record<string, { label: string; code: string; color: string }> = {
  ASSET:      { label: 'Assets',              code: '01', color: 'text-emerald-700' },
  LIABILITY:  { label: 'Liabilities',         code: '03', color: 'text-red-700' },
  EQUITY:     { label: 'Capital / Equity',    code: '02', color: 'text-violet-700' },
  INCOME:     { label: 'Revenue',             code: '04', color: 'text-blue-700' },
  EXPENSE:    { label: 'Expenses',            code: '05', color: 'text-orange-700' },
}

// Order for display in the combobox
const TYPE_DISPLAY_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

// ============================================================
// Account Search Combobox
// ============================================================

interface AccountComboboxProps {
  accounts: AccountOption[]
  value: string            // Selected account ID
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AccountCombobox({
  accounts,
  value,
  onChange,
  placeholder = 'Search account…',
  className,
  disabled = false,
}: AccountComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Find the currently selected account for display
  const selectedAccount = accounts.find(a => a.id === value)

  // Group accounts by type for organized display
  const groupedAccounts = React.useMemo(() => {
    const groups: Record<string, AccountOption[]> = {}

    for (const account of accounts) {
      const type = account.accountType || 'OTHER'
      if (!groups[type]) groups[type] = []
      groups[type].push(account)
    }

    // Sort accounts within each group by code
    for (const type of Object.keys(groups)) {
      groups[type].sort((a, b) => a.code.localeCompare(b.code))
    }

    return groups
  }, [accounts])

  // Filter accounts based on search query (search by code OR name)
  const filteredGroups = React.useMemo(() => {
    if (!searchQuery.trim()) return groupedAccounts

    const q = searchQuery.toLowerCase().trim()
    // Remove dashes from search for numeric code matching
    const numericQuery = q.replace(/-/g, '')
    const filtered: Record<string, AccountOption[]> = {}

    for (const [type, accs] of Object.entries(groupedAccounts)) {
      const matching = accs.filter(a => {
        const codeMatch = a.code.toLowerCase().includes(q) ||
                          a.code.replace(/-/g, '').includes(numericQuery)
        const nameMatch = a.name.toLowerCase().includes(q)
        const typeMatch = a.accountType.toLowerCase().includes(q)
        return codeMatch || nameMatch || typeMatch
      })
      if (matching.length > 0) {
        filtered[type] = matching
      }
    }

    return filtered
  }, [groupedAccounts, searchQuery])

  // Render account display with highlighted code
  const renderAccountLabel = (account: AccountOption) => {
    const typeConfig = ACCOUNT_TYPE_GROUPS[account.accountType]
    return (
      <div className="flex items-center gap-2 w-full min-w-0">
        <span className="font-mono text-[11px] text-muted-foreground shrink-0 tracking-tight">
          {account.code}
        </span>
        <span className="truncate text-[12px]">{account.name}</span>
        {account.level !== undefined && account.level < 3 && (
          <span className="ml-auto text-[9px] text-muted-foreground shrink-0 px-1 py-0.5 rounded bg-muted">
            Header
          </span>
        )}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-7 text-[10px] justify-between font-normal w-full',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selectedAccount ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-mono text-muted-foreground shrink-0">{selectedAccount.code}</span>
              <span className="truncate">{selectedAccount.name}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} className="rounded-lg">
          <div className="flex items-center border-b px-3">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-50 mr-2" />
            <input
              className="flex h-8 w-full bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
              placeholder="Search by code or name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {searchQuery ? `No accounts matching "${searchQuery}"` : 'No accounts found'}
            </CommandEmpty>
            {TYPE_DISPLAY_ORDER.map(type => {
              const accs = filteredGroups[type]
              if (!accs || accs.length === 0) return null
              const config = ACCOUNT_TYPE_GROUPS[type]
              return (
                <CommandGroup
                  key={type}
                  heading={
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${config?.color || 'text-foreground'}`}>
                      {config?.code && <span className="font-mono mr-1">{config.code}</span>}
                      {config?.label || type}
                      <span className="ml-1 font-normal text-muted-foreground">({accs.length})</span>
                    </span>
                  }
                >
                  {accs.map(account => (
                    <CommandItem
                      key={account.id}
                      value={account.id}
                      onSelect={(currentValue) => {
                        onChange(currentValue === value ? '' : currentValue)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                      className="text-xs py-1.5 px-2 cursor-pointer data-[selected=true]:bg-accent"
                    >
                      <Check
                        className={cn(
                          'h-3 w-3 shrink-0 mr-1',
                          value === account.id ? 'opacity-100 text-primary' : 'opacity-0'
                        )}
                      />
                      {renderAccountLabel(account)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
            {/* Show any other account types not in the standard order */}
            {Object.entries(filteredGroups)
              .filter(([type]) => !TYPE_DISPLAY_ORDER.includes(type))
              .map(([type, accs]) => (
                <CommandGroup
                  key={type}
                  heading={
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {type} <span className="font-normal text-muted-foreground">({accs.length})</span>
                    </span>
                  }
                >
                  {accs.map(account => (
                    <CommandItem
                      key={account.id}
                      value={account.id}
                      onSelect={(currentValue) => {
                        onChange(currentValue === value ? '' : currentValue)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                      className="text-xs py-1.5 px-2 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'h-3 w-3 shrink-0 mr-1',
                          value === account.id ? 'opacity-100 text-primary' : 'opacity-0'
                        )}
                      />
                      {renderAccountLabel(account)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
          {/* Footer with count */}
          <div className="border-t px-3 py-1.5 text-[9px] text-muted-foreground flex items-center justify-between">
            <span>
              {Object.values(filteredGroups).reduce((sum, accs) => sum + accs.length, 0)} account{Object.values(filteredGroups).reduce((sum, accs) => sum + accs.length, 0) !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-1 py-0.5 rounded border text-[8px]">↑↓</kbd> navigate
              <kbd className="px-1 py-0.5 rounded border text-[8px]">↵</kbd> select
              <kbd className="px-1 py-0.5 rounded border text-[8px]">esc</kbd> close
            </span>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
