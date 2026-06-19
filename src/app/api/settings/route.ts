import { withAudit } from '@/lib/audit-wrapper'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Default settings that will be seeded if not present
const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description: string; isPublic: boolean }> = {
  company_name: { value: 'AGES Consultants', category: 'general', description: 'Company legal name', isPublic: true },
  company_short_name: { value: 'AGES', category: 'general', description: 'Short name for display', isPublic: true },
  company_address: { value: '123 Finance Street, Business District, Karachi 74000', category: 'general', description: 'Company address', isPublic: true },
  company_phone: { value: '+92-21-1234567', category: 'general', description: 'Company phone number', isPublic: true },
  company_email: { value: 'info@agesconsultants.com', category: 'general', description: 'Company email', isPublic: true },
  company_website: { value: 'www.agesconsultants.com', category: 'general', description: 'Company website', isPublic: true },
  company_tax_number: { value: 'NTN-1234567-8', category: 'general', description: 'National Tax Number', isPublic: false },
  company_registration: { value: 'REG-2024-001', category: 'general', description: 'Company registration number', isPublic: false },
  base_currency: { value: 'PKR', category: 'general', description: 'Base currency code', isPublic: true },
  currency_symbol: { value: '₨', category: 'general', description: 'Currency symbol', isPublic: true },
  fiscal_year_start_month: { value: '7', category: 'general', description: 'Fiscal year start month (1-12)', isPublic: true },
  date_format: { value: 'DD/MM/YYYY', category: 'general', description: 'Display date format', isPublic: true },
  timezone: { value: 'Asia/Karachi', category: 'general', description: 'System timezone', isPublic: true },

  voucher_auto_number: { value: 'true', category: 'voucher', description: 'Auto-generate voucher numbers', isPublic: true },
  voucher_number_prefix: { value: 'VOU', category: 'voucher', description: 'Voucher number prefix', isPublic: true },
  voucher_number_format: { value: 'PREFIX-YYYYMM-SEQ', category: 'voucher', description: 'Voucher number format pattern', isPublic: true },
  voucher_require_narration: { value: 'true', category: 'voucher', description: 'Require narration on all vouchers', isPublic: true },
  voucher_require_reference: { value: 'false', category: 'voucher', description: 'Require reference on all vouchers', isPublic: true },
  voucher_allow_quick_post: { value: 'true', category: 'voucher', description: 'Allow quick post (bypass approval)', isPublic: true },
  voucher_approval_workflow: { value: 'standard', category: 'voucher', description: 'Approval workflow: standard or simplified', isPublic: true },
  voucher_max_amount_quick_post: { value: '50000', category: 'voucher', description: 'Max amount allowed for quick post', isPublic: false },
  voucher_default_narration: { value: '', category: 'voucher', description: 'Default narration template', isPublic: true },

  session_timeout: { value: '30', category: 'security', description: 'Session timeout in minutes', isPublic: false },
  password_min_length: { value: '8', category: 'security', description: 'Minimum password length', isPublic: true },
  password_require_uppercase: { value: 'true', category: 'security', description: 'Require uppercase letters', isPublic: true },
  password_require_numbers: { value: 'true', category: 'security', description: 'Require numbers in password', isPublic: true },
  password_require_special: { value: 'false', category: 'security', description: 'Require special characters', isPublic: true },
  login_max_attempts: { value: '5', category: 'security', description: 'Max login attempts before lockout', isPublic: false },
  audit_log_retention_days: { value: '365', category: 'security', description: 'Audit log retention period in days', isPublic: true },

  payroll_integration_enabled: { value: 'true', category: 'integration', description: 'Enable Payroll integration', isPublic: true },
  payroll_auto_post: { value: 'false', category: 'integration', description: 'Auto-post payroll to GL', isPublic: true },
  fixed_assets_integration_enabled: { value: 'true', category: 'integration', description: 'Enable Fixed Assets integration', isPublic: true },
  fixed_assets_auto_depreciation: { value: 'false', category: 'integration', description: 'Auto-calculate monthly depreciation', isPublic: true },
  email_notifications: { value: 'false', category: 'integration', description: 'Enable email notifications', isPublic: true },
  backup_auto: { value: 'false', category: 'integration', description: 'Enable automatic backups', isPublic: false },

  theme: { value: 'system', category: 'appearance', description: 'UI theme: light, dark, or system', isPublic: true },
  sidebar_collapsed: { value: 'false', category: 'appearance', description: 'Default sidebar state', isPublic: true },
  rows_per_page: { value: '25', category: 'appearance', description: 'Default rows per page in tables', isPublic: true },
  show_account_codes: { value: 'true', category: 'appearance', description: 'Show account codes in dropdowns', isPublic: true },
  thousand_separator: { value: ',', category: 'appearance', description: 'Thousand separator character', isPublic: true },
  decimal_places: { value: '2', category: 'appearance', description: 'Number of decimal places', isPublic: true },
}

// Cache flag to avoid re-seeding on every request
let _seeded = false

// GET /api/settings - Get all settings (optionally filtered by category)
async function GET_HANDLER(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const publicOnly = searchParams.get('public') === 'true'

    // Seed defaults only once per process
    if (!_seeded) {
      await seedDefaults()
      _seeded = true
    }

    const where: Record<string, string> = {}
    if (category) where.category = category

    const settings = await db.systemSetting.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    const filtered = publicOnly ? settings.filter(s => s.isPublic) : settings

    // Convert to key-value map for easy access
    const settingsMap: Record<string, typeof settings[0]> = {}
    for (const s of filtered) {
      settingsMap[s.key] = s
    }

    return NextResponse.json({ settings: filtered, map: settingsMap })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// POST /api/settings - Update settings (batch update)
async function POST_HANDLER(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body as { settings: Record<string, string> }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings object is required' }, { status: 400 })
    }

    // Use upsert for efficiency - update existing or create new
    const results = []
    for (const [key, value] of Object.entries(settings)) {
      const config = DEFAULT_SETTINGS[key]
      const result = await db.systemSetting.upsert({
        where: { key },
        update: { value },
        create: {
          key,
          value,
          category: config?.category || 'general',
          description: config?.description || `Custom setting: ${key}`,
          isPublic: config?.isPublic ?? false,
        },
      })
      results.push(result)
    }

    return NextResponse.json({ success: true, updated: results.length, settings: results })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

// Helper: seed default settings if they don't exist (runs once)
async function seedDefaults() {
  try {
    const existingCount = await db.systemSetting.count()
    if (existingCount >= Object.keys(DEFAULT_SETTINGS).length) {
      return // Already seeded
    }

    // Only create missing settings
    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      await db.systemSetting.upsert({
        where: { key },
        update: {},
        create: {
          key,
          value: config.value,
          category: config.category,
          description: config.description,
          isPublic: config.isPublic,
        },
      })
    }
  } catch (error) {
    console.error('Error seeding defaults:', error)
  }
}

export const POST = withAudit('settings', POST_HANDLER);

export const GET = withAudit('settings', GET_HANDLER);
