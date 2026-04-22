---
Task ID: 1
Agent: Main Agent
Task: Replace existing Chart of Accounts with new comprehensive COA and update all references

Work Log:
- Explored full codebase to identify all hardcoded account code dependencies (dashboard, payroll, fixed-assets, reports, bank-reconciliation, ledgers, FAMS settings/seed)
- Created /src/lib/account-roles.ts - shared utility for semantic role-based account lookups (replaces hardcoded code lookups)
- Designed comprehensive Pakistani NGO COA with 134 accounts across 5 types (Assets, Liabilities, Equity, Income, Expenses)
- Rewrote /src/app/api/seed/route.ts to completely replace the COA (deletes all old data, creates new COA, validates no duplicates/legacy)
- Updated /src/app/api/dashboard/route.ts - replaced code-based lookups with findAccountByRole/findAccountsByRole
- Updated /src/app/api/payroll/route.ts - replaced 7 hardcoded account codes with role-based lookups
- Updated /src/app/api/fixed-assets/route.ts - replaced '76'/'22' prefix lookups with findDepExpenseForCategory/findAccDepForCategory
- Updated /src/app/api/reports/route.ts - replaced '11' prefix lookup with findAccountsByRole('CASH_AND_BANK')
- Updated /src/app/api/bank-reconciliation/route.ts - replaced '112' prefix lookup with findAccountsByRole('BANK_ACCOUNT')
- Updated /src/app/api/ledgers/route.ts - replaced '112' prefix lookup with findAccountsByRole('BANK_ACCOUNT')
- Updated /src/app/api/fams/settings/route.ts - updated all GL mapping codes (1210→1510, 1215→1515, 1220→1520, 1225→1525, 1230→1530, 1235→1535, 1240→1540, 1300→1600, 5300→5600, 4500→4430, 5400→5910, 3200→3300, 1110→1121, plus category-specific acc dep/dep exp)
- Updated /src/app/api/fams/seed/route.ts - updated all GL account codes in asset definitions and FAMS settings
- Updated /src/components/modules/bank-reconciliation.tsx - removed hardcoded code reference from hint text
- Reseeded database - 134 accounts created, 0 duplicates, 0 missing, 0 legacy accounts
- Verified all API endpoints work correctly with new COA
- Lint check passes with 0 errors

Stage Summary:
- New COA: 134 accounts (42 Assets, 21 Liabilities, 7 Equity, 18 Income, 46 Expenses)
- All 134 accounts marked as isSystem: true (shared, cannot be deleted)
- 102 posting accounts, 32 control/group accounts
- All hardcoded account code lookups replaced with semantic role-based utility
- New subType taxonomy: CASH, BANK, RECEIVABLE, PAYABLE, PAYROLL_LIABILITY, FIXED_ASSET, ACCUMULATED_DEPRECIATION, DEPRECIATION, SALARY, SOCIAL_CHARGES, GAIN_ON_DISPOSAL, LOSS_ON_DISPOSAL, REVALUATION_RESERVE, etc.
- Bank accounts now use subType='BANK' instead of code prefix '112' for discovery
- System is fully decoupled from specific account numbering scheme

---
Task ID: 2
Agent: Main Agent
Task: Add Project, Client, Donor, Location, Financial Year filter options to Financial Reports

Work Log:
- Analyzed current Financial Reports component (reports.tsx) and API (api/reports/route.ts)
- Discovered the API already supports projectId, clientId, donorId, locationId, financialYearId query parameters but the frontend didn't expose them
- Rewrote reports.tsx to add comprehensive filter panel:
  - Added "Filters" button with active filter count badge
  - Expandable "Advanced Filters" panel with 5 dropdown filters: Project, Client, Donor, Location, Financial Year
  - Context-aware filters (e.g., hides "Project" filter for project_wise report since project is the grouping dimension)
  - Active filter tags with individual remove (X) buttons and "Clear All" option
  - Filter tags also shown below report description when filter panel is collapsed
  - Print template updated to include active filters in metadata
  - Report header description includes filtered dimensions
- Updated seed route (api/seed/route.ts) to create sample segment data:
  - 4 Donors: USAID Pakistan, EU Delegation, UNDP Pakistan, DFID (FCDO)
  - 4 Clients: Government of Punjab, UNICEF Pakistan, WHO, Engro Foundation
  - 5 Locations: Islamabad, Lahore, Karachi, Peshawar, Quetta
  - 6 Projects: Education Enhancement, Health & Nutrition, WASH KPK, Livelihood Balochistan, Capacity Building, COVID-19 Response
- Fixed seed data to match actual Prisma schema (removed isActive from Donor/Location, removed clientId/donorId/locationId from Project - those are at Voucher level)
- Reseeded database successfully with all segment data
- Verified all filter APIs return data correctly
- Lint check passes with 0 errors

Stage Summary:
- Financial Reports now has 5 filter dropdowns (Project, Client, Donor, Location, Financial Year)
- Filters are context-aware per report type (grouping dimension hidden from filters)
- Active filter tags shown in UI with remove/clear functionality
- Print and CSV exports include filter metadata
- Seed route now creates 4 donors, 4 clients, 5 locations, 6 projects for testing
- No backend API changes needed - existing endpoints already supported all filter params
