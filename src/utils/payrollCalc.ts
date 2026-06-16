export type AllowanceType = 'FIXED_AMOUNT' | 'PERCENTAGE';

export interface Allowance {
  id: string;
  code: string;
  name: string;
  type: AllowanceType;
  value: number;
  isBaseOnSalary: boolean;
  isTaxable: boolean;
  isProjectSpecific: boolean;
  isActive: boolean;
  isInclusive: boolean;
}

export interface CalculatedAllowance {
  id: string;
  code: string;
  name: string;
  type: AllowanceType;
  value: number;
  isInclusive: boolean;
  calculatedAmount: number;
}

export interface PayrollBreakdown {
  grossSalary: number;
  basicSalary: number;
  calculatedAllowances: CalculatedAllowance[];
}

/**
 * Calculates the payroll breakdown based on assigned gross salary and active allowances.
 * Supports standard additions and inclusive carve-outs.
 */
export function calculatePayroll(grossTarget: number) {
  // 1. Calculate base components
  const basicSalary = Math.round(grossTarget * (2 / 3));
  const medicalAllowance = Math.round(basicSalary * 0.10);

  // 2. Calculate Field Allowance as 40% of (Basic + Medical)
  const baseForField = basicSalary + medicalAllowance;
  const fieldAllowance = Math.round(baseForField * 0.40);

  // 3. Re-calculate the actual Gross Total based on the new Field Allowance
  const grossTotal = basicSalary + medicalAllowance + fieldAllowance;

  return {
    basicSalary,
    medicalAllowance,
    fieldAllowance,
    grossTotal
  };
}
