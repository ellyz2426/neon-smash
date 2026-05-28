// Neon Smash VR — Types, constants, state management
import { Vector3 } from '@iwsdk/core';

// === Game States ===
export type GameState = 'title' | 'modeselect' | 'difficulty' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'leaderboard' | 'achievements' | 'settings' | 'help' | 'stats' | 'skins' | 'challenge' | 'tutorial' | 'history';

// === Target Types ===
export enum TargetType {
  Normal = 'normal',
  Speed = 'speed',
  Armored = 'armored',
  Bomb = 'bomb',
  Golden = 'golden',
  Chain = 'chain',
}

export interface TargetConfig {
  type: TargetType;
  color: number;
  emissive: number;
  points: number;
  hitsRequired: number;
  lifetime: number; // seconds
  scale: number;
  spawnChance: number; // weight for random selection
}

export const TARGET_CONFIGS: Record<TargetType, TargetConfig> = {
  [TargetType.Normal]: { type: TargetType.Normal, color: 0x00ffff, emissive: 0x00aaaa, points: 100, hitsRequired: 1, lifetime: 2.5, scale: 1.0, spawnChance: 40 },
  [TargetType.Speed]: { type: TargetType.Speed, color: 0xffff00, emissive: 0xaaaa00, points: 200, hitsRequired: 1, lifetime: 1.0, scale: 0.85, spawnChance: 20 },
  [TargetType.Armored]: { type: TargetType.Armored, color: 0xff8800, emissive: 0xaa5500, points: 300, hitsRequired: 2, lifetime: 3.5, scale: 1.2, spawnChance: 15 },
  [TargetType.Bomb]: { type: TargetType.Bomb, color: 0xff0000, emissive: 0xaa0000, points: -500, hitsRequired: 1, lifetime: 2.5, scale: 1.1, spawnChance: 12 },
  [TargetType.Golden]: { type: TargetType.Golden, color: 0xffd700, emissive: 0xbb9900, points: 500, hitsRequired: 1, lifetime: 1.5, scale: 0.9, spawnChance: 8 },
  [TargetType.Chain]: { type: TargetType.Chain, color: 0x00ff88, emissive: 0x00aa55, points: 350, hitsRequired: 1, lifetime: 4.0, scale: 1.0, spawnChance: 5 },
};

// === Game Modes ===
export enum GameMode {
  Classic = 'classic',
  SpeedRush = 'speedrush',
  Precision = 'precision',
  Endless = 'endless',
  BossWave = 'bosswave',
}

export const MODE_NAMES: Record<GameMode, string> = {
  [GameMode.Classic]: 'CLASSIC',
  [GameMode.SpeedRush]: 'SPEED RUSH',
  [GameMode.Precision]: 'PRECISION',
  [GameMode.Endless]: 'ENDLESS',
  [GameMode.BossWave]: 'BOSS WAVE',
};

export const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  [GameMode.Classic]: '10 waves, 3 lives. Survive the onslaught!',
  [GameMode.SpeedRush]: '60 seconds. How many can you smash?',
  [GameMode.Precision]: '30 targets. Accuracy is everything.',
  [GameMode.Endless]: 'Infinite waves. How long can you last?',
  [GameMode.BossWave]: 'Giant boss targets with weak points.',
};

// === Difficulty ===
export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

export interface DifficultyConfig {
  spawnInterval: number; // base seconds between spawns
  targetLifetimeMult: number;
  maxActiveTargets: number;
  bombChanceMult: number;
  speedMult: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.Easy]: { spawnInterval: 1.8, targetLifetimeMult: 1.3, maxActiveTargets: 4, bombChanceMult: 0.5, speedMult: 0.8 },
  [Difficulty.Medium]: { spawnInterval: 1.2, targetLifetimeMult: 1.0, maxActiveTargets: 6, bombChanceMult: 1.0, speedMult: 1.0 },
  [Difficulty.Hard]: { spawnInterval: 0.7, targetLifetimeMult: 0.7, maxActiveTargets: 9, bombChanceMult: 1.5, speedMult: 1.3 },
};

