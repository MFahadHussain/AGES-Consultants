# Task 2 - Attendance Fix Agent

## Task
Rewrite attendance.tsx with project selection, updated state shape, and project summary column

## Summary of Changes

### Fix 1 — Project Selection Per Day Cell
- Added `WORKING_STATUSES = new Set(['P', 'W', 'H', 'WH', 'T', 'CO'])`
- When a cell status is set to a working status, a popover opens below the cell
- Popover contains a "Project" label, a `<select>` dropdown with project list, and a ✓ Confirm button
- After project is selected, cell shows status badge + tiny project tag below (e.g. "Alpha")
- Non-working statuses (A, SL, CL, EL, CD) cycle as before, no popover
- Popover closes on outside click or confirm

### Fix 2 — Store Project Per Cell in State
- Updated `DayData` interface: added `project: string | null`
- All existing logic (cycling, quick-fill, summary counts) uses `cell.status`
- Quick-fill sets `project: "Unallocated"` for working statuses, `null` for non-working
- Bulk save includes `project` in records sent to API
- When building grid from records, maps `rec.projectId` to project name via `projectIdToName()`

### Fix 3 — Project Summary Column
- Added "Projects" column header after SC-De
- Per employee row: stacked list of unique projects with counts (e.g. "Alpha ×12")
- Shows "—" if all days are Unallocated or non-working

## Technical Details
- `popoverCell` state: `{empId: string, day: number} | null`
- `popoverProject` state: string (selected project in popover)
- `popoverRef` for outside-click detection via useEffect with mousedown listener
- Projects fetched from `/api/projects` on mount
- `projectNames` memo: `['Unallocated', ...projects.map(p => p.name)]`
- `getShortProjectName()`: strips "Proj " prefix, uses code before " - ", truncates to 8 chars

## Lint Status
0 errors, 4 pre-existing warnings in FAMS files

## Files Changed
- `/home/z/my-project/src/components/modules/attendance.tsx` — Complete rewrite with all 3 fixes
