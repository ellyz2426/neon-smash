// Neon Smash VR — Main Entry Point
import {
  World, PanelUI, Follower, FollowBehavior, ScreenSpace,
  PanelDocument, Vector3, Raycaster, Vector2,
  InputComponent,
} from '@iwsdk/core';
import type { UIKitDocument } from '@iwsdk/core';
import {
  GameState, GameMode, Difficulty, MODE_NAMES,
  GameStateManager, ARENA_THEMES,
  ACHIEVEMENTS, loadAchievements, saveAchievement,
  loadLeaderboard, addToLeaderboard,
  loadSettings, saveSettings,
  getPylonPositions,
} from './types';
import { AudioManager } from './audio';
import { Arena } from './arena';
import { TargetSystem, ActiveTarget } from './targets';
import { ParticleSystem } from './particles';

// === Globals ===
let world: World;
let state: GameState = 'title';
let gsm = new GameStateManager();
let audio = new AudioManager();
let arena: Arena;
let targetSystem: TargetSystem;
let particles: ParticleSystem;
let settings = loadSettings();

// UI entities
const uiEntities: Record<string, any> = {};
let uiSetup = false;

// Timing
let gameTime = 0;
let countdownValue = 3;
let countdownTimer = 0;
let waveTransition = false;
let waveTransitionTimer = 0;

// Raycaster for browser aiming
const raycaster = new Raycaster();
const pointer = new Vector2();

// Pylon world positions cache
let pylonPositions: Vector3[] = [];

// === Entry Point ===
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;

  world = await World.create(container, {
    xr: { offer: 'once' as any },
    input: { canvasPointerEvents: true },
    features: {
      grabbing: false,
      locomotion: false,
      physics: false,
      spatialUI: true,
    },
    render: {
      near: 0.01,
      far: 200,
      camera: { position: [0, 1.6, 0], lookAt: [0, 1.55, -3] },
    },
  } as any);

  audio.init();

  // Build arena
  arena = new Arena(settings.theme);
  arena.build(world.scene);

  // Cache pylon positions
  pylonPositions = getPylonPositions();

  // Target system
  targetSystem = new TargetSystem();

  // Particles
  particles = new ParticleSystem();
  world.scene.add(particles.group);

  // Setup UI
  setupUI();

  // Input
  setupBrowserInput(container);

  // Game loop
  const clock = { last: performance.now() };
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - clock.last) / 1000, 0.1);
    clock.last = now;
    gameTime += dt;
    update(dt, gameTime);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// === UI Setup ===
function setupUI() {
  if (uiSetup) return;
  uiSetup = true;

  const panels: { id: string; config: string; maxW: number; maxH: number; mode: 'world' | 'follower' | 'screen' }[] = [
    { id: 'title', config: '/ui/title.json', maxW: 1.0, maxH: 0.7, mode: 'world' },
    { id: 'modeselect', config: '/ui/modeselect.json', maxW: 1.0, maxH: 0.9, mode: 'world' },
    { id: 'difficulty', config: '/ui/difficulty.json', maxW: 0.7, maxH: 0.6, mode: 'world' },
    { id: 'hud', config: '/ui/hud.json', maxW: 0.35, maxH: 0.18, mode: 'follower' },
    { id: 'pause', config: '/ui/pause.json', maxW: 0.6, maxH: 0.4, mode: 'world' },
    { id: 'gameover', config: '/ui/gameover.json', maxW: 0.8, maxH: 0.7, mode: 'world' },
    { id: 'leaderboard', config: '/ui/leaderboard.json', maxW: 0.8, maxH: 0.8, mode: 'world' },
    { id: 'achievements', config: '/ui/achievements.json', maxW: 0.8, maxH: 0.8, mode: 'world' },
    { id: 'settings', config: '/ui/settings.json', maxW: 0.7, maxH: 0.6, mode: 'world' },
    { id: 'help', config: '/ui/help.json', maxW: 0.8, maxH: 0.8, mode: 'world' },
    { id: 'toast', config: '/ui/toast.json', maxW: 0.3, maxH: 0.08, mode: 'follower' },
    { id: 'countdown', config: '/ui/countdown.json', maxW: 0.3, maxH: 0.15, mode: 'follower' },
  ];

  panels.forEach(p => {
    const entity = world.createTransformEntity(undefined, { persistent: true });
    entity.addComponent(PanelUI, { config: p.config, maxWidth: p.maxW, maxHeight: p.maxH });

    if (p.mode === 'world') {
      entity.object3D!.position.set(0, 1.5, -2);
    } else if (p.mode === 'follower') {
      const offY = p.id === 'hud' ? 0.12 : (p.id === 'countdown' ? 0 : -0.12);
      const offX = p.id === 'hud' ? 0.22 : 0;
      entity.addComponent(Follower, {
        target: world.player.head,
        offsetPosition: [offX, offY, -0.5],
        behavior: FollowBehavior.PivotY,
        speed: 5,
        tolerance: 0.3,
      });
    }

    entity.object3D!.visible = false;
    uiEntities[p.id] = entity;
  });

  // Bind events once docs are available
  setTimeout(() => bindUIEvents(), 500);
  setTimeout(() => bindUIEvents(), 1500); // retry
  showUI('title');
}

