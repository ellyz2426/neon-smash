// Neon Smash VR — Power-up System
import {
  Group, Mesh, SphereGeometry, TorusGeometry, OctahedronGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial,
  EdgesGeometry, LineSegments, LineBasicMaterial,
  Vector3, AdditiveBlending,
} from '@iwsdk/core';

export enum PowerUpType {
  TimeSlow = 'timeslow',
  DoublePoints = 'doublepoints',
  MagnetPull = 'magnetpull',
  Shield = 'shield',
}

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  color: number;
  emissive: number;
  duration: number; // seconds the effect lasts
  spawnChance: number; // weight for random selection
  icon: string; // character for UI display
}

export const POWERUP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  [PowerUpType.TimeSlow]: {
    type: PowerUpType.TimeSlow, name: 'TIME SLOW', color: 0x44aaff,
    emissive: 0x2266cc, duration: 8, spawnChance: 25, icon: '⏱',
  },
  [PowerUpType.DoublePoints]: {
    type: PowerUpType.DoublePoints, name: '2X POINTS', color: 0xffdd00,
    emissive: 0xcc9900, duration: 10, spawnChance: 30, icon: '✕2',
  },
  [PowerUpType.MagnetPull]: {
    type: PowerUpType.MagnetPull, name: 'MAGNET', color: 0xff44aa,
    emissive: 0xcc2288, duration: 6, spawnChance: 20, icon: '🧲',
  },
  [PowerUpType.Shield]: {
    type: PowerUpType.Shield, name: 'SHIELD', color: 0x44ff88,
    emissive: 0x22cc55, duration: 12, spawnChance: 25, icon: '🛡',
  },
};

export interface ActivePowerUp {
  group: Group;
  mesh: Mesh;
  glowMesh: Mesh;
  edgeLines: LineSegments;
  config: PowerUpConfig;
  position: Vector3;
  age: number;
  lifetime: number;
  alive: boolean;
  bobPhase: number;
}

export interface ActiveEffect {
  type: PowerUpType;
  remaining: number;
  duration: number;
}

export class PowerUpSystem {
  powerups: ActivePowerUp[] = [];
  activeEffects: ActiveEffect[] = [];
  private spawnTimer = 0;
  private spawnInterval = 15; // seconds between spawn chances
  private spawnChance = 0.35; // probability per interval

  get timeSlow(): boolean {
    return this.activeEffects.some(e => e.type === PowerUpType.TimeSlow && e.remaining > 0);
  }

  get doublePoints(): boolean {
    return this.activeEffects.some(e => e.type === PowerUpType.DoublePoints && e.remaining > 0);
  }

  get magnetPull(): boolean {
    return this.activeEffects.some(e => e.type === PowerUpType.MagnetPull && e.remaining > 0);
  }

  get shield(): boolean {
    return this.activeEffects.some(e => e.type === PowerUpType.Shield && e.remaining > 0);
  }

  getTimeScale(): number {
    return this.timeSlow ? 0.4 : 1.0;
  }

  getPointsMultiplier(): number {
    return this.doublePoints ? 2 : 1;
  }

