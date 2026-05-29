// Neon Smash VR — Wave Formations System (Round 5)
import { Vector3 } from '@iwsdk/core';

export enum FormationType {
  Cross = 'cross',
  VShape = 'vshape',
  HorizontalLine = 'hline',
  Circle = 'circle',
  Diagonal = 'diagonal',
  Diamond = 'diamond',
  Arrow = 'arrow',
  Spiral = 'spiral',
}

export interface Formation {
  type: FormationType;
  name: string;
  pylonIndices: number[]; // which pylons to spawn targets at simultaneously
  bonusPoints: number; // bonus for clearing entire formation
  description: string;
}

// Formations use the 15-pylon layout (3 rows x 5 cols):
// Row 0: [0, 1, 2, 3, 4]   (front)
// Row 1: [5, 6, 7, 8, 9]   (middle)
// Row 2: [10,11,12,13,14]   (back)

export const FORMATIONS: Formation[] = [
  {
    type: FormationType.Cross,
    name: 'CROSS',
    pylonIndices: [2, 6, 7, 8, 12], // center column + center row
    bonusPoints: 500,
    description: 'Hit all targets in the cross pattern!',
  },
  {
    type: FormationType.VShape,
    name: 'V-FORMATION',
    pylonIndices: [0, 4, 6, 8, 12], // V pointing up
    bonusPoints: 600,
    description: 'Clear the V formation!',
  },
  {
    type: FormationType.HorizontalLine,
    name: 'LINE',
    pylonIndices: [5, 6, 7, 8, 9], // middle row
    bonusPoints: 400,
    description: 'Sweep the line!',
  },
  {
    type: FormationType.Circle,
    name: 'RING',
    pylonIndices: [0, 2, 4, 10, 14], // corners + center back
    bonusPoints: 550,
    description: 'Break the ring!',
  },
  {
    type: FormationType.Diagonal,
    name: 'DIAGONAL',
    pylonIndices: [0, 6, 12, 3, 8], // two diagonals
    bonusPoints: 500,
    description: 'Cross the diagonals!',
  },
  {
    type: FormationType.Diamond,
    name: 'DIAMOND',
    pylonIndices: [2, 5, 9, 12, 7], // diamond shape
    bonusPoints: 650,
    description: 'Shatter the diamond!',
  },
  {
    type: FormationType.Arrow,
    name: 'ARROW',
    pylonIndices: [7, 6, 8, 10, 14], // arrow pointing forward
    bonusPoints: 550,
    description: 'Follow the arrow!',
  },
  {
    type: FormationType.Spiral,
    name: 'SPIRAL',
    pylonIndices: [0, 1, 2, 8, 14, 13, 12], // spiral path (7 targets)
    bonusPoints: 800,
    description: 'Trace the spiral!',
  },
];

export interface ActiveFormation {
  formation: Formation;
  targetsRemaining: Set<number>; // pylon indices still alive
  startTime: number;
  announced: boolean;
}

// Pick a random formation, with higher waves getting harder ones
export function pickFormation(wave: number): Formation {
  const pool = [...FORMATIONS];
  // Spiral only at wave 5+
  if (wave < 5) {
    const idx = pool.findIndex(f => f.type === FormationType.Spiral);
    if (idx !== -1) pool.splice(idx, 1);
  }
  // Diamond/Arrow at wave 3+
  if (wave < 3) {
    const filtered = pool.filter(f =>
      f.type !== FormationType.Diamond && f.type !== FormationType.Arrow
    );
    if (filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Should a formation spawn this wave? Chance increases with wave number.
export function shouldSpawnFormation(wave: number): boolean {
  if (wave < 2) return false; // no formations on wave 1
  const chance = Math.min(0.6, 0.15 + (wave - 2) * 0.05);
  return Math.random() < chance;
}
