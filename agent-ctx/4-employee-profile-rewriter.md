# Task 4: Rewrite employee-profile.tsx to use real API data

## Summary
Completely rewrote `/home/z/my-project/src/components/modules/employee-profile.tsx` (was 1692 lines of hardcoded demo data, now ~1050 lines of real API-connected code).

## What was done
1. Removed ALL hardcoded demo data (EMPLOYEES, ATT_MAY_2026, MONTHLY_ATT, WD_PER_MONTH, DEFAULT_DOCS, MONTHS, buildSalaryHistory, buildScLedger, buildLoans, buildAdvances, computeLocalSC)
2. Added TypeScript interfaces for API response types
3. Connected all data to real API endpoints:
   - GET /api/employees?pageSize=200&status=active → Employee list
   - GET /api/payroll → Payroll batches with lines (filtered by employeeId)
   - GET /api/attendance?view=monthly&employeeId=xxx&month=YYYY-MM → Attendance calendar
   - GET /api/loans?employeeId=xxx → Loans with installments
   - PUT /api/employees?id=xxx → Profile edit
4. All 5 tabs now use real data with proper loading/empty states
5. Profile card shows all Employee model fields (personal, contact, employment, banking, statutory, NOK, qualification, experience)
6. Uses useToast from @/hooks/use-toast (NOT sonner)

## Lint
0 errors, only pre-existing warnings in other files
