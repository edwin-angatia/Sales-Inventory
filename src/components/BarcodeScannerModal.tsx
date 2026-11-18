import React, { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, ScanBarcode, X, AlertTriangle, RefreshCw } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onDetected,
}: BarcodeScannerModalProps) {
  const uniqueId = useId().replace(/:/g, '');
  const readerId = `rebootly-barcode-reader-${uniqueId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    handledRef.current = false;
    setStarting(true);
    setError(null);

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 150 },
          aspectRatio: 1.333,
        };

        const onSuccess = (decodedText: string) => {
          if (handledRef.current || cancelled) return;
          const cleaned = decodedText.trim();
          if (!cleaned) return;
          handledRef.current = true;
          scanner
            .stop()
            .catch(() => {})
            .finally(() => {
              onDetected(cleaned);
            });
        };

        try {
          await scanner.start(
            { facingMode: 'environment' },
            config,
            onSuccess,
            () => {}
          );
        } catch {
          // Fallback to default camera (e.g. laptop webcam) if rear camera unavailable
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            throw new Error('No camera was found on this device.');
          }
          await scanner.start(cameras[0].id, config, onSuccess, () => {});
        }

        if (!cancelled) {
          setStarting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStarting(false);
          const msg =
            err instanceof Error
              ? err.message
              : 'Could not access the camera. Please allow camera permissions.';
          setError(msg);
        }
      }
    };

    const timer = setTimeout(startScanner, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const current = scannerRef.current;
      scannerRef.current = null;
      if (current) {
        current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              current.clear();
            } catch {
              // ignore cleanup errors
            }
          });
      }
    };
  }, [isOpen, readerId, onDetected, retryKey]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0a2540]/65 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scan barcode"
    >
      <div className="bg-white/95 backdrop-blur-xl border border-blue-200/80 rounded-2xl shadow-2xl shadow-blue-950/20 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0a2540] via-[#0e3a6e] to-[#1d4ed8] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-400/40 text-orange-300 flex items-center justify-center">
              <ScanBarcode className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold font-serif tracking-wide">
                Scan Unit Barcode
              </h2>
              <p className="text-[11px] text-blue-100/85">
                Point camera at IMEI, Serial, or product barcode
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close barcode scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="p-5 space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-[#0a2540] border-2 border-blue-200/80 min-h-[260px] flex items-center justify-center">
            <div id={readerId} className="w-full" />

            {starting && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a2540]/90 text-white">
                <Camera className="w-7 h-7 text-orange-400 animate-pulse" />
                <p className="text-xs font-medium text-blue-100">
                  Activating device camera...
                </p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-900/95 text-white">
                <AlertTriangle className="w-8 h-8 text-orange-400" />
                <p className="text-xs text-blue-100 leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Supports Code 128, EAN-13, UPC, Code 39 &amp; QR</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-semibold text-[#0a2540] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