// === Themes ===
export interface ArenaTheme {
  name: string;
  gridColor: number;
  accentColor: number;
  pylonColor: number;
  fogColor: number;
  ambientColor: number;
}

export const ARENA_THEMES: ArenaTheme[] = [
  { name: 'Holodeck', gridColor: 0x00ffff, accentColor: 0x00ffff, pylonColor: 0x004466, fogColor: 0x000a14, ambientColor: 0x112244 },
  { name: 'Crimson Arena', gridColor: 0xff2244, accentColor: 0xff4466, pylonColor: 0x440011, fogColor: 0x0a0004, ambientColor: 0x331122 },
  { name: 'Toxic Zone', gridColor: 0x44ff00, accentColor: 0x88ff44, pylonColor: 0x114400, fogColor: 0x040a00, ambientColor: 0x113311 },
  { name: 'Ultraviolet', gridColor: 0xaa44ff, accentColor: 0xcc66ff, pylonColor: 0x220044, fogColor: 0x060014, ambientColor: 0x221144 },
  { name: 'Solar Blaze', gridColor: 0xff8800, accentColor: 0xffaa44, pylonColor: 0x442200, fogColor: 0x0a0400, ambientColor: 0x332211 },
  { name: 'Frost Cavern', gridColor: 0x44aaff, accentColor: 0x88ddff, pylonColor: 0x112244, fogColor: 0x020814, ambientColor: 0x112233 },
  { name: 'Void Rift', gridColor: 0xff00ff, accentColor: 0xff44ff, pylonColor: 0x330033, fogColor: 0x08000a, ambientColor: 0x221133 },
  { name: 'Emerald Grid', gridColor: 0x00ff88, accentColor: 0x44ffaa, pylonColor: 0x004422, fogColor: 0x000a06, ambientColor: 0x113322 },
];

// === Pylon Positions ===
// 15 pylons in a semicircular arrangement (3 rows x 5 columns)
export function getPylonPositions(): Vector3[] {
  const positions: Vector3[] = [];
  const rows = 3;
  const cols = 5;
  const baseRadius = 3.0;
  const rowSpacing = 1.2;
  const arcSpan = Math.PI * 0.7; // ~126 degrees

  for (let r = 0; r < rows; r++) {
    const radius = baseRadius + r * rowSpacing;
    const y = 0.6 + r * 0.3; // slightly higher back rows
    for (let c = 0; c < cols; c++) {
      const angle = -arcSpan / 2 + (c / (cols - 1)) * arcSpan;
      const x = Math.sin(angle) * radius;
      const z = -Math.cos(angle) * radius;
      positions.push(new Vector3(x, y, z));
    }
  }
  return positions;
}

