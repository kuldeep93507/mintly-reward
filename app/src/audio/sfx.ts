// All sound effects are synthesised with WebAudio, so the app ships no audio files.

type Sfx = 'dice' | 'step' | 'capture' | 'home' | 'turn' | 'win' | 'lose' | 'click' | 'coin' | 'six' | 'pop';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) { enabled = on; }

function ac(): AudioContext | null {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Browsers only allow audio after a user gesture: resume the context on the first tap. */
export function installAudioUnlock() {
  const unlock = () => {
    const c = ac();
    if (c && c.state === 'suspended') void c.resume();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, vol = 0.2, freq = 2000) {
  const c = ctx!;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(start);
}

export function play(name: Sfx) {
  if (!enabled) return;
  const c = ac();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'dice':
      for (let i = 0; i < 7; i++) noise(t + i * 0.06 + Math.random() * 0.02, 0.05, 0.35, 1500 + Math.random() * 2500);
      break;
    case 'step':
      tone(880, t, 0.06, 'triangle', 0.18, 660);
      break;
    case 'capture':
      tone(520, t, 0.25, 'sawtooth', 0.18, 90);
      noise(t, 0.18, 0.3, 800);
      tone(300, t + 0.12, 0.3, 'square', 0.1, 70);
      break;
    case 'home':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.08, 0.3, 'triangle', 0.2));
      break;
    case 'six':
      tone(660, t, 0.1, 'square', 0.1);
      tone(990, t + 0.09, 0.18, 'square', 0.1);
      break;
    case 'turn':
      tone(1046, t, 0.12, 'sine', 0.25);
      tone(1568, t + 0.1, 0.2, 'sine', 0.2);
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.13, 0.25, 'square', 0.12));
      [1046, 1318, 1568].forEach((f) => tone(f, t + 0.55, 0.7, 'triangle', 0.12));
      break;
    case 'lose':
      [392, 370, 349, 262].forEach((f, i) => tone(f, t + i * 0.22, 0.3, 'triangle', 0.18));
      break;
    case 'click':
      tone(1200, t, 0.04, 'triangle', 0.15, 700);
      break;
    case 'pop':
      tone(500, t, 0.08, 'sine', 0.2, 1100);
      break;
    case 'coin':
      tone(988, t, 0.08, 'square', 0.1);
      tone(1319, t + 0.07, 0.3, 'square', 0.1);
      break;
  }
}
