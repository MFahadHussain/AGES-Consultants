'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Gift, Info } from 'lucide-react'

export interface CreateAllowanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: AllowanceFormState) => void
}

export interface AllowanceFormState {
  code: string
  name: string
  type: 'FIXED_AMOUNT' | 'PERCENTAGE'
  value: number
  isBaseOnSalary: boolean
  isTaxable: boolean
  isProjectSpecific: boolean
  isActive: boolean
  isInclusive: boolean
  isSocialCharges: boolean
}

const defaultFormState: AllowanceFormState = {
  code: '',
  name: '',
  type: 'PERCENTAGE',
  value: 0,
  isBaseOnSalary: true,
  isTaxable: true,
  isProjectSpecific: false,
  isActive: true,
  isInclusive: false,
  isSocialCharges: false,
}

export default function CreateAllowanceModal({ isOpen, onClose, onSubmit }: CreateAllowanceModalProps) {
  const [form, setForm] = useState<AllowanceFormState>({ ...defaultFormState })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleToggleChange = (field: keyof AllowanceFormState, value: boolean) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value }
      
      // Validation rule: inclusive only makes sense for percentages based on salary
      if (field === 'isInclusive' && value) {
        updated.type = 'PERCENTAGE'
        updated.isBaseOnSalary = true
      }
      
      return updated
    })
  }

  const handleTypeChange = (value: 'FIXED_AMOUNT' | 'PERCENTAGE') => {
    setForm(prev => {
      const updated = { ...prev, type: value }
      if (value === 'FIXED_AMOUNT') {
        updated.isInclusive = false
        updated.isBaseOnSalary = false
      }
      return updated
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim() || form.value < 0) return

    setIsSubmitting(true)
    
    // Simulate API request submission
    setTimeout(() => {
      console.log('Submitting Allowance Configuration:', form)
      if (onSubmit) {
        onSubmit(form)
      }
      setIsSubmitting(false)
      onClose()
      setForm({ ...defaultFormState })
    }, 800)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6 gap-6 rounded-xl border bg-card text-card-foreground shadow-lg">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <Gift className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">Configure Allowance</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Define allowances, configure dynamic basic salary deductions, and specify custom taxation rules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            {/* Code & Name Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-medium text-foreground">
                  Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  placeholder="e.g. HRA"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                  className="h-9 text-xs uppercase"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. House Rent Allowance"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Type & Value Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-xs font-medium text-foreground">
                  Calculation Type
                </Label>
                <Select value={form.type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="type" className="h-9 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE" className="text-xs">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED_AMOUNT" className="text-xs">Fixed Amount (PKR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="value" className="text-xs font-medium text-foreground">
                  Value {form.type === 'PERCENTAGE' ? '(%)' : '(PKR)'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step={form.type === 'PERCENTAGE' ? '0.01' : '1'}
                  placeholder={form.type === 'PERCENTAGE' ? '10' : '5000'}
                  value={form.value || ''}
                  onChange={e => setForm(p => ({ ...p, value: parseFloat(e.target.value) || 0 }))}
                  required
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Toggle Configuration List */}
            <div className="space-y-3 pt-2 border-t border-border">
              <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Configuration Toggles</h4>

              <div className="space-y-2.5">
                {/* 1. Base on Salary Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Base on Basic Salary</Label>
                    <p className="text-[10px] text-muted-foreground">Calculate percentage relative to Basic Salary</p>
                  </div>
                  <Switch
                    checked={form.isBaseOnSalary}
                    onCheckedChange={(checked) => handleToggleChange('isBaseOnSalary', checked)}
                    disabled={form.type === 'FIXED_AMOUNT'}
                  />
                </div>

                {/* 2. Taxable Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Subject to Income Tax</Label>
                    <p className="text-[10px] text-muted-foreground">Include in gross taxable income calculations</p>
                  </div>
                  <Switch
                    checked={form.isTaxable}
                    onCheckedChange={(checked) => handleToggleChange('isTaxable', checked)}
                  />
                </div>

                {/* 3. Project-Specific Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Project-Specific Variable</Label>
                    <p className="text-[10px] text-muted-foreground">Allows overrides per specific project assignments</p>
                  </div>
                  <Switch
                    checked={form.isProjectSpecific}
                    onCheckedChange={(checked) => handleToggleChange('isProjectSpecific', checked)}
                  />
                </div>

                {/* 4. Inclusive of Gross Toggle (CRUCIAL FIELD) */}
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-amber-700 dark:text-amber-500">Inclusive of Gross</Label>
                      <p className="text-[10px] text-amber-600 dark:text-amber-600/80">Carve allowance out of gross salary instead of adding on top</p>
                    </div>
                    <Switch
                      checked={form.isInclusive}
                      onCheckedChange={(checked) => handleToggleChange('isInclusive', checked)}
                      disabled={form.type === 'FIXED_AMOUNT'}
                    />
                  </div>
                  {form.isInclusive && (
                    <div className="flex items-start gap-1.5 mt-1 px-2 py-1.5 bg-amber-500/10 rounded border border-amber-500/20">
                      <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-amber-700 leading-tight">
                        <strong>Inclusive Formula Applied:</strong> If Gross = 100,000 and value = 10%, Basic Salary = 90,909 and Allowance = 9,091 (reverse-calculated).
                      </p>
                    </div>
                  )}
                </div>

                {/* 5. Social Charges Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">Social Charges</Label>
                    <p className="text-[10px] text-muted-foreground">Subject allowance to social charges processing</p>
                  </div>
                  <Switch
                    checked={form.isSocialCharges}
                    onCheckedChange={(checked) => handleToggleChange('isSocialCharges', checked)}
                  />
                </div>

                {/* 6. Active Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Set Active</Label>
                    <p className="text-[10px] text-muted-foreground">Available to assign to current active employees</p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => handleToggleChange('isActive', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs h-9 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isSubmitting ? 'Configuring...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