// === Achievements ===
export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_smash', name: 'First Smash', description: 'Hit your first target', unlocked: false },
  { id: 'combo_5', name: 'Combo Starter', description: 'Reach a 5x combo', unlocked: false },
  { id: 'combo_10', name: 'Combo Master', description: 'Reach a 10x combo', unlocked: false },
  { id: 'combo_25', name: 'Combo Legend', description: 'Reach a 25x combo', unlocked: false },
  { id: 'combo_50', name: 'Unstoppable', description: 'Reach a 50x combo', unlocked: false },
  { id: 'score_1k', name: 'Breaking In', description: 'Score 1,000 points', unlocked: false },
  { id: 'score_10k', name: 'Going Strong', description: 'Score 10,000 points', unlocked: false },
  { id: 'score_50k', name: 'Smash King', description: 'Score 50,000 points', unlocked: false },
  { id: 'score_100k', name: 'Legendary', description: 'Score 100,000 points', unlocked: false },
  { id: 'golden_5', name: 'Gold Rush', description: 'Hit 5 golden targets', unlocked: false },
  { id: 'golden_20', name: 'Midas Touch', description: 'Hit 20 golden targets', unlocked: false },
  { id: 'no_bombs', name: 'Bomb Dodger', description: 'Complete Classic without hitting a bomb', unlocked: false },
  { id: 'perfect_wave', name: 'Perfect Wave', description: 'Hit every target in a wave', unlocked: false },
  { id: 'speed_50', name: 'Speed Demon', description: 'Hit 50 targets in Speed Rush', unlocked: false },
  { id: 'precision_90', name: 'Sharpshooter', description: 'Achieve 90%+ accuracy in Precision', unlocked: false },
  { id: 'precision_100', name: 'Perfect Aim', description: '100% accuracy in Precision', unlocked: false },
  { id: 'endless_5m', name: 'Endurance', description: 'Survive 5 minutes in Endless', unlocked: false },
  { id: 'endless_10m', name: 'Marathon', description: 'Survive 10 minutes in Endless', unlocked: false },
  { id: 'boss_first', name: 'Boss Slayer', description: 'Defeat your first boss', unlocked: false },
  { id: 'boss_flawless', name: 'Flawless Victory', description: 'Defeat a boss without missing', unlocked: false },
  { id: 'chain_complete', name: 'Chain Reaction', description: 'Complete a chain sequence', unlocked: false },
  { id: 'all_modes', name: 'Versatile', description: 'Play all 5 game modes', unlocked: false },
  { id: 'dual_wield', name: 'Dual Wielder', description: 'Hit targets with both controllers', unlocked: false },
  { id: 'speed_100', name: 'Lightning Hands', description: 'Hit 100 targets in Speed Rush', unlocked: false },
  { id: 'games_10', name: 'Regular', description: 'Play 10 games', unlocked: false },
  { id: 'games_50', name: 'Dedicated', description: 'Play 50 games', unlocked: false },
  { id: 'perfect_3', name: 'Hat Trick', description: 'Get 3 perfect waves in one game', unlocked: false },
  { id: 'wave_10', name: 'Survivor', description: 'Reach wave 10 in Endless', unlocked: false },
  { id: 'no_miss_wave5', name: 'Sharpshooter Elite', description: 'Complete 5 waves without a miss', unlocked: false },
  { id: 'total_1000', name: 'Thousand Smashes', description: 'Smash 1,000 total targets', unlocked: false },
];

// === Game State Manager ===
export class GameStateManager {
  score = 0;
  combo = 0;
  maxCombo = 0;
  lives = 3;
  wave = 1;
  totalWaves = 10;
  hits = 0;
  misses = 0;
  totalTargets = 0;
  goldenHits = 0;
  bombsHit = 0;
  chainProgress = 0;
  chainTotal = 0;
  timeRemaining = 60;
  timeElapsed = 0;
  mode: GameMode = GameMode.Classic;
  difficulty: Difficulty = Difficulty.Medium;
  modesPlayed = new Set<GameMode>();

  // Boss state
  bossHP = 0;
  bossMaxHP = 0;
  bossActive = false;

  // Wave tracking
  waveTargets = 0;
  waveHits = 0;
  waveBombsHit = 0;

  // Extended tracking
  chainCompletes = 0;
  perfectWaves = 0;
  leftHandHits = 0;
  rightHandHits = 0;
  waveMisses = 0; // misses in current wave
  consecutivePerfectWaves = 0;
  noMissWaveStreak = 0; // consecutive waves with 0 misses

