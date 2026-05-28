// Neon Smash VR — Arena environment
import {
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry,
  PlaneGeometry, TorusGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial,
  EdgesGeometry, LineSegments, LineBasicMaterial,
  Color, Vector3, Fog, AmbientLight, PointLight,
  AdditiveBlending, DoubleSide,
} from '@iwsdk/core';
import { ArenaTheme, ARENA_THEMES, getPylonPositions } from './types';

export class Arena {
  group = new Group();
  pylons: Group[] = [];
  pylonGlows: Mesh[] = [];
  decorations: Mesh[] = [];
  ambientParticles: Mesh[] = [];
  private theme: ArenaTheme;

  constructor(themeIdx = 0) {
    this.theme = ARENA_THEMES[themeIdx] || ARENA_THEMES[0];
  }

  build(scene: any): void {
    this.buildFloor();
    this.buildCeiling();
    this.buildPylons();
    this.buildDecorations();
    this.buildAmbientParticles();
    this.buildLighting();
    scene.add(this.group);
    scene.fog = new Fog(this.theme.fogColor, 2, 25);
  }

  private buildFloor(): void {
    const geo = new PlaneGeometry(30, 30);
    const mat = new MeshStandardMaterial({
      color: 0x000000, emissive: this.theme.gridColor, emissiveIntensity: 0.05,
      transparent: true, opacity: 0.8,
    });
    const floor = new Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.group.add(floor);

    // Grid lines
    for (let i = -15; i <= 15; i++) {
      const lineGeo = new BoxGeometry(0.01, 0.005, 30);
      const lineMat = new MeshBasicMaterial({
        color: this.theme.gridColor, transparent: true, opacity: 0.15,
      });
      const line = new Mesh(lineGeo, lineMat);
      line.position.set(i, 0.001, 0);
      this.group.add(line);

      const line2 = new Mesh(lineGeo.clone(), lineMat.clone());
      line2.rotation.y = Math.PI / 2;
      line2.position.set(0, 0.001, i);
      this.group.add(line2);
    }
  }

  private buildCeiling(): void {
    const geo = new PlaneGeometry(30, 30);
    const mat = new MeshStandardMaterial({
      color: 0x000000, emissive: this.theme.gridColor, emissiveIntensity: 0.03,
      transparent: true, opacity: 0.5, side: DoubleSide,
    });
    const ceiling = new Mesh(geo, mat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    this.group.add(ceiling);
  }

  private buildPylons(): void {
    const positions = getPylonPositions();
    positions.forEach((pos) => {
      const pylon = new Group();

      // Base cylinder
      const baseMat = new MeshStandardMaterial({
        color: this.theme.pylonColor, emissive: this.theme.accentColor, emissiveIntensity: 0.2,
        metalness: 0.8, roughness: 0.3,
      });
      const base = new Mesh(new CylinderGeometry(0.15, 0.18, 0.5, 8), baseMat);
      base.position.y = 0.25;
      pylon.add(base);

      // Top ring
      const ringMat = new MeshStandardMaterial({
        color: this.theme.accentColor, emissive: this.theme.accentColor, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.8,
      });
      const ring = new Mesh(new TorusGeometry(0.2, 0.02, 8, 16), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.52;
      pylon.add(ring);

      // Glow indicator (pulsing when active)
      const glowMat = new MeshBasicMaterial({
        color: this.theme.accentColor, transparent: true, opacity: 0.3,
      });
      const glow = new Mesh(new SphereGeometry(0.12, 8, 8), glowMat);
      glow.position.y = 0.6;
      glow.visible = false;
      pylon.add(glow);
      this.pylonGlows.push(glow);

      pylon.position.copy(pos);
      this.pylons.push(pylon);
      this.group.add(pylon);
    });
  }

  private buildDecorations(): void {
    const geometries = [
      new TorusGeometry(0.3, 0.05, 8, 12),
      new BoxGeometry(0.4, 0.4, 0.4),
      new SphereGeometry(0.25, 8, 8),
      new ConeGeometry(0.2, 0.5, 6),
    ];

    for (let i = 0; i < 14; i++) {
      const geo = geometries[i % geometries.length];
      const edges = new EdgesGeometry(geo);
      const mat = new LineBasicMaterial({
        color: this.theme.accentColor, transparent: true, opacity: 0.2,
      });
      const deco = new LineSegments(edges, mat) as any;
      const angle = (i / 14) * Math.PI * 2;
      const r = 8 + Math.random() * 4;
      deco.position.set(Math.sin(angle) * r, 1.5 + Math.random() * 2, Math.cos(angle) * r);
      deco.userData = { rotSpeed: 0.2 + Math.random() * 0.3, bobSpeed: 0.3 + Math.random() * 0.4, bobAmp: 0.1 + Math.random() * 0.2, baseY: deco.position.y };
      this.decorations.push(deco);
      this.group.add(deco);
    }
  }

  private buildAmbientParticles(): void {
    const mat = new MeshBasicMaterial({
      color: this.theme.accentColor, transparent: true, opacity: 0.3,
      blending: AdditiveBlending,
    });
    for (let i = 0; i < 50; i++) {
      const p = new Mesh(new SphereGeometry(0.015, 4, 4), mat.clone());
      p.position.set(
        (Math.random() - 0.5) * 16,
        Math.random() * 3.5 + 0.3,
        (Math.random() - 0.5) * 16,
      );
      (p as any).userData = { driftX: (Math.random() - 0.5) * 0.1, driftY: Math.random() * 0.05, phase: Math.random() * Math.PI * 2 };
      this.ambientParticles.push(p);
      this.group.add(p);
    }
  }

  private buildLighting(): void {
    const ambient = new AmbientLight(this.theme.ambientColor, 0.4);
    this.group.add(ambient as any);

    // Accent lights around arena
    const colors = [this.theme.accentColor, this.theme.gridColor, 0xffffff];
    colors.forEach((c, i) => {
      const light = new PointLight(c, 1.5, 15);
      const angle = (i / colors.length) * Math.PI * 2;
      light.position.set(Math.sin(angle) * 5, 3, Math.cos(angle) * 5);
      this.group.add(light as any);
    });

    // Overhead spot
    const overhead = new PointLight(0xffffff, 0.8, 12);
    overhead.position.set(0, 3.8, -2);
    this.group.add(overhead as any);
  }

  update(t: number): void {
    // Animate decorations
    this.decorations.forEach((d) => {
      const ud = (d as any).userData;
      d.rotation.y += ud.rotSpeed * 0.01;
      d.rotation.x += ud.rotSpeed * 0.005;
      d.position.y = ud.baseY + Math.sin(t * ud.bobSpeed + ud.phase) * ud.bobAmp;
    });

    // Animate ambient particles
    this.ambientParticles.forEach((p) => {
      const ud = (p as any).userData;
      p.position.x += ud.driftX * 0.01;
      p.position.y += ud.driftY * 0.01;
      (p.material as MeshBasicMaterial).opacity = 0.15 + 0.15 * Math.sin(t * 1.5 + ud.phase);
      if (p.position.y > 4) p.position.y = 0.2;
      if (Math.abs(p.position.x) > 10) ud.driftX *= -1;
    });
  }

  setTheme(idx: number, scene: any): void {
    this.theme = ARENA_THEMES[idx] || ARENA_THEMES[0];
    if (scene.fog) {
      (scene.fog as Fog).color.setHex(this.theme.fogColor);
    }
  }

  getPylonWorldPosition(index: number): Vector3 {
    if (index >= this.pylons.length) return new Vector3();
    const pos = new Vector3();
    this.pylons[index].getWorldPosition(pos);
    return pos;
  }
}
