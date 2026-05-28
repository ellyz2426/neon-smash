// Neon Smash VR — Main Entry Point (Round 4: moving targets, haptics, match history, streak)
import {
  World, PanelUI, Follower, FollowBehavior, ScreenSpace,
  PanelDocument, Vector3, Raycaster, Vector2,
  InputComponent, Group,
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
import { DualStrikers, StrikerSkin, STRIKER_SKINS } from './striker';
import { ShatterSystem, ComboFlash, ScreenShake } from './effects';
import { recordSession, loadStats, formatPlayTime } from './stats';
import { PowerUpSystem, PowerUpType, POWERUP_CONFIGS } from './powerups';
import {
  generateDailyChallenge, isChallengeCompleted, markChallengeCompleted,
  getChallengeStreak, getChallengeConfig, DailyChallenge, ChallengeGameConfig,
} from './challenges';
import {
  addMatchRecord, loadMatchHistory, formatMatchSummary, formatMatchDetail,
  formatMatchDate,
} from './history';

// === Globals ===
let world: World;
let state: GameState = 'title';
let gsm = new GameStateManager();
let audio = new AudioManager();
let arena: Arena;
let targetSystem: TargetSystem;
let particles: ParticleSystem;
let shatterFx: ShatterSystem;
let comboFlash: ComboFlash;
let screenShake: ScreenShake;
let strikers: DualStrikers;
let powerups: PowerUpSystem;
let settings = loadSettings();
let currentSkin: StrikerSkin = StrikerSkin.Neon;

// Challenge state
let currentChallenge: DailyChallenge | null = null;
let challengeConfig: ChallengeGameConfig | null = null;
let isPlayingChallenge = false;

// Tutorial state
let tutorialStep = 0;
const TUTORIAL_STEPS = [
  { title: 'Welcome to Neon Smash!', desc: 'A VR target-smashing arcade game. Let\'s learn the basics!', hint: 'Press NEXT to continue' },
  { title: 'Aiming & Striking', desc: 'In VR: Pull the trigger to strike. In browser: Click to strike.', hint: 'Aim at targets with your controller or mouse' },
  { title: 'Target Types', desc: 'Cyan=Normal, Yellow=Speed, Orange=Armored (2 hits), Red=BOMB (avoid!)', hint: 'Different targets score different points' },
  { title: 'Combos & Multipliers', desc: 'Hit targets without missing to build combos. 5x=2X, 10x=3X, 25x=10X!', hint: 'The arena lights up as your combo grows' },
  { title: 'Power-Ups', desc: 'Floating pickups grant abilities: Time Slow, 2X Points, Magnet, Shield', hint: 'Strike them to collect' },
  { title: 'Ready to Play!', desc: 'Choose a mode and difficulty, then smash as many targets as you can!', hint: 'Try Classic mode to start' },
];

// UI entities
const uiEntities: Record<string, any> = {};
let uiSetup = false;

// Timing
let gameTime = 0;
let countdownValue = 3;
let countdownTimer = 0;
let waveTransition = false;
let waveTransitionTimer = 0;
let waveAnnounceTimer = 0;
let waveAnnounceActive = false;

// Raycaster for browser aiming
const raycaster = new Raycaster();
const pointer = new Vector2();

// Pylon world positions cache
let pylonPositions: Vector3[] = [];

// Dual-wield tracking
let leftHandUsed = false;
let rightHandUsed = false;

// Power-up expiry warning
let lastPowerUpWarning = 0;

// Haptic feedback
let xrSession: any = null;

// Streak tracking
let currentStreak = 0; // consecutive games with score improvement

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

  // Shatter effects
  shatterFx = new ShatterSystem();
  world.scene.add(shatterFx.group);

  // Combo flash
  comboFlash = new ComboFlash();

  // Screen shake
  screenShake = new ScreenShake();

  // Power-ups
  powerups = new PowerUpSystem();

  // Strikers (for XR controllers)
  strikers = new DualStrikers(currentSkin);
  setupStrikers();

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

// === Striker Setup ===
function setupStrikers(): void {
  try {
    const rightGrip = (world as any).playerSpaceEntities?.gripSpaces?.right;
    const leftGrip = (world as any).playerSpaceEntities?.gripSpaces?.left;
    if (rightGrip) rightGrip.object3D.add(strikers.right.group);
    if (leftGrip) leftGrip.object3D.add(strikers.left.group);
  } catch { /* No XR grip spaces — browser mode */ }
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
    { id: 'waveannounce', config: '/ui/waveannounce.json', maxW: 0.5, maxH: 0.25, mode: 'follower' },
    { id: 'combo', config: '/ui/combo.json', maxW: 0.25, maxH: 0.12, mode: 'follower' },
    { id: 'stats', config: '/ui/stats.json', maxW: 0.8, maxH: 0.9, mode: 'world' },
    { id: 'skins', config: '/ui/skins.json', maxW: 0.7, maxH: 0.8, mode: 'world' },
    // Round 3 panels
    { id: 'powerup', config: '/ui/powerup.json', maxW: 0.35, maxH: 0.08, mode: 'follower' },
    { id: 'challenge', config: '/ui/challenge.json', maxW: 0.85, maxH: 0.8, mode: 'world' },
    { id: 'tutorial', config: '/ui/tutorial.json', maxW: 0.8, maxH: 0.6, mode: 'world' },
    // Round 4 panels
    { id: 'history', config: '/ui/history.json', maxW: 0.85, maxH: 0.9, mode: 'world' },
    { id: 'streak', config: '/ui/streak.json', maxW: 0.2, maxH: 0.06, mode: 'follower' },
  ];

  panels.forEach(p => {
    const entity = world.createTransformEntity(undefined, { persistent: true });
    entity.addComponent(PanelUI, { config: p.config, maxWidth: p.maxW, maxHeight: p.maxH });

    if (p.mode === 'world') {
      entity.object3D!.position.set(0, 1.5, -2);
    } else if (p.mode === 'follower') {
      let offY = 0, offX = 0;
      switch (p.id) {
        case 'hud': offY = 0.12; offX = 0.22; break;
        case 'countdown': offY = 0; break;
        case 'waveannounce': offY = 0.05; break;
        case 'combo': offY = -0.08; offX = -0.2; break;
        case 'toast': offY = -0.12; break;
        case 'powerup': offY = 0.16; offX = -0.18; break;
        case 'streak': offY = -0.04; offX = 0.22; break;
      }
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

  // Attach combo flash to head follower
  try {
    const headEntity = world.playerHeadEntity;
    if (headEntity && headEntity.object3D) headEntity.object3D.add(comboFlash.group);
  } catch { /* Not available */ }

  // Bind events once docs are available
  setTimeout(() => bindUIEvents(), 500);
  setTimeout(() => bindUIEvents(), 1500);
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

  const titleDoc = getDoc('title');
  if (!titleDoc) return;
  eventsBound = true;

  bindBtn(titleDoc, 'btn-play', () => { audio.playButtonClick(); changeState('modeselect'); });
  bindBtn(titleDoc, 'btn-leaderboard', () => { audio.playButtonClick(); populateLeaderboard(); changeState('leaderboard'); });
  bindBtn(titleDoc, 'btn-achievements', () => { audio.playButtonClick(); populateAchievements(); changeState('achievements'); });
  bindBtn(titleDoc, 'btn-settings', () => { audio.playButtonClick(); populateSettings(); changeState('settings'); });
  bindBtn(titleDoc, 'btn-help', () => { audio.playButtonClick(); changeState('help'); });
  bindBtn(titleDoc, 'btn-stats', () => { audio.playButtonClick(); changeState('stats'); });
  bindBtn(titleDoc, 'btn-skins', () => { audio.playButtonClick(); changeState('skins'); });
  // Round 3 buttons
  bindBtn(titleDoc, 'btn-challenge', () => { audio.playButtonClick(); populateChallenge(); changeState('challenge'); });
  bindBtn(titleDoc, 'btn-tutorial', () => { audio.playButtonClick(); tutorialStep = 0; populateTutorial(); changeState('tutorial'); });
  bindBtn(titleDoc, 'btn-history', () => { audio.playButtonClick(); populateHistory(); changeState('history'); });

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
  ['leaderboard', 'achievements', 'settings', 'help', 'stats', 'skins', 'history'].forEach(id => {
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

  // Skins
  const skinsDoc = getDoc('skins');
  if (skinsDoc) {
    const skinKeys = Object.keys(STRIKER_SKINS) as StrikerSkin[];
    skinKeys.forEach((skin, i) => {
      bindBtn(skinsDoc, `skin-${i}`, () => {
        audio.playButtonClick();
        currentSkin = skin;
        strikers.setSkin(skin);
        populateSkins();
      });
    });
  }

  // Challenge
  const chDoc = getDoc('challenge');
  if (chDoc) {
    bindBtn(chDoc, 'btn-start-challenge', () => { audio.playButtonClick(); startChallenge(); });
    bindBtn(chDoc, 'btn-back-challenge', () => { audio.playButtonClick(); changeState('title'); });
  }

  // Tutorial
  const tutDoc = getDoc('tutorial');
  if (tutDoc) {
    bindBtn(tutDoc, 'btn-tut-next', () => {
      audio.playButtonClick();
      tutorialStep++;
      if (tutorialStep >= TUTORIAL_STEPS.length) {
        changeState('title');
      } else {
        populateTutorial();
      }
    });
    bindBtn(tutDoc, 'btn-tut-skip', () => { audio.playButtonClick(); changeState('title'); });
  }
}

function bindBtn(doc: UIKitDocument, id: string, fn: () => void): void {
  const el = doc.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

// === Haptic Feedback ===
function triggerHaptic(hand: 'left' | 'right', intensity = 0.5, duration = 50): void {
  try {
    const xrInput = (world.input as any).xr;
    if (!xrInput) return;
    const gamepad = hand === 'left' ? xrInput.gamepads?.left : xrInput.gamepads?.right;
    if (gamepad?.hapticActuators?.[0]) {
      gamepad.hapticActuators[0].pulse(intensity, duration);
    } else if (gamepad?.vibrationActuator) {
      gamepad.vibrationActuator.playEffect('dual-rumble', {
        duration, strongMagnitude: intensity, weakMagnitude: intensity * 0.5,
      });
    }
  } catch { /* XR haptics not available */ }
}

// === State Changes ===
function changeState(newState: GameState) {
  state = newState;
  switch (newState) {
    case 'title':
      showUI('title');
      targetSystem.clearAll(world.scene);
      targetSystem.removeBoss(world.scene);
      powerups.clearAll(world.scene);
      isPlayingChallenge = false;
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
    case 'stats':
      showUI('stats');
      populateStats();
      break;
    case 'skins':
      showUI('skins');
      populateSkins();
      break;
    case 'challenge':
      showUI('challenge');
      break;
    case 'tutorial':
      showUI('tutorial');
      break;
    case 'history':
      showUI('history');
      break;
  }
}

// === Game Flow ===
function startGame(diff: Difficulty) {
  gsm.reset(gsm.mode, diff);
  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  particles.clear();
  shatterFx.clear();
  powerups.clearAll(world.scene);
  gameTime = 0;
  waveTransition = false;
  waveAnnounceActive = false;
  leftHandUsed = false;
  rightHandUsed = false;
  lastPowerUpWarning = 0;
  audio.startMusic();
  targetSystem.startWave(gsm.wave, gsm.mode);
  showWaveAnnouncement(gsm.wave);
  changeState('countdown');
}

function startChallenge() {
  currentChallenge = generateDailyChallenge();
  challengeConfig = getChallengeConfig(currentChallenge);
  isPlayingChallenge = true;
  gsm.mode = currentChallenge.mode;

  // Apply challenge config overrides
  gsm.reset(currentChallenge.mode, currentChallenge.difficulty);
  if (challengeConfig.lives !== null) gsm.lives = challengeConfig.lives;
  if (challengeConfig.timeLimit !== null) gsm.timeRemaining = challengeConfig.timeLimit;

  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  particles.clear();
  shatterFx.clear();
  powerups.clearAll(world.scene);
  gameTime = 0;
  waveTransition = false;
  waveAnnounceActive = false;
  leftHandUsed = false;
  rightHandUsed = false;
  lastPowerUpWarning = 0;
  audio.startMusic();
  targetSystem.startWave(gsm.wave, gsm.mode);
  showWaveAnnouncement(gsm.wave);
  changeState('countdown');
}

function endGame() {
  audio.stopMusic();
  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  particles.clear();
  shatterFx.clear();
  powerups.clearAll(world.scene);
  arena.setComboLevel(0);

  recordSession({
    mode: gsm.mode, difficulty: gsm.difficulty, score: gsm.score,
    hits: gsm.hits, misses: gsm.misses, maxCombo: gsm.maxCombo,
    accuracy: gsm.getAccuracy(), timeElapsed: gsm.timeElapsed,
    waveReached: gsm.wave, goldenHits: gsm.goldenHits,
    bombsHit: gsm.bombsHit, chainCompletes: gsm.chainCompletes,
    perfectWaves: gsm.perfectWaves,
  });

  addToLeaderboard({
    score: gsm.score, mode: MODE_NAMES[gsm.mode],
    difficulty: gsm.difficulty, accuracy: gsm.getAccuracy(),
    maxCombo: gsm.maxCombo, date: new Date().toLocaleDateString(),
  });

  checkAchievements();
  isPlayingChallenge = false;
  changeState('title');
}

// === Update Loop ===
function update(dt: number, t: number) {
  arena.update(t);
  particles.update(dt);
  shatterFx.update(dt);
  comboFlash.update(dt);
  screenShake.update(dt);
  strikers.update(dt);

  // Handle XR input
  handleXRInput();

  // Update combo-responsive arena lighting
  arena.setComboLevel(state === 'playing' ? gsm.combo : 0);

  // Wave announcement timer
  if (waveAnnounceActive) {
    waveAnnounceTimer += dt;
    if (waveAnnounceTimer >= 2) {
      waveAnnounceActive = false;
      if (uiEntities['waveannounce']) uiEntities['waveannounce'].object3D!.visible = false;
    }
  }

  // Combo display
  if (state === 'playing' && gsm.combo >= 3) {
    updateComboDisplay();
    if (uiEntities['combo']) uiEntities['combo'].object3D!.visible = true;
  } else {
    if (uiEntities['combo']) uiEntities['combo'].object3D!.visible = false;
  }

  // Streak display
  updateStreakDisplay();

  // Power-up HUD
  if (state === 'playing' && powerups.hasActiveEffect()) {
    updatePowerUpHUD();
    if (uiEntities['powerup']) uiEntities['powerup'].object3D!.visible = true;

    // Expiry warning
    for (const eff of powerups.activeEffects) {
      if (eff.remaining < 2 && eff.remaining > 1.9 && gameTime - lastPowerUpWarning > 2) {
        audio.playPowerUpExpire();
        lastPowerUpWarning = gameTime;
      }
    }
  } else {
    if (uiEntities['powerup']) uiEntities['powerup'].object3D!.visible = false;
  }

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
  // Apply time slow from power-up
  const timeScale = powerups.getTimeScale();
  const scaledDt = dt * timeScale;

  // Time tracking
  gsm.timeElapsed += dt;
  if (gsm.mode === GameMode.SpeedRush) {
    gsm.timeRemaining -= dt; // real time, not slowed
    if (gsm.timeRemaining <= 0) {
      gsm.timeRemaining = 0;
      gameOver(true);
      return;
    }
  }

  // Boss mode
  if (gsm.mode === GameMode.BossWave && targetSystem.bossGroup) {
    targetSystem.updateBoss(scaledDt, t);
  }

  // Update targets (with time scale)
  const spawnEnabled = !waveTransition && !(gsm.mode === GameMode.BossWave && targetSystem.bossGroup);
  targetSystem.update(scaledDt, gsm.difficulty, gsm.mode, gsm.wave, pylonPositions, world.scene, spawnEnabled);

  // Update power-ups
  powerups.update(scaledDt, gsm.wave, pylonPositions, world.scene, spawnEnabled && state === 'playing');

  // Magnet pull: drag nearby targets toward center for easier hitting
  if (powerups.magnetPull) {
    for (const target of targetSystem.targets) {
      if (!target.alive) continue;
      const toCenter = new Vector3(0, 1.5, -2).sub(target.group.position).normalize();
      target.group.position.add(toCenter.multiplyScalar(dt * 0.5));
    }
  }

  // Challenge no-miss check
  if (isPlayingChallenge && challengeConfig?.noMissAllowed && gsm.misses > 0) {
    gameOver(false);
    return;
  }

  // Wave completion check
  if (!waveTransition && targetSystem.isWaveComplete() && !(gsm.mode === GameMode.BossWave && targetSystem.bossGroup)) {
    if (gsm.mode === GameMode.SpeedRush) {
      targetSystem.startWave(gsm.wave, gsm.mode);
    } else if (gsm.mode === GameMode.Precision) {
      gameOver(true);
      return;
    } else {
      gsm.recordWaveComplete();
      const wasPerfect = gsm.waveHits === gsm.waveTargets && gsm.waveTargets > 0 && gsm.waveBombsHit === 0;

      if (wasPerfect) {
        tryAchievement('perfect_wave');
        audio.playPerfectWave();
        showToast('PERFECT WAVE!');
        if (gsm.perfectWaves >= 3) tryAchievement('perfect_3');
      }

      if (gsm.noMissWaveStreak >= 5) tryAchievement('no_miss_wave5');

      if (gsm.wave >= gsm.totalWaves && gsm.mode === GameMode.Classic) {
        gameOver(true);
        return;
      }

      if (gsm.mode === GameMode.BossWave && !targetSystem.bossGroup) {
        targetSystem.spawnBoss(world.scene, gsm.wave);
        showToast('BOSS INCOMING!');
      } else {
        waveTransition = true;
        waveTransitionTimer = 0;
        audio.playWaveComplete();
        if (!wasPerfect) showToast(`WAVE ${gsm.wave} CLEAR!`);
      }
    }
  }

  // Wave transition timer
  if (waveTransition) {
    waveTransitionTimer += dt;
    if (waveTransitionTimer >= 2) {
      waveTransition = false;
      gsm.startNextWave();
      targetSystem.startWave(gsm.wave, gsm.mode);
      showWaveAnnouncement(gsm.wave);
      audio.playWaveStart(gsm.wave);
    }
  }

  updateHUD();
}

function gameOver(completed: boolean) {
  audio.stopMusic();
  targetSystem.clearAll(world.scene);
  targetSystem.removeBoss(world.scene);
  powerups.clearAll(world.scene);
  arena.setComboLevel(0);

  if (completed) {
    audio.playWinFanfare();
  } else {
    audio.playGameOver();
  }

  // Check challenge completion
  if (isPlayingChallenge && currentChallenge && completed) {
    if (gsm.score >= currentChallenge.targetScore) {
      markChallengeCompleted(currentChallenge.date);
      audio.playChallengeComplete();
      showToast('CHALLENGE COMPLETE!');
    }
  }

  recordSession({
    mode: gsm.mode, difficulty: gsm.difficulty, score: gsm.score,
    hits: gsm.hits, misses: gsm.misses, maxCombo: gsm.maxCombo,
    accuracy: gsm.getAccuracy(), timeElapsed: gsm.timeElapsed,
    waveReached: gsm.wave, goldenHits: gsm.goldenHits,
    bombsHit: gsm.bombsHit, chainCompletes: gsm.chainCompletes,
    perfectWaves: gsm.perfectWaves,
  });

  addToLeaderboard({
    score: gsm.score, mode: MODE_NAMES[gsm.mode],
    difficulty: gsm.difficulty, accuracy: gsm.getAccuracy(),
    maxCombo: gsm.maxCombo, date: new Date().toLocaleDateString(),
  });

  checkAchievements();

  // Record to match history
  addMatchRecord({
    mode: gsm.mode, difficulty: gsm.difficulty, score: gsm.score,
    hits: gsm.hits, misses: gsm.misses, accuracy: gsm.getAccuracy(),
    maxCombo: gsm.maxCombo, waveReached: gsm.wave,
    timeElapsed: gsm.timeElapsed, goldenHits: gsm.goldenHits,
    bombsHit: gsm.bombsHit, perfectWaves: gsm.perfectWaves,
    completed, isChallenge: isPlayingChallenge,
  });

  changeState('gameover');
}

// === Wave Announcement ===
function showWaveAnnouncement(wave: number) {
  waveAnnounceActive = true;
  waveAnnounceTimer = 0;
  const entity = uiEntities['waveannounce'];
  if (entity) entity.object3D!.visible = true;
  const doc = getDoc('waveannounce');
  if (doc) {
    setText(doc, 'wave-text', `WAVE ${wave}`);
    const subs = ['GET READY!', 'HERE THEY COME!', 'INCOMING!', 'BRACE YOURSELF!', 'KEEP SMASHING!'];
    setText(doc, 'wave-sub', subs[wave % subs.length]);
  }
}

// === Combo Display ===
function updateComboDisplay() {
  const doc = getDoc('combo');
  if (!doc) return;
  setText(doc, 'combo-count', `${gsm.combo}`);
  const mult = gsm.getComboMultiplier();
  setText(doc, 'combo-mult', mult > 1 ? `x${mult}` : '');
}

// === Power-up HUD ===
function updatePowerUpHUD() {
  const doc = getDoc('powerup');
  if (!doc) return;
  const effects = powerups.activeEffects;
  for (let i = 0; i < 3; i++) {
    const eff = effects[i];
    if (eff) {
      const cfg = POWERUP_CONFIGS[eff.type];
      setText(doc, `pu-name-${i}`, cfg.name);
      setText(doc, `pu-timer-${i}`, `${Math.ceil(eff.remaining)}s`);
    } else {
      setText(doc, `pu-name-${i}`, '');
      setText(doc, `pu-timer-${i}`, '');
    }
  }
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
    performStrike('browser');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state === 'playing') changeState('paused');
      else if (state === 'paused') changeState('playing');
    }
  });
}

function performStrike(hand: 'left' | 'right' | 'browser' = 'browser') {
  if (state !== 'playing') return;

  if (hand === 'left') { leftHandUsed = true; gsm.leftHandHits++; triggerHaptic('left', 0.3, 30); }
  if (hand === 'right') { rightHandUsed = true; gsm.rightHandHits++; triggerHaptic('right', 0.3, 30); }

  // Raycast from camera
  try {
    const cam = (world as any)._camera || (world as any).camera || (world.scene.children.find((c: any) => c.isCamera));
    if (cam) raycaster.setFromCamera(pointer, cam);
  } catch { /* fallback */ }

  let hitSomething = false;
  let closestTarget: ActiveTarget | null = null;
  let closestDist = Infinity;

  // Check power-ups first
  for (const pu of powerups.powerups) {
    if (!pu.alive) continue;
    const intersects = raycaster.intersectObject(pu.group, true);
    if (intersects.length > 0 && intersects[0].distance < closestDist) {
      // Collect power-up
      const config = powerups.collect(pu, world.scene);
      audio.playPowerUpCollect();
      particles.burst(pu.position.clone().setY(pu.position.y + 0.5), config.color, 15, 3, 0.5);
      particles.ring(pu.position.clone().setY(pu.position.y + 0.5), config.color, 10);
      showToast(config.name + '!');
      if (config.type === PowerUpType.TimeSlow) audio.playTimeSlowStart();
      hitSomething = true;
      break; // only collect one
    }
  }

  if (!hitSomething) {
    // Check targets
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
          let pts = 250;
          if (powerups.doublePoints) pts *= 2;
          const scored = gsm.addHit(pts);
          showToast(`+${scored}`);
          const zonePos = zone.mesh.getWorldPosition(new Vector3());
          particles.burst(zonePos, 0x00ffff, 15, 4, 0.6);
          shatterFx.shatter(zonePos, 0x00ffff, 6, 0.8);
          screenShake.trigger(0.02);
          if (defeated) {
            audio.playBossDefeat();
            showToast('BOSS DEFEATED!');
            gsm.score += 2000;
            tryAchievement('boss_first');
            particles.ring(new Vector3(0, 1.8, -4), 0xff00ff, 20, 1.5);
            shatterFx.shatter(new Vector3(0, 1.8, -4), 0xff00ff, 15, 1.5);
            screenShake.trigger(0.04);
            waveTransition = true;
            waveTransitionTimer = 0;
          }
          hitSomething = true;
        }
      }
    }

    if (closestTarget) {
      hitTarget(closestTarget, hand);
      hitSomething = true;
    }
  }

  if (!hitSomething) {
    gsm.addMiss();
    audio.playMiss();
  }

  if (leftHandUsed && rightHandUsed) tryAchievement('dual_wield');
}

