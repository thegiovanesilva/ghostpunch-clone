import * as THREE from 'three';

// ============================================================
// GHOSTPUNCH MINI - Etapa 1
// Cena, sala, jogador (WASD + mouse), soco e fantasma que persegue.
// ============================================================

// ---------- Configuração (fácil de ajustar) ----------
const CFG = {
  roomHalf: 9,          // metade do lado da sala (sala = 18x18)
  playerSpeed: 6,       // unidades/seg
  playerMaxHp: 100,
  punchDuration: 0.28,  // seg
  punchHitAt: 0.45,     // fração da animação em que o golpe acerta
  punchRange: 2.2,      // alcance do soco (a partir da borda do boss)
  punchAngle: Math.PI / 3, // meio-ângulo do cone do soco (60 graus)
  punchDamage: 2,
  dodgeSpeed: 15,       // esquiva (Shift)
  dodgeTime: 0.2,
  dodgeCooldown: 0.8,
  // --- soco forte ---
  heavyDuration: 0.65,   // carga (puxa o braço) + golpe
  heavyHitAt: 0.68,      // fração da animação em que o golpe acerta
  heavyDamage: 6,
  cooldowns: { heavy: 1.8, upper: 1.4, slam: 4.0 }, // recarga dos golpes especiais (s)
  slamRadius: 4.5,       // alcance do esmagar (área ao redor do jogador)
  launchFriction: 0.06,  // quanto menor, mais rápido ele freia (0.06 ~ voa a sala toda)
  wallSlamDamage: 4,     // dano extra ao bater na parede
  // --- PERFIS DE GOLPE: o que cada ataque faz com o boss ---
  // speed: empurrão horizontal (u/s) · up: pulo vertical (u/s) · stagger: tempo tonto (s)
  // squash: quanto ele amassa (0-1) · hitstop: congelamento no impacto (s) · shake: tremor de câmera (0-1)
  attacks: {
    light: { speed: 15, up: 3.0, stagger: 0.40, squash: 0.45, hitstop: 0.05, shake: 0.35 }, // soco normal: empurrãozinho, dá para combar
    heavy: { speed: 58, up: 9.5, stagger: 1.70, squash: 1.00, hitstop: 0.14, shake: 1.00 }, // soco forte: manda longe e para o alto
    cross: { speed: 30, up: 5.0, stagger: 0.90, squash: 0.80, hitstop: 0.10, shake: 0.70 }, // 3º golpe do combo: finalizador
    upper: { speed: 9,  up: 19,  stagger: 1.50, squash: 1.00, hitstop: 0.13, shake: 0.85, spin: 14 }, // uppercut: quase não empurra, LANÇA para cima
    slam:  { speed: 34, up: 7.0, stagger: 1.40, squash: 1.00, hitstop: 0.14, shake: 1.00 }, // esmagar: onda em área, empurra para longe de você
    barrel: { speed: 38, up: 3.2, stagger: 0.90, squash: 0.85, hitstop: 0.10, shake: 0.70 },
    tv:     { speed: 36, up: 3.0, stagger: 1.00, squash: 0.85, hitstop: 0.10, shake: 0.70 },
    ball:   { speed: 50, up: 2.2, stagger: 1.10, squash: 0.95, hitstop: 0.12, shake: 0.85 }, // bola de boliche: pesada e rápida
    pillow: { speed: 6,  up: 0.6, stagger: 0.25, squash: 0.20, hitstop: 0.02, shake: 0.10 }, // almofada: faz cócegas
    vase:  { speed: 20, up: 1.5, stagger: 0.50, squash: 0.50, hitstop: 0.06, shake: 0.40 }, // objetos: quanto mais pesado, mais empurra
    plank: { speed: 24, up: 2.0, stagger: 0.50, squash: 0.55, hitstop: 0.06, shake: 0.40 },
    chair: { speed: 32, up: 2.8, stagger: 0.80, squash: 0.75, hitstop: 0.09, shake: 0.60 },
    crate: { speed: 42, up: 3.5, stagger: 1.00, squash: 0.90, hitstop: 0.11, shake: 0.80 },
  },
  heavyPropKnock: 1.15,  // objeto socado com o soco forte empurra 15% mais
  heldKnockMul: 1.25,    // objeto arremessado da mão empurra 25% mais (e fica mais tempo tonto)
  wallStagger: 1.3,      // tempo tonto ao bater na parede
  // --- objetos ---
  throwSpeed: 32,        // velocidade de um objeto socado
  throwHeavy: 50,        // ... com o soco forte
  // --- pegar e arremessar (tecla F) ---
  grabRange: 2.8,        // alcance para pegar um objeto
  throwHeld: 46,         // velocidade do objeto arremessado da mão
  heldThrowMul: 2,       // dano x2 (objeto arremessado da mão bate mais forte que o socado)
  aimAssistDeg: 12,      // se o boss estiver a menos de 12 graus da mira, o arremesso vai nele
  smashSelfDamage: 2,    // dano no boss ao ser arremessado contra móveis
  propSpawnEvery: 6,     // seg: cai uma caixa do teto se houver poucos objetos
  minSmallProps: 6,
  // --- boss ---
  bossName: 'O Fantasma da Casa',
  bossMaxHp: 120,       // muita vida: aguenta muitos golpes
  bossScale: 1.8,
  bossRadius: 1.0,
  bossChaseSpeed: 2.4,
  bossWindup: 0.8,      // tempo de aviso antes do ataque
  bossDashSpeed: 14,
  bossDashTime: 0.5,
  bossRecover: 1.3,     // fica atordoado: leva dano dobrado
  bossContactDamage: 6,
  bossDashDamage: 18,
  phase2At: 0.5,        // abaixo de 50% de vida: mais rápido e agressivo
};

// ---------- Hot reload (Vite HMR) ----------
// Ao salvar este arquivo, o Vite re-executa o módulo SEM recarregar a página.
// Para isso o módulo antigo se "desmonta" (dispose, no fim do arquivo) guardando
// o estado da luta, e o novo restaura esse estado. Os listeners passam por `on()`
// para poderem ser removidos, senão cada salvamento duplicaria os eventos.
const hot = import.meta.hot;
const disposers = [];
function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  disposers.push(() => target.removeEventListener(type, fn, opts));
}
let rafId = 0;

// ---------- Cena, câmera, renderer ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060c);
scene.fog = new THREE.Fog(0x07060c, 14, 32);

// Opções do jogador (menu de pausa), guardadas no navegador
const settings = { sens: 1, fov: 80 };
try {
  const saved = JSON.parse(localStorage.getItem('ghostpunch-settings') || '{}');
  if (saved.sens) settings.sens = saved.sens;
  if (saved.fov) settings.fov = saved.fov;
} catch { /* sem armazenamento: usa o padrão */ }
function saveSettings() { try { localStorage.setItem('ghostpunch-settings', JSON.stringify(settings)); } catch { /* ignora */ } }

// Primeira pessoa: a câmera fica na altura dos olhos do jogador.
let BASE_FOV = settings.fov;
const EYE_HEIGHT = 1.6;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.05, 100);
camera.rotation.order = 'YXZ'; // primeiro gira (yaw) no eixo Y, depois inclina (pitch) no X
scene.add(camera);             // necessário para os filhos da câmera (punho, lanterna) serem desenhados

// no hot reload reaproveitamos o canvas (e o contexto WebGL): trocar o canvas faria o navegador soltar o mouse
const reuse = hot?.data.canvas;
const renderer = new THREE.WebGLRenderer(reuse
  ? { canvas: hot.data.canvas, context: hot.data.gl, antialias: true }
  : { antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
if (!renderer.domElement.isConnected) document.body.appendChild(renderer.domElement);

on(window, 'resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Texturas procedurais (PLACEHOLDER: troque pelas suas) ----------
function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const plank = 64;
  for (let y = 0; y < 512; y += plank) {
    for (let x = 0; x < 512; x += 256) {
      const off = (y / plank) % 2 ? 128 : 0;
      const l = 22 + Math.random() * 10;
      g.fillStyle = `hsl(25, 35%, ${l}%)`;
      g.fillRect(x + off - 256, y, 256, plank);
      g.fillRect(x + off, y, 256, plank);
      g.strokeStyle = 'rgba(0,0,0,.6)';
      g.strokeRect(x + off, y, 256, plank);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWallTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2a4d';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#4d3a66';
  g.lineWidth = 6;
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.25)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 30, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Sala ----------
const H = CFG.roomHalf;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(H * 2, H * 2),
  new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const WALL_H = 6.5; // pé-direito alto: o uppercut lança o boss bem para cima
const wallMat = new THREE.MeshStandardMaterial({ map: makeWallTexture(), roughness: 1 });
function addWall(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
  m.position.set(x, WALL_H / 2, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
addWall(H * 2 + 1, 1, 0, -H - 0.5);
addWall(H * 2 + 1, 1, 0, H + 0.5);
addWall(1, H * 2 + 1, -H - 0.5, 0);
addWall(1, H * 2 + 1, H + 0.5, 0);

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(H * 2, H * 2),
  new THREE.MeshStandardMaterial({ color: 0x1b1428, roughness: 1 })
);
ceiling.rotation.x = Math.PI / 2; // virada para baixo
ceiling.position.y = WALL_H;
scene.add(ceiling);

// ---------- Luzes ----------
scene.add(new THREE.AmbientLight(0x4a3f7a, 0.55));
const moon = new THREE.DirectionalLight(0x8fa0ff, 0.5);
moon.position.set(-6, 12, 4);
moon.castShadow = true;
moon.shadow.camera.left = moon.shadow.camera.bottom = -H - 2;
moon.shadow.camera.right = moon.shadow.camera.top = H + 2;
scene.add(moon);

// lanterna na mão do jogador: filha da câmera, então acompanha para onde você olha
const lantern = new THREE.PointLight(0xffb36b, 30, 14, 1.6);
lantern.position.set(0.1, 0.45, 0.9); // atrás/acima da câmera, para não estourar o brilho do punho
camera.add(lantern);

// ---------- Jogador ----------
// Em primeira pessoa não há corpo visível: `player` guarda só posição (no chão)
// e rotação (yaw). A câmera é posicionada nos olhos a cada frame.
const player = new THREE.Group();
scene.add(player);

// DOIS BRAÇOS "presos" à câmera (viewmodel). Frente da câmera = -Z.
// Cada mão é um grupo próprio (punho + antebraço + punho de manga): hierarquia de transformações (aula 5).
const viewmodel = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9909f, emissive: 0x3a1124, emissiveIntensity: 0.25, roughness: 0.7 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x3d2a57, roughness: 0.9 });
const cuffMat = new THREE.MeshStandardMaterial({ color: 0xd9c7ff, roughness: 0.5 });
function makeHand(side) { // side: -1 = esquerda, +1 = direita
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinMat);
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.6, 12), sleeveMat);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.z = 0.3;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.14;
  const pivot = new THREE.Group();
  pivot.rotation.set(0.28, 0.3 * side, 0); // o braço sai para baixo e para o lado do próprio ombro
  pivot.add(forearm, cuff);
  fist.add(pivot);
  viewmodel.add(fist);
  return { fist, side, p: [0, 0, 0, 0, 0, 0, 1] };
}
const hands = [makeHand(-1), makeHand(1)]; // [0] = esquerda, [1] = direita
const fist = hands[1].fist;                // (atalho usado pelo modo debug)
camera.add(viewmodel);

