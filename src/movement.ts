// Neon Smash VR — Target Movement Patterns (Round 4)
import { Vector3 } from '@iwsdk/core';

export enum MovementPattern {
  Static = 'static',
  Zigzag = 'zigzag',
  Orbit = 'orbit',
  Dive = 'dive',
  Wobble = 'wobble',
  Strafe = 'strafe',
}

export interface MovementConfig {
  pattern: MovementPattern;
  speed: number;
  amplitude: number;
  phase: number;
}

export const MOVEMENT_NAMES: Record<MovementPattern, string> = {
  [MovementPattern.Static]: 'Static',
  [MovementPattern.Zigzag]: 'Zigzag',
  [MovementPattern.Orbit]: 'Orbit',
  [MovementPattern.Dive]: 'Dive',
  [MovementPattern.Wobble]: 'Wobble',
  [MovementPattern.Strafe]: 'Strafe',
};

// Pick a movement pattern based on wave and difficulty
export function pickMovementPattern(wave: number, difficultyMult: number): MovementConfig {
  const r = Math.random();
  const movingChance = Math.min(0.7, 0.1 + wave * 0.05 * difficultyMult);

  if (r > movingChance) {
    return { pattern: MovementPattern.Static, speed: 0, amplitude: 0, phase: 0 };
  }

  const patterns = [
    MovementPattern.Zigzag,
    MovementPattern.Orbit,
    MovementPattern.Wobble,
    MovementPattern.Strafe,
  ];

  // Dive only at wave 4+
  if (wave >= 4) patterns.push(MovementPattern.Dive);

  const picked = patterns[Math.floor(Math.random() * patterns.length)];
  const baseSpeed = 0.5 + wave * 0.08 * difficultyMult;
  const baseAmplitude = 0.15 + wave * 0.02;

  return {
    pattern: picked,
    speed: baseSpeed + Math.random() * 0.3,
    amplitude: Math.min(0.6, baseAmplitude + Math.random() * 0.1),
    phase: Math.random() * Math.PI * 2,
  };
}

// Apply movement offset to a target's base position
export function applyMovement(
  basePos: Vector3,
  movement: MovementConfig,
  age: number,
  out: Vector3,
): void {
  out.copy(basePos);
  if (movement.pattern === MovementPattern.Static) return;

  const t = age * movement.speed + movement.phase;

  switch (movement.pattern) {
    case MovementPattern.Zigzag:
      // Side-to-side movement
      out.x += Math.sin(t * 3) * movement.amplitude;
      out.y += Math.sin(t * 2.1) * movement.amplitude * 0.3;
      break;

    case MovementPattern.Orbit:
      // Circular orbit around base position
      out.x += Math.cos(t * 2) * movement.amplitude;
      out.z += Math.sin(t * 2) * movement.amplitude * 0.6;
      out.y += Math.sin(t * 1.5) * movement.amplitude * 0.2;
      break;

    case MovementPattern.Dive:
      // Moves toward the player, then retreats
      const diveCycle = Math.sin(t * 1.5);
      out.z += diveCycle * movement.amplitude * 2;
      out.y += Math.abs(diveCycle) * movement.amplitude * 0.5;
      break;

    case MovementPattern.Wobble:
      // Erratic small movements in all axes
      out.x += Math.sin(t * 4.3) * movement.amplitude * 0.5;
      out.y += Math.sin(t * 3.7) * movement.amplitude * 0.4;
      out.z += Math.sin(t * 5.1) * movement.amplitude * 0.3;
      break;

    case MovementPattern.Strafe:
      // Smooth horizontal sweep
      out.x += Math.sin(t * 1.2) * movement.amplitude * 1.5;
      break;
  }
}
