/**
 * Pure rules for canteen payment plans — how a sale is settled for a student under each plan type.
 * Kept free of I/O so the behaviour is unit-testable and identical in the API and in tests.
 */
export type PlanType = 'PREPAID' | 'PAY_AS_YOU_GO' | 'MEAL_PLAN' | 'CREDIT' | 'ALLOWANCE';

export interface SaleLine {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}
export interface PlanContext {
  type: PlanType;
  mealsPerDay: number;
  coveredItemIds: string[];
  /** Meals already covered by the plan today */
  mealsUsedToday: number;
  creditLimit: number | null;
  dailyLimit: number | null;
}
export interface Settlement {
  /** Amount the meal plan absorbs (not charged) */
  coveredAmount: number;
  /** Number of covered meals consumed by this sale */
  mealCount: number;
  /** Amount still to be paid (wallet / cash / credit) */
  chargeable: number;
  /** How the chargeable part is settled */
  mode: 'WALLET' | 'CASH' | 'MEAL_PLAN' | 'CREDIT';
  reason?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Splits the sale between the plan and the payer.
 * - MEAL_PLAN: up to `mealsPerDay - mealsUsedToday` units of covered items are free; the rest is chargeable.
 * - CREDIT: everything chargeable goes on the wallet even when negative, down to -creditLimit.
 * - PREPAID / ALLOWANCE: chargeable goes on the wallet (must have balance).
 * - PAY_AS_YOU_GO: chargeable must be paid in cash at the counter.
 */
export function settleSale(lines: SaleLine[], plan: PlanContext | null, requestedMode: 'WALLET' | 'CASH'): Settlement {
  const total = round2(lines.reduce((s, l) => s + l.total, 0));
  if (!plan) return { coveredAmount: 0, mealCount: 0, chargeable: total, mode: requestedMode };
  let coveredAmount = 0;
  let mealCount = 0;
  if (plan.type === 'MEAL_PLAN') {
    let remainingMeals = Math.max(0, plan.mealsPerDay - plan.mealsUsedToday);
    for (const l of lines) {
      if (!plan.coveredItemIds.includes(l.itemId) || remainingMeals <= 0) continue;
      const covered = Math.min(l.quantity, remainingMeals);
      coveredAmount += covered * l.price;
      mealCount += covered;
      remainingMeals -= covered;
    }
  }
  const chargeable = round2(Math.max(0, total - coveredAmount));
  if (chargeable === 0 && plan.type === 'MEAL_PLAN')
    return { coveredAmount: round2(coveredAmount), mealCount, chargeable: 0, mode: 'MEAL_PLAN' };
  if (plan.type === 'PAY_AS_YOU_GO')
    return {
      coveredAmount: round2(coveredAmount),
      mealCount,
      chargeable,
      mode: 'CASH',
      reason:
        requestedMode === 'WALLET' ? 'This student is on a pay-as-you-go plan and pays cash at the counter' : undefined,
    };
  if (plan.type === 'CREDIT')
    return {
      coveredAmount: round2(coveredAmount),
      mealCount,
      chargeable,
      mode: requestedMode === 'CASH' ? 'CASH' : 'CREDIT',
    };
  return { coveredAmount: round2(coveredAmount), mealCount, chargeable, mode: requestedMode };
}

/** Can the wallet absorb `amount`? Returns a human reason when not. */
export function walletCanPay(
  balance: number,
  amount: number,
  creditLimit: number | null,
  isActive: boolean,
): { ok: boolean; reason?: string; floor: number } {
  const floor = creditLimit ? -Math.abs(creditLimit) : 0;
  if (!isActive) return { ok: false, reason: 'This wallet is frozen', floor };
  if (round2(balance - amount) < floor) {
    return {
      ok: false,
      reason: creditLimit
        ? `Credit limit of ${Math.abs(creditLimit).toFixed(2)} would be exceeded (balance ${balance.toFixed(2)})`
        : `Wallet balance ${balance.toFixed(2)} is less than ${amount.toFixed(2)}`,
      floor,
    };
  }
  return { ok: true, floor };
}

/** Daily-limit check: spending so far today + this purchase may not exceed the effective limit. */
export function withinDailyLimit(
  spentToday: number,
  amount: number,
  walletLimit: number | null,
  planLimit: number | null,
  schoolDefault: number | null,
): { ok: boolean; limit: number | null } {
  const limit = walletLimit ?? planLimit ?? (schoolDefault && schoolDefault > 0 ? schoolDefault : null);
  if (!limit) return { ok: true, limit: null };
  return { ok: round2(spentToday + amount) <= limit, limit };
}

/** Whether an allowance is due for a wallet given the plan frequency and last credit time. */
export function allowanceDue(
  frequency: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TERM',
  lastAt: Date | null,
  now: Date,
  isSchoolDay: boolean,
): boolean {
  if (frequency === 'NONE' || frequency === 'TERM') return false;
  if (!lastAt) return frequency !== 'DAILY' || isSchoolDay;
  const days = (now.getTime() - lastAt.getTime()) / 86400000;
  if (frequency === 'DAILY') return isSchoolDay && days >= 0.9 && now.toDateString() !== lastAt.toDateString();
  if (frequency === 'WEEKLY') return days >= 6.5;
  return days >= 27.5;
}