// ---------- Golpes e animações (keyframes) ----------
// Uma pose = [x, y, z, rotX, rotY, rotZ, escala], escrita para a mão DIREITA; a esquerda é o espelho (x, rotY e rotZ trocam de sinal).
// Cada keyframe = [t (0 a 1 da animação), ...pose]. Entre dois keyframes a pose é interpolada suavemente.
const G = [0.30, -0.30, -0.62, -0.25, 0, 0, 1]; // posição de guarda (mãos erguidas)
const MOVES = {
  jab: { name: 'JAB', atk: 'light', dur: CFG.punchDuration, hitAt: CFG.punchHitAt, dmg: CFG.punchDamage, hands: 'alt',
    lunge: 0.5, roll: 0.025, twist: 0.03, dip: 0, kick: 0.01, fov: 2,
    prop: { speed: CFG.throwSpeed, mul: 1, knock: 1, large: 1 },
    strike: [[0, ...G], [0.14, 0.34, -0.31, -0.5, -0.25, 0, 0, 1.0], [0.40, 0.06, -0.10, -1.55, 0, -0.1, 0, 1.5], [0.58, 0.06, -0.10, -1.6, 0, -0.1, 0, 1.55], [1, ...G]],
    off: [[0, ...G], [0.35, 0.20, -0.24, -0.52, -0.4, 0.25, 0, 1], [1, ...G]] },
  cross: { name: 'CRUZADO!', atk: 'cross', dur: 0.42, hitAt: 0.46, dmg: 5, hands: 'alt',
    lunge: 0.9, roll: 0.05, twist: 0.07, dip: 0, kick: 0.03, fov: 5,
    prop: { speed: 40, mul: 1.25, knock: 1.05, large: 2 },
    strike: [[0, ...G], [0.22, 0.52, -0.44, -0.22, -0.5, 0.35, 0.45, 1.1], [0.46, -0.04, -0.12, -1.7, 0.1, -0.3, 0, 1.8], [0.62, -0.04, -0.12, -1.75, 0.1, -0.3, 0, 1.85], [1, ...G]],
    off: [[0, ...G], [0.3, 0.16, -0.18, -0.5, -0.5, 0.3, 0, 1], [1, ...G]] },
  heavy: { name: 'SOCO FORTE!', atk: 'heavy', dur: CFG.heavyDuration, hitAt: CFG.heavyHitAt, dmg: CFG.heavyDamage, hands: 'right', cd: 'heavy',
    lunge: 0.6, roll: 0.07, twist: 0.10, dip: 0, kick: 0.05, fov: 9,
    prop: { speed: CFG.throwHeavy, mul: 1.5, knock: CFG.heavyPropKnock, large: 4 },
    strike: [[0, ...G], [0.40, 0.50, 0.00, -0.45, 0.45, 0.5, -0.95, 1.25], [0.58, 0.38, -0.2, -0.9, -0.2, 0.2, -0.45, 1.55], [0.68, -0.12, -0.22, -1.62, 0, -0.3, 0.25, 1.9], [0.82, -0.14, -0.22, -1.65, 0, -0.3, 0.25, 1.95], [1, ...G]],
    off: [[0, ...G], [0.4, 0.14, -0.12, -0.45, -0.55, 0.3, 0, 1.05], [1, ...G]] },
  upper: { name: 'UPPERCUT!', atk: 'upper', dur: 0.50, hitAt: 0.55, dmg: 5, hands: 'alt', cd: 'upper',
    lunge: 0.4, roll: 0.04, twist: 0.04, dip: -0.05, kick: 0.07, fov: 6,
    prop: { speed: 5, mul: 1, knock: 1, large: 2, pop: 12 },
    strike: [[0, ...G], [0.30, 0.22, -0.80, -0.45, 0.35, 0, 0, 1.1], [0.55, 0.04, 0.10, -1.25, -1.3, 0, 0, 1.75], [0.72, 0.04, 0.12, -1.3, -1.3, 0, 0, 1.8], [1, ...G]],
    off: [[0, ...G], [0.4, 0.18, -0.2, -0.5, -0.5, 0.3, 0, 1], [1, ...G]] },
  slam: { name: 'ESMAGAR!', atk: 'slam', dur: 0.85, hitAt: 0.60, dmg: 5, hands: 'both', cd: 'slam', area: true,
    lunge: 0, roll: 0, twist: 0, dip: 0.10, kick: -0.12, fov: 10,
    strike: [[0, ...G], [0.42, 0.30, 0.45, -0.7, -0.95, 0.05, 0, 1.2], [0.60, 0.20, -0.8, -1.25, -0.1, 0, 0, 1.95], [0.78, 0.20, -0.8, -1.25, -0.1, 0, 0, 1.95], [1, ...G]] },
};
const HELD_POSE = [0.40, -0.66, -1.05, -0.2, 0.5, 0.3, 1];    // segurando objeto: as duas mãos nas laterais
const DODGE_POSE = [0.36, -0.42, -0.40, -0.3, 0, 0, 0.9];     // esquiva: braços encolhidos
for (const h of hands) h.p = [...G];

// interpola os keyframes (suavizado) e escreve a pose em `out`
function sampleKF(frames, p, out) {
  let i = 0;
  while (i < frames.length - 2 && p > frames[i + 1][0]) i++;
  const a = frames[i], b = frames[i + 1];
  let k = THREE.MathUtils.clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
  k = k * k * (3 - 2 * k);
  for (let j = 0; j < 7; j++) out[j] = a[j + 1] + (b[j + 1] - a[j + 1]) * k;
}

const state = {
  hp: CFG.playerMaxHp,
  over: null,        // null | 'win' | 'lose'
  atk: null,         // golpe em andamento: { kind, t, hand (0 esq, 1 dir, 2 ambas), hitDone } ou null
  chain: 0,          // quantos jabs seguidos (o 3º vira cruzado)
  chainT: 0,         // janela de tempo para continuar o combo
  nextHand: 0,       // próxima mão a socar (alterna esquerda/direita)
  cd: { heavy: 0, upper: 0, slam: 0 }, // recarga dos golpes especiais
  kick: { pitch: 0, roll: 0 },         // chacoalhão da câmera no impacto
  moveNameT: 0,      // tempo restante do nome do golpe na tela
  dodgeT: -1,        // <0: sem esquiva
  dodgeCD: 0,
  dodgeDir: new THREE.Vector3(),
  hurtCooldown: 0,
  shake: 0,
  time: 0,           // cronômetro da luta
  hurtFlash: 0,      // flash vermelho na tela ao levar dano
  hitstop: 0,        // congelamento curto no impacto (juice)
  combo: 0,          // golpes seguidos
  comboT: 0,
  propTimer: 0,
  held: null,        // objeto que o jogador está segurando (ou null)
  started: false,    // já clicou em Jogar alguma vez (muda o texto do menu)
  fovKick: 0,        // campo de visão se abre no impacto forte
};

// direção do olhar (primeira pessoa)
const look = { yaw: 0, pitch: 0 };
const MOUSE_SENS = 0.0022;
let locked = false;

// ---------- Entrada (aula 7.2: variáveis de estado + eventos) ----------
const keys = {};
const canvas = renderer.domElement;
on(window, 'keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') restart();
  // P pausa / continua (Esc também pausa: o navegador solta o mouse sozinho)
  if (e.code === 'KeyP') { if (locked) document.exitPointerLock(); else if (state.started) lockMouse(); }
  if (!locked) return; // pausado: ignora as ações do jogo
  if (e.code === 'Space') { e.preventDefault(); startPunch('jab'); }
  if (e.code === 'KeyE') startPunch('heavy'); // soco forte (alternativa ao botão direito)
  if (e.code === 'KeyQ') startPunch('upper'); // uppercut
  if (e.code === 'KeyC') startPunch('slam');  // esmagar (área)
  if (e.code === 'KeyF') interact();       // pegar / soltar objeto
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') startDodge();
});
on(window, 'keyup', (e) => { keys[e.code] = false; });

// Mouse look: com o Pointer Lock o mouse fica preso na janela e o evento
// mousemove passa a entregar o deslocamento (movementX/Y) em vez da posição.
on(window, 'mousemove', (e) => {
  if (!locked) return;
  look.yaw -= e.movementX * MOUSE_SENS * settings.sens;
  look.pitch -= e.movementY * MOUSE_SENS * settings.sens;
  look.pitch = THREE.MathUtils.clamp(look.pitch, -1.35, 1.35); // ~ +-77 graus
});
on(window, 'mousedown', (e) => {
  if (!locked) return; // pausado: os cliques são do menu
  if (e.button === 0) startPunch('jab');    // clique = jab / jab / cruzado
  if (e.button === 2) startPunch('heavy');  // botão direito = soco forte
});
on(window, 'contextmenu', (e) => e.preventDefault());

