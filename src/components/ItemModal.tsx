import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ELECTRONICS_CATEGORIES,
  ElectronicsCategory,
  Product,
  ProductFormInput,
  Supplier,
} from '../types';
import { CameraExtractButton, ExtractedProductData } from './CameraExtractButton';

interface ItemModalProps {
  isOpen: boolean;
  editingProduct: Product | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (data: ProductFormInput, existingId?: string) => Promise<void>;
}

const DEFAULT_FORM: ProductFormInput = {
  name: '',
  brand: '',
  model: '',
  sku: '',
  barcode: '',
  category: 'Smartphones',
  costPrice: 0,
  sellPrice: 0,
  reorderThreshold: 2,
  supplierName: '',
  notes: '',
  initialSerials: '',
};

export function ItemModal({
  isOpen,
  editingProduct,
  suppliers,
  onClose,
  onSave,
}: ItemModalProps) {
  const [form, setForm] = useState<ProductFormInput>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name,
        brand: editingProduct.brand,
        model: editingProduct.model || '',
        sku: editingProduct.sku,
        barcode: editingProduct.barcode || '',
        category: editingProduct.category,
        costPrice: editingProduct.costPrice,
        sellPrice: editingProduct.sellPrice,
        reorderThreshold: editingProduct.reorderThreshold,
        supplierName: editingProduct.supplierName || '',
        notes: editingProduct.notes || '',
        initialSerials: '',
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    const trimmedSku = form.sku.trim();
    const trimmedBrand = form.brand.trim();

    if (!trimmedName || !trimmedSku || !trimmedBrand) {
      setError('Product name, SKU, and brand are required.');
      return;
    }
    if (form.reorderThreshold < 0 || form.costPrice < 0 || form.sellPrice < 0) {
      setError('Thresholds and KES prices cannot be negative.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          ...form,
          name: trimmedName.slice(0, 120),
          brand: trimmedBrand.slice(0, 60),
          model: form.model.trim().slice(0, 60),
          sku: trimmedSku.slice(0, 40),
          barcode: form.barcode.trim().slice(0, 60),
          supplierName: form.supplierName.trim().slice(0, 100),
          notes: form.notes.trim().slice(0, 300),
        },
        editingProduct?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleExtracted = (extracted: ExtractedProductData) => {
    setForm((prev) => ({
      ...prev,
      name: extracted.name || prev.name,
      brand: extracted.brand || prev.brand,
      model: extracted.model || prev.model,
      sku:
        extracted.sku ||
        prev.sku ||
        (extracted.brand && extracted.model
          ? `${extracted.brand.slice(0, 3).toUpperCase()}-${extracted.model.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`
          : prev.sku),
      barcode: extracted.barcode || prev.barcode,
      category: extracted.category || prev.category,
      notes: extracted.notes || prev.notes,
      initialSerials:
        extracted.serialNumbers && extracted.serialNumbers.length > 0
          ? prev.initialSerials.trim()
            ? `${prev.initialSerials.trim()}\n${extracted.serialNumbers.join('\n')}`
            : extracted.serialNumbers.join('\n')
          : prev.initialSerials,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="item-modal-title" className="text-base font-semibold text-slate-900">
            {editingProduct ? 'Edit Product SKU' : 'Add New Product SKU'}
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
          <CameraExtractButton onExtracted={handleExtracted} />

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Product Name *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                placeholder="e.g. iPhone 16 Pro 256GB Titanium"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Brand *</label>
              <input
                type="text"
                required
                maxLength={60}
                placeholder="e.g. Apple, Samsung, Sony"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Model Number
              </label>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. A3293"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">SKU *</label>
              <input
                type="text"
                required
                maxLength={40}
                placeholder="e.g. APL-IP16P-256"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Barcode / EAN
              </label>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. 195949722101"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as ElectronicsCategory })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              >
                {ELECTRONICS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Supplier</label>
              <input
                type="text"
                list="supplier-options"
                maxLength={100}
                placeholder="Select or type supplier"
                value={form.supplierName}
                onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
              <datalist id="supplier-options">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Cost Price (KES) *
              </label>
              <input
                type="number"
                min={0}
                step="1"
                required
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Selling Price (KES) *
              </label>
              <input
                type="number"
                min={0}
                step="1"
                required
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Low-Stock Restock Threshold *
              </label>
              <input
                type="number"
                min={0}
                max={100000}
                required
                value={form.reorderThreshold}
                onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            {!editingProduct && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Initial Serial / IMEI Numbers (one per line, optional)
                </label>
                <textarea
                  rows={3}
                  placeholder={'IMEI-35901122334401\nIMEI-35901122334402'}
                  value={form.initialSerials}
                  onChange={(e) => setForm({ ...form, initialSerials: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Stock count is derived automatically from in-stock serialized units.
                </p>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes</label>
              <textarea
                rows={2}
                maxLength={300}
                placeholder="Warranty terms, shelf location, or supplier notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600 resize-none"
              />
            </div>
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
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product SKU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
