/** Quiet, locally synthesized paper tear and a short shimmer; no media request. */
export function startupSoundSamples(sampleRate = 22050) {
  const samples = new Float32Array(Math.ceil(2.65 * sampleRate));
  const chimes = [
    [2.04, 1568, 0.028],
    [2.13, 2093, 0.021],
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
    const tear = t - 0.68;
    let value = 0;
    if (tear >= 0 && tear < 1.2) {
      const envelope = Math.min(1, tear / 0.035, (1.2 - tear) / 0.12);
      const grain = 0.24 + 0.76 * Math.pow(Math.sin(tear * 113) * Math.sin(tear * 37), 2);
      value += (noise - low) * envelope * grain * 0.16;
    }
    const rustle = t - 0.44;
    if (rustle >= 0 && rustle < 0.22)
      value += (noise - low) * Math.sin((Math.PI * rustle) / 0.22) * 0.028;
    for (const [start, frequency, volume] of chimes) {
      const chime = t - start;
      if (chime >= 0 && chime < 0.45) {
        const envelope =
          Math.min(1, chime / 0.008) * Math.exp(-chime * 12) * Math.min(1, (0.45 - chime) / 0.035);
        value += Math.sin(2 * Math.PI * frequency * chime) * envelope * volume;
      }
    }
    samples[i] = Math.max(-0.24, Math.min(0.24, value));
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
      if (disposed || source || elapsed() >= 2650) return;
      try {
        context ??= new Audio({ latencyHint: 'interactive' });
        const current = context,
          request = ++generation;
        // Calling resume synchronously also supports an explicit tap on the sound button.
        void current
          .resume()
          .then(() => {
            if (disposed || request !== generation || context !== current) return;
            if (current.state !== 'running' || document.hidden || elapsed() >= 2650) {
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
            // A late unlock resumes at the matching point; it never replays the tear.
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
