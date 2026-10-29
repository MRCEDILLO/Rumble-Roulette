/**
 * Host-screen sound effects (no background music), synthesised with Web Audio so there are no audio files to host.
 * Phones never call this.
 */
type Sfx = 'tick' | 'reveal' | 'coin' | 'lose' | 'fanfare' | 'pop' | 'whoosh' | 'drum';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const settings = {
  muted: readSetting('rr-muted', false),
  volume: readSetting('rr-volume', 0.6),
};

function readSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, master: master! };
}

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

export function getSoundSettings() {
  return { ...settings };
}

export function setMuted(muted: boolean) {
  settings.muted = muted;
  try {
    localStorage.setItem('rr-muted', JSON.stringify(muted));
  } catch {
    /* ignore */
  }
  applyVolume();
}

export function setVolume(volume: number) {
  settings.volume = volume;
  try {
    localStorage.setItem('rr-volume', JSON.stringify(volume));
  } catch {
    /* ignore */
  }
  applyVolume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.15, slideTo?: number) {
  const { ctx, master } = audio();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

function noise(start: number, dur: number, gain = 0.2) {
  const { ctx, master } = audio();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(g);
  g.connect(master);
  src.start(ctx.currentTime + start);
}

export function play(sfx: Sfx) {
  try {
    switch (sfx) {
      case 'tick':
        return tone(1400, 0, 0.03, 'square', 0.06);
      case 'pop':
        return tone(500, 0, 0.12, 'sine', 0.25, 900);
      case 'whoosh':
        return noise(0, 0.35, 0.12);
      case 'drum':
        tone(120, 0, 0.18, 'sine', 0.5, 50);
        return noise(0, 0.08, 0.15);
      case 'reveal':
        [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle', 0.2));
        return;
      case 'coin':
        tone(988, 0, 0.08, 'square', 0.12);
        return tone(1319, 0.08, 0.25, 'square', 0.12);
      case 'lose':
        return tone(330, 0, 0.5, 'sawtooth', 0.1, 140);
      case 'fanfare':
        [523, 523, 523, 698, 880, 784, 1047].forEach((f, i) =>
          tone(f, [0, 0.12, 0.24, 0.36, 0.6, 0.78, 0.96][i], i === 6 ? 0.8 : 0.14, 'triangle', 0.22),
        );
        return;
    }
  } catch {
    // Audio not available (e.g. blocked autoplay); the game carries on silently.
  }
}
