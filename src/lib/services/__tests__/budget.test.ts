import { describe, it, expect } from "vitest";
import {
  calculateSettlement,
  calculateCategoryTotals,
  groupExpensesByDate,
} from "../budget";
import type { Expense, TripMember } from "@/types/database";

// ─── Test Helpers ───────────────────────────────────────

function makeMember(
  userId: string,
  displayName: string
): TripMember {
  return {
    id: `member-${userId}`,
    trip_id: "trip-1",
    user_id: userId,
    role: "editor",
    joined_at: "2026-01-01",
    profile: {
      id: userId,
      display_name: displayName,
      avatar_url: null,
      created_at: "2026-01-01",
    },
  };
}

function makeExpense(
  paidBy: string,
  amount: number,
  overrides: Partial<Expense> = {}
): Expense {
  return {
    id: `exp-${Math.random().toString(36).slice(2)}`,
    trip_id: "trip-1",
    category: "food",
    title: "테스트 지출",
    amount,
    currency: "KRW",
    paid_by: paidBy,
    date: "2026-03-01",
    memo: null,
    created_at: "2026-03-01",
    ...overrides,
  };
}

// ─── calculateSettlement ────────────────────────────────

describe("calculateSettlement", () => {
  it("멤버가 없으면 빈 배열 반환", () => {
    expect(calculateSettlement([], [])).toEqual([]);
  });

  it("지출이 없으면 빈 배열 반환", () => {
    const members = [makeMember("a", "Alice"), makeMember("b", "Bob")];
    expect(calculateSettlement([], members)).toEqual([]);
  });

  it("2인 균등 분배: A가 전액 결제 → B가 A에게 절반 송금", () => {
    const members = [makeMember("a", "Alice"), makeMember("b", "Bob")];
    const expenses = [makeExpense("a", 10000)];

    const result = calculateSettlement(expenses, members);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: "Bob",
      to: "Alice",
      amount: 5000,
    });
  });

  it("2인 이미 균등: 각자 같은 금액 → 정산 없음", () => {
    const members = [makeMember("a", "Alice"), makeMember("b", "Bob")];
    const expenses = [
      makeExpense("a", 5000),
      makeExpense("b", 5000),
    ];

    const result = calculateSettlement(expenses, members);
    expect(result).toHaveLength(0);
  });

  it("3인 불균등: 1명이 전액 결제 → 나머지 2명이 송금", () => {
    const members = [
      makeMember("a", "Alice"),
      makeMember("b", "Bob"),
      makeMember("c", "Charlie"),
    ];
    const expenses = [makeExpense("a", 30000)];

    const result = calculateSettlement(expenses, members);

    // 1인당 10000원, Alice가 20000원 더 냄
    const totalTransferred = result.reduce((s, t) => s + t.amount, 0);
    expect(totalTransferred).toBe(20000);

    // Bob과 Charlie가 Alice에게 각각 10000원
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "Bob", to: "Alice", amount: 10000 }),
        expect.objectContaining({ from: "Charlie", to: "Alice", amount: 10000 }),
      ])
    );
  });

  it("소수점 처리: 1원 미만 차이는 무시", () => {
    const members = [
      makeMember("a", "Alice"),
      makeMember("b", "Bob"),
      makeMember("c", "Charlie"),
    ];
    // 10001 / 3 = 3333.66... → 소수점 발생
    const expenses = [makeExpense("a", 10001)];

    const result = calculateSettlement(expenses, members);

    // 모든 금액이 정수
    result.forEach((t) => {
      expect(Number.isInteger(t.amount)).toBe(true);
    });
  });

  it("복잡한 시나리오: 여러 명이 여러 건 결제", () => {
    const members = [
      makeMember("a", "Alice"),
      makeMember("b", "Bob"),
      makeMember("c", "Charlie"),
    ];
    const expenses = [
      makeExpense("a", 30000), // Alice가 3만원
      makeExpense("b", 15000), // Bob이 1.5만원
      makeExpense("c", 0),     // Charlie 0원
    ];
    // 총 45000, 1인당 15000
    // Alice: +15000, Bob: 0, Charlie: -15000

    const result = calculateSettlement(expenses, members);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      from: "Charlie",
      to: "Alice",
      amount: 15000,
    });
  });
});

// ─── calculateCategoryTotals ────────────────────────────

describe("calculateCategoryTotals", () => {
  it("빈 배열이면 빈 배열 반환", () => {
    expect(calculateCategoryTotals([])).toEqual([]);
  });

  it("카테고리별 합계 정확히 계산", () => {
    const expenses = [
      makeExpense("a", 10000, { category: "food" }),
      makeExpense("a", 5000, { category: "food" }),
      makeExpense("b", 20000, { category: "transport" }),
    ];

    const result = calculateCategoryTotals(expenses);

    const food = result.find((r) => r.category === "food");
    const transport = result.find((r) => r.category === "transport");

    expect(food?.value).toBe(15000);
    expect(transport?.value).toBe(20000);
    expect(food?.name).toBe("식비");
    expect(transport?.name).toBe("교통");
  });
});

// ─── groupExpensesByDate ────────────────────────────────

describe("groupExpensesByDate", () => {
  it("빈 배열이면 빈 배열 반환", () => {
    expect(groupExpensesByDate([])).toEqual([]);
  });

  it("날짜별 그룹핑 + 최신순 정렬", () => {
    const expenses = [
      makeExpense("a", 1000, { date: "2026-03-01" }),
      makeExpense("a", 2000, { date: "2026-03-03" }),
      makeExpense("b", 3000, { date: "2026-03-01" }),
      makeExpense("b", 4000, { date: "2026-03-02" }),
    ];

    const result = groupExpensesByDate(expenses);

    // 최신순 정렬
    expect(result[0][0]).toBe("2026-03-03");
    expect(result[1][0]).toBe("2026-03-02");
    expect(result[2][0]).toBe("2026-03-01");

    // 03-01에 2건
    expect(result[2][1]).toHaveLength(2);
  });
});
