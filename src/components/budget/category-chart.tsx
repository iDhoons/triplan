"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CurrencyCode } from "@/types/database";

interface CategoryDataItem {
  name: string;
  value: number;
  color: string;
}

interface CategoryChartProps {
  data: CategoryDataItem[];
  currency: CurrencyCode;
  formatAmount: (amount: number, currency: CurrencyCode) => string;
}

export default function CategoryChart({
  data,
  currency,
  formatAmount,
}: CategoryChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatAmount(Number(value), currency)}
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
  );
}