  private pickType(): PowerUpType {
    const types = Object.values(PowerUpType);
    const weights = types.map(t => POWERUP_CONFIGS[t].spawnChance);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) return types[i];
    }
    return PowerUpType.DoublePoints;
  }

  private createMesh(config: PowerUpConfig): { mesh: Mesh; glow: Mesh; edges: LineSegments } {
    let geo: any;
    switch (config.type) {
      case PowerUpType.TimeSlow:
        geo = new TorusGeometry(0.12, 0.04, 8, 16);
        break;
      case PowerUpType.DoublePoints:
        geo = new OctahedronGeometry(0.14, 0);
        break;
      case PowerUpType.MagnetPull:
        geo = new ConeGeometry(0.1, 0.2, 6);
        break;
      case PowerUpType.Shield:
        geo = new SphereGeometry(0.13, 8, 8);
        break;
    }

    const mat = new MeshStandardMaterial({
      color: config.color, emissive: config.emissive,
      emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.2,
      transparent: true, opacity: 0.9,
    });
    const mesh = new Mesh(geo, mat);

    const glowMat = new MeshBasicMaterial({
      color: config.color, transparent: true, opacity: 0.3,
      blending: AdditiveBlending,
    });
    const glow = new Mesh(new SphereGeometry(0.2, 8, 8), glowMat);

    const edgeGeo = new EdgesGeometry(geo);
    const edgeMat = new LineBasicMaterial({
      color: config.color, transparent: true, opacity: 0.6,
    });
    const edges = new LineSegments(edgeGeo, edgeMat);

    return { mesh, glow, edges };
  }

  spawn(position: Vector3, scene: any): ActivePowerUp {
    const type = this.pickType();
    const config = POWERUP_CONFIGS[type];
    const { mesh, glow, edges } = this.createMesh(config);

    const group = new Group();
    group.add(mesh);
    group.add(glow);
    group.add(edges);
    group.position.copy(position);
    group.position.y += 0.5; // float above pylon
    group.scale.setScalar(0);

    const powerup: ActivePowerUp = {
      group, mesh, glowMesh: glow, edgeLines: edges,
      config, position: position.clone(),
      age: 0, lifetime: 8, alive: true,
      bobPhase: Math.random() * Math.PI * 2,
    };

    this.powerups.push(powerup);
    scene.add(group);
    return powerup;
  }

  collect(powerup: ActivePowerUp, scene: any): PowerUpConfig {
    powerup.alive = false;
    scene.remove(powerup.group);

    // Add or refresh effect
    const existing = this.activeEffects.find(e => e.type === powerup.config.type);
    if (existing) {
      existing.remaining = powerup.config.duration;
      existing.duration = powerup.config.duration;
    } else {
      this.activeEffects.push({
        type: powerup.config.type,
        remaining: powerup.config.duration,
        duration: powerup.config.duration,
      });
    }

    return powerup.config;
  }

  update(dt: number, wave: number, pylonPositions: Vector3[], scene: any, spawnEnabled: boolean): void {
    // Spawn timer
    if (spawnEnabled) {
      this.spawnTimer += dt;
      const interval = Math.max(8, this.spawnInterval - wave * 0.5);
      if (this.spawnTimer >= interval) {
        this.spawnTimer = 0;
        if (Math.random() < this.spawnChance && this.powerups.filter(p => p.alive).length < 2) {
          const idx = Math.floor(Math.random() * pylonPositions.length);
          this.spawn(pylonPositions[idx], scene);
        }
      }
    }

    // Update existing power-ups
    for (const pu of this.powerups) {
      if (!pu.alive) continue;
      pu.age += dt;

      // Pop-in animation
      const popIn = Math.min(1, pu.age * 3);
      const s = easeOutBack(popIn);
      pu.group.scale.setScalar(s);

      // Bob and spin
      pu.group.position.y = pu.position.y + 0.5 + Math.sin(pu.age * 2 + pu.bobPhase) * 0.1;
      pu.mesh.rotation.y += dt * 2;
      pu.edgeLines.rotation.y += dt * 2;
      pu.mesh.rotation.x = Math.sin(pu.age * 1.5) * 0.2;

      // Glow pulse (faster than targets)
      const pulse = 0.2 + 0.2 * Math.sin(pu.age * 6);
      (pu.glowMesh.material as MeshBasicMaterial).opacity = pulse;

      // Emissive pulse
      (pu.mesh.material as MeshStandardMaterial).emissiveIntensity = 0.6 + 0.4 * Math.sin(pu.age * 4);

      // Expire
      if (pu.age >= pu.lifetime) {
        // Fade out last second
        if (pu.age >= pu.lifetime) {
          pu.alive = false;
          scene.remove(pu.group);
        }
      }

      // Blink near expiry
      if (pu.lifetime - pu.age < 2) {
        pu.group.visible = Math.sin(pu.age * 12) > 0;
      }
    }

    // Clean dead
    this.powerups = this.powerups.filter(p => p.alive);

    // Update active effects
    for (const eff of this.activeEffects) {
      eff.remaining -= dt;
    }
    this.activeEffects = this.activeEffects.filter(e => e.remaining > 0);
  }

  clearAll(scene: any): void {
    for (const pu of this.powerups) {
      if (pu.alive) scene.remove(pu.group);
    }
    this.powerups = [];
    this.activeEffects = [];
    this.spawnTimer = 0;
  }

  hasActiveEffect(): boolean {
    return this.activeEffects.length > 0;
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