// ---------- Menu de pausa ----------
// O jogo está PAUSADO sempre que o mouse não está capturado (Esc, P, trocar de janela ou antes do primeiro clique).
const elMenu = document.getElementById('menu');
const elMenuTitle = document.getElementById('menuTitle');
const elMenuSub = document.getElementById('menuSub');
const elMenuMsg = document.getElementById('menuMsg');
const elBtnPlay = document.getElementById('btnPlay');
const elBtnRestart = document.getElementById('btnRestart');
const elOptSens = document.getElementById('optSens');
const elOptSensV = document.getElementById('optSensV');
const elOptFov = document.getElementById('optFov');
const elOptFovV = document.getElementById('optFovV');

function lockMouse() {
  elMenuMsg.textContent = '';
  canvas.requestPointerLock?.();
}
function updateMenu() {
  const paused = !locked && !state.over;
  elMenu.style.display = paused ? 'flex' : 'none';
  if (!paused) return;
  elMenuTitle.textContent = state.started ? 'Pausado' : 'Ghostpunch Mini';
  elMenuSub.textContent = state.started ? 'O jogo está parado' : 'Boss fight em primeira pessoa';
  elBtnPlay.textContent = state.started ? 'Continuar' : 'Jogar';
  elBtnRestart.style.display = state.started ? '' : 'none';
}
function refreshOptionLabels() {
  elOptSens.value = settings.sens; elOptSensV.textContent = settings.sens.toFixed(2) + 'x';
  elOptFov.value = settings.fov;   elOptFovV.textContent = settings.fov + '°';
}
refreshOptionLabels();

on(document, 'pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) state.started = true;
  updateMenu();
});
on(document, 'pointerlockerror', () => {
  elMenuMsg.textContent = 'O navegador não deixou capturar o mouse agora. Espere um instante e clique de novo.';
});
on(elBtnPlay, 'click', lockMouse);
on(elBtnRestart, 'click', () => { restart(); lockMouse(); });
on(elOptSens, 'input', () => { settings.sens = +elOptSens.value; refreshOptionLabels(); saveSettings(); });
on(elOptFov, 'input', () => { settings.fov = +elOptFov.value; BASE_FOV = settings.fov; refreshOptionLabels(); saveSettings(); });

// ---------- Boss (fantasma: menina de vestido branco, cabelo preto comprido) ----------
// Modelo feito só de primitivas, em hierarquia: boss > bossVis (inclinação) > vestido, braços (cada um com pivô no ombro) e cabeça (rosto + cabelo).
const bossMat = new THREE.MeshStandardMaterial({            // vestido: translúcido, a cor emissiva mostra o estado do boss
  color: 0xe9e6ee, emissive: 0x4fa8ff, emissiveIntensity: 0.7,
  transparent: true, opacity: 0.9, roughness: 0.8, side: THREE.DoubleSide,
});
const bossSkin = new THREE.MeshStandardMaterial({ color: 0xc9c7c4, emissive: 0x4fa8ff, emissiveIntensity: 0.25, roughness: 0.6 });
const bossHair = new THREE.MeshStandardMaterial({ color: 0x060509, roughness: 1 });
const bossEyeGlow = new THREE.MeshBasicMaterial({ color: 0x4fa8ff });  // olhos brilham na cor do estado
const bossDark = new THREE.MeshBasicMaterial({ color: 0x000000 });
const boss = new THREE.Group();
const bossVis = new THREE.Group();
boss.add(bossVis);

// vestido: cone largo (facetado, parece rasgado) + tiras compridas e desiguais na barra
const dress = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.45, 9, 1, true), bossMat);
dress.position.y = 0.78;
bossVis.add(dress);
const hemStrips = [];
for (let i = 0; i < 11; i++) {
  const ang = (i / 11) * Math.PI * 2, len = 0.35 + ((i * 37) % 10) / 10 * 0.45;
  const pivot = new THREE.Group();
  pivot.position.set(Math.sin(ang) * 0.58, 0.1, Math.cos(ang) * 0.58);
  pivot.rotation.y = ang;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, len, 0.015), bossMat);
  strip.position.y = -len / 2;
  pivot.add(strip);
  bossVis.add(pivot);
  hemStrips.push(pivot);
}

// braços compridos demais, pendurados; cada um gira em torno do ombro; mãos com dedos finos e longos
function makeGhostArm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.3, 1.4, 0.02);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.25, 8), bossSkin);
  arm.position.y = -0.625;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bossSkin);
  hand.position.y = -1.27;
  shoulder.add(arm, hand);
  for (let f = 0; f < 4; f++) {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.22, 0.018), bossSkin);
    finger.position.set((f - 1.5) * 0.03, -1.4, 0);
    finger.rotation.z = (f - 1.5) * 0.12;
    shoulder.add(finger);
  }
  bossVis.add(shoulder);
  return shoulder;
}
const ghostArms = [makeGhostArm(-1), makeGhostArm(1)];

// cabeça: rosto pálido, olhos fundos com brilho, boca, cabelo repartido ao meio e mechas longas
const bossTop = new THREE.Group(); // (nome mantido: é o que flutua e se inclina)
const face = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), bossSkin);
face.scale.set(0.9, 1.18, 0.95);
bossTop.add(face);
for (const side of [-1, 1]) {
  const socket = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bossDark);
  socket.scale.set(0.8, 1.7, 0.4);
  socket.position.set(side * 0.095, 0.05, 0.235);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), bossEyeGlow);
  glow.position.set(side * 0.095, 0.05, 0.255);
  bossTop.add(socket, glow);
}
const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bossDark);
mouth.scale.set(0.7, 1.4, 0.35);
mouth.position.set(0, -0.14, 0.25);
bossTop.add(mouth);
// cabelo: massa atrás e em cima, duas cortinas na frente (deixam só uma fresta no meio do rosto)
const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), bossHair);
hairBack.scale.set(1.05, 1.25, 1.0); hairBack.position.set(0, 0.02, -0.07);
bossTop.add(hairBack);
for (const side of [-1, 1]) {
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.75, 0.1), bossHair);
  curtain.position.set(side * 0.2, -0.12, 0.2);
  curtain.rotation.set(0, side * -0.35, side * 0.08);
  bossTop.add(curtain);
}
// mechas compridas penduradas (balançam)
const hairStrands = [];
for (let i = 0; i < 16; i++) {
  const ang = (i / 16) * Math.PI * 2, len = 0.9 + ((i * 53) % 10) / 10 * 0.7;
  const pivot = new THREE.Group();
  pivot.position.set(Math.sin(ang) * 0.27, -0.1, Math.cos(ang) * 0.24 - 0.04);
  const strand = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.03), bossHair);
  strand.position.y = -len / 2;
  pivot.add(strand);
  bossTop.add(pivot);
  hairStrands.push(pivot);
}
const BOSS_HEAD_Y = 1.62;
bossTop.position.y = BOSS_HEAD_Y;
bossVis.add(bossTop);

const bossLight = new THREE.PointLight(0x4fa8ff, 6, 8);
bossLight.position.y = 1.4;
boss.add(bossLight);
boss.scale.setScalar(CFG.bossScale);
scene.add(boss);

// animação do fantasma: braços, cabeça em espasmos, cabelo e barra balançando
const ghostAnim = { twitchT: 0, headZ: 0, headTarget: 0, armX: [0, 0], armZ: [0.12, -0.12], lean: 0 };
function animateGhost(dt, t) {
  // cabeça: de tempos em tempos "estala" para um lado (movimento em degraus, nada suave de propósito)
  ghostAnim.twitchT -= dt;
  if (ghostAnim.twitchT <= 0) {
    ghostAnim.twitchT = 0.35 + Math.random() * 1.1;
    ghostAnim.headTarget = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.45);
  }
  let armX = Math.sin(t * 1.3) * 0.12, armSpread = 0.12, lean = 0.12, headLoll = null;
  if (B.mode === 'windup') {                 // aviso: ergue os braços para frente e inclina o corpo
    const k = Math.min(1, B.t / (CFG.bossWindup * (B.phase2 ? 0.7 : 1)));
    armX = -1.5 * k + Math.sin(t * 40) * 0.06 * k; armSpread = 0.05; lean = 0.12 + 0.35 * k; headLoll = 0; ghostAnim.headZ += (Math.sin(t * 50) * 0.08 - ghostAnim.headZ) * 0.5;
  } else if (B.mode === 'dash') {            // avanço: braços esticados à frente, em garras
    armX = -1.75; armSpread = 0.02; lean = 0.55; headLoll = 0;
  } else if (B.mode === 'stun') {            // tonto: braços soltos, cabeça mole para o lado
    armX = 0.25 + Math.sin(t * 9) * 0.25; armSpread = 0.5; lean = -0.1; headLoll = 0.75;
  } else if (B.mode === 'dying') {
    armX = 0.4; armSpread = 0.7; lean = 0; headLoll = 0.9;
  }
  if (B.launch && B.mode !== 'dying') { armX = -0.6 + Math.sin(t * 22) * 0.5; armSpread = 0.9 + Math.sin(t * 17) * 0.3; }
  const k = 1 - Math.exp(-dt * 10);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    ghostAnim.armX[i] += (armX + (i ? 0.25 : 0) * Math.sin(t * 1.9) - ghostAnim.armX[i]) * k;
    ghostAnim.armZ[i] += (side * armSpread - ghostAnim.armZ[i]) * k;
    ghostArms[i].rotation.set(ghostAnim.armX[i], 0, ghostAnim.armZ[i]);
  }
  ghostAnim.lean += (lean - ghostAnim.lean) * k;
  bossVis.rotation.x = ghostAnim.lean;
  if (headLoll !== null) {
    ghostAnim.headZ += (headLoll * (Math.sin(t * 0.7) > 0 ? 1 : -1) - ghostAnim.headZ) * (1 - Math.exp(-dt * 12));
  } else {
    ghostAnim.headZ += (ghostAnim.headTarget - ghostAnim.headZ) * (1 - Math.exp(-dt * 30));
  }
  bossTop.rotation.z = ghostAnim.headZ;
  bossTop.rotation.x = -ghostAnim.lean * 0.6; // a cabeça continua olhando para frente quando o corpo se inclina
  hairStrands.forEach((h, i) => { h.rotation.z = Math.sin(t * 1.6 + i) * 0.1; h.rotation.x = Math.sin(t * 1.2 + i * 0.7) * 0.12; });
  hemStrips.forEach((h, i) => { h.rotation.x = Math.sin(t * 2 + i * 1.3) * 0.15; });
}