function getDoc(id: string): UIKitDocument | null {
  const entity = uiEntities[id];
  if (!entity) return null;
  return entity.getValue(PanelDocument, 'document') as UIKitDocument | null;
}

function setText(doc: UIKitDocument | null, elId: string, text: string): void {
  if (!doc) return;
  const el = doc.getElementById(elId) as any;
  if (el && el.text) el.text.value = text;
}

function showUI(...ids: string[]) {
  Object.entries(uiEntities).forEach(([key, entity]) => {
    entity.object3D!.visible = ids.includes(key);
  });
}

let eventsBound = false;
function bindUIEvents() {
  if (eventsBound) return;

  // Title
  const titleDoc = getDoc('title');
  if (!titleDoc) return; // not ready yet
  eventsBound = true;

  bindBtn(titleDoc, 'btn-play', () => { audio.playButtonClick(); changeState('modeselect'); });
  bindBtn(titleDoc, 'btn-leaderboard', () => { audio.playButtonClick(); populateLeaderboard(); changeState('leaderboard'); });
  bindBtn(titleDoc, 'btn-achievements', () => { audio.playButtonClick(); populateAchievements(); changeState('achievements'); });
  bindBtn(titleDoc, 'btn-settings', () => { audio.playButtonClick(); populateSettings(); changeState('settings'); });
  bindBtn(titleDoc, 'btn-help', () => { audio.playButtonClick(); changeState('help'); });

  // Mode select
  const modeDoc = getDoc('modeselect');
  if (modeDoc) {
    bindBtn(modeDoc, 'btn-classic', () => { audio.playButtonClick(); gsm.mode = GameMode.Classic; changeState('difficulty'); });
    bindBtn(modeDoc, 'btn-speedrush', () => { audio.playButtonClick(); gsm.mode = GameMode.SpeedRush; changeState('difficulty'); });
    bindBtn(modeDoc, 'btn-precision', () => { audio.playButtonClick(); gsm.mode = GameMode.Precision; changeState('difficulty'); });
    bindBtn(modeDoc, 'btn-endless', () => { audio.playButtonClick(); gsm.mode = GameMode.Endless; changeState('difficulty'); });
    bindBtn(modeDoc, 'btn-bosswave', () => { audio.playButtonClick(); gsm.mode = GameMode.BossWave; changeState('difficulty'); });
    bindBtn(modeDoc, 'btn-back-mode', () => { audio.playButtonClick(); changeState('title'); });
  }

  // Difficulty
  const diffDoc = getDoc('difficulty');
  if (diffDoc) {
    bindBtn(diffDoc, 'btn-easy', () => { audio.playButtonClick(); startGame(Difficulty.Easy); });
    bindBtn(diffDoc, 'btn-medium', () => { audio.playButtonClick(); startGame(Difficulty.Medium); });
    bindBtn(diffDoc, 'btn-hard', () => { audio.playButtonClick(); startGame(Difficulty.Hard); });
    bindBtn(diffDoc, 'btn-back-diff', () => { audio.playButtonClick(); changeState('modeselect'); });
  }

  // Pause
  const pauseDoc = getDoc('pause');
  if (pauseDoc) {
    bindBtn(pauseDoc, 'btn-resume', () => { audio.playButtonClick(); changeState('playing'); });
    bindBtn(pauseDoc, 'btn-quit', () => { audio.playButtonClick(); endGame(); });
  }

  // Game Over
  const goDoc = getDoc('gameover');
  if (goDoc) {
    bindBtn(goDoc, 'btn-rematch', () => { audio.playButtonClick(); startGame(gsm.difficulty); });
    bindBtn(goDoc, 'btn-title', () => { audio.playButtonClick(); changeState('title'); });
  }

  // Back buttons
  ['leaderboard', 'achievements', 'settings', 'help'].forEach(id => {
    const doc = getDoc(id);
    if (doc) bindBtn(doc, `btn-back-${id}`, () => { audio.playButtonClick(); changeState('title'); });
  });

  // Settings volume
  const setDoc = getDoc('settings');
  if (setDoc) {
    bindBtn(setDoc, 'btn-master-up', () => { settings.masterVolume = Math.min(1, settings.masterVolume + 0.1); audio.setMasterVolume(settings.masterVolume); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-master-down', () => { settings.masterVolume = Math.max(0, settings.masterVolume - 0.1); audio.setMasterVolume(settings.masterVolume); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-sfx-up', () => { settings.sfxVolume = Math.min(1, settings.sfxVolume + 0.1); audio.setSfxVolume(settings.sfxVolume); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-sfx-down', () => { settings.sfxVolume = Math.max(0, settings.sfxVolume - 0.1); audio.setSfxVolume(settings.sfxVolume); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-music-up', () => { settings.musicVolume = Math.min(1, settings.musicVolume + 0.1); audio.setMusicVolume(settings.musicVolume); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-music-down', () => { settings.musicVolume = Math.max(0, settings.musicVolume - 0.1); audio.setMusicVolume(settings.musicVolume); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-theme-prev', () => { settings.theme = (settings.theme - 1 + ARENA_THEMES.length) % ARENA_THEMES.length; arena.setTheme(settings.theme, world.scene); saveSettings(settings); populateSettings(); });
    bindBtn(setDoc, 'btn-theme-next', () => { settings.theme = (settings.theme + 1) % ARENA_THEMES.length; arena.setTheme(settings.theme, world.scene); saveSettings(settings); populateSettings(); });
  }
}

function bindBtn(doc: UIKitDocument, id: string, fn: () => void): void {
  const el = doc.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

// === State Changes ===
function changeState(newState: GameState) {
  state = newState;
  switch (newState) {
    case 'title':
      showUI('title');
      targetSystem.clearAll(world.scene);
      targetSystem.removeBoss(world.scene);
      break;
    case 'modeselect':
      showUI('modeselect');
      break;
    case 'difficulty':
      showUI('difficulty');
      break;
    case 'countdown':
      showUI('countdown');
      countdownValue = 3;
      countdownTimer = 0;
      updateCountdown();
      break;
    case 'playing':
      showUI('hud');
      break;
    case 'paused':
      showUI('hud', 'pause');
      break;
    case 'gameover':
      showUI('gameover');
      populateGameOver();
      break;
    case 'leaderboard':
      showUI('leaderboard');
      break;
    case 'achievements':
      showUI('achievements');
      break;
    case 'settings':
      showUI('settings');
      break;
    case 'help':
      showUI('help');
      break;
  }
}

// === Game Flow ===
function startGame(diff: Difficulty) {
  gsm.reset(gsm.mode, diff);
  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  particles.clear();
  gameTime = 0;
  waveTransition = false;
  audio.startMusic();
  targetSystem.startWave(gsm.wave, gsm.mode);
  changeState('countdown');
}

function endGame() {
  audio.stopMusic();
  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  particles.clear();

  // Save leaderboard
  addToLeaderboard({
    score: gsm.score,
    mode: MODE_NAMES[gsm.mode],
    difficulty: gsm.difficulty,
    accuracy: gsm.getAccuracy(),
    maxCombo: gsm.maxCombo,
    date: new Date().toLocaleDateString(),
  });

  // Check achievements
  checkAchievements();

  changeState('title');
}

// === Update Loop ===
function update(dt: number, t: number) {
  arena.update(t);
  particles.update(dt);

  // Handle XR input
  handleXRInput();

  switch (state) {
    case 'countdown':
      updateCountdownState(dt);
      break;
    case 'playing':
      updatePlaying(dt, t);
      break;
  }
}

function updateCountdownState(dt: number) {
  countdownTimer += dt;
  if (countdownTimer >= 1) {
    countdownTimer = 0;
    countdownValue--;
    if (countdownValue <= 0) {
      audio.playGameStart();
      changeState('playing');
      updateHUD();
    } else {
      audio.playCountdown();
      updateCountdown();
    }
  }
}

function updatePlaying(dt: number, t: number) {
  // Time tracking
  gsm.timeElapsed += dt;
  if (gsm.mode === GameMode.SpeedRush) {
    gsm.timeRemaining -= dt;
    if (gsm.timeRemaining <= 0) {
      gsm.timeRemaining = 0;
      gameOver(true);
      return;
    }
  }

  // Boss mode
  if (gsm.mode === GameMode.BossWave && targetSystem.bossGroup) {
    targetSystem.updateBoss(dt, t);
  }

  // Update targets
  const spawnEnabled = !waveTransition && !(gsm.mode === GameMode.BossWave && targetSystem.bossGroup);
  targetSystem.update(dt, gsm.difficulty, gsm.mode, gsm.wave, pylonPositions, world.scene, spawnEnabled);

  // Check for expired targets (misses)
  // Already handled in target system

  // Wave completion check
  if (!waveTransition && targetSystem.isWaveComplete() && !(gsm.mode === GameMode.BossWave && targetSystem.bossGroup)) {
    if (gsm.mode === GameMode.SpeedRush) {
      // Continuous in speed rush
      targetSystem.startWave(gsm.wave, gsm.mode);
    } else if (gsm.mode === GameMode.Precision) {
      gameOver(true);
      return;
    } else {
      // Wave complete
      if (gsm.waveHits === gsm.waveTargets && gsm.waveTargets > 0 && gsm.waveBombsHit === 0) {
        tryAchievement('perfect_wave');
      }

      if (gsm.wave >= gsm.totalWaves && gsm.mode === GameMode.Classic) {
        gameOver(true);
        return;
      }

      // Boss wave: spawn boss after clearing minions
      if (gsm.mode === GameMode.BossWave && !targetSystem.bossGroup) {
        targetSystem.spawnBoss(world.scene, gsm.wave);
        showToast('BOSS INCOMING!');
      } else {
        // Next wave
        waveTransition = true;
        waveTransitionTimer = 0;
        audio.playWaveComplete();
        showToast(`WAVE ${gsm.wave} CLEAR!`);
      }
    }
  }

  // Wave transition timer
  if (waveTransition) {
    waveTransitionTimer += dt;
    if (waveTransitionTimer >= 2) {
      waveTransition = false;
      gsm.wave++;
      gsm.waveTargets = 0;
      gsm.waveHits = 0;
      gsm.waveBombsHit = 0;
      targetSystem.startWave(gsm.wave, gsm.mode);
    }
  }

  updateHUD();
}

function gameOver(completed: boolean) {
  audio.stopMusic();
  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  if (completed) {
    audio.playWinFanfare();
  } else {
    audio.playGameOver();
  }

  addToLeaderboard({
    score: gsm.score,
    mode: MODE_NAMES[gsm.mode],
    difficulty: gsm.difficulty,
    accuracy: gsm.getAccuracy(),
    maxCombo: gsm.maxCombo,
    date: new Date().toLocaleDateString(),
  });

  checkAchievements();
  changeState('gameover');
}

// === Hit Detection (Browser) ===
function setupBrowserInput(container: HTMLDivElement) {
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  });

  container.addEventListener('click', () => {
    if (state !== 'playing') return;
    audio.init();
    performStrike();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state === 'playing') changeState('paused');
      else if (state === 'paused') changeState('playing');
    }
  });
}

