// Neon Smash VR — Particle effects
import {
  Mesh, SphereGeometry, MeshBasicMaterial,
  Vector3, AdditiveBlending, Group,
} from '@iwsdk/core';

interface Particle {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private maxParticles = 120;
  group = new Group();

  constructor() {
    // Pre-allocate pool
    for (let i = 0; i < this.maxParticles; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(new SphereGeometry(0.02, 4, 4), mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({
        mesh, velocity: new Vector3(), life: 0, maxLife: 0, active: false,
      });
    }
  }

  private acquire(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    // Recycle oldest
    let oldest: Particle | null = null;
    let maxAge = -1;
    for (const p of this.pool) {
      if (p.life > maxAge) { maxAge = p.life; oldest = p; }
    }
    return oldest;
  }

  burst(position: Vector3, color: number, count: number, speed = 3, lifetime = 0.5): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) return;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.copy(position);
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + speed * 0.2,
        (Math.random() - 0.5) * speed,
      );
      p.life = 0;
      p.maxLife = lifetime + Math.random() * lifetime * 0.5;
      (p.mesh.material as MeshBasicMaterial).color.setHex(color);
      (p.mesh.material as MeshBasicMaterial).opacity = 1;
      p.mesh.scale.setScalar(0.8 + Math.random() * 0.5);
    }
  }

  ring(position: Vector3, color: number, count: number, radius = 0.5): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      if (!p) return;
      const angle = (i / count) * Math.PI * 2;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.copy(position);
      p.velocity.set(Math.cos(angle) * 2, 0.5, Math.sin(angle) * 2);
      p.life = 0;
      p.maxLife = 0.6;
      (p.mesh.material as MeshBasicMaterial).color.setHex(color);
      (p.mesh.material as MeshBasicMaterial).opacity = 1;
      p.mesh.scale.setScalar(1);
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      // Move
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;
      // Gravity
      p.velocity.y -= 6 * dt;
      // Fade
      const t = p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = 1 - t;
      p.mesh.scale.setScalar((1 - t * 0.5) * (0.8 + Math.random() * 0.1));
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }
}