const B = {
  hp: CFG.bossMaxHp,
  mode: 'chase',     // chase | windup | dash | stun | dying
  t: 0,              // tempo no estado atual
  chaseTime: 2,      // quanto tempo persegue antes de atacar
  vel: new THREE.Vector3(),
  dashDir: new THREE.Vector3(),
  flash: 0,
  bob: 0,
  phase2: false,
  launch: false,     // sendo arremessado
  stunDur: 0,        // quanto tempo dura o estado 'stun' atual
  vy: 0,             // velocidade vertical (pulinho ao ser atingido)
  squash: 0,         // amassado ao ser atingido (1 -> 0)
  spin: 10,          // velocidade do giro enquanto voa (depende da força do golpe)
};

function setBossMode(m) { B.mode = m; B.t = 0; }

function bossReset() {
  B.hp = CFG.bossMaxHp; B.phase2 = false; B.flash = 0; B.vel.set(0, 0, 0); B.launch = false; B.stunDur = 0; B.vy = 0; B.squash = 0; B.spin = 10;
  B.chaseTime = 2.5;
  setBossMode('chase');
  boss.position.set(0, 0, -H + 3);
  boss.scale.setScalar(CFG.bossScale);
  boss.rotation.set(0, 0, 0);
}

const UP = new THREE.Vector3(0, 1, 0);

// ---------- Esquiva ----------
function startDodge() {
  if (state.over || state.dodgeT >= 0 || state.dodgeCD > 0) return;
  // esquiva na direção do movimento; sem movimento, para trás da mira
  state.dodgeDir.set(
    (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    0,
    (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0)
  );
  if (state.dodgeDir.lengthSq() === 0) state.dodgeDir.set(0, 0, 1); // sem direção: pula para trás
  state.dodgeDir.normalize().applyAxisAngle(UP, look.yaw);     // relativo para onde você olha
  state.dodgeT = 0;
  state.dodgeCD = CFG.dodgeCooldown;
}

// ---------- Soco ----------
function startPunch(kind = 'jab') {
  if (state.held) { if (!state.over) throwHeld(); return; } // com um objeto na mão, atacar = arremessar
  if (state.over || state.atk) return;
  if (MOVES[kind].cd && state.cd[MOVES[kind].cd] > 0) return;
  // combo: jab, jab, CRUZADO (o 3º golpe seguido é mais forte); a janela fecha se você demorar
  if (kind === 'jab') {
    if (state.chainT <= 0) state.chain = 0;
    if (state.chain % 3 === 2) kind = 'cross';
    state.chain++;
  }
  const M = MOVES[kind];
  if (M.cd) state.cd[M.cd] = CFG.cooldowns[M.cd];
  const hand = M.hands === 'right' ? 1 : M.hands === 'both' ? 2 : state.nextHand;
  if (M.hands === 'alt') state.nextHand ^= 1;
  state.atk = { kind, t: 0, hand, hitDone: false };
  state.moveNameT = 0.8;
  elMoveName.textContent = M.name;
}

const fwd = new THREE.Vector3();
const toBoss = new THREE.Vector3();

// dano no boss (usado pelo soco e pela batida na parede)
function damageBoss(amount) {
  B.hp -= amount;
  B.flash = 0.12;
  if (!B.phase2 && B.hp <= CFG.bossMaxHp * CFG.phase2At) {
    B.phase2 = true;
    state.shake = 0.8;
  }
  if (B.hp <= 0 && B.mode !== 'dying') {
    B.hp = 0;
    setBossMode('dying');
    state.over = 'win';
    state.shake = 1;
  }
}

// efeitos de impacto: congela o jogo por um instante, amassa o boss e conta o combo
function registerHit(stop, squash = 1) {
  state.hitstop = Math.max(state.hitstop, stop);
  state.combo++;
  state.comboT = 2;
  B.squash = squash;
}

// todo golpe desloca o boss: velocidade horizontal + pulinho, e ele fica tonto por um tempo
// `atk` é um perfil de CFG.attacks (leve, pesado, ou o objeto que acertou); `boost` > 1 reforça tudo
function launchBoss(dir, atk, boost = 1) {
  const speed = atk.speed * boost;
  B.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
  B.vy = atk.up * boost;                                           // pulo vertical (knock-up)
  B.spin = atk.spin ?? 4 + 12 * Math.min(1, speed / CFG.attacks.heavy.speed);  // golpe forte = gira muito mais
  B.launch = true;
  if (B.mode !== 'dying') {
    B.stunDur = atk.stagger + (boost - 1) * 1.2;
    setBossMode('stun'); // cancela qualquer ataque do boss
  }
}

// o golpe acerta um alvo? devolve a direção (horizontal, normalizada) ou null
const punchTmp = new THREE.Vector3();
const punchDirV = new THREE.Vector3();
function punchDirTo(pos, radius, range = CFG.punchRange) {
  punchTmp.subVectors(pos, player.position).setY(0);
  const dist = punchTmp.length();
  if (dist - radius > range) return null;
  if (dist < 0.001) return punchDirV.copy(fwd);
  punchTmp.divideScalar(dist);
  // produto escalar: o alvo está dentro do cone à frente?
  if (fwd.dot(punchTmp) < Math.cos(CFG.punchAngle)) return null;
  return punchDirV.copy(punchTmp);
}

function applyMoveHit(kind) {
  const M = MOVES[kind];
  fwd.set(0, 0, -1).applyQuaternion(player.quaternion);
  state.kick.pitch += M.kick;                       // a câmera dá um tranco no impacto
  state.kick.roll += (state.atk?.hand === 1 ? -1 : 1) * M.roll * 1.5;
  if (M.area) { applySlam(M); return; }

  // --- boss: SEMPRE leva dano e é empurrado ---
  if (B.mode !== 'dying') {
    const d = punchDirTo(boss.position, CFG.bossRadius, M.range);
    if (d) {
      const atk = CFG.attacks[M.atk];
      const air = boss.position.y > 0.5; // boss no ar: combo aéreo (juggle) = mais dano e ele continua subindo
      damageBoss(M.dmg * (air ? 1.5 : 1));
      launchBoss(d, atk);
      if (air) B.vy = Math.max(B.vy, 8);
      registerHit(atk.hitstop, atk.squash);
      state.shake = atk.shake;
      state.fovKick = M.fov; // o campo de visão "dá um soco" no impacto
    }
  }

  // --- objetos: pequenos viram projéteis (ou sobem, no uppercut), grandes quebram ---
  for (const p of [...props]) {
    if (p.thrown || p.held) continue;
    const d = punchDirTo(p.obj.position, p.T.radius);
    if (!d) continue;
    if (p.T.size === 'small') {
      if (M.prop.pop) { launchProp(p, d, M.prop.speed, false); p.vel.y = M.prop.pop; } // uppercut: o objeto sobe
      else launchProp(p, d, M.prop.speed, true, M.prop.mul, M.prop.knock);
      state.hitstop = Math.max(state.hitstop, 0.04);
      state.shake = Math.max(state.shake, 0.25);
    } else {
      damageProp(p, M.prop.large, d);
    }
  }
}

// ESMAGAR: onda de choque em volta do jogador, empurra boss e objetos para longe
const shockwaves = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
function spawnShockwave(pos, R) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe3a8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, 0.06, pos.z);
  scene.add(m);
  shockwaves.push({ m, t: 0, R });
}
function updateShockwaves(dt) {
  for (const w of [...shockwaves]) {
    w.t += dt;
    const k = w.t / 0.4;
    w.m.scale.setScalar(0.3 + k * w.R);
    w.m.material.opacity = 0.9 * Math.max(0, 1 - k);
    if (k >= 1) { scene.remove(w.m); w.m.material.dispose(); shockwaves.splice(shockwaves.indexOf(w), 1); }
  }
}
const slamDir = new THREE.Vector3();
function applySlam(M) {
  const R = CFG.slamRadius;
  spawnShockwave(player.position, R);
  spawnDebris(player.position, 0x8a8299, 16, null, 0); // poeira/pedaços do chão
  state.shake = 1;
  state.fovKick = M.fov;
  state.hitstop = Math.max(state.hitstop, 0.1);
  if (B.mode !== 'dying') {
    slamDir.subVectors(boss.position, player.position).setY(0);
    const dist = slamDir.length();
    if (dist < R + CFG.bossRadius) {
      if (dist < 0.01) slamDir.set(0, 0, -1).applyAxisAngle(UP, look.yaw); else slamDir.divideScalar(dist);
      const atk = CFG.attacks.slam;
      damageBoss(M.dmg);
      launchBoss(slamDir, atk, 1 - 0.4 * Math.min(1, dist / R)); // quanto mais perto, mais forte
      registerHit(atk.hitstop, atk.squash);
    }
  }
  for (const p of [...props]) {
    if (p.thrown || p.held) continue;
    slamDir.set(p.obj.position.x - player.position.x, 0, p.obj.position.z - player.position.z);
    const dist = slamDir.length();
    if (dist > R + p.T.radius) continue;
    if (dist < 0.01) slamDir.set(0, 0, -1); else slamDir.divideScalar(dist);
    if (p.T.size === 'small') launchProp(p, slamDir, 26, true, 1, 1);
    else damageProp(p, 2, slamDir);
  }
}