function hitTarget(target: ActiveTarget, hand: 'left' | 'right' | 'browser' = 'browser') {
  const config = target.config;
  const pos = target.group.position.clone();

  if (config.type === 'bomb') {
    // Shield blocks bomb damage
    if (powerups.shield) {
      showToast('SHIELD BLOCKED!');
      particles.burst(pos, 0x44ff88, 12, 3, 0.4);
      audio.playHit(1);
      targetSystem.removeTarget(target, world.scene);
      if (hand !== 'browser') triggerHaptic(hand, 0.4, 40);
      return;
    }

    gsm.score += config.points;
    gsm.combo = 0;
    gsm.bombsHit++;
    gsm.waveBombsHit++;
    audio.playBombHit();
    particles.burst(pos, 0xff0000, 20, 5, 0.8);
    shatterFx.shatter(pos, 0xff0000, 12, 1.2);
    screenShake.trigger(0.04);
    showToast(`BOMB! ${config.points}`);
    // Strong haptic for bomb
    if (hand !== 'browser') triggerHaptic(hand, 1.0, 150);
    if (gsm.mode !== GameMode.SpeedRush && gsm.mode !== GameMode.Precision) {
      if (gsm.loseLife()) {
        audio.playLifeLost();
        gameOver(false);
        return;
      }
      audio.playLifeLost();
    }
    targetSystem.removeTarget(target, world.scene);
    return;
  }

  const destroyed = targetSystem.hitTarget(target, world.scene);

  if (!destroyed) {
    audio.playArmoredHit();
    particles.burst(pos, config.color, 6, 2, 0.3);
    shatterFx.shatter(pos, config.color, 4, 0.5);
    showToast('CRACK!');
    if (hand !== 'browser') triggerHaptic(hand, 0.6, 60);
    return;
  }

  gsm.totalTargets++;
  gsm.waveTargets++;
  let points = config.points;

  // Apply power-up multipliers
  if (powerups.doublePoints) points *= 2;
  // Apply challenge multiplier
  if (isPlayingChallenge && challengeConfig) points = Math.round(points * challengeConfig.pointsMult);

  const scored = gsm.addHit(points);

  // Type-specific effects
  switch (config.type) {
    case 'golden':
      gsm.goldenHits++;
      audio.playGoldenHit();
      particles.burst(pos, 0xffd700, 18, 4, 0.7);
      particles.ring(pos, 0xffd700, 12);
      shatterFx.shatter(pos, 0xffd700, 8, 1.0);
      if (hand !== 'browser') triggerHaptic(hand, 0.7, 80);
      break;
    case 'chain':
      gsm.chainCompletes++;
      audio.playChainComplete();
      particles.burst(pos, 0x00ff88, 15, 3, 0.5);
      shatterFx.shatter(pos, 0x00ff88, 6, 0.7);
      tryAchievement('chain_complete');
      if (hand !== 'browser') triggerHaptic(hand, 0.5, 60);
      break;
    default:
      audio.playHit(config.points / 100);
      particles.burst(pos, config.color, 12, 3, 0.5);
      shatterFx.shatter(pos, config.color, 6, 0.6);
      if (hand !== 'browser') triggerHaptic(hand, 0.4, 40);
      break;
  }

  screenShake.trigger(0.01);

  // Combo feedback
  if (gsm.combo >= 5) {
    comboFlash.trigger(gsm.combo);
    audio.playStreakSound(gsm.combo);
    showToast(`${gsm.combo}x COMBO! +${scored}`);
  } else {
    showToast(`+${scored}`);
  }

  // Achievement checks
  if (gsm.hits === 1) tryAchievement('first_smash');
  if (gsm.combo >= 5) tryAchievement('combo_5');
  if (gsm.combo >= 10) tryAchievement('combo_10');
  if (gsm.combo >= 25) tryAchievement('combo_25');
  if (gsm.combo >= 50) tryAchievement('combo_50');
  if (gsm.goldenHits >= 5) tryAchievement('golden_5');
  if (gsm.goldenHits >= 20) tryAchievement('golden_20');
}

