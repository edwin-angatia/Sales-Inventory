import React, { useMemo, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { RestockOrder, Supplier } from '../types';

interface SupplierPerformanceProps {
  suppliers: Supplier[];
  restockOrders: RestockOrder[];
  onLogOrder: (params: {
    supplierId?: string;
    supplierName: string;
    estimatedLeadDays: number;
    actualLeadDays: number;
    unitCount: number;
    orderedDate: string;
    receivedDate: string;
  }) => Promise<void>;
}

export function SupplierPerformance({
  suppliers,
  restockOrders,
  onLogOrder,
}: SupplierPerformanceProps) {
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [unitCount, setUnitCount] = useState(5);
  const [orderedDate, setOrderedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().split('T')[0];
  });
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const reportRows = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        estimatedLeadDays: number;
        orderCount: number;
        totalActualDays: number;
        totalUnits: number;
      }
    >();

    for (const s of suppliers) {
      map.set(s.name, {
        name: s.name,
        estimatedLeadDays: s.leadTimeDays,
        orderCount: 0,
        totalActualDays: 0,
        totalUnits: 0,
      });
    }

    for (const o of restockOrders) {
      const existing = map.get(o.supplierName) || {
        name: o.supplierName,
        estimatedLeadDays: o.estimatedLeadDays,
        orderCount: 0,
        totalActualDays: 0,
        totalUnits: 0,
      };
      existing.orderCount += 1;
      existing.totalActualDays += o.actualLeadDays;
      existing.totalUnits += o.unitCount;
      map.set(o.supplierName, existing);
    }

    return Array.from(map.values()).map((row) => {
      const avgActual =
        row.orderCount > 0 ? Number((row.totalActualDays / row.orderCount).toFixed(1)) : null;
      const variance =
        avgActual !== null ? Number((avgActual - row.estimatedLeadDays).toFixed(1)) : null;
      return { ...row, avgActual, variance };
    });
  }, [suppliers, restockOrders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenName = selectedSupplierName || suppliers[0]?.name || '';
    if (!chosenName) return;

    const sup = suppliers.find((s) => s.name === chosenName);
    const start = new Date(orderedDate).getTime();
    const end = new Date(receivedDate).getTime();
    const diffDays = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));

    setSaving(true);
    try {
      await onLogOrder({
        supplierId: sup?.id,
        supplierName: chosenName,
        estimatedLeadDays: sup?.leadTimeDays ?? 3,
        actualLeadDays: diffDays,
        unitCount: Math.max(1, unitCount),
        orderedDate,
        receivedDate,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            Supplier Performance — Actual vs. Estimated Lead Time
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare average delivery speed against each supplier&apos;s quoted lead time.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          {restockOrders.length} past order{restockOrders.length === 1 ? '' : 's'} logged
        </span>
      </div>

      {/* Quick Log Past Order Form */}
      {suppliers.length > 0 && (
        <form
          onSubmit={handleSubmit}
          className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Supplier</label>
            <select
              value={selectedSupplierName || suppliers[0]?.name || ''}
              onChange={(e) => setSelectedSupplierName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Ordered Date</label>
            <input
              type="date"
              required
              value={orderedDate}
              onChange={(e) => setOrderedDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Received Date</label>
            <input
              type="date"
              required
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Units</label>
            <input
              type="number"
              min={1}
              required
              value={unitCount}
              onChange={(e) => setUnitCount(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? 'Logging...' : 'Log Order'}
          </button>
        </form>
      )}

      {reportRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Add suppliers and log received orders to track lead-time performance.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-right">Past Orders</th>
                <th className="py-3 px-4 text-right">Estimated Lead</th>
                <th className="py-3 px-4 text-right">Avg Actual Lead</th>
                <th className="py-3 px-4 text-right">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {reportRows.map((row) => (
                <tr key={row.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900">{row.name}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {row.orderCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                    {row.estimatedLeadDays} d
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {row.avgActual !== null ? `${row.avgActual} d` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-xs font-medium whitespace-nowrap">
                    {row.variance === null ? (
                      <span className="text-slate-400">No orders yet</span>
                    ) : row.variance <= 0 ? (
                      <span className="text-emerald-700 font-mono">
                        On Time ({row.variance === 0 ? '0d' : `${row.variance}d`})
                      </span>
                    ) : (
                      <span className="text-red-600 font-mono">
                        Delayed (+{row.variance}d)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
