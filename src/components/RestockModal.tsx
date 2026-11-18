import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatKES, Product } from '../types';

interface RestockModalProps {
  product: Product | null;
  currentStock: number;
  onClose: () => void;
  onReceiveUnits: (
    product: Product,
    serialNumbers: string[],
    costSnapshot: number,
    warrantyExpiry: string
  ) => Promise<void>;
}

export function RestockModal({
  product,
  currentStock,
  onClose,
  onReceiveUnits,
}: RestockModalProps) {
  const [serialText, setSerialText] = useState('');
  const [costSnapshot, setCostSnapshot] = useState<number>(0);
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setCostSnapshot(product.costPrice);
      setSerialText('');
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setWarrantyExpiry(nextYear.toISOString().split('T')[0]);
    }
  }, [product]);

  if (!product) return null;

  const parsedSerials = serialText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleQuickGenerate = (count: number) => {
    const prefix = product.sku.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
    const stamp = Date.now().toString().slice(-4);
    const generated = Array.from(
      { length: count },
      (_, idx) => `${prefix}-${stamp}-${String(idx + 1).padStart(2, '0')}`
    );
    setSerialText((prev) => (prev.trim() ? `${prev.trim()}\n${generated.join('\n')}` : generated.join('\n')));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedSerials.length === 0) return;
    setSaving(true);
    try {
      await onReceiveUnits(product, parsedSerials, costSnapshot, warrantyExpiry);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="restock-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="restock-modal-title" className="text-base font-semibold text-slate-900">
            Receive Stock Units
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-900">{product.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {product.sku} · In stock: {currentStock} · Min: {product.reorderThreshold}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Cost Snapshot (KES)
              </label>
              <input
                type="number"
                min={0}
                required
                value={costSnapshot}
                onChange={(e) => setCostSnapshot(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Warranty Expiry
              </label>
              <input
                type="date"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Serial / IMEI Numbers (one per line) *
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleQuickGenerate(n)}
                    className="px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                  >
                    +Gen {n}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={4}
              required
              placeholder={'Scan or paste serial/IMEI numbers...\nIMEI-35901122334409'}
              value={serialText}
              onChange={(e) => setSerialText(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
            />
            <p className="text-xs text-slate-500 mt-1.5 font-mono">
              {parsedSerials.length} unit{parsedSerials.length === 1 ? '' : 's'} · Total batch cost{' '}
              {formatKES(parsedSerials.length * costSnapshot)}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || parsedSerials.length === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Receiving...' : `Receive ${parsedSerials.length} Unit${parsedSerials.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
