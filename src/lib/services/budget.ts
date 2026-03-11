/**
 * Budget 서비스 — 순수 비즈니스 로직
 * UI 컴포넌트와 독립적으로 테스트 가능한 순수 함수 모음.
 */

import type { Expense, ExpenseCategory, TripMember } from "@/types/database";

// ─── Types ──────────────────────────────────────────────

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
}

export interface CategoryTotal {
  name: string;
  value: number;
  color: string;
  category: ExpenseCategory;
}

// ─── Constants ──────────────────────────────────────────

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  accommodation: "숙소",
  food: "식비",
  transport: "교통",
  activity: "액티비티",
  shopping: "쇼핑",
  other: "기타",
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  accommodation: "#6366f1",
  food: "#f97316",
  transport: "#06b6d4",
  activity: "#22c55e",
  shopping: "#ec4899",
  other: "#8b5cf6",
};

// ─── Settlement Calculation ─────────────────────────────

/**
 * 정산 계산: 각 멤버가 누구에게 얼마를 보내야 하는지 계산한다.
 * 모든 지출을 균등 분배하여 채권자/채무자를 매칭한다.
 */
export function calculateSettlement(
  expenses: Expense[],
  members: TripMember[]
): SettlementTransaction[] {
  if (members.length === 0) return [];

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  if (totalSpent === 0) return [];

  // 각 멤버가 결제한 총액
  const paid: Record<string, number> = {};
  members.forEach((m) => {
    paid[m.user_id] = 0;
  });
  expenses.forEach((e) => {
    paid[e.paid_by] = (paid[e.paid_by] ?? 0) + e.amount;
  });

  // 1인당 평균 부담액
  const avg = totalSpent / members.length;

  // 잔액 계산 (양수 = 더 낸 사람, 음수 = 덜 낸 사람)
  const balances = members.map((m) => ({
    userId: m.user_id,
    name: m.profile?.display_name ?? "알 수 없음",
    balance: (paid[m.user_id] ?? 0) - avg,
  }));

  // 채권자/채무자 분리
  const creditors = balances
    .filter((b) => b.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const debtors = balances
    .filter((b) => b.balance < 0)
    .sort((a, b) => a.balance - b.balance);

  const transactions: SettlementTransaction[] = [];
  let ci = 0;
  let di = 0;
  const c = creditors.map((x) => ({ ...x }));
  const d = debtors.map((x) => ({ ...x }));

  while (ci < c.length && di < d.length) {
    const transfer = Math.min(c[ci].balance, -d[di].balance);
    if (transfer > 1) {
      transactions.push({
        from: d[di].name,
        to: c[ci].name,
        amount: Math.round(transfer),
      });
    }
    c[ci].balance -= transfer;
    d[di].balance += transfer;
    if (Math.abs(c[ci].balance) < 1) ci++;
    if (Math.abs(d[di].balance) < 1) di++;
  }

  return transactions;
}

// ─── Category Totals ────────────────────────────────────

/**
 * 카테고리별 지출 합계를 계산한다.
 */
export function calculateCategoryTotals(
  expenses: Expense[]
): CategoryTotal[] {
  const map: Partial<Record<ExpenseCategory, number>> = {};
  expenses.forEach((e) => {
    map[e.category] = (map[e.category] ?? 0) + e.amount;
  });
  return Object.entries(map).map(([cat, value]) => ({
    name: CATEGORY_LABELS[cat as ExpenseCategory],
    value: value!,
    color: CATEGORY_COLORS[cat as ExpenseCategory],
    category: cat as ExpenseCategory,
  }));
}

// ─── Grouping ───────────────────────────────────────────

/**
 * 지출을 날짜별로 그룹핑하여 최신순 정렬한다.
 */
export function groupExpensesByDate(
  expenses: Expense[]
): [string, Expense[]][] {
  const map: Record<string, Expense[]> = {};
  expenses.forEach((e) => {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  });
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
}
