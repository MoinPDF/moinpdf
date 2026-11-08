/** Quiet, locally synthesized wave whoosh and a short shimmer; no media request. */
export function startupSoundSamples(sampleRate = 22050) {
  const samples = new Float32Array(Math.ceil(3.5 * sampleRate));
  const chimes = [
    [2.55, 1318.51, 0.022],
    [2.68, 1975.53, 0.016],
  ] as const;
  let seed = 0x4d4f494e,
    low = 0;
  for (let i = 0; i < samples.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const noise = (seed >>> 0) / 2147483648 - 1;
    low += 0.16 * (noise - low);
    const t = i / sampleRate;
    const wave = t - 0.3;
    let value = 0;
    if (wave >= 0 && wave < 1.35) {
      const envelope = Math.pow(Math.sin((Math.PI * wave) / 1.35), 2);
      value += (low * 0.8 + (noise - low) * 0.2) * envelope * 0.06;
    }
    for (const [start, frequency, volume] of chimes) {
      const chime = t - start;
      if (chime >= 0 && chime < 0.45) {
        const envelope =
          Math.min(1, chime / 0.008) * Math.exp(-chime * 12) * Math.min(1, (0.45 - chime) / 0.035);
        value += Math.sin(2 * Math.PI * frequency * chime) * envelope * volume;
      }
    }
    samples[i] = Math.max(-0.16, Math.min(0.16, value));
  }
  return samples;
}

export type StartupSound = {
  enable(): void;
  mute(): void;
  dispose(): void;
};

/** Never queue a sound that could play after a blocked startup has disappeared. */
export function createStartupSound(
  elapsed: () => number,
  onActive: (active: boolean) => void,
): StartupSound | null {
  const Audio =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return null;
  let context: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let disposed = false,
    generation = 0;
  const stop = (notify: boolean) => {
    generation++;
    if (source) {
      source.onended = null;
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* Already finished. */
      }
      source = null;
    }
    const previous = context;
    context = null;
    if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
    if (notify) onActive(false);
  };
  return {
    enable() {
      if (disposed || source || elapsed() >= 3500) return;
      try {
        context ??= new Audio({ latencyHint: 'interactive' });
        const current = context,
          request = ++generation;
        // Calling resume synchronously also supports an explicit tap on the sound button.
        void current
          .resume()
          .then(() => {
            if (disposed || request !== generation || context !== current) return;
            if (current.state !== 'running' || document.hidden || elapsed() >= 3500) {
              stop(true);
              return;
            }
            const samples = startupSoundSamples();
            const buffer = current.createBuffer(1, samples.length, 22050);
            buffer.copyToChannel(samples, 0);
            const node = current.createBufferSource();
            node.buffer = buffer;
            node.connect(current.destination);
            source = node;
            node.onended = () => {
              if (source === node) stop(true);
            };
            // A late unlock resumes at the matching point; it never replays earlier cues.
            node.start(current.currentTime + 0.01, Math.max(0, elapsed() / 1000));
            onActive(true);
          })
          .catch(() => {
            if (!disposed && request === generation) stop(true);
          });
      } catch {
        stop(true);
      }
    },
    mute() {
      stop(true);
    },
    dispose() {
      disposed = true;
      stop(false);
    },
  };
}
