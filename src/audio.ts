// Neon Smash VR — Procedural Audio Manager (Round 3: pitch variations, ambient, stingers)
import { loadSettings } from './types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicLfo: OscillatorNode | null = null;
  private musicPad: OscillatorNode | null = null;
  private musicBass: OscillatorNode | null = null;
  private musicArp: OscillatorNode | null = null;
  private arpGain: GainNode | null = null;
  private arpInterval: ReturnType<typeof setInterval> | null = null;

  // Ambient
  private ambientGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientDrone: OscillatorNode | null = null;
  private ambientHum: OscillatorNode | null = null;

  // Hit pitch variation state
  private lastHitPitch = 1.0;
  private hitVariationSeed = 0;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.15;
    this.ambientGain.connect(this.masterGain);

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

  // === Hit SFX with pitch variation ===
  playHit(intensity = 1.0): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;

    // Pitch variation: each consecutive hit rises slightly, resets on miss
    this.hitVariationSeed++;
    const pitchVar = 1.0 + (this.hitVariationSeed % 8) * 0.04 + (Math.random() - 0.5) * 0.08;
    const baseFreq = 800 * intensity * pitchVar;

    // Bright percussive click + metallic ring
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(200 * pitchVar, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.12);

    // Noise burst with varied filter
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400 + this.hitVariationSeed * 50;
    noise.connect(hp).connect(ng).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.06);

    this.lastHitPitch = pitchVar;
  }

  resetHitPitch(): void {
    this.hitVariationSeed = 0;
    this.lastHitPitch = 1.0;
  }

  playArmoredHit(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Metallic clang with resonance
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

    // Metallic resonance
    const res = ctx.createOscillator();
    res.type = 'sine';
    res.frequency.value = 1200 + Math.random() * 400;
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.08, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    res.connect(rg).connect(this.sfxGain!);
    res.start(t);
    res.stop(t + 0.3);
  }

  playBombHit(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
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

    // Sub-bass thud
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, t);
    sub.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.3, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    sub.connect(sg).connect(this.sfxGain!);
    sub.start(t);
    sub.stop(t + 0.5);
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
    // Shimmer
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2200, t);
    shimmer.frequency.linearRampToValueAtTime(3500, t + 0.4);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.06, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    shimmer.connect(sg).connect(this.sfxGain!);
    shimmer.start(t);
    shimmer.stop(t + 0.4);
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
    this.resetHitPitch(); // reset pitch variation on miss
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

  // === Victory stinger: triumphant ascending fanfare ===
  playWinFanfare(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Main melody
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.35);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.35);
    });
    // Harmony pad
    [262, 330, 392].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 1.0);
    });
    // Cymbal shimmer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.1, t + 0.3);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    noise.connect(hp).connect(ng).connect(this.sfxGain!);
    noise.start(t + 0.3);
    noise.stop(t + 1.0);
  }

  // === Defeat stinger: descending, dramatic ===
  playGameOver(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Descending melody
    [523, 440, 349, 262].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.2);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.2 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800 - i * 100;
      osc.connect(lp).connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.4);
    });
    // Dark bass chord
    [65, 82, 98].forEach(f => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + 0.5);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + 0.5);
      osc.stop(t + 1.5);
    });
    // Reverse cymbal effect
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = i / data.length; // fade in = reverse crash
      data[i] = (Math.random() * 2 - 1) * 0.2 * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = 0.08;
    noise.connect(ng).connect(this.sfxGain!);
    noise.start(t);
    noise.stop(t + 0.5);
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

  // === Power-up collect sound ===
  playPowerUpCollect(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Rising whoosh
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.3);
    // Sparkle
    [1200, 1500, 1800].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + 0.1 + i * 0.05);
      g.gain.linearRampToValueAtTime(0.1, t + 0.12 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + i * 0.05);
      o.connect(g).connect(this.sfxGain!);
      o.start(t + 0.1 + i * 0.05);
      o.stop(t + 0.3 + i * 0.05);
    });
  }

  // === Power-up expire warning ===
  playPowerUpExpire(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // === Challenge complete ===
  playChallengeComplete(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Triumphant short stinger
    [659, 784, 988, 1175, 1568].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.15, t + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
      osc.connect(gain).connect(this.sfxGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.3);
    });
    // Bell tone
    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.value = 2093;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t + 0.3);
    bg.gain.linearRampToValueAtTime(0.12, t + 0.35);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    bell.connect(bg).connect(this.sfxGain!);
    bell.start(t + 0.3);
    bell.stop(t + 0.8);
  }

  // === Ambient Arena Sounds ===
  startAmbient(): void {
    const ctx = this.ensureCtx();
    if (this.ambientNoise) return;
    const t = ctx.currentTime;

    // Low-frequency ambient noise (filtered)
    const bufLen = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1;
    }
    this.ambientNoise = ctx.createBufferSource();
    this.ambientNoise.buffer = buf;
    this.ambientNoise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.value = 0.08;
    this.ambientNoise.connect(lp).connect(ng).connect(this.ambientGain!);
    this.ambientNoise.start(t);

    // Sub-frequency hum (electrical atmosphere)
    this.ambientHum = ctx.createOscillator();
    this.ambientHum.type = 'sine';
    this.ambientHum.frequency.value = 60;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.03;
    const humLfo = ctx.createOscillator();
    humLfo.type = 'sine';
    humLfo.frequency.value = 0.1;
    const humLfoGain = ctx.createGain();
    humLfoGain.gain.value = 0.01;
    humLfo.connect(humLfoGain).connect(humGain.gain);
    this.ambientHum.connect(humGain).connect(this.ambientGain!);
    this.ambientHum.start(t);
    humLfo.start(t);

    // Ambient drone (tonal atmosphere)
    this.ambientDrone = ctx.createOscillator();
    this.ambientDrone.type = 'triangle';
    this.ambientDrone.frequency.value = 110;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.04;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 200;
    const droneLfo = ctx.createOscillator();
    droneLfo.type = 'sine';
    droneLfo.frequency.value = 0.05;
    const droneLfoGain = ctx.createGain();
    droneLfoGain.gain.value = 20;
    droneLfo.connect(droneLfoGain).connect(droneLp.frequency);
    this.ambientDrone.connect(droneLp).connect(droneGain).connect(this.ambientGain!);
    this.ambientDrone.start(t);
    droneLfo.start(t);
  }

  stopAmbient(): void {
    const t = this.ctx?.currentTime || 0;
    try {
      this.ambientNoise?.stop(t + 0.1);
      this.ambientHum?.stop(t + 0.1);
      this.ambientDrone?.stop(t + 0.1);
    } catch { /* ignore */ }
    this.ambientNoise = null;
    this.ambientHum = null;
    this.ambientDrone = null;
  }

  // === Background Music ===
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

    // Second bass layer (fifth)
    this.musicBass = ctx.createOscillator();
    this.musicBass.type = 'sine';
    this.musicBass.frequency.value = 82.5;
    const bass2Gain = ctx.createGain();
    bass2Gain.gain.value = 0.06;
    this.musicBass.connect(bass2Gain).connect(this.musicGain!);
    this.musicBass.start(t);

    // Arpeggiator
    this.arpGain = ctx.createGain();
    this.arpGain.gain.value = 0.04;
    this.arpGain.connect(this.musicGain!);
    const arpNotes = [220, 330, 440, 550, 440, 330];
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

    // Start ambient sounds too
    this.startAmbient();
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
    this.stopAmbient();
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

  // === Time slow effect sound ===
  playTimeSlowStart(): void {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Descending whoosh
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