  reset(mode: GameMode, diff: Difficulty): void {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.totalTargets = 0;
    this.goldenHits = 0;
    this.bombsHit = 0;
    this.chainProgress = 0;
    this.chainTotal = 0;
    this.timeElapsed = 0;
    this.wave = 1;
    this.waveTargets = 0;
    this.waveHits = 0;
    this.waveBombsHit = 0;
    this.bossHP = 0;
    this.bossMaxHP = 0;
    this.bossActive = false;
    this.chainCompletes = 0;
    this.perfectWaves = 0;
    this.leftHandHits = 0;
    this.rightHandHits = 0;
    this.waveMisses = 0;
    this.consecutivePerfectWaves = 0;
    this.noMissWaveStreak = 0;
    this.mode = mode;
    this.difficulty = diff;
    this.modesPlayed.add(mode);

    switch (mode) {
      case GameMode.Classic:
        this.lives = 3;
        this.totalWaves = 10;
        this.timeRemaining = 999;
        break;
      case GameMode.SpeedRush:
        this.lives = 999;
        this.totalWaves = 999;
        this.timeRemaining = 60;
        break;
      case GameMode.Precision:
        this.lives = 999;
        this.totalWaves = 1;
        this.timeRemaining = 999;
        break;
      case GameMode.Endless:
        this.lives = 3;
        this.totalWaves = 999;
        this.timeRemaining = 999;
        break;
      case GameMode.BossWave:
        this.lives = 5;
        this.totalWaves = 5;
        this.timeRemaining = 999;
        break;
    }
  }

  getComboMultiplier(): number {
    if (this.combo >= 25) return 10;
    if (this.combo >= 15) return 5;
    if (this.combo >= 10) return 3;
    if (this.combo >= 5) return 2;
    return 1;
  }

  getAccuracy(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : Math.round((this.hits / total) * 100);
  }

  addHit(points: number): number {
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.hits++;
    this.waveHits++;
    const mult = this.getComboMultiplier();
    const scored = points * mult;
    this.score += scored;
    return scored;
  }

  addMiss(): void {
    this.combo = 0;
    this.misses++;
    this.waveMisses++;
  }

  recordWaveComplete(): void {
    if (this.waveHits === this.waveTargets && this.waveTargets > 0 && this.waveBombsHit === 0) {
      this.perfectWaves++;
      this.consecutivePerfectWaves++;
    } else {
      this.consecutivePerfectWaves = 0;
    }
    if (this.waveMisses === 0 && this.waveTargets > 0) {
      this.noMissWaveStreak++;
    } else {
      this.noMissWaveStreak = 0;
    }
  }

  startNextWave(): void {
    this.wave++;
    this.waveTargets = 0;
    this.waveHits = 0;
    this.waveBombsHit = 0;
    this.waveMisses = 0;
  }

  loseLife(): boolean {
    this.lives--;
    return this.lives <= 0;
  }
}

// === Leaderboard ===
export interface LeaderboardEntry {
  score: number;
  mode: string;
  difficulty: string;
  accuracy: number;
  maxCombo: number;
  date: string;
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem('neon-smash-leaderboard');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem('neon-smash-leaderboard', JSON.stringify(entries.slice(0, 20)));
  } catch { /* ignore */ }
}

export function addToLeaderboard(entry: LeaderboardEntry): void {
  const entries = loadLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  saveLeaderboard(entries);
}

// === Achievement Persistence ===
export function loadAchievements(): Set<string> {
  try {
    const raw = localStorage.getItem('neon-smash-achievements');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function saveAchievement(id: string): void {
  const unlocked = loadAchievements();
  unlocked.add(id);
  try {
    localStorage.setItem('neon-smash-achievements', JSON.stringify([...unlocked]));
  } catch { /* ignore */ }
}

// === Settings ===
export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  theme: number;
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem('neon-smash-settings');
    return raw ? JSON.parse(raw) : { masterVolume: 0.7, sfxVolume: 0.8, musicVolume: 0.5, theme: 0 };
  } catch { return { masterVolume: 0.7, sfxVolume: 0.8, musicVolume: 0.5, theme: 0 }; }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem('neon-smash-settings', JSON.stringify(s));
  } catch { /* ignore */ }
}