// ---------- Objetos: móveis destrutíveis e projéteis ----------
const props = [];
const debris = [];
const matCache = {};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function mat(color, rough = 0.85) { return (matCache[color] ??= new THREE.MeshStandardMaterial({ color, roughness: rough })); }
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// cada tipo: tamanho (small = arremessável, large = quebra), raio de colisão, dano ao acertar o boss, vida, cor dos estilhaços
const PROP_TYPES = {
  chair: { size: 'small', radius: 0.45, dmg: 6, hp: 1, color: 0x8a5a33, build(g) {
    g.add(box(0.6, 0.08, 0.6, 0x8a5a33, 0, 0.5, 0), box(0.6, 0.7, 0.08, 0x8a5a33, 0, 0.9, -0.26));
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) g.add(box(0.07, 0.5, 0.07, 0x6b4426, x, 0.25, z));
  } },
  crate: { size: 'small', radius: 0.5, dmg: 8, hp: 1, color: 0xa8763e, build(g) {
    g.add(box(0.8, 0.8, 0.8, 0xa8763e, 0, 0.4, 0));
    for (const y of [0.04, 0.76]) g.add(box(0.84, 0.08, 0.84, 0x7a5228, 0, y, 0));
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) g.add(box(0.08, 0.84, 0.08, 0x7a5228, x, 0.4, z));
  } },
  vase: { size: 'small', radius: 0.32, dmg: 5, hp: 1, color: 0x3f8f9a, build(g) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mat(0x3f8f9a, 0.35));
    body.position.y = 0.38; body.scale.y = 1.25; body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.25, 12), mat(0x2f737d, 0.35));
    neck.position.y = 0.85; neck.castShadow = true;
    g.add(body, neck);
  } },
  plank: { size: 'small', radius: 0.5, dmg: 5, hp: 1, color: 0x9a6a3a, build(g) {
    g.add(box(1.2, 0.1, 0.26, 0x9a6a3a, 0, 0.1, 0));
  } },
  barrel: { size: 'small', radius: 0.42, dmg: 7, hp: 1, color: 0x3f5f8a, build(g) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 16), mat(0x3f5f8a, 0.5));
    b.position.y = 0.475; b.castShadow = true; g.add(b);
    for (const y of [0.2, 0.75]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.07, 16), mat(0x9aa7b8, 0.4)); r.position.y = y; g.add(r); }
  } },
  tv: { size: 'small', radius: 0.5, dmg: 9, hp: 1, color: 0x2a2a35, build(g) {
    g.add(box(0.95, 0.7, 0.5, 0x2a2a35, 0, 0.45, 0), box(0.5, 0.1, 0.3, 0x1a1a22, 0, 0.05, 0));
    const scr = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x10202a, emissive: 0x3b7bd1, emissiveIntensity: 0.9, roughness: 0.3 }));
    scr.scale.set(0.8, 0.55, 0.04); scr.position.set(0, 0.47, 0.26); g.add(scr);
  } },
  ball: { size: 'small', radius: 0.32, dmg: 10, hp: 1, color: 0x3b1d6b, build(g) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), mat(0x3b1d6b, 0.2));
    b.position.y = 0.3; b.castShadow = true; g.add(b);
    for (const [x, y] of [[-0.07, 0.42], [0.07, 0.42], [0, 0.32]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat(0xdddddd, 0.6)); h.position.set(x, y, 0.27); g.add(h); }
  } },
  pillow: { size: 'small', radius: 0.45, dmg: 1, hp: 1, color: 0xe7d3b8, build(g) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat(0xe7d3b8, 0.95));
    b.scale.set(1, 0.35, 0.8); b.position.y = 0.16; b.castShadow = true; g.add(b);
  } },
  sofa: { size: 'large', radius: 1.35, hp: 4, color: 0x7a2f3f, chunks: ['pillow', 'pillow'], build(g) {
    g.add(box(2.4, 0.5, 1.0, 0x7a2f3f, 0, 0.35, 0), box(2.4, 0.8, 0.25, 0x6a2535, 0, 0.9, -0.4));
    for (const x of [-1.1, 1.1]) g.add(box(0.25, 0.75, 1.0, 0x6a2535, x, 0.55, 0));
    for (const x of [-0.5, 0.5]) g.add(box(0.95, 0.2, 0.8, 0x9a4455, x, 0.68, 0.05));
  } },
  fridge: { size: 'large', radius: 0.75, hp: 5, color: 0xd9e0e6, build(g) {
    g.add(box(0.9, 2.1, 0.8, 0xd9e0e6, 0, 1.05, 0), box(0.92, 0.03, 0.82, 0x9aa3ab, 0, 1.45, 0));
    g.add(box(0.05, 0.5, 0.05, 0x6b737a, 0.32, 1.75, 0.42), box(0.05, 0.5, 0.05, 0x6b737a, 0.32, 1.0, 0.42));
  } },
  table: { size: 'large', radius: 1.1, hp: 3, color: 0x7b4f2c, build(g) {
    g.add(box(2.0, 0.12, 1.1, 0x7b4f2c, 0, 0.8, 0));
    for (const [x, z] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]]) g.add(box(0.1, 0.78, 0.1, 0x5e3a1f, x, 0.39, z));
  } },
  shelf: { size: 'large', radius: 0.95, hp: 4, color: 0x5e3a1f, build(g) {
    g.add(box(1.6, 2.4, 0.5, 0x5e3a1f, 0, 1.2, 0));
    const cols = [0xb23a48, 0x3a6ea5, 0xd9a441, 0x4f8f5f, 0x8a5aa8];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++)
      g.add(box(0.14, 0.5, 0.36, cols[(i + row) % cols.length], -0.6 + i * 0.2, 0.55 + row * 0.7, 0.1));
  } },
};

function createProp(type, x, z, y = 0, rotY = Math.random() * Math.PI * 2) {
  const T = PROP_TYPES[type];
  const g = new THREE.Group();
  T.build(g);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  scene.add(g);
  const p = { type, T, obj: g, hp: T.hp, vel: new THREE.Vector3(), thrown: false, held: false, falling: y > 0.01, wobble: 0, spin: new THREE.Vector3(), dmgMul: 1, knock: 1 };
  props.push(p);
  return p;
}
function removeProp(p) { p.obj.removeFromParent(); const i = props.indexOf(p); if (i >= 0) props.splice(i, 1); }
function clearProps() {
  for (const p of [...props]) removeProp(p);
  for (const d of debris) scene.remove(d.mesh);
  debris.length = 0;
}

function spawnLayout() {
  clearProps();
  createProp('table', 4.5, -3, 0, 0.3);
  createProp('chair', 2.8, -3.6);
  createProp('chair', 6.0, -2.0);
  createProp('chair', -4.6, 2.6);
  createProp('chair', 4.4, 1.2);
  createProp('shelf', -7.6, -2, 0, Math.PI / 2);
  createProp('shelf', -7.6, 3, 0, Math.PI / 2);
  createProp('sofa', -4.5, -8.0, 0, 0);
  createProp('fridge', 7.9, 3.5, 0, -Math.PI / 2);
  createProp('crate', -3, -5);
  createProp('crate', 3, 4);
  createProp('crate', -5, 5.5);
  createProp('barrel', -6.5, 0.2);
  createProp('barrel', 7.2, -6.5);
  createProp('barrel', 6.6, 7.2);
  createProp('tv', -2.5, 3.5, 0, 0.5);
  createProp('ball', 1.5, -1.2);
  createProp('ball', -6.5, 7);
  createProp('pillow', 2.2, -6.9);
  createProp('pillow', -0.8, 3.2);
  createProp('pillow', 4.5, 6.5);
  createProp('vase', 6.5, 5);
  createProp('vase', -2, 1.5);
  createProp('vase', 2.5, 7.8);
}

function launchProp(p, dir, speed, thrown, dmgMul = 1, knock = 1) {
  p.vel.set(dir.x * speed, 0, dir.z * speed);
  p.thrown = thrown;
  p.falling = !thrown;
  if (!thrown) p.vel.y = 5 + Math.random() * 3;
  p.dmgMul = dmgMul;
  p.knock = knock; // multiplica o empurrão no boss
  p.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8);
  if (thrown) p.obj.position.y = Math.max(p.obj.position.y, 0.8);
}

function spawnDebris(pos, color, n, dir, force) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(boxGeo, mat(color));
    const sz = 0.08 + Math.random() * 0.16;
    m.scale.set(sz, sz * (0.4 + Math.random()), sz * (0.6 + Math.random()));
    m.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y + 0.3 + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 0.5);
    m.castShadow = true;
    scene.add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6);
    if (dir) v.addScaledVector(dir, force * (0.4 + Math.random() * 0.6));
    debris.push({ mesh: m, vel: v, spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14), life: 3 + Math.random() * 2 });
  }
  while (debris.length > 160) scene.remove(debris.shift().mesh); // limite para não pesar
}

function breakProp(p, dir, force = 10) {
  const pos = p.obj.position;
  const large = p.T.size === 'large';
  spawnDebris(pos, p.T.color, large ? 18 : 9, dir, force);
  if (large) {
    // móvel grande vira tábuas arremessáveis
    for (const chunk of p.T.chunks ?? ['plank', 'plank']) {
      const q = createProp(chunk, pos.x, pos.z, 0.8);
      const ang = (Math.random() - 0.5) * 2.2;
      const d = new THREE.Vector3(dir.x, 0, dir.z).applyAxisAngle(UP, ang);
      launchProp(q, d, 10 + Math.random() * 8, false);
    }
  }
  state.shake = Math.max(state.shake, large ? 0.6 : 0.25);
  removeProp(p);
}

function damageProp(p, amount, dir) {
  p.hp -= amount;
  p.wobble = 1;
  spawnDebris(p.obj.position, p.T.color, 3, dir, 6);
  state.shake = Math.max(state.shake, 0.3);
  if (p.hp <= 0) breakProp(p, dir, 16);
}