function performStrike() {
  if (state !== 'playing') return;

  // Raycast from camera
  const camera = (world as any).renderer?.xr?.isPresenting
    ? null // handled by XR input
    : (world.scene as any).children?.find?.((c: any) => c.isCamera) || null;

  if (!camera) {
    // Fallback: use world camera
    raycaster.setFromCamera(pointer, (world as any)._camera || (world as any).camera);
  } else {
    raycaster.setFromCamera(pointer, camera);
  }

  // Try to get the actual camera
  try {
    const cam = (world as any)._camera || (world as any).camera || (world.scene.children.find((c: any) => c.isCamera));
    if (cam) raycaster.setFromCamera(pointer, cam);
  } catch { /* use fallback */ }

  // Check targets
  let hitSomething = false;
  let closestTarget: ActiveTarget | null = null;
  let closestDist = Infinity;

  for (const target of targetSystem.targets) {
    if (!target.alive) continue;
    const intersects = raycaster.intersectObject(target.group, true);
    if (intersects.length > 0 && intersects[0].distance < closestDist) {
      closestDist = intersects[0].distance;
      closestTarget = target;
    }
  }

  // Check boss hit zones
  if (targetSystem.bossGroup) {
    for (let i = 0; i < targetSystem.bossHitZones.length; i++) {
      const zone = targetSystem.bossHitZones[i];
      if (zone.hit) continue;
      const intersects = raycaster.intersectObject(zone.mesh, true);
      if (intersects.length > 0) {
        const defeated = targetSystem.hitBossZone(i, world.scene);
        audio.playBossHit();
        const scored = gsm.addHit(250);
        showToast(`+${scored}`);
        particles.burst(zone.mesh.getWorldPosition(new Vector3()), 0x00ffff, 15, 4, 0.6);
        if (defeated) {
          audio.playBossDefeat();
          showToast('BOSS DEFEATED!');
          gsm.score += 2000;
          tryAchievement('boss_first');
          particles.ring(new Vector3(0, 1.8, -4), 0xff00ff, 20, 1.5);
          // Continue to next wave
          waveTransition = true;
          waveTransitionTimer = 0;
        }
        hitSomething = true;
      }
    }
  }

  if (closestTarget) {
    hitTarget(closestTarget);
    hitSomething = true;
  }

  if (!hitSomething) {
    gsm.addMiss();
    audio.playMiss();
  }
}

