import React, { useRef, useState } from 'react';
import { Camera, Loader2, Upload } from 'lucide-react';
import { ELECTRONICS_CATEGORIES, ElectronicsCategory } from '../types';

export interface ExtractedProductData {
  name?: string;
  brand?: string;
  model?: string;
  sku?: string;
  barcode?: string;
  category?: ElectronicsCategory;
  serialNumbers?: string[];
  notes?: string;
}

interface CameraExtractButtonProps {
  onExtracted: (data: ExtractedProductData) => void;
}

async function fileToCompressedBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function CameraExtractButton({ onExtracted }: CameraExtractButtonProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setExtracting(true);
    setError(null);
    try {
      const { base64, mimeType } = await fileToCompressedBase64(file);
      const res = await fetch('/api/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Could not extract product details.');
      }

      const validCategory = ELECTRONICS_CATEGORIES.includes(payload.category)
        ? (payload.category as ElectronicsCategory)
        : undefined;

      onExtracted({
        name: typeof payload.name === 'string' ? payload.name : '',
        brand: typeof payload.brand === 'string' ? payload.brand : '',
        model: typeof payload.model === 'string' ? payload.model : '',
        sku: typeof payload.sku === 'string' ? payload.sku : '',
        barcode: typeof payload.barcode === 'string' ? payload.barcode : '',
        category: validCategory,
        serialNumbers: Array.isArray(payload.serialNumbers)
          ? payload.serialNumbers.filter((s: unknown) => typeof s === 'string' && s.trim())
          : [],
        notes: typeof payload.notes === 'string' ? payload.notes : '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-xl space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <p className="text-xs font-semibold text-teal-950">
            Scan Product Box or Label
          </p>
          <p className="text-[11px] text-teal-800/80">
            Take a photo to auto-fill Name, Brand, Model, Barcode &amp; Serial/IMEI.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelected}
            className="hidden"
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            className="hidden"
          />

          <button
            type="button"
            disabled={extracting}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {extracting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            {extracting ? 'Scanning...' : 'Take Photo'}
          </button>

          <button
            type="button"
            disabled={extracting}
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-900 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
