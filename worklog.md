---
Task ID: 1
Agent: Main Agent
Task: Fix Fixed Asset Registration Form UI and API error

Work Log:
- Read and analyzed the full fixed-assets.tsx component (3100+ lines), API routes, Prisma schema, and account-roles utility
- Identified that the `assetTag` field was missing from the Prisma schema (causing data to not be persisted)
- Identified that the registration form UI was using Card components with inconsistent styling and a 2-column grid layout
- Identified the `[FAMS] Asset creation failed: {}` error was caused by poor error handling - the response body was parsed as JSON but the error path didn't properly extract the error message
- Added `assetTag` field to Prisma schema and ran db:push
- Added `assetTag` to the POST and PUT API route handlers
- Improved API error handling with Prisma-specific error messages (unique constraint, required fields)
- Added server-side console.log for successful asset creation
- Completely redesigned the registration form UI:
  - Replaced Card components with cleaner rounded-xl border containers
  - Added numbered step indicators (1-9) with primary-colored badges
  - Added section descriptions under each header
  - Switched from 2-column to 3-column grid layout for better space usage
  - Added consistent Field wrapper component with proper label spacing
  - Improved depreciation preview with colored stat cards (annual/monthly/total)
  - Added description textarea field in Asset Specifications section
  - Added Date of Capitalization as a separate field
  - Added Project and Fund Code fields in Location & Custodian section
  - Improved donor funding section with a bordered switch container
  - Added GL mapping info note
  - Made dialog wider (max-w-4xl) with better header styling
  - Added "Reset Form" button in the sticky action bar
  - Added loading spinner to the submit button
- Improved handleSaveAsset function:
  - Added separate try/catch for network errors vs API errors vs JSON parse errors
  - Properly extracts error message from response body (checks both .error and .message fields)
  - Better error toasts with specific messages
- Regenerated Prisma client and restarted dev server
- Verified asset creation API works with assetTag field
- Lint check passes with 0 errors

Stage Summary:
- Fixed: assetTag field now properly stored in database
- Fixed: API returns proper error messages instead of empty `{}`
- Fixed: Registration form UI completely redesigned with professional 3-column layout, step indicators, and better visual hierarchy
- Fixed: Error handling in handleSaveAsset properly handles network errors, JSON parse errors, and API error messages