function hitTarget(target: ActiveTarget) {
  const config = target.config;
  const pos = target.group.position.clone();

  if (config.type === 'bomb') {
    // Hit a bomb — bad!
    gsm.score += config.points; // negative
    gsm.combo = 0;
    gsm.bombsHit++;
    gsm.waveBombsHit++;
    audio.playBombHit();
    particles.burst(pos, 0xff0000, 20, 5, 0.8);
    showToast(`BOMB! ${config.points}`);
    if (gsm.mode !== GameMode.SpeedRush && gsm.mode !== GameMode.Precision) {
      if (gsm.loseLife()) {
        gameOver(false);
        return;
      }
    }
    targetSystem.removeTarget(target, world.scene);
    return;
  }

  const destroyed = targetSystem.hitTarget(target, world.scene);

  if (!destroyed) {
    // Armored: partial hit
    audio.playArmoredHit();
    particles.burst(pos, config.color, 6, 2, 0.3);
    showToast('CRACK!');
    return;
  }

  // Target destroyed
  gsm.totalTargets++;
  gsm.waveTargets++;
  const scored = gsm.addHit(config.points);

  // Type-specific effects
  switch (config.type) {
    case 'golden':
      gsm.goldenHits++;
      audio.playGoldenHit();
      particles.burst(pos, 0xffd700, 18, 4, 0.7);
      particles.ring(pos, 0xffd700, 12);
      break;
    case 'chain':
      audio.playChainComplete();
      particles.burst(pos, 0x00ff88, 15, 3, 0.5);
      tryAchievement('chain_complete');
      break;
    default:
      audio.playHit(config.points / 100);
      particles.burst(pos, config.color, 12, 3, 0.5);
      break;
  }

  // Combo feedback
  if (gsm.combo >= 5) {
    showToast(`${gsm.combo}x COMBO! +${scored}`);
  } else {
    showToast(`+${scored}`);
  }

  // Achievement checks
  if (gsm.hits === 1) tryAchievement('first_smash');
  if (gsm.combo >= 5) tryAchievement('combo_5');
  if (gsm.combo >= 10) tryAchievement('combo_10');
  if (gsm.combo >= 25) tryAchievement('combo_25');
  if (gsm.goldenHits >= 5) tryAchievement('golden_5');
  if (gsm.goldenHits >= 20) tryAchievement('golden_20');
}

