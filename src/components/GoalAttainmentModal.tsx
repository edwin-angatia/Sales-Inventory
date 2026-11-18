import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatKES, Sale } from '../types';

interface GoalAttainmentModalProps {
  isOpen: boolean;
  sales: Sale[];
  dailyGoal: number;
  onClose: () => void;
}

interface DayPoint {
  dateKey: string;
  label: string;
  revenue: number;
  attainmentPct: number;
}

export function GoalAttainmentModal({
  isOpen,
  sales,
  dailyGoal,
  onClose,
}: GoalAttainmentModalProps) {
  const data = useMemo<DayPoint[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map<string, DayPoint>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' });
      map.set(key, { dateKey: key, label, revenue: 0, attainmentPct: 0 });
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
      }
    }

    return Array.from(map.values()).map((pt) => ({
      ...pt,
      attainmentPct: dailyGoal > 0 ? Math.round((pt.revenue / dailyGoal) * 100) : 0,
    }));
  }, [sales, dailyGoal]);

  if (!isOpen) return null;

  const daysHit = data.filter((d) => d.revenue >= dailyGoal).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-trend-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="goal-trend-title" className="text-base font-semibold text-slate-900">
              7-Day Revenue Goal Attainment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target: <span className="font-mono font-medium text-slate-700">{formatKES(dailyGoal)}</span>/day · Goal met on{' '}
              <span className="font-mono font-semibold text-emerald-700">{daysHit}/7</span> days
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
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
                  width={48}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ReferenceLine
                  y={100}
                  stroke="#0F766E"
                  strokeDasharray="4 4"
                  label={{
                    value: '100% Goal',
                    position: 'insideTopRight',
                    fill: '#0F766E',
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                  formatter={(value, _name, item) => {
                    const rev = (item?.payload as DayPoint | undefined)?.revenue ?? 0;
                    return [`${Number(value ?? 0)}% (${formatKES(rev)})`, 'Attainment'];
                  }}
                  labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                />
                <Line
                  type="monotone"
                  dataKey="attainmentPct"
                  stroke="#EA580C"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#EA580C', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#0F766E' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
