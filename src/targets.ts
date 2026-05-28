// Neon Smash VR — Target System (Round 4: moving target patterns)
import {
  Mesh, Group, SphereGeometry, BoxGeometry, ConeGeometry,
  OctahedronGeometry, IcosahedronGeometry, TorusGeometry,
  MeshStandardMaterial, MeshBasicMaterial,
  EdgesGeometry, LineSegments, LineBasicMaterial,
  Vector3, Color, AdditiveBlending,
} from '@iwsdk/core';
import { TargetType, TARGET_CONFIGS, TargetConfig, Difficulty, DIFFICULTY_CONFIGS, GameMode } from './types';
import { MovementConfig, MovementPattern, pickMovementPattern, applyMovement } from './movement';

export interface ActiveTarget {
  group: Group;
  mesh: Mesh;
  glowMesh: Mesh;
  edgeLines: LineSegments;
  pylonIndex: number;
  config: TargetConfig;
  hitsRemaining: number;
  lifetime: number;
  age: number;
  alive: boolean;
  chainIndex?: number; // for chain targets
  spawnAnim: number; // 0-1 for pop-up animation
  movement: MovementConfig; // movement pattern
  basePosition: Vector3; // original pylon position for movement offsets
}

export class TargetSystem {
  targets: ActiveTarget[] = [];
  private spawnTimer = 0;
  private waveTargetCount = 0;
  private waveTargetsSpawned = 0;
  private occupiedPylons = new Set<number>();
  private totalPylons = 15;

  // Boss state
  bossGroup: Group | null = null;
  bossHitZones: { mesh: Mesh; hit: boolean }[] = [];

  getTargetCountForWave(wave: number, mode: GameMode): number {
    switch (mode) {
      case GameMode.Classic: return 5 + wave * 2;
      case GameMode.SpeedRush: return 999;
      case GameMode.Precision: return 30;
      case GameMode.Endless: return 8 + wave * 2;
      case GameMode.BossWave: return 3 + wave; // minions before boss
      default: return 10;
    }
  }

  startWave(wave: number, mode: GameMode): void {
    this.waveTargetCount = this.getTargetCountForWave(wave, mode);
    this.waveTargetsSpawned = 0;
    this.spawnTimer = 0;
  }

  private pickTargetType(difficulty: Difficulty, mode: GameMode): TargetType {
    const diffCfg = DIFFICULTY_CONFIGS[difficulty];
    const types = Object.values(TargetType);
    let weights: number[] = [];

    types.forEach(t => {
      let w = TARGET_CONFIGS[t].spawnChance;
      if (t === TargetType.Bomb) w *= diffCfg.bombChanceMult;
      if (mode === GameMode.Precision && t === TargetType.Bomb) w = 0; // no bombs in precision
      weights.push(w);
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) return types[i];
    }
    return TargetType.Normal;
  }

  private createTargetMesh(config: TargetConfig): { mesh: Mesh; glow: Mesh; edges: LineSegments } {
    let geo: any;
    switch (config.type) {
      case TargetType.Normal:
        geo = new IcosahedronGeometry(0.18 * config.scale, 1);
        break;
      case TargetType.Speed:
        geo = new OctahedronGeometry(0.16 * config.scale, 0);
        break;
      case TargetType.Armored:
        geo = new BoxGeometry(0.3 * config.scale, 0.3 * config.scale, 0.3 * config.scale);
        break;
      case TargetType.Bomb:
        geo = new SphereGeometry(0.2 * config.scale, 12, 12);
        break;
      case TargetType.Golden:
        geo = new OctahedronGeometry(0.17 * config.scale, 0);
        break;
      case TargetType.Chain:
        geo = new ConeGeometry(0.15 * config.scale, 0.3 * config.scale, 6);
        break;
    }

    const mat = new MeshStandardMaterial({
      color: config.color,
      emissive: config.emissive,
      emissiveIntensity: 0.6,
      metalness: 0.5,
      roughness: 0.3,
    });
    const mesh = new Mesh(geo, mat);

    // Glow sphere
    const glowMat = new MeshBasicMaterial({
      color: config.color, transparent: true, opacity: 0.25,
      blending: AdditiveBlending,
    });
    const glow = new Mesh(new SphereGeometry(0.25 * config.scale, 8, 8), glowMat);

    // Wireframe edges
    const edgeGeo = new EdgesGeometry(geo);
    const edgeMat = new LineBasicMaterial({
      color: config.color, transparent: true, opacity: 0.5,
    });
    const edges = new LineSegments(edgeGeo, edgeMat);

    return { mesh, glow, edges };
  }

