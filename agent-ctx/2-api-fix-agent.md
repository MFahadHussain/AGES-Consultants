# Task 2 - API Fix Agent

## Task: Fix all FAMS API route errors and consolidate helpers

## Summary
Completed all 6 fixes as specified. Zero lint errors and zero warnings. Dev server running normally.

## Changes Made

### 1. `/api/fams/assets/route.ts` - GET endpoint filtering & pagination
- Changed `GET()` → `GET(request: NextRequest)` 
- Added 8 filter params: search, category, status, province, isDonorFunded, depreciationMethod, approvalStatus
- Added pagination: page (default 1), limit (default 20)
- Response: `{ assets, total, totalPages, summary: { totalCost, totalAccDep, totalNBV, donorCount, donorCost, totalCount } }`
- Summary from ALL matching assets (not just current page)

### 2. `/api/fams/journals/route.ts` - Added statusCounts
- Added `statusCounts: { pending, exported, reversed }` to response
- Kept existing `stats` for backward compatibility

### 3. `/api/fams/depreciation/route.ts` - Consolidated helpers
- Removed local `resolveAccountId` and `getOpenFinancialYearId`
- Added `import { resolveAccountId, getOpenFinancialYearId } from '@/lib/fams-gl'`

### 4. `/api/fams/transactions/route.ts` - Consolidated helpers
- Removed local `resolveAccountId` and `getOpenFinancialYearId`
- Added `import { resolveAccountId, getOpenFinancialYearId } from '@/lib/fams-gl'`

### 5. `/api/fams/export/route.ts` - Consolidated helpers
- Removed local `resolveAccountId` and `getOpenFinancialYearId`
- Added `import { resolveAccountId, getOpenFinancialYearId } from '@/lib/fams-gl'`

### 6. `/api/fams/journals/export/route.ts` - Replaced getUserId
- Removed local `getUserId()` function
- Added `import { getSystemUserId } from '@/lib/db'`
- Replaced `getUserId()` → `getSystemUserId()`
- Changed `Request` → `NextRequest` param type

### 7. `/api/fams/assets/route.ts` - POST auto-post to GL
- Added `import { postAssetAcquisitionToGL } from '@/lib/fams-gl'`
- After create, calls `postAssetAcquisitionToGL(asset)` in try/catch

## Lint Result
0 errors, 0 warnings
