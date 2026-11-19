// Web Audio API synthesizer for Samsung-style "Dropcoin" sale alert chime

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a crisp, metallic Samsung "Dropcoin" style coin-drop chime
 * when a sale is confirmed.
 */
export function playDropcoinTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master gain for clean volume & zero clipping
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.32, now);
  master.connect(ctx.destination);

  // Samsung Dropcoin signature: bright metallic two-tone coin impact + shimmering high-harmonic ring
  const notes = [
    { freq: 1318.51, overtone: 2637.02, start: 0.0, dur: 0.22, peak: 0.85 }, // E6 (initial coin clink)
    { freq: 1975.53, overtone: 3951.07, start: 0.095, dur: 0.55, peak: 1.0 }, // B6 (resonant metallic ring)
    { freq: 2637.02, overtone: 5274.04, start: 0.19, dur: 0.48, peak: 0.55 }, // E7 (crystalline coin shimmer)
  ];

  for (const n of notes) {
    const t0 = now + n.start;

    // Fundamental sine bell
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(n.freq, t0);

    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.exponentialRampToValueAtTime(n.peak, t0 + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);

    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(t0);
    osc1.stop(t0 + n.dur + 0.02);

    // Metallic overtone (triangle, slightly detuned for authentic coin shimmer)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(n.overtone * 1.003, t0);

    gain2.gain.setValueAtTime(0.0001, t0);
    gain2.gain.exponentialRampToValueAtTime(n.peak * 0.35, t0 + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur * 0.7);

    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(t0);
    osc2.stop(t0 + n.dur + 0.02);
  }
}
