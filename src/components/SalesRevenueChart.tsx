import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatKES, Sale } from '../types';

interface SalesRevenueChartProps {
  sales: Sale[];
}

interface DailyRevenuePoint {
  dateKey: string;
  label: string;
  revenue: number;
  profit: number;
  count: number;
}

export function SalesRevenueChart({ sales }: SalesRevenueChartProps) {
  const data = useMemo<DailyRevenuePoint[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map<string, DailyRevenuePoint>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
      map.set(key, { dateKey: key, label, revenue: 0, profit: 0, count: 0 });
    }

    for (const sale of sales) {
      if (sale.status !== 'completed' || !sale.soldAt?.toDate) continue;
      const d = sale.soldAt.toDate();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const bucket = map.get(key);
      if (bucket) {
        bucket.revenue += sale.totalAmount;
        bucket.profit += sale.totalProfit;
        bucket.count += sale.itemCount;
      }
    }

    return Array.from(map.values());
  }, [sales]);

  const total30dRevenue = useMemo(
    () => data.reduce((sum, d) => sum + d.revenue, 0),
    [data]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Daily Revenue — Last 30 Days (incl. 16% VAT)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Completed sales revenue aggregated by day
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500">30-Day Total: </span>
          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
            {formatKES(total30dRevenue)}
          </span>
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              contentStyle={{
                backgroundColor: '#0F172A',
                border: 'none',
                borderRadius: '8px',
                color: '#F8FAFC',
                fontSize: '12px',
              }}
              formatter={(value) => [formatKES(Number(value ?? 0)), 'Revenue (incl. VAT)']}
              labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
            />
            <Bar
              dataKey="revenue"
              fill="#EA580C"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
