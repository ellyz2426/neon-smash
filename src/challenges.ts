// Neon Smash VR — Daily Challenge System with seeded randomness
import { GameMode, Difficulty } from './types';

export interface DailyChallenge {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  mode: GameMode;
  difficulty: Difficulty;
  modifiers: ChallengeModifier[];
  targetScore: number;
  seed: number;
}

export interface ChallengeModifier {
  id: string;
  name: string;
  description: string;
}

// Seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const ch = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

const CHALLENGE_TITLES = [
  'Speed Demon', 'Precision Strike', 'Bomb Alley', 'Golden Rush',
  'Combo Master', 'Endurance Run', 'Boss Blitz', 'Chain Reaction',
  'No Mercy', 'Quick Draw', 'Target Practice', 'Survival Mode',
  'Neon Blitz', 'Hyper Strike', 'Iron Will',
];

const ALL_MODIFIERS: ChallengeModifier[] = [
  { id: 'fast_targets', name: 'Fast Targets', description: 'Targets expire 40% faster' },
  { id: 'more_bombs', name: 'Bomb Storm', description: '2x bomb spawn rate' },
  { id: 'tiny_targets', name: 'Tiny Targets', description: 'Targets are 30% smaller' },
  { id: 'no_miss', name: 'No Miss Allowed', description: 'Game ends on first miss' },
  { id: 'golden_only', name: 'All That Glitters', description: '3x golden target spawns' },
  { id: 'rapid_fire', name: 'Rapid Fire', description: 'Targets spawn 50% faster' },
  { id: 'short_fuse', name: 'Short Fuse', description: 'Only 30 seconds in Speed Rush' },
  { id: 'big_combos', name: 'Combo Frenzy', description: 'Combo multipliers are 2x' },
  { id: 'armored_up', name: 'Armored Up', description: '2x armored target spawns' },
  { id: 'glass_cannon', name: 'Glass Cannon', description: '3x points but 1 life' },
];

export function generateDailyChallenge(dateStr?: string): DailyChallenge {
  const date = dateStr || new Date().toISOString().split('T')[0];
  const seed = dateToSeed(date);
  const rng = mulberry32(seed);

  const modes = [GameMode.Classic, GameMode.SpeedRush, GameMode.Precision, GameMode.Endless, GameMode.BossWave];
  const diffs = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];

  const mode = modes[Math.floor(rng() * modes.length)];
  const difficulty = diffs[Math.floor(rng() * 3)];
  const title = CHALLENGE_TITLES[Math.floor(rng() * CHALLENGE_TITLES.length)];

  // Pick 1-2 modifiers
  const modCount = 1 + Math.floor(rng() * 2);
  const shuffled = [...ALL_MODIFIERS].sort(() => rng() - 0.5);
  const modifiers = shuffled.slice(0, modCount);

  // Target score based on difficulty and modifiers
  let baseScore = 5000;
  if (difficulty === Difficulty.Medium) baseScore = 10000;
  if (difficulty === Difficulty.Hard) baseScore = 20000;
  if (modifiers.some(m => m.id === 'glass_cannon')) baseScore *= 1.5;
  if (modifiers.some(m => m.id === 'no_miss')) baseScore *= 0.7;
  const targetScore = Math.round(baseScore * (0.8 + rng() * 0.4));

  return {
    id: `daily-${date}`,
    date,
    title,
    description: `${title} — ${modifiers.map(m => m.name).join(' + ')}`,
    mode,
    difficulty,
    modifiers,
    targetScore,
    seed,
  };
}

// Check if today's challenge has been completed
export function isChallengeCompleted(date: string): boolean {
  try {
    const completed = localStorage.getItem('neon-smash-challenges-completed');
    if (!completed) return false;
    const dates: string[] = JSON.parse(completed);
    return dates.includes(date);
  } catch { return false; }
}

export function markChallengeCompleted(date: string): void {
  try {
    const completed = localStorage.getItem('neon-smash-challenges-completed');
    const dates: string[] = completed ? JSON.parse(completed) : [];
    if (!dates.includes(date)) {
      dates.push(date);
      // Keep only last 30 days
      if (dates.length > 30) dates.shift();
      localStorage.setItem('neon-smash-challenges-completed', JSON.stringify(dates));
    }
  } catch { /* ignore */ }
}

export function getChallengeStreak(): number {
  try {
    const completed = localStorage.getItem('neon-smash-challenges-completed');
    if (!completed) return 0;
    const dates: string[] = JSON.parse(completed);
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (dates.includes(ds)) streak++;
      else break;
    }
    return streak;
  } catch { return 0; }
}

// Apply challenge modifiers to game config
export interface ChallengeGameConfig {
  lifetimeMult: number;
  bombChanceMult: number;
  scaleMult: number;
  spawnRateMult: number;
  pointsMult: number;
  lives: number | null; // null = use default
  timeLimit: number | null; // null = use default
  comboMultiplierMult: number;
  goldenSpawnMult: number;
  armoredSpawnMult: number;
  noMissAllowed: boolean;
}

export function getChallengeConfig(challenge: DailyChallenge): ChallengeGameConfig {
  const cfg: ChallengeGameConfig = {
    lifetimeMult: 1, bombChanceMult: 1, scaleMult: 1,
    spawnRateMult: 1, pointsMult: 1, lives: null,
    timeLimit: null, comboMultiplierMult: 1, goldenSpawnMult: 1,
    armoredSpawnMult: 1, noMissAllowed: false,
  };

  for (const mod of challenge.modifiers) {
    switch (mod.id) {
      case 'fast_targets': cfg.lifetimeMult = 0.6; break;
      case 'more_bombs': cfg.bombChanceMult = 2; break;
      case 'tiny_targets': cfg.scaleMult = 0.7; break;
      case 'no_miss': cfg.noMissAllowed = true; break;
      case 'golden_only': cfg.goldenSpawnMult = 3; break;
      case 'rapid_fire': cfg.spawnRateMult = 1.5; break;
      case 'short_fuse': cfg.timeLimit = 30; break;
      case 'big_combos': cfg.comboMultiplierMult = 2; break;
      case 'armored_up': cfg.armoredSpawnMult = 2; break;
      case 'glass_cannon': cfg.pointsMult = 3; cfg.lives = 1; break;
    }
  }

  return cfg;
}
