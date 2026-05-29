// Neon Smash VR — XP & Progression System (Round 5)

export interface PlayerProfile {
  xp: number;
  level: number;
  totalGamesPlayed: number;
  totalSmashed: number;
  skinsUnlocked: string[];
  themesUnlocked: number[];
  titlesUnlocked: string[];
  currentTitle: string;
}

export interface LevelReward {
  level: number;
  type: 'skin' | 'theme' | 'title';
  id: string | number;
  name: string;
}

// XP required for each level (increasing curve)
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.5));
}

export function xpToNextLevel(profile: PlayerProfile): number {
  const nextLevelXP = xpForLevel(profile.level + 1);
  return nextLevelXP - profile.xp;
}

export function xpProgress(profile: PlayerProfile): number {
  const currentLevelXP = xpForLevel(profile.level);
  const nextLevelXP = xpForLevel(profile.level + 1);
  const range = nextLevelXP - currentLevelXP;
  if (range <= 0) return 1;
  return Math.min(1, (profile.xp - currentLevelXP) / range);
}

// Rewards unlocked at specific levels
export const LEVEL_REWARDS: LevelReward[] = [
  { level: 3, type: 'skin', id: 'flame', name: 'Flame Striker' },
  { level: 5, type: 'theme', id: 2, name: 'Toxic Zone Arena' },
  { level: 7, type: 'title', id: 'target_smasher', name: 'Target Smasher' },
  { level: 10, type: 'skin', id: 'ice', name: 'Ice Striker' },
  { level: 12, type: 'theme', id: 3, name: 'Ultraviolet Arena' },
  { level: 15, type: 'title', id: 'combo_king', name: 'Combo King' },
  { level: 18, type: 'skin', id: 'void', name: 'Void Striker' },
  { level: 20, type: 'theme', id: 4, name: 'Solar Blaze Arena' },
  { level: 22, type: 'title', id: 'neon_legend', name: 'Neon Legend' },
  { level: 25, type: 'skin', id: 'lightning', name: 'Lightning Striker' },
  { level: 28, type: 'theme', id: 5, name: 'Frost Cavern Arena' },
  { level: 30, type: 'title', id: 'smash_master', name: 'Smash Master' },
  { level: 33, type: 'theme', id: 6, name: 'Void Rift Arena' },
  { level: 36, type: 'theme', id: 7, name: 'Emerald Grid Arena' },
  { level: 40, type: 'title', id: 'ultimate_smasher', name: 'Ultimate Smasher' },
  { level: 50, type: 'title', id: 'grandmaster', name: 'Grandmaster' },
];

// Player titles with display names
export const PLAYER_TITLES: Record<string, string> = {
  rookie: 'Rookie',
  target_smasher: 'Target Smasher',
  combo_king: 'Combo King',
  neon_legend: 'Neon Legend',
  smash_master: 'Smash Master',
  ultimate_smasher: 'Ultimate Smasher',
  grandmaster: 'Grandmaster',
};

// Calculate XP earned from a game session
export function calculateSessionXP(stats: {
  score: number;
  hits: number;
  maxCombo: number;
  accuracy: number;
  perfectWaves: number;
  completed: boolean;
  isChallenge: boolean;
  waveReached: number;
}): { total: number; breakdown: { label: string; xp: number }[] } {
  const breakdown: { label: string; xp: number }[] = [];

  // Base XP from score (1 XP per 100 score)
  const scoreXP = Math.floor(stats.score / 100);
  if (scoreXP > 0) breakdown.push({ label: 'Score', xp: scoreXP });

  // Hit bonus (1 XP per 2 hits)
  const hitXP = Math.floor(stats.hits / 2);
  if (hitXP > 0) breakdown.push({ label: 'Hits', xp: hitXP });

  // Combo bonus
  const comboXP = Math.floor(stats.maxCombo * 2);
  if (comboXP > 0) breakdown.push({ label: 'Max Combo', xp: comboXP });

  // Accuracy bonus
  if (stats.accuracy >= 90) {
    const accXP = Math.floor(stats.accuracy - 80);
    breakdown.push({ label: 'Accuracy', xp: accXP });
  }

  // Perfect wave bonus
  if (stats.perfectWaves > 0) {
    const perfXP = stats.perfectWaves * 15;
    breakdown.push({ label: 'Perfect Waves', xp: perfXP });
  }

  // Completion bonus
  if (stats.completed) {
    const compXP = 25 + stats.waveReached * 5;
    breakdown.push({ label: 'Completed', xp: compXP });
  }

  // Challenge bonus
  if (stats.isChallenge && stats.completed) {
    breakdown.push({ label: 'Challenge', xp: 50 });
  }

  const total = breakdown.reduce((sum, b) => sum + b.xp, 0);
  return { total, breakdown };
}

// Load profile from localStorage
export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem('neon-smash-profile');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    xp: 0,
    level: 1,
    totalGamesPlayed: 0,
    totalSmashed: 0,
    skinsUnlocked: ['neon'], // default skin always unlocked
    themesUnlocked: [0, 1], // Holodeck + Crimson always unlocked
    titlesUnlocked: ['rookie'],
    currentTitle: 'rookie',
  };
}

// Save profile
export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem('neon-smash-profile', JSON.stringify(profile));
  } catch { /* ignore */ }
}

// Add XP and check for level ups. Returns list of new rewards unlocked.
export function addXP(profile: PlayerProfile, amount: number): LevelReward[] {
  profile.xp += amount;
  const newRewards: LevelReward[] = [];

  // Check level ups
  while (true) {
    const nextLevelXP = xpForLevel(profile.level + 1);
    if (profile.xp >= nextLevelXP && profile.level < 50) {
      profile.level++;

      // Check for rewards at this level
      const rewards = LEVEL_REWARDS.filter(r => r.level === profile.level);
      for (const reward of rewards) {
        switch (reward.type) {
          case 'skin':
            if (!profile.skinsUnlocked.includes(reward.id as string)) {
              profile.skinsUnlocked.push(reward.id as string);
              newRewards.push(reward);
            }
            break;
          case 'theme':
            if (!profile.themesUnlocked.includes(reward.id as number)) {
              profile.themesUnlocked.push(reward.id as number);
              newRewards.push(reward);
            }
            break;
          case 'title':
            if (!profile.titlesUnlocked.includes(reward.id as string)) {
              profile.titlesUnlocked.push(reward.id as string);
              newRewards.push(reward);
            }
            break;
        }
      }
    } else {
      break;
    }
  }

  saveProfile(profile);
  return newRewards;
}

// Format level display
export function formatLevel(profile: PlayerProfile): string {
  return `LV.${profile.level}`;
}

// Format XP bar as text
export function formatXPBar(profile: PlayerProfile): string {
  const progress = xpProgress(profile);
  const barLength = 10;
  const filled = Math.floor(progress * barLength);
  return '[' + '='.repeat(filled) + '-'.repeat(barLength - filled) + ']';
}