function hitBossWithProp(p, dir) {
  const atk = CFG.attacks[p.type] ?? CFG.attacks.chair; // cada objeto empurra de um jeito (vaso < tábua < cadeira < caixa)
  damageBoss(p.T.dmg * p.dmgMul);
  launchBoss(dir, atk, p.knock);
  registerHit(atk.hitstop, atk.squash);
  state.shake = Math.max(state.shake, atk.shake);
  breakProp(p, dir, 12);
}

const propDir = new THREE.Vector3();
function updateProps(dt, t) {
  for (const p of [...props]) {
    if (p.held) continue; // na mão do jogador: não tem física
    const o = p.obj;
    // balançar quando levou dano
    p.wobble = Math.max(0, p.wobble - dt * 3);
    if (p.wobble > 0) o.rotation.z = Math.sin(t * 45) * p.wobble * 0.12;

    const moving = p.thrown || p.falling || p.vel.lengthSq() > 0.01;
    if (!moving) continue;
    const hs = Math.hypot(p.vel.x, p.vel.z);

    if (p.thrown && hs > 10) {
      // voo reto na altura do peito, girando
      o.position.y += (1.1 - o.position.y) * Math.min(1, dt * 12);
      o.rotation.x += p.spin.x * dt;
      o.rotation.y += p.spin.y * dt;
      p.vel.x *= Math.pow(0.45, dt); p.vel.z *= Math.pow(0.45, dt);
    } else {
      // perdeu velocidade: cai e fica no chão (pode ser socado de novo)
      p.thrown = false;
      p.vel.y -= 24 * dt;
      o.position.y += p.vel.y * dt;
      const settle = Math.min(1, dt * 8);
      o.rotation.x -= o.rotation.x * settle;
      o.rotation.z -= o.rotation.z * settle;
      if (o.position.y <= 0) {
        o.position.y = 0; p.vel.y = 0; p.falling = false;
        p.vel.x *= Math.pow(0.02, dt); p.vel.z *= Math.pow(0.02, dt);
      }
      if (!p.falling) { p.vel.x *= Math.pow(0.02, dt); p.vel.z *= Math.pow(0.02, dt); if (p.vel.lengthSq() < 0.05) p.vel.set(0, 0, 0); }
    }
    o.position.x += p.vel.x * dt;
    o.position.z += p.vel.z * dt;

    if (!p.thrown) { clampToRoom(o.position, 0.7); continue; }

    propDir.set(p.vel.x, 0, p.vel.z).normalize();
    // bateu na parede: estilhaça
    const lim = H - 0.7;
    if (Math.abs(o.position.x) > lim || Math.abs(o.position.z) > lim) { breakProp(p, propDir, 10); continue; }
    // acertou o boss
    if (B.mode !== 'dying') {
      const dx = o.position.x - boss.position.x, dz = o.position.z - boss.position.z;
      const r = CFG.bossRadius + p.T.radius;
      if (dx * dx + dz * dz < r * r) { hitBossWithProp(p, propDir); continue; }
    }
    // acertou móvel grande
    let broke = false;
    for (const q of props) {
      if (q === p || q.thrown || q.T.size !== 'large') continue;
      const dx = o.position.x - q.obj.position.x, dz = o.position.z - q.obj.position.z;
      const r = q.T.radius + p.T.radius;
      if (dx * dx + dz * dz < r * r) { damageProp(q, 2, propDir); breakProp(p, propDir, 10); broke = true; break; }
    }
    if (broke) continue;
  }
}

function updateDebris(dt) {
  for (const d of [...debris]) {
    const m = d.mesh;
    d.vel.y -= 22 * dt;
    m.position.addScaledVector(d.vel, dt);
    m.rotation.x += d.spin.x * dt; m.rotation.y += d.spin.y * dt; m.rotation.z += d.spin.z * dt;
    if (m.position.y < 0.05) {
      m.position.y = 0.05;
      d.vel.y = Math.abs(d.vel.y) > 2 ? -d.vel.y * 0.35 : 0;
      d.vel.x *= Math.pow(0.02, dt); d.vel.z *= Math.pow(0.02, dt);
      d.spin.multiplyScalar(0.9);
    }
    d.life -= dt;
    if (d.life < 1) m.scale.multiplyScalar(Math.max(0, 1 - dt * 2));
    if (d.life <= 0) { scene.remove(m); debris.splice(debris.indexOf(d), 1); }
  }
}

// o jogador não atravessa móveis parados
function pushPlayerOutOfProps() {
  for (const p of props) {
    if (p.thrown || p.held || p.falling || p.vel.lengthSq() > 1) continue;
    const dx = player.position.x - p.obj.position.x, dz = player.position.z - p.obj.position.z;
    const r = p.T.radius * 0.85 + 0.45;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      player.position.x += (dx / d) * (r - d);
      player.position.z += (dz / d) * (r - d);
    }
  }
}

// ---------- Pegar e arremessar objetos (tecla F) ----------
const LABELS = { chair: 'cadeira', crate: 'caixa', vase: 'vaso', plank: 'tábua', barrel: 'barril', tv: 'TV', ball: 'bola de boliche', pillow: 'almofada' };
const SMALL_TYPES = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].size === 'small' && k !== 'plank');
const elPrompt = document.getElementById('prompt');
const throwDir = new THREE.Vector3();
const toB = new THREE.Vector3();