  spawnTarget(pylonIndex: number, pylonPos: Vector3, config: TargetConfig, chainIndex?: number, wave = 1, diffMult = 1): ActiveTarget {
    const { mesh, glow, edges } = this.createTargetMesh(config);
    const group = new Group();
    group.add(mesh);
    group.add(glow);
    group.add(edges);

    // Position above the pylon
    group.position.copy(pylonPos);
    group.position.y += 0.3; // start low for pop-up anim

    // Pick movement pattern (bombs and chain are always static for fairness)
    let movement: MovementConfig;
    if (config.type === TargetType.Bomb || config.type === TargetType.Chain) {
      movement = { pattern: MovementPattern.Static, speed: 0, amplitude: 0, phase: 0 };
    } else {
      movement = pickMovementPattern(wave, diffMult);
    }

    const basePosition = pylonPos.clone();
    basePosition.y += 0.7; // final pop-up height

    const target: ActiveTarget = {
      group, mesh, glowMesh: glow, edgeLines: edges,
      pylonIndex, config,
      hitsRemaining: config.hitsRequired,
      lifetime: config.lifetime,
      age: 0, alive: true, spawnAnim: 0,
      chainIndex,
      movement,
      basePosition,
    };

    this.targets.push(target);
    this.occupiedPylons.add(pylonIndex);
    return target;
  }

  update(dt: number, difficulty: Difficulty, mode: GameMode, wave: number,
         pylonPositions: Vector3[], scene: any, spawnEnabled: boolean): void {
    const diffCfg = DIFFICULTY_CONFIGS[difficulty];

    // Spawn new targets
    if (spawnEnabled && this.waveTargetsSpawned < this.waveTargetCount) {
      this.spawnTimer += dt;
      const interval = diffCfg.spawnInterval / (1 + wave * 0.05);
      if (this.spawnTimer >= interval) {
        this.spawnTimer = 0;
        const activeCount = this.targets.filter(t => t.alive).length;
        if (activeCount < diffCfg.maxActiveTargets) {
          // Find unoccupied pylon
          const available: number[] = [];
          for (let i = 0; i < this.totalPylons; i++) {
            if (!this.occupiedPylons.has(i)) available.push(i);
          }
          if (available.length > 0) {
            const idx = available[Math.floor(Math.random() * available.length)];
            const type = this.pickTargetType(difficulty, mode);
            const config = { ...TARGET_CONFIGS[type] };
            config.lifetime *= diffCfg.targetLifetimeMult;
            const target = this.spawnTarget(idx, pylonPositions[idx], config, undefined, wave, DIFFICULTY_CONFIGS[difficulty].speedMult);
            scene.add(target.group);
            this.waveTargetsSpawned++;
          }
        }
      }
    }

    // Update existing targets
    for (const target of this.targets) {
      if (!target.alive) continue;

      target.age += dt;

      // Pop-up animation
      if (target.spawnAnim < 1) {
        target.spawnAnim = Math.min(1, target.spawnAnim + dt * 4);
        const s = easeOutBack(target.spawnAnim);
        target.group.scale.setScalar(s);
        const pylonPos = pylonPositions[target.pylonIndex];
        target.group.position.y = pylonPos.y + 0.3 + s * 0.4;
      } else if (target.movement.pattern !== MovementPattern.Static) {
        // Apply movement pattern after spawn animation completes
        applyMovement(target.basePosition, target.movement, target.age, target.group.position);
      }

      // Rotation
      target.mesh.rotation.y += dt * 1.5;
      target.edgeLines.rotation.y += dt * 1.5;

      // Glow pulse
      const pulse = 0.2 + 0.1 * Math.sin(target.age * 4);
      (target.glowMesh.material as MeshBasicMaterial).opacity = pulse;

      // Bomb pulse (faster, more dramatic)
      if (target.config.type === TargetType.Bomb) {
        const bombPulse = 0.4 + 0.3 * Math.sin(target.age * 8);
        (target.mesh.material as MeshStandardMaterial).emissiveIntensity = bombPulse;
        target.mesh.scale.setScalar(1 + 0.05 * Math.sin(target.age * 6));
      }

      // Golden sparkle
      if (target.config.type === TargetType.Golden) {
        (target.mesh.material as MeshStandardMaterial).emissiveIntensity = 0.5 + 0.3 * Math.sin(target.age * 5);
      }

      // Lifetime expiry
      if (target.age >= target.lifetime) {
        this.removeTarget(target, scene);
      }
    }

    // Clean dead targets
    this.targets = this.targets.filter(t => t.alive);
  }

