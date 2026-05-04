# Task 2+9: Payroll Engine Rebuild

## Agent: Payroll Engine Rebuild Agent

## Summary
Rebuilt the Payroll Calculation Engine and updated the Payroll API route with YTD tax engine, multi-project allocation, ESSI/Gratuity support.

## Files Modified
1. `/src/lib/payroll/calculateMonthlyPayroll.ts` — Complete rebuild
2. `/src/app/api/payroll/route.ts` — Major update with new fields, ESSI GL entries, recalculate action
3. `/src/app/api/payroll/calculate/route.ts` — No changes needed (inherits YTD engine from calculateMonthlyPayroll)

## Key Changes

### calculateMonthlyPayroll.ts
- Earned Salary = (Base Salary / Calendar Days) × Payable Days
- Multi-project allocation by weight (no duplication)
- YTD + Rolling Projection Tax Engine with FBR 2024-25 slabs
- ESSI (6% employer, 0% employee default), conditional on essiEnabled
- EOBI fixed (Rs 370 employee, Rs 870 employer), conditional on eobiEnabled
- Gratuity (Basic/12), conditional on gratuityEnabled
- PF (8.33% both), conditional on pfEnabled
- All PKR amounts rounded with Math.round

### payroll/route.ts
- New fields: calendarDays, payableDays, essiEmployee, essiEmployer, projectAllocations
- recalcBatchTotals includes totalEssiEmployee, totalEssiEmployer
- GL entries for ESSI employee/employer and Gratuity
- New `recalculate` action for re-running payroll on draft batches
- Shared buildGlEntries() helper to eliminate code duplication
- All conditional checks enforced

## Lint Result
0 errors, 4 pre-existing warnings
