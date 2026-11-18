import React, { useEffect, useState } from 'react';
import { Check, TrendingDown, TrendingUp, X } from 'lucide-react';
import {
  CHANNEL_LABELS,
  formatKES,
  PAYMENT_LABELS,
  PaymentMethod,
  Product,
  SaleChannel,
  Unit,
  VAT_RATE,
} from '../types';

interface SellUnitModalProps {
  product: Product | null;
  availableUnits: Unit[];
  onClose: () => void;
  onConfirmSale: (params: {
    product: Product;
    unit: Unit;
    priceAtSale: number;
    vatAmount: number;
    totalAmount: number;
    channel: SaleChannel;
    paymentMethod: PaymentMethod;
    customerName: string;
    customerPhone: string;
  }) => Promise<void>;
}

export function SellUnitModal({
  product,
  availableUnits,
  onClose,
  onConfirmSale,
}: SellUnitModalProps) {
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [priceAtSale, setPriceAtSale] = useState(0);
  const [channel, setChannel] = useState<SaleChannel>('in_store');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product && availableUnits.length > 0) {
      setSelectedUnitId(availableUnits[0].id);
      setPriceAtSale(product.sellPrice);
      setChannel('in_store');
      setPaymentMethod('mpesa');
      setCustomerName('');
      setCustomerPhone('');
    }
  }, [product, availableUnits]);

  if (!product) return null;

  const selectedUnit = availableUnits.find((u) => u.id === selectedUnitId) || availableUnits[0];
  const vatAmount = Number((priceAtSale * VAT_RATE).toFixed(2));
  const totalAmount = Number((priceAtSale + vatAmount).toFixed(2));
  const netProfit = selectedUnit ? Number((priceAtSale - selectedUnit.costSnapshot).toFixed(2)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    setSaving(true);
    try {
      await onConfirmSale({
        product,
        unit: selectedUnit,
        priceAtSale,
        vatAmount,
        totalAmount,
        channel,
        paymentMethod,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
      });
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
      aria-labelledby="sell-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="sell-modal-title" className="text-base font-semibold text-slate-900">
            Mark Unit Sold
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{product.name}</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {product.sku} · {availableUnits.length} unit{availableUnits.length === 1 ? '' : 's'} in stock
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Select Physical Unit (Serial / IMEI) *
            </label>
            <select
              required
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
            >
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.serialNumber} (Cost: {formatKES(u.costSnapshot)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Unit Price excl. VAT (KES) *
              </label>
              <input
                type="number"
                min={0}
                required
                value={priceAtSale}
                onChange={(e) => setPriceAtSale(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              >
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Sales Channel *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CHANNEL_LABELS) as SaleChannel[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                    channel === ch
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {CHANNEL_LABELS[ch]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                maxLength={100}
                placeholder="Optional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Customer Phone
              </label>
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. 0712..."
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
          </div>

          {/* 16% VAT Breakdown & Profit/Loss Indicator */}
          {selectedUnit && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (excl. VAT)</span>
                <span className="font-mono tabular-nums">{formatKES(priceAtSale)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>VAT (16%)</span>
                <span className="font-mono tabular-nums">{formatKES(vatAmount)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Total Sale Amount (incl. 16% VAT)</span>
                <span className="font-mono tabular-nums">{formatKES(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                <span className="text-slate-600">Margin Outcome</span>
                <span
                  className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums ${
                    netProfit > 0
                      ? 'text-emerald-700'
                      : netProfit < 0
                      ? 'text-red-600'
                      : 'text-slate-600'
                  }`}
                >
                  {netProfit > 0 ? (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" />
                      Profit +{formatKES(netProfit)}
                    </>
                  ) : netProfit < 0 ? (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" />
                      Loss {formatKES(netProfit)}
                    </>
                  ) : (
                    'Break-even (KES 0)'
                  )}
                </span>
              </div>
            </div>
          )}

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
              disabled={saving || !selectedUnit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Recording...' : `Confirm (${formatKES(totalAmount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
