export type Sound = 'paste' | 'stamp' | 'click' | 'ding' | 'whoosh' | 'send' | 'reply';

interface ToneOptions {
  freq: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

interface NoiseOptions {
  duration: number;
  from: number;
  to: number;
  gain?: number;
}

let context: AudioContext | undefined;

function tone(audio: AudioContext, at: number, { freq, to, duration, type = 'sine', gain = 0.1 }: ToneOptions) {
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, at);
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

function noise(audio: AudioContext, at: number, { duration, from, to, gain = 0.08 }: NoiseOptions) {
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + duration);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + duration * 0.3);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(envelope).connect(audio.destination);
  source.start(at);
}

const SOUNDS: Record<Sound, (audio: AudioContext, at: number) => void> = {
  paste: (audio, at) => noise(audio, at, { duration: 0.2, from: 500, to: 3500, gain: 0.14 }),
  stamp: (audio, at) => {
    tone(audio, at, { freq: 160, to: 50, duration: 0.16, type: 'triangle', gain: 0.4 });
    noise(audio, at, { duration: 0.05, from: 2600, to: 1200, gain: 0.12 });
  },
  click: (audio, at) => tone(audio, at, { freq: 2400, duration: 0.03, type: 'square', gain: 0.05 }),
  ding: (audio, at) => {
    tone(audio, at, { freq: 1046.5, duration: 0.35, gain: 0.09 });
    tone(audio, at + 0.08, { freq: 1568, duration: 0.5, gain: 0.07 });
  },
  whoosh: (audio, at) => noise(audio, at, { duration: 0.5, from: 250, to: 2800, gain: 0.12 }),
  send: (audio, at) => tone(audio, at, { freq: 420, to: 1000, duration: 0.13, gain: 0.14 }),
  reply: (audio, at) => {
    tone(audio, at, { freq: 660, duration: 0.12, gain: 0.08 });
    tone(audio, at + 0.1, { freq: 880, duration: 0.2, gain: 0.08 });
  },
};

export async function unlockAudio(): Promise<void> {
  try {
    context ??= new AudioContext();
    await context.resume();
  } catch {
    context = undefined;
  }
}

export function suspendAudio(): void {
  void context?.suspend().catch(() => undefined);
}

export function play(sound: Sound): void {
  if (context?.state !== 'running') return;
  try {
    SOUNDS[sound](context, context.currentTime + 0.005);
  } catch {
    return;
  }
}