// objeto pequeno, parado, à frente e ao alcance: o mais próximo
function findGrabbable() {
  fwd.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
  let best = null, bestD = Infinity;
  for (const p of props) {
    if (p.T.size !== 'small' || p.thrown || p.held || p.falling || p.vel.lengthSq() > 1) continue;
    if (!punchDirTo(p.obj.position, p.T.radius, CFG.grabRange)) continue;
    const d = Math.hypot(p.obj.position.x - player.position.x, p.obj.position.z - player.position.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function setCastShadow(obj, on) { obj.traverse((m) => { if (m.isMesh) m.castShadow = on; }); }

function interact() {
  if (state.over) return;
  if (state.held) { dropHeld(); return; }
  const p = findGrabbable();
  if (!p) return;
  // o objeto sai da cena e vira FILHO DA CÂMERA: passa a acompanhar o olhar (hierarquia de transformações)
  state.held = p;
  p.held = true;
  p.vel.set(0, 0, 0);
  camera.add(p.obj);
  p.obj.position.set(0.05, -0.78, -1.25);
  p.obj.rotation.set(0.25, 0.6, 0);
  p.obj.scale.setScalar(0.5);
  setCastShadow(p.obj, false);
  state.shake = Math.max(state.shake, 0.1);
}

// devolve o objeto da mão para a cena, na posição do mundo dada
function releaseHeld(x, y, z) {
  const p = state.held;
  state.held = null;
  p.held = false;
  p.obj.removeFromParent();
  scene.add(p.obj);
  p.obj.scale.setScalar(1);
  p.obj.rotation.set(0, Math.random() * Math.PI * 2, 0);
  p.obj.position.set(x, y, z);
  setCastShadow(p.obj, true);
  return p;
}

function dropHeld() {
  if (!state.held) return;
  fwd.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
  const p = releaseHeld(player.position.x + fwd.x * 1.2, 0.9, player.position.z + fwd.z * 1.2);
  clampToRoom(p.obj.position, 0.8);
  p.falling = true; // cai no chão e pode ser pego de novo
}

function throwHeld() {
  if (!state.held) return;
  // direção: para onde você olha; MIRA ASSISTIDA: se o boss está quase na mira, o arremesso vai direto nele
  throwDir.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
  if (B.mode !== 'dying') {
    toB.subVectors(boss.position, player.position).setY(0);
    const dist = toB.length();
    if (dist > 0.1) {
      toB.divideScalar(dist);
      if (throwDir.dot(toB) > Math.cos(THREE.MathUtils.degToRad(CFG.aimAssistDeg))) throwDir.copy(toB);
    }
  }
  const p = releaseHeld(player.position.x + throwDir.x * 0.9, 1.2, player.position.z + throwDir.z * 0.9);
  launchProp(p, throwDir, CFG.throwHeld, true, CFG.heldThrowMul, CFG.heldKnockMul);
  state.shake = Math.max(state.shake, 0.3);
  state.hitstop = Math.max(state.hitstop, 0.03);
}

// o objeto na mão balança de leve; mostra a dica na tela
function updateHeld(t) {
  if (state.held) {
    const o = state.held.obj;
    o.position.y = -0.78 + Math.sin(t * 3) * 0.012;
    o.rotation.y = 0.6 + Math.sin(t * 1.7) * 0.05;
  }
  let msg = '';
  if (state.over) msg = '';
  else if (state.held) msg = 'Clique = ARREMESSAR  ·  F = soltar';
  else { const g = findGrabbable(); if (g) msg = 'F = pegar ' + LABELS[g.type]; }
  if (elPrompt.textContent !== msg) elPrompt.textContent = msg;
}

// ---------- Avisos na tela (ataques fora do campo de visão) ----------
const elHurt = document.getElementById('hurt');
const elWarnL = document.getElementById('warnL');
const elWarnR = document.getElementById('warnR');
function updateWarnings(dt) {
  // flash vermelho ao levar dano
  state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2.5);
  elHurt.style.opacity = (state.hurtFlash * 0.7).toFixed(2);

  // se o boss está carregando/avançando e NÃO está à frente, acende a borda do lado dele
  let wl = 0, wr = 0;
  if ((B.mode === 'windup' || B.mode === 'dash') && !state.over) {
    toBoss.subVectors(boss.position, player.position).setY(0).normalize();
    fwd.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
    if (fwd.dot(toBoss) < 0.35) {
      const right = toBoss.x * -fwd.z + toBoss.z * fwd.x; // > 0: boss à direita
      const behind = fwd.dot(toBoss) < -0.5;
      if (right <= 0 || behind) wl = 1;
      if (right > 0 || behind) wr = 1;
    }
  }
  elWarnL.style.opacity = wl; elWarnR.style.opacity = wr;
}

// ---------- HUD ----------
const elHp = document.getElementById('hp');
const elBossHp = document.getElementById('bossHp');
const elBossName = document.getElementById('bossName');
const elOver = document.getElementById('over');
const elOverTitle = document.getElementById('overTitle');
const elOverSub = document.getElementById('overSub');
const elMv = { heavy: document.getElementById('mvheavy'), upper: document.getElementById('mvupper'), slam: document.getElementById('mvslam') };
const elCombo = document.getElementById('combo');
const elMoveName = document.getElementById('moveName');
elBossName.textContent = CFG.bossName;
function updateHud() {
  elHp.style.width = Math.max(0, state.hp / CFG.playerMaxHp * 100) + '%';
  elBossHp.style.width = Math.max(0, B.hp / CFG.bossMaxHp * 100) + '%';
  elBossHp.classList.toggle('p2', B.phase2);
  for (const k in elMv) {
    elMv[k].firstElementChild.firstElementChild.style.width = (100 - state.cd[k] / CFG.cooldowns[k] * 100) + '%';
    elMv[k].classList.toggle('ready', state.cd[k] <= 0);
  }
  elMoveName.style.opacity = Math.min(1, state.moveNameT / 0.4);
  elCombo.textContent = state.combo >= 2 ? 'x' + state.combo : '';
  elCombo.style.opacity = state.combo >= 2 ? Math.min(1, state.comboT) : 0;
  updateMenu();
  if (state.over) {
    elOverTitle.textContent = state.over === 'win' ? 'Vitória!' : 'Você foi derrotado';
    elOverSub.textContent = (state.over === 'win' ? 'Tempo: ' + state.time.toFixed(1) + 's · ' : '') + 'Pressione R para tentar de novo';
    elOver.style.display = 'flex';
  } else {
    elOver.style.display = 'none';
  }
}

function restart() {
  state.hp = CFG.playerMaxHp; state.over = null; state.time = 0;
  state.atk = null; state.chain = 0; state.chainT = 0; state.nextHand = 0; state.cd = { heavy: 0, upper: 0, slam: 0 }; state.kick = { pitch: 0, roll: 0 }; state.moveNameT = 0;
  for (const h of hands) h.p = [...G];
  state.dodgeT = -1; state.dodgeCD = 0; state.shake = 0; state.hurtCooldown = 0;
  player.position.set(0, 0, H - 3);
  look.yaw = 0; look.pitch = 0; state.hurtFlash = 0;
  state.hitstop = 0; state.combo = 0; state.comboT = 0; state.propTimer = 0;
  state.held = null;
  bossReset();
  spawnLayout();
  updateHud();
}

// ---------- Loop principal ----------
const clock = new THREE.Timer();
const move = new THREE.Vector3();
const dirToPlayer = new THREE.Vector3();

function clampToRoom(v, margin) {
  const lim = H - margin;
  v.x = THREE.MathUtils.clamp(v.x, -lim, lim);
  v.z = THREE.MathUtils.clamp(v.z, -lim, lim);
}

function hurtPlayer(dmg) {
  if (state.hurtCooldown > 0 || state.dodgeT >= 0 || state.over) return; // esquiva = invulnerável
  state.hp -= dmg;
  state.hurtCooldown = 0.8;
  state.shake = 0.6;
  state.hurtFlash = 1;
  if (state.hp <= 0) { state.hp = 0; state.over = 'lose'; }
}

function updatePlayer(dt) {
  state.dodgeCD = Math.max(0, state.dodgeCD - dt);

  if (state.dodgeT >= 0) {
    state.dodgeT += dt;
    player.position.addScaledVector(state.dodgeDir, CFG.dodgeSpeed * dt);
    clampToRoom(player.position, 0.8);
    if (state.dodgeT >= CFG.dodgeTime) state.dodgeT = -1;
  } else {
    move.set(0, 0, 0);
    if (keys.KeyW || keys.ArrowUp) move.z -= 1;
    if (keys.KeyS || keys.ArrowDown) move.z += 1;
    if (keys.KeyA || keys.ArrowLeft) move.x -= 1;
    if (keys.KeyD || keys.ArrowRight) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize().applyAxisAngle(UP, look.yaw).multiplyScalar(CFG.playerSpeed * dt); // W = para onde olha
      player.position.add(move);
      clampToRoom(player.position, 0.8);
    }
  }

  pushPlayerOutOfProps();

  player.rotation.y = look.yaw; // usado no cone do soco

  for (const k in state.cd) state.cd[k] = Math.max(0, state.cd[k] - dt);
  state.chainT = Math.max(0, state.chainT - dt);
  state.moveNameT = Math.max(0, state.moveNameT - dt);

  // golpe em andamento: avanço do corpo (lunge) até o impacto, dano no momento certo, fim da animação
  const a = state.atk;
  if (a) {
    const M = MOVES[a.kind];
    const prev = a.t;
    a.t += dt;
    const hitT = M.hitAt * M.dur;
    if (M.lunge && prev < hitT) {
      toB.subVectors(boss.position, player.position).setY(0);
      if (toB.length() > CFG.bossRadius + 1.0) { // não entra dentro do boss
        lungeDir.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
        player.position.addScaledVector(lungeDir, M.lunge * (Math.min(a.t, hitT) - prev) / hitT);
        clampToRoom(player.position, 0.8);
      }
    }
    if (!a.hitDone && a.t / M.dur >= M.hitAt) { a.hitDone = true; applyMoveHit(a.kind); }
    if (a.t >= M.dur) { state.atk = null; state.chainT = 0.9; }
  }
  updateHands(dt);
}
const lungeDir = new THREE.Vector3();

// poses dos dois braços: golpe (keyframes) > segurando objeto > esquiva > guarda com balanço
const poseTmp = [0, 0, 0, 0, 0, 0, 0];
function updateHands(dt) {
  const a = state.atk;
  const t = state.time;
  const walking = (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) && state.dodgeT < 0 ? 1 : 0;
  for (const h of hands) {
    const side = h.side;
    let frames = null;
    if (a) {
      const M = MOVES[a.kind];
      frames = (a.hand === 2 || a.hand === (side > 0 ? 1 : 0)) ? M.strike : M.off;
    }
    if (frames) {
      sampleKF(frames, THREE.MathUtils.clamp(a.t / MOVES[a.kind].dur, 0, 1), h.p);
    } else {
      const target = state.held ? HELD_POSE : state.dodgeT >= 0 ? DODGE_POSE : G;
      const k = 1 - Math.exp(-dt * 16);
      for (let j = 0; j < 7; j++) h.p[j] += (target[j] - h.p[j]) * k;
    }
    // respiração + balanço ao andar (só quando não está golpeando)
    const idle = frames ? 0 : 1;
    const ph = side > 0 ? 0 : Math.PI;
    const sy = idle * (Math.sin(t * 1.8 + ph) * 0.006 + walking * Math.sin(t * 9 + ph) * 0.014);
    const sx = idle * walking * Math.cos(t * 4.5 + ph) * 0.01;
    const p = h.p;
    h.fist.position.set(p[0] * side + sx, p[1] + sy, p[2]);
    h.fist.rotation.set(p[3], p[4] * side, p[5] * side);
    h.fist.scale.setScalar(p[6]);
  }
}

const COLORS = {
  chase: 0x4fa8ff, windup: 0xff2a2a, dash: 0xff8a00, stun: 0xffe14f, p2chase: 0xb06bff,
};

function updateBoss(dt) {
  B.t += dt;
  B.flash = Math.max(0, B.flash - dt);
  const p2 = B.phase2;
  const speedMul = p2 ? 1.4 : 1;
  const timeMul = p2 ? 0.7 : 1;

  dirToPlayer.subVectors(player.position, boss.position).setY(0);
  const dist = dirToPlayer.length();
  if (dist > 0.001) dirToPlayer.divideScalar(dist);

  let emissive = p2 ? COLORS.p2chase : COLORS.chase;
  let intensity = 0.7;
  let sc = CFG.bossScale; // escala base deste frame (aviso e morte alteram)

  if (B.mode === 'chase') {
    if (!state.over) boss.position.addScaledVector(dirToPlayer, CFG.bossChaseSpeed * speedMul * dt);
    if (B.t >= B.chaseTime * timeMul && !state.over) setBossMode('windup');
    // contato leve enquanto persegue
    if (dist < CFG.bossRadius + 0.6) hurtPlayer(CFG.bossContactDamage);
  } else if (B.mode === 'windup') {
    // AVISO: pisca em vermelho e "encolhe" (carregando). Dá tempo de reagir.
    emissive = COLORS.windup;
    intensity = 1.2 + Math.sin(B.t * 30) * 0.8;
    const k = Math.min(B.t / (CFG.bossWindup * timeMul), 1);
    sc = CFG.bossScale * (1 - 0.18 * k);
    if (!state.over) B.dashDir.copy(dirToPlayer); // mira até o último instante
    if (B.t >= CFG.bossWindup * timeMul) {
      setBossMode('dash');
      sc = CFG.bossScale;
    }
  } else if (B.mode === 'dash') {
    emissive = COLORS.dash;
    intensity = 2;
    boss.position.addScaledVector(B.dashDir, CFG.bossDashSpeed * speedMul * dt);
    if (dist < CFG.bossRadius + 0.6) hurtPlayer(CFG.bossDashDamage);
    // bateu na parede: fica atordoado, vulnerável
    const lim = H - 1.2;
    const hitWall = Math.abs(boss.position.x) >= lim || Math.abs(boss.position.z) >= lim;
    if (hitWall) { state.shake = 0.7; B.stunDur = CFG.bossRecover * timeMul; setBossMode('stun'); }
    else if (B.t >= CFG.bossDashTime) { B.stunDur = CFG.bossRecover * timeMul; setBossMode('stun'); }
  } else if (B.mode === 'stun') {
    emissive = COLORS.stun;
    intensity = 0.5 + Math.sin(B.t * 12) * 0.3;
    if (B.t >= B.stunDur) {
      B.chaseTime = 1.2 + Math.random() * 1.2;
      setBossMode('chase');
    }
  } else if (B.mode === 'dying') {
    const s = Math.max(0, 1 - B.t / 1.2);
    sc = CFG.bossScale * s;
    boss.rotation.y += dt * 10;
    emissive = 0xffffff; intensity = 3;
  }

  // knockback com atrito
  boss.position.addScaledVector(B.vel, dt);
  B.vel.multiplyScalar(Math.pow(B.launch ? CFG.launchFriction : 0.001, dt));
  const px = boss.position.x, pz = boss.position.z;
  clampToRoom(boss.position, 1.0);
  if (B.launch) {
    const speed = B.vel.length();
    const hitWall = px !== boss.position.x || pz !== boss.position.z;
    if (hitWall && speed > 4 && B.mode !== 'dying') {
      // BATEU NA PAREDE: dano extra, tremor forte, para de vez e ganha mais atordoamento
      damageBoss(CFG.wallSlamDamage);
      registerHit(0.12, 0.9);
      state.shake = 1;
      B.vel.set(0, 0, 0);
      B.launch = false;
      B.stunDur = CFG.wallStagger; // fica grudado/tonto na parede um tempo
      B.t = 0;
      spawnDebris(boss.position, 0xcfe9ff, 8, null, 0); // "poeira" fantasma
    } else if (speed < 3) {
      B.launch = false;
    }
  }

  // arremessado (ou avançando) contra móveis: destrói tudo no caminho
  const speedNow = B.vel.length();
  const smashing = (B.launch && speedNow > 8) || B.mode === 'dash';
  if (smashing) {
    propDir.copy(B.launch ? B.vel : B.dashDir).setY(0).normalize();
    for (const p of [...props]) {
      if (p.thrown || p.held) continue;
      const dx = boss.position.x - p.obj.position.x, dz = boss.position.z - p.obj.position.z;
      const r = CFG.bossRadius + p.T.radius;
      if (dx * dx + dz * dz < r * r) {
        breakProp(p, propDir, 14);
        // só móveis grandes machucam o boss (tábuas e objetos pequenos não)
        if (B.launch && B.mode !== 'dying' && p.T.size === 'large') { damageBoss(CFG.smashSelfDamage); registerHit(0.05, 0.5); }
      }
    }
  }

  // pulinho vertical (ao ser atingido) com gravidade e quique
  B.vy -= 30 * dt;
  boss.position.y += B.vy * dt;
  const maxY = WALL_H - 3.5; // a cabeça do boss não atravessa o teto
  if (boss.position.y > maxY) { boss.position.y = maxY; if (B.vy > 0) B.vy = 0; }
  if (boss.position.y < 0) { boss.position.y = 0; B.vy = B.vy < -6 ? -B.vy * 0.3 : 0; }

  // flutuar e olhar para o jogador
  B.bob += dt * 3;
  bossTop.position.y = BOSS_HEAD_Y + Math.sin(B.bob) * 0.05;
  animateGhost(dt, state.time + B.bob);
  if (B.launch && B.mode !== 'dying') {
    // girando enquanto voa
    boss.rotation.y += dt * B.spin;
    boss.rotation.z += dt * B.spin * 0.65;
  } else if (B.mode !== 'dying' && B.mode !== 'dash') {
    boss.rotation.set(0, Math.atan2(player.position.x - boss.position.x, player.position.z - boss.position.z), 0);
  }

  // amassado ao levar golpe (squash & stretch)
  B.squash = Math.max(0, B.squash - dt * 5);
  boss.scale.set(sc * (1 + 0.35 * B.squash), sc * (1 - 0.35 * B.squash), sc * (1 + 0.35 * B.squash));

  if (B.flash > 0) { emissive = 0xffffff; intensity = 2.5; }
  bossMat.emissive.setHex(emissive);
  bossMat.emissiveIntensity = intensity * 0.6;
  bossSkin.emissive.setHex(emissive);
  bossSkin.emissiveIntensity = 0.15 + (B.flash > 0 ? 1.2 : 0);
  bossEyeGlow.color.setHex(emissive);
  bossLight.color.setHex(emissive);
  bossLight.intensity = 4 + intensity * 3;
}

function animate() {
  rafId = requestAnimationFrame(animate);
  clock.update();
  let dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsed();
  // PAUSADO: sem mouse capturado o jogo não avança (só desenha o menu por cima)
  if (!locked && !state.over) { updateHud(); renderer.render(scene, camera); return; }
  // hitstop: o jogo quase congela por um instante quando um golpe acerta
  if (state.hitstop > 0) { state.hitstop -= dt; dt *= 0.08; }

  state.hurtCooldown = Math.max(0, state.hurtCooldown - dt);

  if (!state.over) state.time += dt;
  if (!state.over || state.over === 'win') updatePlayer(dt);
  updateBoss(dt);
  updateProps(dt, t);
  updateDebris(dt);
  updateShockwaves(dt);
  updateHeld(t);

  // combo expira; caixas caem do teto se houver poucos objetos
  state.comboT = Math.max(0, state.comboT - dt);
  if (state.comboT <= 0) state.combo = 0;
  state.propTimer += dt;
  if (state.propTimer >= CFG.propSpawnEvery && !state.over) {
    state.propTimer = 0;
    if (props.filter((p) => p.T.size === 'small').length < CFG.minSmallProps) {
      createProp(SMALL_TYPES[Math.floor(Math.random() * SMALL_TYPES.length)], (Math.random() * 2 - 1) * (H - 2), (Math.random() * 2 - 1) * (H - 2), WALL_H - 0.6);
    }
  }

  // lanterna na mão (filha da câmera) com leve tremida
  lantern.intensity = 30 + Math.sin(t * 17) * 1.5;

  // câmera nos olhos do jogador, olhando para yaw/pitch
  const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
  const bob = moving && state.dodgeT < 0 ? Math.sin(t * 9) * 0.03 : 0; // balanço leve ao andar
  camera.position.set(player.position.x, EYE_HEIGHT + bob, player.position.z);
  // animação de câmera dos golpes: o corpo gira/inclina junto com o soco e a câmera leva um tranco no impacto
  let aRoll = 0, aYaw = 0, aPitch = 0;
  if (state.atk) {
    const M = MOVES[state.atk.kind];
    const w = Math.sin(Math.min(1, state.atk.t / M.dur) * Math.PI);
    const sgn = state.atk.hand === 2 ? 0 : state.atk.hand === 1 ? 1 : -1;
    aRoll = -sgn * M.roll * w; aYaw = -sgn * M.twist * w; aPitch = M.dip * w;
  }
  const kd = Math.exp(-dt * 9);
  state.kick.pitch *= kd; state.kick.roll *= kd;
  camera.rotation.set(look.pitch + aPitch + state.kick.pitch, look.yaw + aYaw, aRoll + state.kick.roll);
  // tremor de impacto (posição + inclinação lateral)
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt * 2.5);
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.15;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.15;
    camera.rotation.z += (Math.random() - 0.5) * state.shake * 0.08;
  }
  // esquiva: campo de visão se abre por um instante (sensação de velocidade)
  state.fovKick = Math.max(0, state.fovKick - dt * 40);
  const targetFov = (state.dodgeT >= 0 ? BASE_FOV + 12 : BASE_FOV) + state.fovKick;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
  camera.updateProjectionMatrix();

  updateWarnings(dt);
  updateHud();
  renderer.render(scene, camera);
}

