import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Boxes, CheckSquare, TrendingUp } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { APP_LOGO_URL } from '../types';

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
    <div className="min-h-screen islamic-pattern-bg flex flex-col justify-between items-center px-4 py-10">
      <div />
      <div className="w-full max-w-md bg-white/85 backdrop-blur-xl border border-blue-200/80 shadow-lg shadow-blue-950/10 rounded-2xl p-8 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={APP_LOGO_URL}
              alt="Sales Inventory"
              className="h-12 w-12 rounded-xl object-cover shadow-sm border border-blue-100"
            />
            <div>
              <h1 className="text-xl font-bold font-serif tracking-tight text-[#04295f]">
                Sales Inventory
              </h1>
              <p className="text-xs font-medium text-orange-600">
                Electronics Inventory &amp; Sales Monitor
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed pt-1">
            Track serialized electronics units (IMEI/Serial), tick items sold across in-store and
            online channels in KES, and monitor restocks automatically.
          </p>
        </div>

        <div className="space-y-3 py-3 border-y border-blue-100 text-sm text-[#0a2540]">
          <div className="flex items-center gap-3">
            <Boxes className="w-4 h-4 text-orange-600 shrink-0" />
            <span>Derived stock counts from individual serialized units</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Atomic &ldquo;Mark Sold&rdquo; with M-Pesa, Cash, WhatsApp &amp; Online logs</span>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-[#0a2540] shrink-0" />
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
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#0a2540] via-[#0e3a6e] to-[#1d4ed8] hover:from-[#0e3a6e] hover:to-blue-700 rounded-xl shadow-sm shadow-blue-900/20 disabled:opacity-50 transition-all"
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Your inventory, serialized units, and sales records are synced securely in real time.
        </p>
      </div>

      <footer className="mt-8 text-xs text-[#0a2540]/70 text-center">
        Made with ❤️ by{' '}
        <a
          href="https://edwin-angatia.github.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#04295f] hover:text-orange-600 underline underline-offset-2 transition-colors"
        >
          Rebootly
        </a>
      </footer>
    </div>
  );
}
