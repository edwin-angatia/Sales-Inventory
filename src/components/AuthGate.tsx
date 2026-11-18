import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Boxes, CheckSquare, TrendingUp } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { REBOOTLY_LOGO_URL } from '../types';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="space-y-3">
          <img
            src={REBOOTLY_LOGO_URL}
            alt="Rebootly — Reboot your future"
            referrerPolicy="no-referrer"
            className="h-11 w-auto object-contain"
          />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 pt-1">
            Electronics Inventory &amp; Sales Monitor
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Track serialized electronics units (IMEI/Serial), tick items sold across in-store and
            online channels in KES, and monitor restocks automatically.
          </p>
        </div>

        <div className="space-y-3 py-3 border-y border-slate-100 text-sm text-slate-700">
          <div className="flex items-center gap-3">
            <Boxes className="w-4 h-4 text-orange-600 shrink-0" />
            <span>Derived stock counts from individual serialized units</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Atomic &ldquo;Mark Sold&rdquo; with M-Pesa, Cash, WhatsApp &amp; Online logs</span>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-slate-800 shrink-0" />
            <span>Audit-safe history, CSV sales export, and supplier restock queue</span>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Your inventory, serialized units, and sales records are synced securely in real time.
        </p>
      </div>
    </div>
  );
}