// modo debug (abrir com ?debug na URL): expõe o estado para testes
if (location.search.includes('debug')) window.__gp = { state, B, boss, player, CFG, look, fist, hands, MOVES, startPunch, applyMoveHit, props, debris, createProp, breakProp, camera, settings };

restart();

// ---------- Hot reload: guardar / restaurar o estado ----------
function saveState() {
  return {
    state: { ...state, dodgeDir: state.dodgeDir.toArray() },
    look: { ...look },
    player: player.position.toArray(),
    boss: boss.position.toArray(),
    B: { ...B, vel: B.vel.toArray(), dashDir: B.dashDir.toArray() },
    props: props.map((p) => ({ type: p.type, pos: p.obj.position.toArray(), rotY: p.obj.rotation.y, hp: p.hp, vel: p.vel.toArray(), thrown: p.thrown, falling: p.falling, dmgMul: p.dmgMul, knock: p.knock })),
  };
}
function loadState(d) {
  const { dodgeDir, ...st } = d.state;
  Object.assign(state, st);
  state.dodgeDir.fromArray(dodgeDir);
  Object.assign(look, d.look);
  player.position.fromArray(d.player);
  boss.position.fromArray(d.boss);
  const { vel, dashDir, ...b } = d.B;
  Object.assign(B, b);
  B.vel.fromArray(vel);
  B.dashDir.fromArray(dashDir);
  if (d.props) {
    clearProps();
    for (const o of d.props) {
      const p = createProp(o.type, o.pos[0], o.pos[2], o.pos[1], o.rotY);
      p.hp = o.hp; p.vel.fromArray(o.vel); p.thrown = o.thrown; p.falling = o.falling; p.dmgMul = o.dmgMul; p.knock = o.knock ?? 1;
    }
  }
}

if (hot) {
  if (hot.data.saved) {
    loadState(hot.data.saved);
    locked = document.pointerLockElement === canvas; // o mouse continua capturado entre recargas
    console.log('[hot reload] código atualizado, luta mantida');
  }
  import.meta.hot.dispose((data) => {
    dropHeld(); // objeto na mão volta para o chão antes de guardar o estado
    data.saved = saveState();
    data.canvas = renderer.domElement;
    data.gl = renderer.getContext();
    cancelAnimationFrame(rafId);
    disposers.forEach((f) => f());
    // libera geometrias, materiais e texturas da cena antiga
    scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material ?? [])) { m.map?.dispose(); m.dispose(); }
    });
    renderer.dispose();
  });
  // precisa ser escrito literalmente assim: o Vite procura este texto para saber que o módulo se atualiza sozinho
  import.meta.hot.accept();
}

animate();
