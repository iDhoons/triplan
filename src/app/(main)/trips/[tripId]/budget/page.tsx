"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  Budget,
  Expense,
  TripMember,
  ExpenseCategory,
  CurrencyCode,
} from "@/types/database";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  calculateSettlement,
  calculateCategoryTotals,
  groupExpensesByDate,
} from "@/lib/services/budget";

const CURRENCY_OPTIONS: CurrencyCode[] = [
  "KRW",
  "JPY",
  "USD",
  "EUR",
  "CNY",
  "THB",
  "VND",
];

function formatAmount(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateGroup(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function BudgetPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { user } = useAuthStore();
  const supabase = createClient();

  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Budget edit state
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState<CurrencyCode>("KRW");
  const [savingBudget, setSavingBudget] = useState(false);

  // Expense form state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("food");
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expPaidBy, setExpPaidBy] = useState("");
  const [expDate, setExpDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expMemo, setExpMemo] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [tripId]);

  async function fetchAll() {
    setLoading(true);
    const [budgetRes, expensesRes, membersRes] = await Promise.all([
      supabase.from("budgets").select("*").eq("trip_id", tripId).maybeSingle(),
      supabase
        .from("expenses")
        .select("*, profile:profiles(id, display_name, avatar_url, created_at)")
        .eq("trip_id", tripId)
        .order("date", { ascending: false }),
      supabase
        .from("trip_members")
        .select(
          "*, profile:profiles(id, display_name, avatar_url, created_at)"
        )
        .eq("trip_id", tripId),
    ]);

    if (budgetRes.data) setBudget(budgetRes.data as Budget);
    if (expensesRes.data) setExpenses(expensesRes.data as Expense[]);
    if (membersRes.data) setMembers(membersRes.data as TripMember[]);
    setLoading(false);
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    setSavingBudget(true);
    const total = parseFloat(budgetAmount);
    if (isNaN(total)) {
      setSavingBudget(false);
      return;
    }

    if (budget) {
      await supabase
        .from("budgets")
        .update({ total_budget: total, currency: budgetCurrency })
        .eq("id", budget.id);
    } else {
      await supabase
        .from("budgets")
        .insert({ trip_id: tripId, total_budget: total, currency: budgetCurrency });
    }

    await fetchAll();
    setSavingBudget(false);
    setBudgetDialogOpen(false);
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingExpense(true);

    await supabase.from("expenses").insert({
      trip_id: tripId,
      category: expCategory,
      title: expTitle,
      amount: parseFloat(expAmount),
      currency: budget?.currency ?? "KRW",
      paid_by: expPaidBy || user.id,
      date: expDate,
      memo: expMemo || null,
    });

    setExpTitle("");
    setExpAmount("");
    setExpMemo("");
    setExpPaidBy("");
    setExpCategory("food");
    setExpDate(new Date().toISOString().split("T")[0]);
    await fetchAll();
    setSavingExpense(false);
    setExpenseDialogOpen(false);
  }

  async function handleDeleteExpense(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const currency = budget?.currency ?? "KRW";
  const totalBudget = budget?.total_budget ?? 0;
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const spentPercent =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const remaining = totalBudget - totalSpent;

  // Category totals for pie chart
  const categoryData = useMemo(
    () => calculateCategoryTotals(expenses),
    [expenses]
  );

  // Group expenses by date
  const groupedExpenses = useMemo(
    () => groupExpensesByDate(expenses),
    [expenses]
  );

  // Settlement calculation
  const settlement = useMemo(
    () => calculateSettlement(expenses, members),
    [expenses, members]
  );

  const getMemberName = (userId: string) => {
    const m = members.find((m) => m.user_id === userId);
    return m?.profile?.display_name ?? "알 수 없음";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">예산 관리</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBudgetAmount(budget ? String(budget.total_budget) : "");
              setBudgetCurrency(budget?.currency ?? "KRW");
              setBudgetDialogOpen(true);
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" />
            {budget ? "예산 수정" : "예산 설정"}
          </Button>

          <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>총 예산 설정</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveBudget} className="space-y-4">
                <div className="space-y-2">
                  <Label>통화</Label>
                  <Select
                    value={budgetCurrency}
                    onValueChange={(v) => v && setBudgetCurrency(v as CurrencyCode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>총 예산</Label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    required
                    min={0}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={savingBudget}
                >
                  {savingBudget ? "저장 중..." : "저장"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button size="sm" onClick={() => setExpenseDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            지출 추가
          </Button>

          <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>지출 등록</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label>카테고리</Label>
                  <Select
                    value={expCategory}
                    onValueChange={(v) => v && setExpCategory(v as ExpenseCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>내용</Label>
                  <Input
                    placeholder="교통 카드 충전"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>금액 ({currency})</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    required
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>결제자</Label>
                  <Select
                    value={expPaidBy || user?.id || ""}
                    onValueChange={(v) => setExpPaidBy(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="결제자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profile?.display_name ?? m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>날짜</Label>
                  <Input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>메모 (선택)</Label>
                  <Input
                    placeholder="메모"
                    value={expMemo}
                    onChange={(e) => setExpMemo(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={savingExpense}
                >
                  {savingExpense ? "저장 중..." : "등록"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Budget Overview */}
      <Card>
        <CardContent className="pt-5">
          {budget ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">지출</span>
                <span className="font-medium">
                  {formatAmount(totalSpent, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">총 예산</span>
                <span className="font-medium">
                  {formatAmount(totalBudget, currency)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    spentPercent >= 100
                      ? "bg-destructive"
                      : spentPercent >= 80
                      ? "bg-amber-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${spentPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{spentPercent.toFixed(1)}% 사용</span>
                <span
                  className={remaining < 0 ? "text-destructive font-medium" : ""}
                >
                  {remaining < 0 ? "초과 " : "남은 예산 "}
                  {formatAmount(Math.abs(remaining), currency)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              예산을 설정하면 지출 현황을 확인할 수 있어요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Donut chart + Settlement side by side */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">카테고리별 지출</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatAmount(Number(value), currency)
                    }
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Settlement */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">정산</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Per-person summary */}
              <div className="space-y-1.5">
                {members.map((m) => {
                  const paid = expenses
                    .filter((e) => e.paid_by === m.user_id)
                    .reduce((s, e) => s + e.amount, 0);
                  return (
                    <div
                      key={m.user_id}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {m.profile?.display_name ?? "알 수 없음"}
                      </span>
                      <span className="font-medium">
                        {formatAmount(paid, currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-3 space-y-1.5">
                {settlement.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">
                    정산이 필요 없어요
                  </p>
                ) : (
                  settlement.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 text-sm flex-wrap"
                    >
                      <span className="font-medium text-destructive">
                        {t.from}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{t.to}</span>
                      <span className="text-muted-foreground ml-auto">
                        {formatAmount(t.amount, currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expense list grouped by date */}
      {groupedExpenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-3xl mb-3">💸</p>
          <p className="font-medium">아직 지출 내역이 없어요</p>
          <p className="text-sm mt-1">지출을 추가해보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedExpenses.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {formatDateGroup(date)}
              </p>
              <div className="space-y-2">
                {items.map((expense) => (
                  <Card key={expense.id}>
                    <CardContent className="flex items-center gap-3 py-3 px-4">
                      <div
                        className="w-2 h-8 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            CATEGORY_COLORS[expense.category],
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {expense.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs py-0">
                            {CATEGORY_LABELS[expense.category]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getMemberName(expense.paid_by)} 결제
                          </span>
                        </div>
                      </div>
                      <span className="font-semibold text-sm shrink-0">
                        {formatAmount(expense.amount, expense.currency)}
                      </span>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
