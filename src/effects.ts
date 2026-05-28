// Neon Smash VR — Visual effects (shatter, combo, wave announcements)
import {
  Group, Mesh, Vector3, Color,
  BoxGeometry, SphereGeometry, ConeGeometry, PlaneGeometry,
  MeshStandardMaterial, MeshBasicMaterial,
  AdditiveBlending,
} from '@iwsdk/core';

// === Shatter Effect ===
interface ShatterFragment {
  mesh: Mesh;
  velocity: Vector3;
  angularVel: Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ShatterSystem {
  private fragments: ShatterFragment[] = [];
  private pool: ShatterFragment[] = [];
  group = new Group();

  constructor() {
    // Pre-allocate fragment pool
    const geos = [
      new BoxGeometry(0.03, 0.03, 0.01),
      new BoxGeometry(0.02, 0.04, 0.01),
      new BoxGeometry(0.04, 0.02, 0.015),
      new ConeGeometry(0.02, 0.04, 3),
    ];

    for (let i = 0; i < 80; i++) {
      const geo = geos[i % geos.length];
      const mat = new MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5,
        metalness: 0.6, roughness: 0.3,
        transparent: true, opacity: 1,
      });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({
        mesh, velocity: new Vector3(), angularVel: new Vector3(),
        life: 0, maxLife: 0, active: false,
      });
    }
  }

  private acquire(): ShatterFragment | null {
    for (const f of this.pool) {
      if (!f.active) return f;
    }
    // Recycle oldest
    let oldest: ShatterFragment | null = null;
    let maxAge = -1;
    for (const f of this.pool) {
      if (f.life > maxAge) { maxAge = f.life; oldest = f; }
    }
    return oldest;
  }

  shatter(position: Vector3, color: number, count = 10, intensity = 1.0): void {
    for (let i = 0; i < count; i++) {
      const f = this.acquire();
      if (!f) return;
      f.active = true;
      f.mesh.visible = true;
      f.mesh.position.copy(position);
      f.mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );

      const speed = 2 + Math.random() * 4 * intensity;
      f.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.6 + speed * 0.3,
        (Math.random() - 0.5) * speed,
      );
      f.angularVel.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      );
      f.life = 0;
      f.maxLife = 0.5 + Math.random() * 0.5 * intensity;

      const mat = f.mesh.material as MeshStandardMaterial;
      mat.color.setHex(color);
      mat.emissive.setHex(color);
      mat.opacity = 1;
    }
  }

  update(dt: number): void {
    for (const f of this.pool) {
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.maxLife) {
        f.active = false;
        f.mesh.visible = false;
        continue;
      }

      // Movement
      f.mesh.position.x += f.velocity.x * dt;
      f.mesh.position.y += f.velocity.y * dt;
      f.mesh.position.z += f.velocity.z * dt;
      f.velocity.y -= 8 * dt; // gravity

      // Rotation
      f.mesh.rotation.x += f.angularVel.x * dt;
      f.mesh.rotation.y += f.angularVel.y * dt;
      f.mesh.rotation.z += f.angularVel.z * dt;

      // Fade + shrink
      const t = f.life / f.maxLife;
      const mat = f.mesh.material as MeshStandardMaterial;
      mat.opacity = 1 - t;
      mat.emissiveIntensity = 0.5 * (1 - t);
      f.mesh.scale.setScalar(1 - t * 0.6);
    }
  }

  clear(): void {
    for (const f of this.pool) {
      f.active = false;
      f.mesh.visible = false;
    }
  }
}

// === Combo Flash ===
export class ComboFlash {
  private flashMeshes: Mesh[] = [];
  group = new Group();
  private flashTimer = 0;
  private flashActive = false;
  private flashColor = 0xffffff;

  constructor() {
    // Screen-border flash indicators (4 edges)
    const edgeGeo = new PlaneGeometry(0.5, 0.01);
    for (let i = 0; i < 4; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: AdditiveBlending, side: 2,
      });
      const mesh = new Mesh(edgeGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.flashMeshes.push(mesh);
    }
    // Position edges around a virtual rect
    this.flashMeshes[0].position.set(0, 0.15, -0.5);  // top
    this.flashMeshes[1].position.set(0, -0.15, -0.5); // bottom
    this.flashMeshes[2].position.set(-0.2, 0, -0.5);  // left
    this.flashMeshes[2].rotation.z = Math.PI / 2;
    this.flashMeshes[3].position.set(0.2, 0, -0.5);   // right
    this.flashMeshes[3].rotation.z = Math.PI / 2;
  }

  trigger(combo: number): void {
    this.flashActive = true;
    this.flashTimer = 0;

    if (combo >= 25) this.flashColor = 0xff00ff;
    else if (combo >= 15) this.flashColor = 0xff4400;
    else if (combo >= 10) this.flashColor = 0xffff00;
    else this.flashColor = 0x00ffff;

    for (const mesh of this.flashMeshes) {
      mesh.visible = true;
      (mesh.material as MeshBasicMaterial).color.setHex(this.flashColor);
    }
  }

  update(dt: number): void {
    if (!this.flashActive) return;
    this.flashTimer += dt;
    const duration = 0.3;
    if (this.flashTimer >= duration) {
      this.flashActive = false;
      for (const mesh of this.flashMeshes) {
        mesh.visible = false;
      }
      return;
    }
    const t = this.flashTimer / duration;
    const opacity = 0.6 * (1 - t);
    for (const mesh of this.flashMeshes) {
      (mesh.material as MeshBasicMaterial).opacity = opacity;
    }
  }
}

// === Screen Shake Effect (camera offset) ===
export class ScreenShake {
  offset = new Vector3();
  private intensity = 0;
  private decay = 8;
  private time = 0;

  trigger(intensity = 0.02): void {
    this.intensity = intensity;
    this.time = 0;
  }

  update(dt: number): void {
    if (this.intensity <= 0.001) {
      this.offset.set(0, 0, 0);
      return;
    }
    this.time += dt;
    this.intensity *= Math.exp(-this.decay * dt);
    this.offset.set(
      (Math.random() - 0.5) * this.intensity * 2,
      (Math.random() - 0.5) * this.intensity * 2,
      0,
    );
  }
}
