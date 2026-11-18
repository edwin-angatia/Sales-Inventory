import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatKES, Sale } from '../types';

interface MonthlyRevenueChartProps {
  sales: Sale[];
}

interface MonthlyPoint {
  monthKey: string;
  label: string;
  revenue: number;
  count: number;
}

export function MonthlyRevenueChart({ sales }: MonthlyRevenueChartProps) {
  const data = useMemo<MonthlyPoint[]>(() => {
    const now = new Date();
    const map = new Map<string, MonthlyPoint>();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
      map.set(key, { monthKey: key, label, revenue: 0, count: 0 });
    }

    for (const sale of sales) {
      if (sale.status !== 'completed' || !sale.soldAt?.toDate) continue;
      const d = sale.soldAt.toDate();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = map.get(key);
      if (bucket) {
        bucket.revenue += sale.totalAmount;
        bucket.count += sale.itemCount;
      }
    }

    return Array.from(map.values());
  }, [sales]);

  const total12mRevenue = useMemo(
    () => data.reduce((sum, m) => sum + m.revenue, 0),
    [data]
  );

  return (
    <div className="bg-white/80 backdrop-blur-md border border-teal-900/10 rounded-xl p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Monthly Revenue Trends — Last 12 Months
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Long-term completed sales growth across the past year
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500">12-Month Total: </span>
          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
            {formatKES(total12mRevenue)}
          </span>
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
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
              contentStyle={{
                backgroundColor: '#0F172A',
                border: 'none',
                borderRadius: '8px',
                color: '#F8FAFC',
                fontSize: '12px',
              }}
              formatter={(value) => [formatKES(Number(value ?? 0)), 'Monthly Revenue']}
              labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0F766E"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#0F766E', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#EA580C' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