// === XR Input ===
function handleXRInput() {
  try {
    const rightGamepad = (world.input as any).xr?.gamepads?.right;
    if (!rightGamepad) return;

    const triggerDown = rightGamepad.getButtonDown?.(InputComponent.Trigger);
    const bDown = rightGamepad.getButtonDown?.(InputComponent.B_Button);
    const aDown = rightGamepad.getButtonDown?.(InputComponent.A_Button);

    if (state === 'playing' && triggerDown) {
      performStrike();
    }
    if (state === 'playing' && bDown) {
      changeState('paused');
    }
    if (state === 'paused' && bDown) {
      changeState('playing');
    }
    if (aDown) {
      // Confirm / select in menus
      audio.playButtonClick();
    }
  } catch { /* XR not available */ }
}

// === HUD Updates ===
function updateHUD() {
  const doc = getDoc('hud');
  if (!doc) return;
  setText(doc, 'hud-score', `${gsm.score}`);
  setText(doc, 'hud-combo', gsm.combo > 1 ? `${gsm.combo}x` : '');
  setText(doc, 'hud-lives', gsm.lives < 900 ? `${'*'.repeat(gsm.lives)}` : '');

  if (gsm.mode === GameMode.SpeedRush) {
    setText(doc, 'hud-info', `${Math.ceil(gsm.timeRemaining)}s`);
  } else if (gsm.mode === GameMode.Precision) {
    setText(doc, 'hud-info', `${gsm.getAccuracy()}%`);
  } else if (gsm.mode === GameMode.BossWave && targetSystem.bossGroup) {
    const remaining = targetSystem.bossHitZones.filter(z => !z.hit).length;
    setText(doc, 'hud-info', `BOSS: ${remaining} pts`);
  } else {
    setText(doc, 'hud-info', `W${gsm.wave}`);
  }
}

