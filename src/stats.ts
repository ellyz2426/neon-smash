// Neon Smash VR — Statistics tracking and persistence
import { GameMode, Difficulty, MODE_NAMES } from './types';

export interface ModeStats {
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  totalHits: number;
  totalMisses: number;
  bestCombo: number;
  bestAccuracy: number;
  totalTimePlayed: number; // seconds
  bestStreak: number; // consecutive hits without miss in single game
  waveRecord: number; // highest wave reached (Classic/Endless/Boss)
}

export interface SessionStats {
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  hits: number;
  misses: number;
  maxCombo: number;
  accuracy: number;
  timeElapsed: number;
  waveReached: number;
  goldenHits: number;
  bombsHit: number;
  chainCompletes: number;
  perfectWaves: number;
}

export interface StatsData {
  totalGamesPlayed: number;
  totalPlayTime: number; // seconds
  allTimeScore: number;
  allTimeBestScore: number;
  allTimeBestCombo: number;
  allTimeBestAccuracy: number;
  totalTargetsSmashed: number;
  totalGoldenHits: number;
  totalBombsHit: number;
  totalChainCompletes: number;
  totalPerfectWaves: number;
  modeStats: Record<string, ModeStats>;
  lastPlayed: string;
  firstPlayed: string;
}

const STATS_KEY = 'neon-smash-stats';

function defaultModeStats(): ModeStats {
  return {
    gamesPlayed: 0, totalScore: 0, bestScore: 0,
    totalHits: 0, totalMisses: 0, bestCombo: 0,
    bestAccuracy: 0, totalTimePlayed: 0, bestStreak: 0, waveRecord: 0,
  };
}

export function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    totalGamesPlayed: 0, totalPlayTime: 0, allTimeScore: 0,
    allTimeBestScore: 0, allTimeBestCombo: 0, allTimeBestAccuracy: 0,
    totalTargetsSmashed: 0, totalGoldenHits: 0, totalBombsHit: 0,
    totalChainCompletes: 0, totalPerfectWaves: 0,
    modeStats: {}, lastPlayed: '', firstPlayed: '',
  };
}

export function saveStats(data: StatsData): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function recordSession(session: SessionStats): StatsData {
  const stats = loadStats();
  const now = new Date().toISOString();

  stats.totalGamesPlayed++;
  stats.totalPlayTime += session.timeElapsed;
  stats.allTimeScore += session.score;
  stats.totalTargetsSmashed += session.hits;
  stats.totalGoldenHits += session.goldenHits;
  stats.totalBombsHit += session.bombsHit;
  stats.totalChainCompletes += session.chainCompletes;
  stats.totalPerfectWaves += session.perfectWaves;
  stats.lastPlayed = now;
  if (!stats.firstPlayed) stats.firstPlayed = now;

  if (session.score > stats.allTimeBestScore) stats.allTimeBestScore = session.score;
  if (session.maxCombo > stats.allTimeBestCombo) stats.allTimeBestCombo = session.maxCombo;
  if (session.accuracy > stats.allTimeBestAccuracy) stats.allTimeBestAccuracy = session.accuracy;

  // Per-mode stats
  const modeKey = session.mode;
  if (!stats.modeStats[modeKey]) stats.modeStats[modeKey] = defaultModeStats();
  const ms = stats.modeStats[modeKey];
  ms.gamesPlayed++;
  ms.totalScore += session.score;
  ms.totalHits += session.hits;
  ms.totalMisses += session.misses;
  ms.totalTimePlayed += session.timeElapsed;
  if (session.score > ms.bestScore) ms.bestScore = session.score;
  if (session.maxCombo > ms.bestCombo) ms.bestCombo = session.maxCombo;
  if (session.accuracy > ms.bestAccuracy) ms.bestAccuracy = session.accuracy;
  if (session.waveReached > ms.waveRecord) ms.waveRecord = session.waveReached;

  saveStats(stats);
  return stats;
}

export function formatPlayTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
