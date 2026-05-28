// Neon Smash VR — Match History System (Round 4)
import { GameMode, Difficulty, MODE_NAMES } from './types';

export interface MatchRecord {
  id: string;
  date: string;
  mode: GameMode;
  difficulty: Difficulty;
  score: number;
  hits: number;
  misses: number;
  accuracy: number;
  maxCombo: number;
  waveReached: number;
  timeElapsed: number;
  goldenHits: number;
  bombsHit: number;
  perfectWaves: number;
  completed: boolean;
  isChallenge: boolean;
}

const HISTORY_KEY = 'neon-smash-match-history';
const MAX_HISTORY = 50;

export function loadMatchHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveMatchHistory(records: MatchRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export function addMatchRecord(record: Omit<MatchRecord, 'id' | 'date'>): MatchRecord {
  const history = loadMatchHistory();
  const full: MatchRecord = {
    ...record,
    id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
  };
  history.unshift(full); // newest first
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  saveMatchHistory(history);
  return full;
}

export function formatMatchSummary(match: MatchRecord): string {
  const mode = MODE_NAMES[match.mode] || match.mode;
  const diff = match.difficulty.charAt(0).toUpperCase() + match.difficulty.slice(1);
  return `${mode} ${diff} — ${match.score.toLocaleString()} pts`;
}

export function formatMatchDetail(match: MatchRecord): string {
  const acc = match.accuracy;
  const combo = match.maxCombo;
  return `Acc: ${acc}% | Combo: ${combo}x | Wave: ${match.waveReached}`;
}

export function formatMatchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch { return dateStr; }
}

export function getPersonalBests(): Record<string, { score: number; combo: number; accuracy: number }> {
  const history = loadMatchHistory();
  const bests: Record<string, { score: number; combo: number; accuracy: number }> = {};
  for (const m of history) {
    const key = `${m.mode}-${m.difficulty}`;
    if (!bests[key]) {
      bests[key] = { score: m.score, combo: m.maxCombo, accuracy: m.accuracy };
    } else {
      if (m.score > bests[key].score) bests[key].score = m.score;
      if (m.maxCombo > bests[key].combo) bests[key].combo = m.maxCombo;
      if (m.accuracy > bests[key].accuracy) bests[key].accuracy = m.accuracy;
    }
  }
  return bests;
}