function updateCountdown() {
  const doc = getDoc('countdown');
  if (!doc) return;
  setText(doc, 'countdown-text', countdownValue > 0 ? `${countdownValue}` : 'SMASH!');
}

// === Toast ===
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  const entity = uiEntities['toast'];
  if (entity) entity.object3D!.visible = true;
  const doc = getDoc('toast');
  setText(doc, 'toast-text', msg);
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (entity && state === 'playing') entity.object3D!.visible = false;
  }, 1200);
}

// === Populate Panels ===
function populateGameOver() {
  const doc = getDoc('gameover');
  if (!doc) return;
  const completed = gsm.lives > 0 || gsm.mode === GameMode.SpeedRush || gsm.mode === GameMode.Precision;
  setText(doc, 'go-title', completed ? 'WELL DONE!' : 'GAME OVER');
  setText(doc, 'go-score', `Score: ${gsm.score}`);
  setText(doc, 'go-hits', `Hits: ${gsm.hits}`);
  setText(doc, 'go-accuracy', `Accuracy: ${gsm.getAccuracy()}%`);
  setText(doc, 'go-combo', `Max Combo: ${gsm.maxCombo}x`);
  setText(doc, 'go-mode', `Mode: ${MODE_NAMES[gsm.mode]}`);
}

function populateLeaderboard() {
  const doc = getDoc('leaderboard');
  if (!doc) return;
  const entries = loadLeaderboard();
  for (let i = 0; i < 10; i++) {
    const e = entries[i];
    const prefix = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`;
    setText(doc, `lb-${i}`, e ? `${prefix} ${e.score} - ${e.mode} ${e.accuracy}%` : `${prefix} ---`);
  }
}

function populateAchievements() {
  const doc = getDoc('achievements');
  if (!doc) return;
  const unlocked = loadAchievements();
  ACHIEVEMENTS.forEach((a, i) => {
    const isUnlocked = unlocked.has(a.id);
    setText(doc, `ach-${i}`, `${isUnlocked ? '[X]' : '[ ]'} ${a.name} - ${a.description}`);
  });
}

function populateSettings() {
  const doc = getDoc('settings');
  if (!doc) return;
  setText(doc, 'val-master', `${Math.round(settings.masterVolume * 100)}%`);
  setText(doc, 'val-sfx', `${Math.round(settings.sfxVolume * 100)}%`);
  setText(doc, 'val-music', `${Math.round(settings.musicVolume * 100)}%`);
  setText(doc, 'val-theme', ARENA_THEMES[settings.theme].name);
}

// === Achievements ===
function tryAchievement(id: string) {
  const unlocked = loadAchievements();
  if (unlocked.has(id)) return;
  saveAchievement(id);
  audio.playAchievement();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) showToast(`UNLOCKED: ${a.name}`);
}

function checkAchievements() {
  if (gsm.score >= 1000) tryAchievement('score_1k');
  if (gsm.score >= 10000) tryAchievement('score_10k');
  if (gsm.score >= 50000) tryAchievement('score_50k');
  if (gsm.score >= 100000) tryAchievement('score_100k');
  if (gsm.mode === GameMode.Classic && gsm.bombsHit === 0 && gsm.lives > 0) tryAchievement('no_bombs');
  if (gsm.mode === GameMode.SpeedRush && gsm.hits >= 50) tryAchievement('speed_50');
  if (gsm.mode === GameMode.Precision && gsm.getAccuracy() >= 90) tryAchievement('precision_90');
  if (gsm.mode === GameMode.Precision && gsm.getAccuracy() === 100) tryAchievement('precision_100');
  if (gsm.mode === GameMode.Endless && gsm.timeElapsed >= 300) tryAchievement('endless_5m');
  if (gsm.modesPlayed.size >= 5) tryAchievement('all_modes');
}

// === Start ===
main();