  removeTarget(target: ActiveTarget, scene: any): void {
    target.alive = false;
    this.occupiedPylons.delete(target.pylonIndex);
    scene.remove(target.group);
  }

  hitTarget(target: ActiveTarget, scene: any): boolean {
    target.hitsRemaining--;
    if (target.hitsRemaining <= 0) {
      this.removeTarget(target, scene);
      return true; // destroyed
    }
    // Flash on armored hit
    const mat = target.mesh.material as MeshStandardMaterial;
    mat.emissiveIntensity = 1.5;
    setTimeout(() => { mat.emissiveIntensity = 0.6; }, 100);
    return false;
  }

  isWaveComplete(): boolean {
    return this.waveTargetsSpawned >= this.waveTargetCount && this.targets.filter(t => t.alive).length === 0;
  }

  getRemainingInWave(): number {
    return this.waveTargetCount - this.waveTargetsSpawned + this.targets.filter(t => t.alive).length;
  }

  clearAll(scene: any): void {
    this.targets.forEach(t => {
      if (t.alive) {
        t.alive = false;
        scene.remove(t.group);
      }
    });
    this.targets = [];
    this.occupiedPylons.clear();
    this.spawnTimer = 0;
    this.waveTargetsSpawned = 0;
  }

  // === Boss Target ===
  spawnBoss(scene: any, wave: number): void {
    this.bossGroup = new Group();
    this.bossHitZones = [];

    const hp = 3 + wave * 2;
    const bossSize = 1.2 + wave * 0.15;

    // Central body
    const bodyGeo = new IcosahedronGeometry(bossSize * 0.5, 2);
    const bodyMat = new MeshStandardMaterial({
      color: 0xff00ff, emissive: 0xaa00aa, emissiveIntensity: 0.5,
      metalness: 0.7, roughness: 0.2,
    });
    const body = new Mesh(bodyGeo, bodyMat);
    this.bossGroup.add(body);

    // Hit zones (floating weak points)
    const zoneCount = Math.min(hp, 6);
    for (let i = 0; i < zoneCount; i++) {
      const angle = (i / zoneCount) * Math.PI * 2;
      const r = bossSize * 0.7;
      const zoneGeo = new OctahedronGeometry(0.15, 0);
      const zoneMat = new MeshStandardMaterial({
        color: 0x00ffff, emissive: 0x00aaaa, emissiveIntensity: 0.8,
        metalness: 0.3, roughness: 0.4,
      });
      const zone = new Mesh(zoneGeo, zoneMat);
      zone.position.set(Math.sin(angle) * r, Math.cos(angle) * r * 0.5, 0);
      this.bossGroup.add(zone);
      this.bossHitZones.push({ mesh: zone, hit: false });
    }

    // Edges
    const edgeGeo = new EdgesGeometry(bodyGeo);
    const edgeMat = new LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4 });
    const edges = new LineSegments(edgeGeo, edgeMat);
    this.bossGroup.add(edges);

    this.bossGroup.position.set(0, 1.8, -4);
    scene.add(this.bossGroup);
  }

  updateBoss(dt: number, t: number): void {
    if (!this.bossGroup) return;
    // Slow rotation
    this.bossGroup.rotation.y += dt * 0.5;
    // Bob
    this.bossGroup.position.y = 1.8 + Math.sin(t * 0.8) * 0.3;
    // Hit zones orbit
    this.bossHitZones.forEach((z, i) => {
      if (z.hit) return;
      const angle = t * 1.2 + (i / this.bossHitZones.length) * Math.PI * 2;
      const r = 0.7;
      z.mesh.position.x = Math.sin(angle) * r;
      z.mesh.position.y = Math.cos(angle) * r * 0.5;
      z.mesh.rotation.y += dt * 3;
    });
  }

  hitBossZone(zoneIdx: number, scene: any): boolean {
    if (zoneIdx >= this.bossHitZones.length) return false;
    const zone = this.bossHitZones[zoneIdx];
    if (zone.hit) return false;
    zone.hit = true;
    zone.mesh.visible = false;

    // Check if all zones are hit
    const allHit = this.bossHitZones.every(z => z.hit);
    if (allHit && this.bossGroup) {
      scene.remove(this.bossGroup);
      this.bossGroup = null;
      this.bossHitZones = [];
      return true; // boss defeated
    }
    return false;
  }

  removeBoss(scene: any): void {
    if (this.bossGroup) {
      scene.remove(this.bossGroup);
      this.bossGroup = null;
      this.bossHitZones = [];
    }
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
