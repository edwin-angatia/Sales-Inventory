import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        Install App (Android / PC)
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        Install on Phone / PC
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">
              Install Rebootly on Android &amp; PC
            </h3>
            {isIOS ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Tap <strong>Add to Home Screen</strong>.
              </p>
            ) : (
              <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
                <p>
                  <strong>Android (Chrome):</strong> Open the browser menu (⋮) and tap{' '}
                  <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </p>
                <p>
                  <strong>PC (Chrome / Edge):</strong> Click the <strong>Install</strong> icon in
                  the address bar to run Rebootly as a standalone desktop app.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