// === XR Input (Dual-Wield) ===
function handleXRInput() {
  try {
    const xrInput = (world.input as any).xr;
    if (!xrInput) return;

    const rightGamepad = xrInput.gamepads?.right;
    if (rightGamepad) {
      const triggerDown = rightGamepad.getButtonDown?.(InputComponent.Trigger);
      const bDown = rightGamepad.getButtonDown?.(InputComponent.B_Button);
      if (state === 'playing' && triggerDown) performStrike('right');
      if (state === 'playing' && bDown) changeState('paused');
      if (state === 'paused' && bDown) changeState('playing');
    }

    const leftGamepad = xrInput.gamepads?.left;
    if (leftGamepad) {
      const triggerDown = leftGamepad.getButtonDown?.(InputComponent.Trigger);
      const xDown = leftGamepad.getButtonDown?.(InputComponent.A_Button);
      if (state === 'playing' && triggerDown) performStrike('left');
      if (xDown) audio.playButtonClick();
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
  let title = completed ? 'WELL DONE!' : 'GAME OVER';
  if (isPlayingChallenge && currentChallenge) {
    if (completed && gsm.score >= currentChallenge.targetScore) {
      title = 'CHALLENGE COMPLETE!';
    } else {
      title = 'CHALLENGE FAILED';
    }
  }
  setText(doc, 'go-title', title);
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

function populateStats() {
  const doc = getDoc('stats');
  if (!doc) return;
  const stats = loadStats();
  setText(doc, 'stat-games', `${stats.totalGamesPlayed}`);
  setText(doc, 'stat-time', formatPlayTime(stats.totalPlayTime));
  setText(doc, 'stat-smashed', `${stats.totalTargetsSmashed}`);
  setText(doc, 'stat-total-score', `${stats.allTimeScore}`);
  setText(doc, 'stat-best-score', `${stats.allTimeBestScore}`);
  setText(doc, 'stat-best-combo', `${stats.allTimeBestCombo}x`);
  setText(doc, 'stat-best-accuracy', `${stats.allTimeBestAccuracy}%`);
  setText(doc, 'stat-golden', `${stats.totalGoldenHits}`);
  setText(doc, 'stat-perfect', `${stats.totalPerfectWaves}`);

  const modeKeys = Object.keys(stats.modeStats);
  const modeNames: Record<string, string> = {
    classic: 'CLASSIC', speedrush: 'SPEED RUSH', precision: 'PRECISION',
    endless: 'ENDLESS', bosswave: 'BOSS WAVE',
  };
  for (let i = 0; i < 5; i++) {
    const key = modeKeys[i];
    if (key && stats.modeStats[key]) {
      const ms = stats.modeStats[key];
      setText(doc, `stat-mode-${i}`, modeNames[key] || key);
      setText(doc, `stat-mode-val-${i}`, `${ms.gamesPlayed}g, Best: ${ms.bestScore}`);
    } else {
      setText(doc, `stat-mode-${i}`, '---');
      setText(doc, `stat-mode-val-${i}`, '---');
    }
  }
}

function populateSkins() {
  const doc = getDoc('skins');
  if (!doc) return;
  const skinKeys = Object.keys(STRIKER_SKINS) as StrikerSkin[];
  skinKeys.forEach((skin, i) => {
    const cfg = STRIKER_SKINS[skin];
    setText(doc, `skin-name-${i}`, cfg.name);
    setText(doc, `skin-ind-${i}`, skin === currentSkin ? '[EQUIPPED]' : '');
  });
}

function populateChallenge() {
  const doc = getDoc('challenge');
  if (!doc) return;
  const challenge = generateDailyChallenge();
  const completed = isChallengeCompleted(challenge.date);
  const streak = getChallengeStreak();

  setText(doc, 'ch-title', challenge.title);
  setText(doc, 'ch-desc', challenge.modifiers.map(m => m.description).join(' | '));
  setText(doc, 'ch-detail', `Mode: ${MODE_NAMES[challenge.mode]} | ${challenge.difficulty.toUpperCase()}`);
  setText(doc, 'ch-target', `Target: ${challenge.targetScore.toLocaleString()} pts`);
  setText(doc, 'ch-streak', streak > 0 ? `Streak: ${streak} day${streak > 1 ? 's' : ''}` : 'No streak yet');
  setText(doc, 'ch-status', completed ? 'COMPLETED TODAY!' : '');
}

function populateTutorial() {
  const doc = getDoc('tutorial');
  if (!doc) return;
  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) return;
  setText(doc, 'tut-step', `Step ${tutorialStep + 1} / ${TUTORIAL_STEPS.length}`);
  setText(doc, 'tut-title', step.title);
  setText(doc, 'tut-desc', step.desc);
  setText(doc, 'tut-progress', step.hint);
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
  if (gsm.mode === GameMode.SpeedRush && gsm.hits >= 100) tryAchievement('speed_100');
  if (gsm.mode === GameMode.Precision && gsm.getAccuracy() >= 90) tryAchievement('precision_90');
  if (gsm.mode === GameMode.Precision && gsm.getAccuracy() === 100) tryAchievement('precision_100');
  if (gsm.mode === GameMode.Endless && gsm.timeElapsed >= 300) tryAchievement('endless_5m');
  if (gsm.mode === GameMode.Endless && gsm.timeElapsed >= 600) tryAchievement('endless_10m');
  if (gsm.mode === GameMode.Endless && gsm.wave >= 10) tryAchievement('wave_10');
  if (gsm.modesPlayed.size >= 5) tryAchievement('all_modes');

  const stats = loadStats();
  if (stats.totalTargetsSmashed >= 1000) tryAchievement('total_1000');
  if (stats.totalGamesPlayed >= 10) tryAchievement('games_10');
  if (stats.totalGamesPlayed >= 50) tryAchievement('games_50');
}

// === Match History ===
function populateHistory() {
  const doc = getDoc('history');
  if (!doc) return;
  const history = loadMatchHistory();
  for (let i = 0; i < 8; i++) {
    const m = history[i];
    setText(doc, `hist-rank-${i}`, `${i + 1}.`);
    if (m) {
      setText(doc, `hist-summary-${i}`, formatMatchSummary(m));
      setText(doc, `hist-detail-${i}`, formatMatchDetail(m));
      setText(doc, `hist-date-${i}`, formatMatchDate(m.date));
    } else {
      setText(doc, `hist-summary-${i}`, '---');
      setText(doc, `hist-detail-${i}`, '---');
      setText(doc, `hist-date-${i}`, '');
    }
  }
}

// === Streak Display ===
function updateStreakDisplay() {
  if (state !== 'playing' || gsm.combo < 1) {
    if (uiEntities['streak']) uiEntities['streak'].object3D!.visible = false;
    return;
  }
  // Show streak at 3+ combo
  if (gsm.combo >= 3) {
    if (uiEntities['streak']) uiEntities['streak'].object3D!.visible = true;
    const doc = getDoc('streak');
    if (doc) {
      setText(doc, 'streak-count', `${gsm.combo}`);
      // Escalate icon based on combo tier
      if (gsm.combo >= 25) setText(doc, 'streak-icon', '💥');
      else if (gsm.combo >= 15) setText(doc, 'streak-icon', '⚡');
      else if (gsm.combo >= 10) setText(doc, 'streak-icon', '🔥');
      else setText(doc, 'streak-icon', '🎯');
    }
  } else {
    if (uiEntities['streak']) uiEntities['streak'].object3D!.visible = false;
  }
}

// === Start ===
main();
