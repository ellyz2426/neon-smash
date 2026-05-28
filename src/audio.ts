// Neon Smash VR — Procedural Audio Manager
import { loadSettings } from './types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicLfo: OscillatorNode | null = null;
  private musicPad: OscillatorNode | null = null;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);

    const settings = loadSettings();
    this.masterGain.gain.value = settings.masterVolume;
    this.sfxGain.gain.value = settings.sfxVolume;
    this.musicGain.gain.value = settings.musicVolume;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    return this.ctx!;
  }

  setMasterVolume(v: number): void { if (this.masterGain) this.masterGain.gain.value = v; }
  setSfxVolume(v: number): void { if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMusicVolume(v: number): void { if (this.musicGain) this.musicGain.gain.value = v; }

  // === SFX ===
  playHit(intensity = 1.0): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Bright percussive click + metallic ring
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 * intensity, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.12);

    // Noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(ng).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.06);
  }

  playArmoredHit(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playBombHit(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Deep explosion
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.4);
    // Noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(100, t + 0.3);
    noise.connect(lp).connect(ng).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.3);
  }

  playGoldenHit(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const notes = [880, 1100, 1320, 1760];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.2);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.2);
    });
  }

  playChainComplete(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.25);
    });
  }

  playMiss(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  playCountdown(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 660;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playGameStart(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.15);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.15);
    });
  }

  playGameOver(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [523, 440, 349, 262].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.15 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.3);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      osc.connect(lp).connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.3);
    });
  }

  playWinFanfare(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.25);
    });
  }

  playWaveComplete(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [659, 784, 1047].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.2);
    });
  }

  playBossHit(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  playBossDefeat(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.07);
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.3);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.3);
    });
  }

  playAchievement(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.3);
    });
  }

  playButtonClick(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // === Ambient Music ===
  private musicBass: OscillatorNode | null = null;
  private musicArp: OscillatorNode | null = null;
  private arpGain: GainNode | null = null;
  private arpInterval: ReturnType<typeof setInterval> | null = null;

  startMusic(): void {
    const ctx = this.ensureCtx();
    if (this.musicOsc) return;
    const t = ctx.currentTime;

    // Sub bass drone
    this.musicOsc = ctx.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.value = 55;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.15;
    this.musicOsc.connect(bassGain).connect(this.musicGain!);
    this.musicOsc.start(t);

    // LFO
    this.musicLfo = ctx.createOscillator();
    this.musicLfo.type = 'sine';
    this.musicLfo.frequency.value = 0.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    this.musicLfo.connect(lfoGain).connect(this.musicOsc.frequency);
    this.musicLfo.start(t);

    // Triangle pad
    this.musicPad = ctx.createOscillator();
    this.musicPad.type = 'triangle';
    this.musicPad.frequency.value = 110;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.06;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 300;
    this.musicPad.connect(padFilter).connect(padGain).connect(this.musicGain!);
    this.musicPad.start(t);

    // Second bass layer (fifth interval)
    this.musicBass = ctx.createOscillator();
    this.musicBass.type = 'sine';
    this.musicBass.frequency.value = 82.5; // E2 (fifth above A1)
    const bass2Gain = ctx.createGain();
    bass2Gain.gain.value = 0.06;
    this.musicBass.connect(bass2Gain).connect(this.musicGain!);
    this.musicBass.start(t);

    // Arpeggiator layer
    this.arpGain = ctx.createGain();
    this.arpGain.gain.value = 0.04;
    this.arpGain.connect(this.musicGain!);
    const arpNotes = [220, 330, 440, 550, 440, 330]; // A minor arpeggio
    let arpIdx = 0;
    this.arpInterval = setInterval(() => {
      if (!this.ctx || !this.arpGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = arpNotes[arpIdx % arpNotes.length];
      const env = this.ctx.createGain();
      const now = this.ctx.currentTime;
      env.gain.setValueAtTime(0.04, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      osc.connect(lp).connect(env).connect(this.musicGain!);
      osc.start(now);
      osc.stop(now + 0.35);
      arpIdx++;
    }, 450);
  }

  stopMusic(): void {
    const t = this.ctx?.currentTime || 0;
    try {
      this.musicOsc?.stop(t + 0.1);
      this.musicLfo?.stop(t + 0.1);
      this.musicPad?.stop(t + 0.1);
      this.musicBass?.stop(t + 0.1);
    } catch { /* ignore */ }
    this.musicOsc = null;
    this.musicLfo = null;
    this.musicPad = null;
    this.musicBass = null;
    if (this.arpInterval) {
      clearInterval(this.arpInterval);
      this.arpInterval = null;
    }
    this.arpGain = null;
  }

  // === Wave-specific jingles ===
  playWaveStart(wave: number): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const baseFreq = 330 + wave * 20;
    [0, 4, 7].forEach((semitone, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = baseFreq * Math.pow(2, semitone / 12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.18);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.18);
    });
  }

  playStreakSound(combo: number): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const freq = 600 + combo * 30;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playLifeLost(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    osc.connect(lp).connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playPerfectWave(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [784, 988, 1175, 1568, 1976].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.25);
    });
  }
}
