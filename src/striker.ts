// Neon Smash VR — Striker (weapon) visuals with trail effects
import {
  Group, Mesh, CylinderGeometry, SphereGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial,
  BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Line,
  Vector3, Color, AdditiveBlending,
} from '@iwsdk/core';

export enum StrikerSkin {
  Neon = 'neon',
  Flame = 'flame',
  Ice = 'ice',
  Void = 'void',
  Lightning = 'lightning',
}

export interface StrikerSkinConfig {
  name: string;
  handleColor: number;
  headColor: number;
  emissive: number;
  trailColor: number;
  glowColor: number;
}

export const STRIKER_SKINS: Record<StrikerSkin, StrikerSkinConfig> = {
  [StrikerSkin.Neon]: {
    name: 'Neon', handleColor: 0x222244, headColor: 0x00ffff,
    emissive: 0x00aaff, trailColor: 0x00ccff, glowColor: 0x00ffff,
  },
  [StrikerSkin.Flame]: {
    name: 'Flame', handleColor: 0x442200, headColor: 0xff4400,
    emissive: 0xff2200, trailColor: 0xff6600, glowColor: 0xff8800,
  },
  [StrikerSkin.Ice]: {
    name: 'Ice', handleColor: 0x112244, headColor: 0x88ccff,
    emissive: 0x4488cc, trailColor: 0x66aaff, glowColor: 0xaaddff,
  },
  [StrikerSkin.Void]: {
    name: 'Void', handleColor: 0x110022, headColor: 0xaa00ff,
    emissive: 0x6600aa, trailColor: 0x8800ff, glowColor: 0xcc44ff,
  },
  [StrikerSkin.Lightning]: {
    name: 'Lightning', handleColor: 0x333300, headColor: 0xffff00,
    emissive: 0xcccc00, trailColor: 0xffff44, glowColor: 0xffffaa,
  },
};

const TRAIL_LENGTH = 20;

export class Striker {
  group = new Group();
  private handle: Mesh;
  private head: Mesh;
  private glow: Mesh;
  private trailLine: Line;
  private trailPositions: Vector3[] = [];
  private trailGeo: BufferGeometry;
  private skin: StrikerSkinConfig;
  private prevPos = new Vector3();
  private swingSpeed = 0;

  constructor(skin: StrikerSkin = StrikerSkin.Neon) {
    this.skin = STRIKER_SKINS[skin];

    // Handle
    const handleMat = new MeshStandardMaterial({
      color: this.skin.handleColor, metalness: 0.9, roughness: 0.2,
    });
    this.handle = new Mesh(new CylinderGeometry(0.012, 0.015, 0.2, 8), handleMat);
    this.handle.rotation.x = Math.PI / 6; // angled forward
    this.group.add(this.handle);

    // Head (mallet shape)
    const headMat = new MeshStandardMaterial({
      color: this.skin.headColor, emissive: this.skin.emissive,
      emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3,
    });
    this.head = new Mesh(new SphereGeometry(0.04, 12, 12), headMat);
    this.head.position.y = 0.12;
    this.group.add(this.head);

    // Glow
    const glowMat = new MeshBasicMaterial({
      color: this.skin.glowColor, transparent: true, opacity: 0.25,
      blending: AdditiveBlending,
    });
    this.glow = new Mesh(new SphereGeometry(0.06, 8, 8), glowMat);
    this.glow.position.y = 0.12;
    this.group.add(this.glow);

    // Trail
    this.trailGeo = new BufferGeometry();
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    this.trailGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const trailMat = new LineBasicMaterial({
      color: this.skin.trailColor, transparent: true, opacity: 0.6,
      blending: AdditiveBlending,
    });
    this.trailLine = new Line(this.trailGeo, trailMat);
    this.trailLine.frustumCulled = false;
    this.group.add(this.trailLine);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      this.trailPositions.push(new Vector3());
    }
  }

  setSkin(skin: StrikerSkin): void {
    this.skin = STRIKER_SKINS[skin];
    (this.handle.material as MeshStandardMaterial).color.setHex(this.skin.handleColor);
    (this.head.material as MeshStandardMaterial).color.setHex(this.skin.headColor);
    (this.head.material as MeshStandardMaterial).emissive.setHex(this.skin.emissive);
    (this.glow.material as MeshBasicMaterial).color.setHex(this.skin.glowColor);
    (this.trailLine.material as LineBasicMaterial).color.setHex(this.skin.trailColor);
  }

  update(dt: number): void {
    // Get world position of head
    const worldPos = new Vector3();
    this.head.getWorldPosition(worldPos);

    // Calculate swing speed
    this.swingSpeed = worldPos.distanceTo(this.prevPos) / Math.max(dt, 0.001);
    this.prevPos.copy(worldPos);

    // Update trail
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      this.trailPositions[i].copy(this.trailPositions[i - 1]);
    }
    this.trailPositions[0].copy(worldPos);

    const posAttr = this.trailGeo.getAttribute('position') as any;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      posAttr.setXYZ(i, this.trailPositions[i].x, this.trailPositions[i].y, this.trailPositions[i].z);
    }
    posAttr.needsUpdate = true;

    // Trail opacity based on swing speed
    const trailOpacity = Math.min(0.8, this.swingSpeed * 0.15);
    (this.trailLine.material as LineBasicMaterial).opacity = trailOpacity;

    // Glow pulse based on swing speed
    const glowIntensity = 0.15 + Math.min(0.5, this.swingSpeed * 0.08);
    (this.glow.material as MeshBasicMaterial).opacity = glowIntensity;

    // Head emissive based on speed
    (this.head.material as MeshStandardMaterial).emissiveIntensity = 0.5 + Math.min(1.0, this.swingSpeed * 0.1);
  }

  getSwingSpeed(): number {
    return this.swingSpeed;
  }
}

export class DualStrikers {
  left: Striker;
  right: Striker;

  constructor(skin: StrikerSkin = StrikerSkin.Neon) {
    this.left = new Striker(skin);
    this.right = new Striker(skin);
  }

  setSkin(skin: StrikerSkin): void {
    this.left.setSkin(skin);
    this.right.setSkin(skin);
  }

  update(dt: number): void {
    this.left.update(dt);
    this.right.update(dt);
  }
}
