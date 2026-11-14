import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAudio } from './audio.js';
import { createModelRig, loadFirstPersonArms } from './models.js';
import { makeProcedural, loadImages, worldUV } from './textures.js';
import { t as tx, applyDom, setLang, getLang, savedChoice, saveChoice } from './i18n.js';

// ============================================================
// GHOSTPUNCH MINI - Etapa 1
// Cena, sala, jogador (WASD + mouse), soco e fantasma que persegue.
// ============================================================

// ---------- Configuração (fácil de ajustar) ----------
const CFG = {
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
  heavyDamage: 12,    // (era 7,2: o soco pesado é o golpe que resolve)
  cooldowns: { heavy: 1.8, upper: 1.4, slam: 4.0 }, // recarga dos golpes especiais (s)
  slamRadius: 4.5,       // alcance do esmagar (área ao redor do jogador)
  // --- FÍSICA DO ARREMESSO (boss vira um corpo rígido: voa, quica, rola e atravessa paredes de gesso) ---
  groundDecel: 14,       // atrito do chão (u/s², constante) -> ele desliza e pára de forma natural
  groundDrag: 1.0,       // atrito proporcional à velocidade (quanto mais rápido, mais freia)
  airDrag: 0.2,          // resistência do ar
  bounceWall: 0.28,      // quanto da velocidade sobra ao quicar numa parede
  bounceFloor: 0.25,     // idem no chão (vertical)
  wallBreakSpeed: 9,     // velocidade (batendo de frente) para atravessar uma parede de gesso
  gravityBoss: 28,
  wallSlamDamage: 3,     // dano ao bater na parede (+0,02 por u/s de impacto): a força aparece no exagero, não na vida tirada
  // --- PERFIS DE GOLPE: o que cada ataque faz com o boss ---
  // speed: empurrão horizontal (u/s) · up: pulo vertical (u/s) · stagger: tempo tonto (s)
  // squash: quanto ele amassa (0-1) · hitstop: congelamento no impacto (s) · shake: tremor de câmera (0-1)
  attacks: {
    light: { speed: 8, up: 1.4, stagger: 0.35, squash: 0.45, hitstop: 0.05, shake: 0.35 }, // soco normal: empurrãozinho, dá para combar
    heavy: { speed: 32, up: 4.2, stagger: 1.20, squash: 1.00, hitstop: 0.16, shake: 1.00, spin: 10, big: true }, // soco forte: manda longe e para o alto
    cross: { speed: 15, up: 2.2, stagger: 0.80, squash: 0.80, hitstop: 0.10, shake: 0.70, big: true }, // 3º golpe do combo: finalizador
    upper: { speed: 4,  up: 9.5, stagger: 1.00, squash: 1.00, hitstop: 0.12, shake: 0.85, spin: 7, big: true }, // uppercut: quase não empurra, LANÇA para cima
    slam:  { speed: 18, up: 3.5, stagger: 1.00, squash: 1.00, hitstop: 0.14, shake: 1.00, big: true }, // esmagar: onda em área, empurra para longe de você
    // OBJETOS: efeito bem mais contido que os golpes do jogador (squash < 0,9: sem clarão, sem luz tremendo, sem grito de arremesso)
    barrel: { speed: 30, up: 2.2, stagger: 0.70, squash: 0.60, hitstop: 0.05, shake: 0.30 },
    tv:     { speed: 28, up: 2.0, stagger: 0.70, squash: 0.60, hitstop: 0.05, shake: 0.30 },
    ball:   { speed: 38, up: 1.6, stagger: 0.80, squash: 0.70, hitstop: 0.06, shake: 0.35 }, // bola de boliche: pesada e rápida
    pillow: { speed: 4,  up: 0.4, stagger: 0.20, squash: 0.15, hitstop: 0.01, shake: 0.05 }, // almofada: faz cócegas
    vase:  { speed: 14, up: 1.0, stagger: 0.35, squash: 0.35, hitstop: 0.03, shake: 0.15 },
    juggle: { speed: 3, up: 7.5, stagger: 0.6, squash: 0.6, hitstop: 0.05, shake: 0.4 }, // soco no fantasma no ar: ele continua subindo na sua frente
    toss:  { speed: 28, up: 6.5, stagger: 1.2, squash: 1.00, hitstop: 0.12, shake: 0.9, spin: 9, big: true }, // agarrar e arremessar o fantasma
    boom:  { speed: 14, up: 3.2, stagger: 0.9, squash: 0.85, hitstop: 0.08, shake: 0.9, big: true }, // explosão da vodka
    vodka: { speed: 12, up: 0.8, stagger: 0.30, squash: 0.30, hitstop: 0.03, shake: 0.12 }, // garrafa: estilhaça e deixa o fantasma tonto de leve
    plank: { speed: 18, up: 1.2, stagger: 0.40, squash: 0.40, hitstop: 0.03, shake: 0.18 },
    chair: { speed: 24, up: 1.8, stagger: 0.55, squash: 0.50, hitstop: 0.04, shake: 0.22 },
    crate: { speed: 30, up: 2.2, stagger: 0.65, squash: 0.60, hitstop: 0.05, shake: 0.28 },
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
  minSmallProps: 10,
  // --- PISCADA (o fantasma some e reaparece, quase sempre atrás do jogador) ---
  blinkChance: 0.35,     // chance de piscar em vez de atacar direto quando termina de perseguir (fase 2: 0.5)
  blinkBehind: 0.7,      // chance de reaparecer ATRÁS do jogador (senão, num ponto qualquer ao redor)
  blinkVanish: 0.45,     // seg: some (pisca e encolhe)
  blinkHidden: [0.6, 1.3], // seg invisível (sussurro avisa onde)
  blinkAppear: 0.5,      // seg: reaparece (vulnerável) antes de atacar
  blinkCooldown: 7,      // seg mínimos entre piscadas
  vodkaHeal: 25,         // vida recuperada ao beber uma garrafa de vodka (bebe sozinho ao pegar)
  vodkaMax: 8,           // máximo de garrafas cheias no mapa
  vodkaSpawnEvery: 8,    // seg: nasce uma garrafa nova (mais rápido se a vida estiver baixa)
  vodkaDrinkTime: 1.1,   // seg da animação de beber (não dá para arremessar enquanto bebe)
  vodkaBoomRadius: 3.4,  // a garrafa vazia arremessada explode no impacto (coquetel): raio da explosão
  vodkaBoomDamage: 16,   // dano no fantasma no centro da explosão (cai com a distância)
  vodkaSelfDamage: 2,    // dano em você, se estiver perto demais (quase nada: você é o monstro)
  // --- boss ---
  bossName: 'O Fantasma da Casa',
  bossMaxHp: 300,       // (era 1200 -> 660 -> 300): ficou impossível de matar com 660
  bossScale: 1.05,      // tamanho humano (~1,9 m): passa pelas portas da casa
  bossRadius: 0.6,
  bossChaseSpeed: 1.6,  // (era 2,4: rápido demais para conseguir bater)
  bossWindup: 0.8,      // tempo de aviso antes do ataque
  // --- combate dinâmico (Etapa 32) ---
  swipeRange: 2.8,       // perto assim, ele ataca com GARRAS (sequência rápida de 2 a 3 golpes curtos) em vez de esperar
  swipeWindup: 0.3,      // aviso curto de cada garrada
  swipeDamage: 2,
  swipeCooldown: 2.2,
  evadeChance: 0.2,      // chance de desviar para o lado quando você prepara um soco forte/uppercut perto dele (fase 2: 0.45)
  evadeCooldown: 3,
  perfectDodgeWindow: 1,
  guardMax: 100,         // GUARDA do fantasma: ele levanta os braços contra socos leves; cada soco leve gasta guarda
  guardChance: 0.55,     // chance de ele defender quando você começa um soco leve perto dele (fase 2: 0.7)
  guardJabCost: 34, guardCrossCost: 55, guardRegen: 14, // por golpe / por segundo
  guardBrokenTime: 2.2,  // guarda quebrada: fica tonto e leva mais dano por este tempo
  guardBrokenMul: 1.5,
  tossDamage: 14,        // agarrar o fantasma (F perto dele atordoado ou caído) e arremessar // esquivou no instante do golpe dele: câmera lenta + CONTRA-ATAQUE (próximo golpe x2) por este tempo (s)
  bossDashSpeed: 10,
  bossDashTime: 0.5,
  bossRecover: 0.8,     // fica atordoado depois do avanço (era 1,3: agora levanta mais rápido)
  bossContactDamage: 1,   // O MONSTRO É VOCÊ: os ataques dele quase não fazem cócegas (era 6 -> 3 -> 1)
  bossDashDamage: 4,      // (era 18 -> 9 -> 4)
  // --- habilidades especiais (Etapa 20) ---
  specialCooldown: 9,     // seg mínimos entre teto / possessão / apagão (fase 2: 6)
  specialChance: 0.5,     // chance de usar uma especial ao fim da perseguição
  ceilCrawl: 3.0,         // seg rastejando no teto antes de mirar
  ceilAim: 0.9,           // seg parado em cima do alvo (mancha no chão avisa)
  ceilDropDamage: 4, ceilDropRadius: 3.4,
  possessMax: 3, possessDamage: 2, possessSpeed: 24,
  fearPerHit: 6,         // MEDO: cada golpe que ele leva assusta mais; com medo ele foge, se encolhe e grita
  fearBigHit: 5,         // extra nos golpes pesados (soco forte, uppercut, esmagar, agarrão)
  fearDecay: 3,          // por segundo
  fearHold: 1.5,         // seg sem baixar depois de cada susto
  fearNoAttack: 80,      // a partir deste medo ele NÃO ataca (APAVORADO): só foge e se encolhe...
  terrorMax: 4,          // ...mas apavorado por mais que isso, ele se desespera: o medo cai para 35 e ele parte para cima de novo
  calmAfterSnap: 4,      // e por este tempo depois do desespero ele se assusta pela metade (não volta a apavorar na hora)
  blackoutDur: [4, 6],    // seg de escuro
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
scene.fog = new THREE.Fog(0x07060c, 16, 46);

// Celular/tablet: controles na tela (joystick + botões). Também dá para forçar com ?touch na URL.
const touchMode = new URLSearchParams(location.search).has('touch') || matchMedia('(hover: none) and (pointer: coarse)').matches;
if (touchMode) document.body.classList.add('touch');

// Opções do jogador (menu de pausa), guardadas no navegador
const settings = { sens: 1, fov: 80, vol: 0.7, muted: false, flicker: true, slowmo: true, hitstop: true, shadows: !touchMode, textures: true }; // no celular as sombras começam desligadas
try {
  const saved = JSON.parse(localStorage.getItem('ghostpunch-settings') || '{}');
  if (saved.sens) settings.sens = saved.sens;
  if (saved.fov) settings.fov = saved.fov;
  if (saved.vol !== undefined) settings.vol = saved.vol;
  if (saved.muted) settings.muted = true;
  if (saved.flicker === false) settings.flicker = false;
  if (saved.slowmo === false) settings.slowmo = false;
  if (saved.hitstop === false) settings.hitstop = false;
  if (saved.shadows === false) settings.shadows = false;
  if (saved.shadows === true) settings.shadows = true;
  if (saved.textures === false) settings.textures = false;
} catch { /* sem armazenamento: usa o padrão */ }
function saveSettings() { try { localStorage.setItem('ghostpunch-settings', JSON.stringify(settings)); } catch { /* ignora */ } }

// Som: tudo sintetizado em audio.js (sem arquivos). O contexto de áudio só nasce no clique em Jogar.
const sfx = createAudio({ vol: settings.vol, muted: settings.muted, base: import.meta.env.BASE_URL + 'sounds/' });
let audioPaused = true;
const bossAt = () => ({ x: boss.position.x, y: boss.position.y + 1.5, z: boss.position.z });

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
renderer.setPixelRatio(Math.min(devicePixelRatio, touchMode ? 1.25 : 1.5)); // (2 deixava pesado em telas de alta densidade)
renderer.shadowMap.enabled = true;
if (!renderer.domElement.isConnected) document.body.appendChild(renderer.domElement);

on(window, 'resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Sem texturas (por enquanto) ----------
// TEXTURAS (branch textures-test): superfícies geradas por código (src/textures.js) + imagens autorais (public/textures/).
// Cada material texturizado é registrado com useTex(); a opção "Texturas" do menu liga/desliga tudo para comparar com a cor lisa.
const TEX = makeProcedural(), IMG = loadImages(import.meta.env.BASE_URL + 'textures/');
const texSlots = [];
function setSlot(sl) {
  const on = settings.textures;
  sl.m.map = on ? sl.map : null; sl.m.bumpMap = on ? sl.bump : null; sl.m.bumpScale = sl.bumpScale;
  sl.m.color.setHex(on ? sl.on : sl.off); sl.m.needsUpdate = true;
}
function useTex(m, t, tint = 0xffffff, bumpScale = 1.5) { // `tint` = cor do material quando texturizado (multiplica a textura)
  const sl = { m, map: t.map || t, bump: t.bump || null, bumpScale, on: tint, off: m.color.getHex() };
  texSlots.push(sl); setSlot(sl); return m;
}
const decals = new THREE.Group(); scene.add(decals);
const vig = document.createElement('div'); // vinheta: escurece as bordas da tela (clima pesado)
vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,.5) 78%, rgba(0,0,0,.86) 100%)';
renderer.domElement.after(vig); disposers.push(() => vig.remove());
function applyTextures() {
  texSlots.forEach(setSlot);
  decals.visible = settings.textures; vig.style.display = settings.textures ? 'block' : 'none';
  scene.fog.near = settings.textures ? 10 : 16; scene.fog.far = settings.textures ? 40 : 46;
}

const houseStart = scene.children.length; // (tudo que entra na cena daqui até o fim da casa é cenário fixo: ver mergeStatic)
// ---------- CASA: casarão de dois andares ----------
// Planta (x para a direita/leste, z para baixo/sul; o jogador entra pela porta da frente, no sul):
//   TÉRREO (pé-direito 3,4 m)                          ANDAR DE CIMA (piso em 3,6 m, teto em 6,8 m)
//   ┌──────────┬─────────┬──────────┐ z=-12             ┌──────────┬─────────┬──────────┐
//   │  JANTAR  │ DEPÓSITO│ COZINHA  │                   │ QUARTO DA│ BANHEIRO│  QUARTO  │
//   │          ├──┬───┬──┤          │ z=-4              │ CRIANÇA  ├─────────┤ PRINCIPAL│
//   │          │  HALL   │          │                   │          │ GALERIA │          │
//   ├──────────┤(pé-dir.├──────────┤ z=2 (gesso)       ├──────────┤─ ─ ─ ─ ─├──────────┤ z=-1,5: balaustrada
//   │  SALA DE │ duplo)  │BIBLIOTECA│                   │ QUARTO DE│  vão do │ESCRITÓRIO│
//   │  ESTAR   │ escada  │          │                   │ HÓSPEDES │  hall   │          │
//   └──────────┴──porta──┴──────────┘ z=12              └──────────┴─────────┴──────────┘
//   x=-16    x=-5     x=5       x=16
// O hall tem pé-direito duplo: da galeria do andar de cima dá para ver (e jogar coisas) lá embaixo.
const HX = 16, HZ = 12;            // metade do tamanho da casa em x e z (32 x 24 m)
const H = Math.max(HX, HZ);        // (compatibilidade: alguns trechos antigos usam um "raio" único)
const GF_CEIL = 3.4, F2 = 3.6, ROOF = 6.8, WALL_H = ROOF; // teto do térreo, piso de cima, teto de cima
const DOOR_H = 2.4;
const OUT_T = 0.4, WT = 0.3;       // espessura das paredes externas e internas

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(HX * 2, HZ * 2),
  useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x2e1f14, roughness: 0.9 }), 0.25), TEX.floor, 0xb8aca0, 2.5)
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const WS = 1 / 3.4; // papel de parede e gesso: a textura cobre um pé-direito
const wallMat = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x2c2228, roughness: 1 }), WS), TEX.wallpaper, 0x9a8f94, 2); // paredes externas
const plasterMat = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x6f6466, roughness: 1 }), WS), TEX.plaster, 0xcfc6c0, 3); // divisórias de gesso (quebram)
const wallpaperShared = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x3b2a33, roughness: 1 }), WS), TEX.wallpaper, 0xd8ccd2, 2);
function wallpaperMat() { return wallpaperShared; }
const trimMat = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x23170f, roughness: 0.8 }), 0.5), TEX.wood, 0x4e3626, 2);
const woodMat = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x3e2a1c, roughness: 0.85 }), 0.5), TEX.wood, 0x7a5638, 2);
const woodTop = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.8 }), 0.5), TEX.wood, 0x8e6444, 2);
const slabMat = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x2e1f14, roughness: 0.9 }), 0.25), TEX.floor, 0xb8aca0, 2.5); // piso de cima (o lado de baixo é o teto do térreo)
const ceilUnderMat = useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x1d171b, roughness: 1 }), 1 / 6), TEX.ceiling, 0xd0c8c8);

// ---------- COLISÃO: tudo que é sólido é uma caixa alinhada aos eixos (AABB) com base y0 e topo `top` ----------
// Quem está com os pés em y é bloqueado por uma caixa se ela começa abaixo da cabeça (y0 < y + ENT_H) e termina acima
// do passo (top > y + passo). Assim a laje do andar de cima não bloqueia quem anda no térreo, e uma parede do andar de
// cima não bloqueia quem está embaixo dela.
const ENT_H = 2.0;
const solids = [];       // sólidos ativos (os painéis quebrados saem daqui)
const allPanels = [];    // tudo que quebra (gesso, balaustrada), para reconstruir no restart
const solidGeo = new THREE.BoxGeometry(1, 1, 1);
function addSolid(x0, x1, z0, z1, top, { outer = false, breakable = false, material = wallMat, y0 = 0, hp = 2, visible = true, cast = true } = {}) {
  const mesh = new THREE.Mesh(solidGeo, material);
  mesh.scale.set(x1 - x0, top - y0, z1 - z0);
  mesh.position.set((x0 + x1) / 2, (top + y0) / 2, (z0 + z1) / 2);
  mesh.castShadow = cast; mesh.receiveShadow = true; mesh.visible = visible;
  scene.add(mesh);
  const sol = { x0, x1, z0, z1, top, y0, mesh, outer, breakable, hp: breakable ? hp : Infinity, maxHp: hp, alive: true };
  solids.push(sol);
  if (breakable) allPanels.push(sol);
  return sol;
}
// paredes externas (sobem até o telhado)
addSolid(-HX - OUT_T, HX + OUT_T, -HZ - OUT_T, -HZ, ROOF, { outer: true });
addSolid(-HX - OUT_T, HX + OUT_T, HZ, HZ + OUT_T, ROOF, { outer: true });
addSolid(-HX - OUT_T, -HX, -HZ, HZ, ROOF, { outer: true });
addSolid(HX, HX + OUT_T, -HZ, HZ, ROOF, { outer: true });

// batente de porta (só visual): verga sobre o vão e dois montantes de madeira
function doorFrame(cx, cz, len, alongZ, y0, ceil) {
  const head = new THREE.Mesh(solidGeo, wallpaperMat()); head.scale.set(alongZ ? WT : len, ceil - y0 - DOOR_H, alongZ ? len : WT);
  head.position.set(cx, y0 + DOOR_H + (ceil - y0 - DOOR_H) / 2, cz); head.receiveShadow = true; scene.add(head);
  const w = alongZ ? WT + 0.12 : len + 0.24, d = alongZ ? len + 0.24 : WT + 0.12;
  const trim = new THREE.Mesh(solidGeo, trimMat); trim.scale.set(w, 0.16, d); trim.position.set(cx, y0 + DOOR_H + 0.08, cz); scene.add(trim);
  for (const sgn of [-1, 1]) {
    const post = new THREE.Mesh(solidGeo, trimMat);
    post.scale.set(alongZ ? WT + 0.12 : 0.12, DOOR_H, alongZ ? 0.12 : WT + 0.12);
    post.position.set(alongZ ? cx : cx + sgn * (len / 2 + 0.06), y0 + DOOR_H / 2, alongZ ? cz + sgn * (len / 2 + 0.06) : cz); scene.add(post);
  }
}
// parede ao longo de z (em x fixo) de a até b, entre y0 e y1, com portas [[za, zb], ...]
function wallAlongZ(x, a, b, y0, y1, doors = [], opt = {}) {
  let z = a;
  for (const [da, db] of [...doors].sort((p, q) => p[0] - q[0])) {
    if (da > z) segZ(x, z, da, y0, y1, opt);
    doorFrame(x, (da + db) / 2, db - da, true, y0, y1); z = db;
  }
  if (b > z) segZ(x, z, b, y0, y1, opt);
}
function segZ(x, a, b, y0, y1, opt) {
  if (opt.breakable) for (let z = a; z < b - 0.01; z += 3) addSolid(x - WT / 2, x + WT / 2, z, Math.min(b, z + 3), y1, { ...opt, y0 });
  else addSolid(x - WT / 2, x + WT / 2, a, b, y1, { material: wallpaperMat(), ...opt, y0 });
}
function wallAlongX(z, a, b, y0, y1, doors = [], opt = {}) {
  let x = a;
  for (const [da, db] of [...doors].sort((p, q) => p[0] - q[0])) {
    if (da > x) segX(z, x, da, y0, y1, opt);
    doorFrame((da + db) / 2, z, db - da, false, y0, y1); x = db;
  }
  if (b > x) segX(z, x, b, y0, y1, opt);
}
function segX(z, a, b, y0, y1, opt) {
  if (opt.breakable) for (let x = a; x < b - 0.01; x += 3) addSolid(x, Math.min(b, x + 3), z - WT / 2, z + WT / 2, y1, { ...opt, y0 });
  else addSolid(a, b, z - WT / 2, z + WT / 2, y1, { material: wallpaperMat(), ...opt, y0 });
}
const PLASTER = { breakable: true, material: plasterMat };

// TÉRREO
wallAlongZ(-5, -HZ, HZ, 0, GF_CEIL, [[-9, -7], [-3.6, -1.8], [6, 8]]);   // hall/depósito <-> jantar/sala de estar
wallAlongZ(5, -HZ, HZ, 0, GF_CEIL, [[-9, -7], [-3.6, -1.8], [6, 8]]);    // hall/depósito <-> cozinha/biblioteca
wallAlongX(2, -HX, -5, 0, GF_CEIL, [[-12, -10]], PLASTER);              // jantar / sala de estar
wallAlongX(2, 5, HX, 0, GF_CEIL, [[10, 12]], PLASTER);                  // cozinha / biblioteca
wallAlongX(-4, -5, 5, 0, GF_CEIL, [[-1, 1]], PLASTER);                  // hall / depósito (fundos)
// ANDAR DE CIMA (as paredes começam no teto do térreo para fechar a espessura da laje)
wallAlongZ(-5, -HZ, HZ, GF_CEIL, ROOF, [[-3.6, -1.8]]);                 // galeria -> quarto da criança
wallAlongZ(5, -HZ, HZ, GF_CEIL, ROOF, [[-3.6, -1.8]]);                  // galeria -> quarto principal
wallAlongX(2, -HX, -5, GF_CEIL, ROOF, [[-12, -10]], PLASTER);           // quarto da criança / hóspedes
wallAlongX(2, 5, HX, GF_CEIL, ROOF, [[10, 12]], PLASTER);               // quarto principal / escritório
wallAlongX(-4, -5, 5, GF_CEIL, ROOF, [[-1, 1]]);                        // galeria -> banheiro

// LAJE do andar de cima (piso em F2; a face de baixo é o teto do térreo). O hall (x -5..5, z -1,5..12) fica aberto.
function slab(x0, x1, z0, z1) {
  addSolid(x0, x1, z0, z1, F2, { material: slabMat, y0: GF_CEIL, cast: false });
  const under = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), ceilUnderMat); // teto do térreo (mais escuro que o piso)
  under.rotation.x = Math.PI / 2; under.position.set((x0 + x1) / 2, GF_CEIL - 0.005, (z0 + z1) / 2); scene.add(under);
}
slab(-HX, -5, -HZ, HZ); slab(5, HX, -HZ, HZ); slab(-5, 5, -HZ, -1.5);
slab(-5, -3.4, -1.5, 0.56);                                              // patamar no topo da escada

// ESCADA do hall: 12 degraus de 0,3 m (menos que o passo máximo de 0,55 m), subindo para o norte junto à parede oeste
const STAIR_N = 12, STAIR_RISE = F2 / STAIR_N, STAIR_RUN = 0.32, PLAT_TOP = F2;
function addStairsZ(x0, x1, zBottom, dir) { // sobe andando na direção `dir` (+1 ou -1) em z
  for (let k = 1; k <= STAIR_N; k++) {
    const a = zBottom + dir * (k - 1) * STAIR_RUN, b = zBottom + dir * k * STAIR_RUN;
    addSolid(x0, x1, Math.min(a, b), Math.max(a, b), k * STAIR_RISE, { material: k % 2 ? woodMat : woodTop });
  }
}
addStairsZ(-4.85, -3.4, 0.56 + STAIR_N * STAIR_RUN, -1);
// corrimão inclinado (só visual) e balaústres
{
  const len = Math.hypot(STAIR_N * STAIR_RUN, F2), ang = Math.atan2(F2, STAIR_N * STAIR_RUN);
  const rail = new THREE.Mesh(solidGeo, trimMat); rail.scale.set(0.08, 0.1, len);
  rail.position.set(-3.42, F2 / 2 + 0.95, 0.56 + STAIR_N * STAIR_RUN / 2); rail.rotation.x = ang; scene.add(rail);
  for (let k = 0; k < STAIR_N; k += 2) {
    const p = new THREE.Mesh(solidGeo, trimMat); p.scale.set(0.05, 0.95, 0.05);
    p.position.set(-3.42, (k + 1) * STAIR_RISE + 0.475, 0.56 + STAIR_N * STAIR_RUN - (k + 0.5) * STAIR_RUN); scene.add(p);
  }
}
// BALAUSTRADA da galeria e do patamar (quebra: dá para arremessar o fantasma lá de cima). Um trecho já está quebrado.
const railMat = trimMat;
function railing(x0, x1, z0, z1) {
  const s = addSolid(x0, x1, z0, z1, F2 + 1.0, { breakable: true, hp: 1, material: railMat, y0: F2 + 0.9, cast: false }); // corrimão
  const lenA = Math.max(x1 - x0, z1 - z0), alongX = x1 - x0 > z1 - z0, posts = [];
  for (let t = 0.15; t < lenA; t += 0.3) {
    const p = new THREE.Mesh(solidGeo, railMat); p.scale.set(0.05, 0.9, 0.05);
    p.position.set(alongX ? x0 + t : (x0 + x1) / 2, F2 + 0.45, alongX ? (z0 + z1) / 2 : z0 + t); scene.add(p); posts.push(p);
  }
  s.extra = posts; s.y0Hit = F2; // colide desde o piso (os balaústres fecham o vão)
  return s;
}
railing(-3.4, 1.4, -1.6, -1.45); railing(3.0, 5, -1.6, -1.45); railing(-3.45, -3.35, -1.5, 0.56);
// pedaço de balaustrada caído lá embaixo (o vão entre x 1,4 e 3 é a "janela de pulo")
{
  const r = new THREE.Mesh(solidGeo, railMat); r.scale.set(1.5, 0.1, 0.1); r.position.set(2.3, 0.08, 0.6); r.rotation.y = 0.5; scene.add(r);
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(solidGeo, railMat); p.scale.set(0.05, 0.9, 0.05); p.position.set(1.7 + i * 0.4, 0.05, 0.2 + i * 0.3); p.rotation.set(Math.PI / 2, 0, i); scene.add(p); }
}

// ---------- MÓVEIS FIXOS (sólidos): bancada da cozinha, lareira, banheira ----------
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2a2626, roughness: 0.95 });
const porcelain = new THREE.MeshStandardMaterial({ color: 0x9c968a, roughness: 0.35 });
addSolid(5.2, 15.8, -11.8, -11.0, 0.95, { material: woodMat });         // bancada da cozinha (parede norte)
addSolid(15.2, 15.8, -11, -5, 0.95, { material: woodMat });             // bancada (parede leste)
{ const top = new THREE.Mesh(solidGeo, porcelain); top.scale.set(10.7, 0.05, 0.9); top.position.set(10.5, 0.97, -11.4); scene.add(top); }
addSolid(-15.9, -15.1, 5.5, 8.5, 1.3, { material: stoneMat });          // lareira da sala de estar (parede oeste)
{
  const mantle = new THREE.Mesh(solidGeo, trimMat); mantle.scale.set(1.0, 0.12, 3.4); mantle.position.set(-15.45, 1.36, 7); scene.add(mantle);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ color: 0x050303 })); hole.rotation.y = Math.PI / 2; hole.position.set(-15.09, 0.45, 7); scene.add(hole);
  const chim = new THREE.Mesh(solidGeo, stoneMat); chim.scale.set(0.6, GF_CEIL - 1.42, 1.6); chim.position.set(-15.6, 1.42 + (GF_CEIL - 1.42) / 2, 7); scene.add(chim);
  const embers = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.2), new THREE.MeshBasicMaterial({ color: 0x8a2a08 })); embers.position.set(-15.4, 0.06, 7); scene.add(embers);
}
addSolid(-4.6, -3.0, -11.6, -9.6, F2 + 0.6, { material: porcelain, y0: F2 });   // banheira (banheiro, andar de cima)
{ const water = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), new THREE.MeshStandardMaterial({ color: 0x1a0d0c, roughness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.set(-3.8, F2 + 0.61, -10.6); scene.add(water); }

// altura do chão num ponto: o topo mais alto que dá para "pisar" (<= maxTop)
function groundY(x, z, maxTop = 0) {
  let g = 0;
  for (const s of solids) if (s.top > g && s.top <= maxTop && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) g = s.top;
  return g;
}
// o mesmo, mas olhando um círculo de raio r em volta do ponto (quem tem pés grandes sobe o degrau antes de chegar ao meio dele)
function groundYR(x, z, maxTop, r) {
  let g = 0;
  for (const s of solids) {
    if (s.top <= g || s.top > maxTop) continue;
    const cx = THREE.MathUtils.clamp(x, s.x0, s.x1), cz = THREE.MathUtils.clamp(z, s.z0, s.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) g = s.top;
  }
  return g;
}
// teto acima de quem está em y: a base mais baixa de um sólido que cubra o ponto e comece acima da cabeça; senão o telhado
function ceilAt(x, z, y) {
  let c = ROOF;
  for (const s of solids) if (s.y0 > y + 0.3 && s.y0 < c && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) c = s.y0;
  return c;
}
const solidBase = (s) => s.y0Hit ?? s.y0;
// círculo (raio r) contra as caixas: empurra para fora. Sólidos mais baixos que y+stepH são pisáveis (não bloqueiam), e
// sólidos que começam acima da cabeça (y0 >= y + ENT_H) também não.
// `only(s)` filtra quais sólidos contam. `hit(s, nx, nz, depth)` é chamado em cada contato; se devolver true o sólido é ignorado (ex.: parede quebrou)
function resolveSolids(pos, r, y, stepH, only = null, hit = null) {
  let touched = false;
  for (let it = 0; it < 3; it++) {
    let any = false;
    for (const s of [...solids]) {
      if (!s.alive || s.top <= y + stepH || solidBase(s) >= y + ENT_H || (only && !only(s))) continue;
      const cx = THREE.MathUtils.clamp(pos.x, s.x0, s.x1), cz = THREE.MathUtils.clamp(pos.z, s.z0, s.z1);
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx, nz, depth;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; depth = r - d; }
      else { // centro dentro da caixa: sai pelo lado mais próximo
        const l = pos.x - s.x0, rr = s.x1 - pos.x, t = pos.z - s.z0, b = s.z1 - pos.z;
        const m = Math.min(l, rr, t, b);
        if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
        depth = m + r;
      }
      if (hit && hit(s, nx, nz, depth)) continue;
      pos.x += nx * depth; pos.z += nz * depth;
      any = touched = true;
    }
    if (!any) break;
  }
  return touched;
}
// algum sólido toca este círculo na altura y? (sem empurrar; usado por projéteis)
function touchingSolid(x, z, r, y, only = null) {
  for (const s of solids) {
    if (s.top <= y || solidBase(s) > y + 0.4 || (only && !only(s))) continue;
    const cx = THREE.MathUtils.clamp(x, s.x0, s.x1), cz = THREE.MathUtils.clamp(z, s.z0, s.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return s;
  }
  return null;
}

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(HX * 2, HZ * 2),
  useTex(worldUV(new THREE.MeshStandardMaterial({ color: 0x17121a, roughness: 1 }), 1 / 6), TEX.ceiling, 0xffffff)
);
ceiling.rotation.x = Math.PI / 2; // virada para baixo
ceiling.position.y = ROOF;
scene.add(ceiling);

// ---------- Luzes: bem menos luz que antes; poucas lâmpadas, várias queimadas ----------
const AMBIENT0 = 0.32, MOON0 = 0.32, BULB0 = 7;
const ambient = new THREE.AmbientLight(0x3a3350, AMBIENT0);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x7f90d8, MOON0);
moon.position.set(-8, 16, 6);
moon.castShadow = true;
moon.shadow.camera.left = moon.shadow.camera.bottom = -H - 2;
moon.shadow.camera.right = moon.shadow.camera.top = H + 2;
moon.shadow.mapSize.set(2048, 2048);
scene.add(moon);

// lâmpadas penduradas: [x, z, altura do teto, acesa?, cor]. Só 5 têm luz de verdade (cada luz pontual pesa em todos os pixels)
const cordMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
const bulbs = [
  [0, 4, ROOF, 1, 0xffcf8a],          // lustre do hall
  [-10.5, 7, GF_CEIL, 1, 0xff9a5a],   // sala de estar (tom de brasa)
  [10.5, -6, GF_CEIL, 1, 0xd8e0c0],   // cozinha (fluorescente velha)
  [-10.5, -6, ROOF, 1, 0xffb070],     // quarto da criança
  [10.5, -6, ROOF, 1, 0xc05050],      // quarto principal (vermelho)
  [-10.5, -6, GF_CEIL, 0], [10.5, 7, GF_CEIL, 0], [0, -8, GF_CEIL, 0], [0, -8, ROOF, 0], [-10.5, 7, ROOF, 0], [10.5, 7, ROOF, 0],
].map(([x, z, ceil, lit, color = 0xffd9a0], idx) => {
  if (touchMode && idx > 2) lit = 0; // celular: só 3 luzes pontuais (lustre, sala, cozinha); cada luz pesa em todos os pixels
  const g = new THREE.Group();
  g.position.set(x, ceil, z);
  const drop = ceil === ROOF && x === 0 && z === 4 ? 1.6 : 0.6;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, drop, 5), cordMat);
  cord.position.y = -drop / 2;
  const bulbMat = new THREE.MeshBasicMaterial({ color: lit ? 0xffe2a8 : 0x2a2622 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbMat);
  bulb.position.y = -drop - 0.1;
  const light = lit ? new THREE.PointLight(color, BULB0, 13, 1.7) : null;
  if (light) light.position.y = -drop - 0.2;
  g.add(cord, bulb);
  if (light) g.add(light);
  scene.add(g);
  return { light, bulbMat: lit ? bulbMat : new THREE.MeshBasicMaterial() }; // (as queimadas não acendem nas piscadas)
});

// ---------- Decoração (não bloqueia nada) ----------
const decoBox = new THREE.BoxGeometry(1, 1, 1);
function floorPatch(w, d, x, z, color, t, y = 0) { // tapetes e pisos diferentes, um pouco acima do piso
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  if (t) useTex(m.material, t);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.015, z); m.receiveShadow = true;
  scene.add(m);
}
floorPatch(6, 4.5, -10.5, 7.5, 0x3a1219, IMG.rug);              // sala de estar
floorPatch(2.6, 11, 0, 6.4, 0x2a0c16, IMG.runner);              // passadeira do hall até a porta
IMG.tiles.repeat.set(10, 7); floorPatch(10.6, 7.8, 10.5, -8, 0x3d3a42, IMG.tiles);   // cozinha
floorPatch(9.6, 9.6, 0, -7.9, 0x2b2a2e, null, F2);             // banheiro: piso de cimento
floorPatch(5, 3.6, -10.5, -8, 0x25131c, IMG.rug, F2);          // quarto da criança
// janela: moldura + vidro azulado (luar); algumas pregadas com tábuas
const frameMat = trimMat;
const glassMat = new THREE.MeshBasicMaterial({ color: 0x1c2648 });
function addWindow(x, y, z, ry, boarded = false) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), glassMat); pane.position.z = 0.02;
  g.add(pane);
  for (const [w, h, px, py] of [[1.55, 0.12, 0, 1.0], [1.55, 0.12, 0, -1.0], [0.12, 2.1, -0.71, 0], [0.12, 2.1, 0.71, 0], [0.06, 1.9, 0, 0], [1.3, 0.06, 0, 0.3]]) {
    const b = new THREE.Mesh(decoBox, frameMat); b.scale.set(w, h, 0.1); b.position.set(px, py, 0.05); g.add(b);
  }
  if (boarded) for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(decoBox, woodMat); b.scale.set(1.8, 0.2, 0.05); b.position.set(0, -0.6 + i * 0.6, 0.12); b.rotation.z = (i - 1) * 0.25 + 0.08; g.add(b); }
  scene.add(g);
}
const picN = { f: 0, s: 0 };
const pictureFrameMat = new THREE.MeshStandardMaterial({ color: 0x5a4418, roughness: 0.6 }); // compartilhado: as molduras viram uma malha só
function addPicture(x, y, z, ry, w, h, face, tilt = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, ry, tilt);
  const frame = new THREE.Mesh(decoBox, pictureFrameMat); frame.scale.set(w + 0.16, h + 0.16, 0.06);
  const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ roughness: 1, color: face ? 0x241c2c : 0x1b2a22 }));
  canvasM.position.z = 0.04;
  const list = face ? IMG.portraits : IMG.scenes; useTex(canvasM.material, list[(face ? picN.f++ : picN.s++) % list.length], 0xffffff);
  g.add(frame, canvasM); scene.add(g);
}
const XI = HX - 0.02, ZI = HZ - 0.02; // faces internas das paredes externas
for (const [y, fl] of [[1.6, 0], [5.2, 1]]) {
  for (const x of [-12, -8, 8, 12]) { addWindow(x, y, -ZI + 0.05, 0, (x + fl * 3) % 8 === 0); addWindow(x, y, ZI - 0.05, Math.PI, x === 12 && !fl); }
  for (const z of [-8, 7]) { addWindow(XI - 0.05, y, z, -Math.PI / 2, fl === 1 && z === 7); addWindow(-XI + 0.05, y, z, Math.PI / 2, fl === 0 && z === -8); }
}
for (const x of [-3, 3]) addWindow(x, 5.2, ZI - 0.05, Math.PI);   // janelas altas do hall, sobre a porta
// retratos de família pelo hall e pela galeria (um deles torto)
addPicture(-4.83, 1.9, 9.5, Math.PI / 2, 0.9, 1.2, true); addPicture(4.83, 1.9, 9.5, -Math.PI / 2, 0.9, 1.2, true, 0.12);
addPicture(4.83, 5.0, 5, -Math.PI / 2, 1.3, 1.7, true); addPicture(-4.83, 5.0, 8, Math.PI / 2, 1.6, 1.1, false);
addPicture(0, 5.1, -3.83, 0, 1.1, 1.5, true); addPicture(-10.5, 2.0, 1.83, Math.PI, 1.3, 0.9, false);
addPicture(10.5, 1.9, 1.83, Math.PI, 1.0, 1.3, true, -0.08); addPicture(-10.5, 5.3, -11.95, 0, 0.8, 1.1, true);
addPicture(10.5, 5.2, -11.95, 0, 1.4, 1.0, false); addPicture(-15.95, 5.3, 7, Math.PI / 2, 1.0, 1.3, true);
// porta da frente (trancada), no meio da parede sul
{
  const g = new THREE.Group(); g.position.set(0, 0, ZI - 0.05); g.rotation.y = Math.PI;
  const door = new THREE.Mesh(decoBox, new THREE.MeshStandardMaterial({ color: 0x2a180c, roughness: 0.8 })); door.scale.set(1.9, 2.7, 0.1); door.position.y = 1.35; useTex(door.material, IMG.door, 0xffffff);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshStandardMaterial({ color: 0x8a7040, roughness: 0.4 })); knob.position.set(0.7, 1.3, 0.1);
  const top = new THREE.Mesh(decoBox, frameMat); top.scale.set(2.3, 0.18, 0.14); top.position.y = 2.8;
  for (const sx of [-1.05, 1.05]) { const p = new THREE.Mesh(decoBox, frameMat); p.scale.set(0.18, 2.9, 0.14); p.position.set(sx, 1.45, 0); g.add(p); }
  g.add(door, knob, top); scene.add(g);
}
// sangue seco (decalques)
function addDecal(t, x, y, z, rx, ry, size, rot = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }));
  m.rotation.set(rx, ry, 0); if (rx) m.rotation.z = rot; m.position.set(x, y, z); m.receiveShadow = true; decals.add(m);
}
[[1.5, 0, 9, 2.4], [-2, 0, 1.5, 1.8], [-12, 0, -6, 2.6], [12, 0, -9.5, 1.6], [10, 0, 8, 2.2], [-1, 0, -9, 2.2], [-10, F2, -9, 1.8], [11, F2, -8, 2.4], [-3, F2, -2.5, 1.6]].forEach(([x, y, z, s], i) =>
  addDecal(IMG.bloodFloor[i % 2], x, y + 0.03, z, -Math.PI / 2, 0, s, i * 1.7));
[[-4.84, 2.0, -0.5, Math.PI / 2], [12, 1.8, -ZI + 0.03, 0], [-XI + 0.03, 5.0, -3, Math.PI / 2], [XI - 0.03, 1.9, 4, -Math.PI / 2], [-1.5, 5.0, -3.84, 0], [5.16, 1.8, -10, Math.PI / 2]].forEach(([x, y, z, ry], i) =>
  addDecal(IMG.bloodWall[i % 2], x, y, z, 0, ry, 2.2));
// vigas no teto do hall e do andar de cima
for (const z of [-9, -4.5, 0, 4.5, 9]) {
  const b = new THREE.Mesh(decoBox, frameMat); b.scale.set(HX * 2, 0.26, 0.32); b.position.set(0, ROOF - 0.13, z); scene.add(b);
}
// teias de aranha nos cantos (triângulos translúcidos com fios desenhados num canvas)
{
  const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d');
  g2.strokeStyle = 'rgba(220,220,230,.55)'; g2.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; g2.beginPath(); g2.moveTo(0, 0); g2.lineTo(Math.cos(a) * 128, Math.sin(a) * 128); g2.stroke(); }
  for (let r = 14; r < 128; r += 14) { g2.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2, rr = r * (0.92 + 0.08 * Math.sin(i * 3 + r)); i ? g2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g2.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g2.stroke(); }
  const webMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 });
  const webGeo = new THREE.PlaneGeometry(1.4, 1.4); webGeo.translate(0.7, -0.7, 0);
  const corners = [[-HX, -HZ, 1, 1], [HX, -HZ, -1, 1], [-HX, HZ, 1, -1], [HX, HZ, -1, -1], [-5, -4, -1, 1], [5, -4, 1, 1], [-5, 2, 1, -1], [5, 2, -1, -1], [-5, HZ, 1, -1], [5, HZ, -1, -1]];
  for (const [x, z, sx, sz] of corners) for (const ceil of [GF_CEIL, ROOF]) {
    if (ceil === GF_CEIL && Math.abs(x) === 5 && z === HZ) continue;
    const w = new THREE.Mesh(webGeo, webMat); w.position.set(x + sx * 0.17, ceil - 0.01, z + sz * 0.17);
    w.rotation.set(0, Math.atan2(sz, -sx) + Math.PI / 4 - Math.PI / 4, 0); w.lookAt(x + sx, ceil - 0.01, z + sz); w.rotateY(-Math.PI / 4); w.rotateX(-0.6);
    decals.add(w);
  }
}


// ---------- OTIMIZAÇÃO: juntar o cenário fixo (menos chamadas de desenho) ----------
// A casa tem ~1.200 pedaços (batentes, balaústres, molduras, teias, vigas...). Desenhar cada um é uma "chamada de desenho"
// separada para a placa de vídeo, e o custo por chamada pesa muito no celular. Aqui, tudo que é FIXO e usa o MESMO
// material vira uma única malha: as geometrias são copiadas já com a posição/rotação/escala de cada peça aplicadas
// (matrixWorld) e concatenadas. O visual não muda. Ficam de fora o que muda durante o jogo: paredes de gesso e corrimãos
// (quebram), lâmpadas (acendem/apagam) e o que tem luz dentro.
function mergeStatic(roots, exclude, target) {
  scene.updateMatrixWorld(true);
  const groups = new Map();
  for (const r of roots) r.traverse((o) => {
    if (!o.isMesh || exclude.has(o) || !o.visible || o.isSkinnedMesh || Array.isArray(o.material)) return;
    const key = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + o.renderOrder;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let before = 0, after = 0;
  for (const list of groups.values()) {
    before += list.length;
    if (list.length < 2) { after += 1; continue; }
    const geos = list.map((m) => {
      const src = m.geometry, g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position.clone()); g.setAttribute('normal', src.attributes.normal.clone());
      g.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
      if (src.index) g.setIndex(src.index.clone()); else g.setIndex([...Array(src.attributes.position.count).keys()]);
      return g.applyMatrix4(m.matrixWorld);
    });
    const merged = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
    if (!merged) { after += list.length; continue; }
    const m0 = list[0], mesh = new THREE.Mesh(merged, m0.material);
    mesh.castShadow = m0.castShadow; mesh.receiveShadow = m0.receiveShadow; mesh.renderOrder = m0.renderOrder;
    mesh.matrixAutoUpdate = false; target.add(mesh);
    for (const m of list) m.removeFromParent();
    after += 1;
  }
  return [before, after];
}
{
  const exclude = new Set();
  for (const sol of allPanels) { exclude.add(sol.mesh); sol.extra?.forEach((p) => exclude.add(p)); }
  const roots = scene.children.slice(houseStart).filter((o) => o !== decals);
  roots.forEach((r) => r.traverse((o) => { if (o.isLight && o.parent !== scene) o.parent.children.forEach((c) => { if (c.material !== cordMat) exclude.add(c); }); })); // lâmpadas (o fio pode juntar)
  const statics = new THREE.Group(); statics.name = 'cenarioFixo'; scene.add(statics);
  const [b1, a1] = mergeStatic(roots, exclude, statics);
  const [b2, a2] = mergeStatic([decals], new Set(), decals);
  console.info(`[otimização] cenário fixo: ${b1 + b2} peças -> ${a1 + a2} malhas`);
}

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
// MÃO MAIS HUMANA: palma achatada, 4 dedos de 3 falanges (cápsulas) dobrados em punho, polegar por cima, punho fino e manga.
// Cada falange é filha da articulação anterior (hierarquia: dobrar a articulação 1 move o resto do dedo).
const capCache = {};
function capsule(r, len) { return (capCache[r + '_' + len] ??= new THREE.CapsuleGeometry(r, len, 5, 10)); }
function makeFinger(x, [l1, l2, l3], r, curl = 0) {
  const j1 = new THREE.Group(); j1.position.set(x, 0.03, -0.085); j1.rotation.x = Math.PI / 2 - 0.1;       // 1ª articulação: dedo aponta para a frente
  const j2 = new THREE.Group(); j2.position.y = -(l1 + 1.6 * r); j2.rotation.x = -Math.PI / 2 + 0.1 - curl; // 2ª: dobra para baixo
  const j3 = new THREE.Group(); j3.position.y = -(l2 + 1.6 * r); j3.rotation.x = -Math.PI / 2 + 0.25 - curl; // 3ª: volta para a palma
  for (const [j, l] of [[j1, l1], [j2, l2], [j3, l3]]) {
    const seg = new THREE.Mesh(capsule(r, l), skinMat); seg.position.y = -(l / 2 + r * 0.8); j.add(seg);
  }
  j1.add(j2); j2.add(j3);
  return j1;
}
function makeHand(side) { // side: -1 = esquerda, +1 = direita
  const fist = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skinMat);
  palm.scale.set(0.125, 0.082, 0.11); palm.position.set(0, 0, 0.01);
  fist.add(palm);
  const FING = [[-0.078, [0.05, 0.036, 0.03], 0.027], [-0.026, [0.056, 0.04, 0.032], 0.029], [0.026, [0.052, 0.037, 0.03], 0.028], [0.078, [0.04, 0.03, 0.026], 0.025]];
  FING.forEach(([x, l, r], i) => fist.add(makeFinger(x, l, r, i * 0.03)));
  // polegar: sai do lado da palma, aponta para a frente e para dentro, e dobra por cima dos dedos
  const t1 = new THREE.Group(); t1.position.set(-side * 0.1, -0.03, -0.0); t1.rotation.set(Math.PI / 2 - 0.15, 0, -side * 0.45);
  const t2 = new THREE.Group(); t2.position.y = -0.07; t2.rotation.z = -side * 1.1; t2.rotation.x = 0.35;
  const ts1 = new THREE.Mesh(capsule(0.03, 0.045), skinMat); ts1.position.y = -0.04; t1.add(ts1);
  const ts2 = new THREE.Mesh(capsule(0.027, 0.035), skinMat); ts2.position.y = -0.035; t2.add(ts2);
  t1.add(t2); fist.add(t1);
  // punho e antebraço: pele fina, aro da manga e a manga larga (a manga cobre o resto do braço)
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.2, 14), skinMat);
  wrist.rotation.x = Math.PI / 2; wrist.position.z = 0.15;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.05, 16), cuffMat);
  cuff.rotation.x = Math.PI / 2; cuff.position.z = 0.27;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.55, 14), sleeveMat);
  sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.55;
  const pivot = new THREE.Group();
  pivot.rotation.set(0.28, 0.3 * side, 0); // o braço sai para baixo e para o lado do próprio ombro
  pivot.add(wrist, cuff, sleeve);
  fist.add(pivot);
  viewmodel.add(fist);
  return { fist, side, p: [0, 0, 0, 0, 0, 0, 1] };
}
const hands = [makeHand(-1), makeHand(1)]; // [0] = esquerda, [1] = direita
loadFirstPersonArms(import.meta.env.BASE_URL + 'models/arms.glb', hands); // modelo pronto dos braços, se existir
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
    lunge: 0.9, roll: 0.05, twist: 0.07, dip: 0, kick: 0.05, fov: 8,
    prop: { speed: 40, mul: 1.25, knock: 1.05, large: 2 },
    strike: [[0, ...G], [0.22, 0.52, -0.44, -0.22, -0.5, 0.35, 0.45, 1.1], [0.46, -0.04, -0.12, -1.7, 0.1, -0.3, 0, 1.8], [0.62, -0.04, -0.12, -1.75, 0.1, -0.3, 0, 1.85], [1, ...G]],
    off: [[0, ...G], [0.3, 0.16, -0.18, -0.5, -0.5, 0.3, 0, 1], [1, ...G]] },
  heavy: { name: 'SOCO FORTE!', atk: 'heavy', dur: CFG.heavyDuration, hitAt: CFG.heavyHitAt, dmg: CFG.heavyDamage, hands: 'right', cd: 'heavy',
    lunge: 0.6, roll: 0.07, twist: 0.10, dip: 0, kick: 0.09, fov: 15,
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
  throwT: -1, tossT: -1, grabAnimT: 0, gulpN: -1, // animações das mãos (arremesso, arremesso do fantasma, pegar)
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
  flash: 0,          // clarão branco no impacto (0..1)
  slow: 0,           // tempo restante de câmera lenta (s, tempo real)
  eyeY: 0,           // altura suavizada dos olhos (sobe escada sem tranco)
  pvy: 0,            // velocidade vertical do jogador (cai de plataformas)
};

// direção do olhar (primeira pessoa)
const look = { yaw: 0, pitch: 0 };
const MOUSE_SENS = 0.0022;
let locked = false;

// ---------- Entrada (aula 7.2: variáveis de estado + eventos) ----------
const keys = {};
const canvas = renderer.domElement;
// clarão branco de impacto (um div por cima do canvas; some sozinho)
const flashEl = document.createElement('div');
flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4';
document.body.appendChild(flashEl);
disposers.push(() => flashEl.remove());
on(window, 'keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') restart();
  if (e.code === 'KeyT') { settings.slowmo = !settings.slowmo; if (!settings.slowmo) state.slow = 0; refreshOptionLabels(); saveSettings(); state.moveNameT = 1; elMoveName.textContent = tx(settings.slowmo ? 'slowOn' : 'slowOff'); } // T = liga/desliga a câmera lenta
  if (e.code === 'KeyM') { settings.muted = sfx.toggleMute(); refreshOptionLabels(); saveSettings(); } // M = mudo
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

// ---------- Controles de toque (celular) ----------
// Joystick flutuante à esquerda (vira as teclas WASD), arrastar o dedo na tela para olhar,
// e botões para os golpes. Cada dedo é seguido pelo seu pointerId, então dá para andar, olhar e socar ao mesmo tempo.
const touchBtns = {};
const touchHold = { jab: false };
let fsRefresh = null;
function setupTouch() {
  const css = document.createElement('style');
  css.textContent = `
    body.touch { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    body.touch .kbonly, body.touch #moves, body.touch #help { display: none !important; }
    body:not(.touch) .touchonly { display: none !important; }
    #tui { position: fixed; inset: 0; z-index: 3; touch-action: none; }
    #tui .zone { position: absolute; touch-action: none; }
    #tz-look { inset: 0; }
    #tz-move { left: 0; bottom: 0; width: 42%; height: 72%; }
    #tui .stick { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 1px solid rgba(185,174,156,.3); background: rgba(0,0,0,.28); display: none; pointer-events: none; }
    #tui .stick i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(110,8,12,.6); border: 1px solid rgba(185,174,156,.5); }
    #tui .tb { position: absolute; border-radius: 50%; border: 1px solid rgba(185,174,156,.42); background: rgba(8,4,4,.6); color: #b9ae9c; font: 400 10px Georgia, serif; letter-spacing: 1.5px; box-shadow: inset 0 0 14px #000;
               display: flex; align-items: center; justify-content: center; text-align: center; touch-action: none; padding: 0; }
    #tui .tb:active, #tui .tb.down { background: rgba(120,10,14,.8); }
    #tui .tb.cd { opacity: .45; }
    #tui .tb.main { background: rgba(78,6,9,.72); border-color: rgba(160,30,34,.7); color: #d8cfbe; font-size: 13px; }
    #tpause { position: fixed; top: 10px; right: 10px; z-index: 5; width: 44px; height: 44px; border-radius: 4px; border: 1px solid rgba(185,174,156,.4); background: rgba(8,4,4,.6); color: #b9ae9c; font-size: 18px; display: none; }
    body.touch #tpause { display: block; }
    #tfs { position: fixed; top: 10px; right: 62px; z-index: 5; width: 44px; height: 44px; border-radius: 4px; border: 1px solid rgba(185,174,156,.4); background: rgba(8,4,4,.6); color: #b9ae9c; font-size: 18px; display: none; }
    body.touch.fsok #tfs { display: block; }
    @media (max-height: 480px) { #tpause, #tfs { top: 6px; width: 38px; height: 38px; font-size: 17px; } #tfs { right: 54px; } #tpause { right: 8px; } }
    #rotate { position: fixed; inset: 0; z-index: 9; background: #030203; color: #b9ae9c; display: none; align-items: center; justify-content: center; text-align: center; font-size: 20px; padding: 24px; }
    @media (orientation: portrait) { body.touch #rotate { display: flex; } }
    @media (max-height: 460px) { #menu .panel, #menu > div { max-height: 92vh; overflow-y: auto; } }
  `;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'tui'; ui.style.display = 'none'; // só aparece enquanto joga (touchUpdate)
  ui.innerHTML = `<div class="zone" id="tz-look"></div><div class="zone" id="tz-move"></div><div class="stick" id="tstick"><i></i></div>`;
  const defs = [ // [id, rótulo, direita, baixo, tamanho, classe]
    ['jab', 'SOCO', 20, 20, 96, 'main'], ['heavy', 'FORTE', 126, 28, 68, ''], ['upper', 'UPPER', 24, 128, 62, ''],
    ['slam', 'ESMAGAR', 94, 114, 62, ''], ['dodge', 'ESQUIVA', 164, 106, 58, ''],
  ];
  for (const [id, label, r, b, size, cls] of defs) {
    const el = document.createElement('button'); el.className = 'tb ' + cls; el.dataset.tb = id; el.textContent = tx('tb.' + id); touchBtns[id] = el;
    el.style.cssText = `right:${r}px;bottom:${b}px;width:${size}px;height:${size}px`; ui.appendChild(el);
  }
  for (const [id, label, l, b] of [['grab', 'PEGAR', 22, 196]]) {
    const el = document.createElement('button'); el.className = 'tb'; el.dataset.tb = id; el.textContent = tx('tb.' + id); touchBtns[id] = el;
    el.style.cssText = `left:${l}px;bottom:${b}px;width:58px;height:58px`; ui.appendChild(el);
  }
  document.body.appendChild(ui);
  const pause = document.createElement('button'); pause.id = 'tpause'; pause.textContent = '❚❚'; document.body.appendChild(pause);
  // tela cheia: botão no jogo e no menu (o iPhone não permite tela cheia fora de vídeo, então o botão some lá)
  const fsOk = !!(document.documentElement.requestFullscreen && document.fullscreenEnabled);
  if (fsOk) document.body.classList.add('fsok');
  const fsBtn = document.createElement('button'); fsBtn.id = 'tfs'; document.body.appendChild(fsBtn);
  const fsMenu = document.getElementById('btnFs');
  const toggleFs = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch { /* ignora */ } };
  const refreshFs = () => { const on = !!document.fullscreenElement; fsBtn.textContent = on ? '⤡' : '⤢'; fsBtn.title = tx(on ? 'fsExit' : 'fsEnter'); if (fsMenu) fsMenu.textContent = tx(on ? 'fsExit' : 'fsEnter'); };
  on(fsBtn, 'pointerdown', (e) => { e.preventDefault(); toggleFs(); });
  if (fsMenu) on(fsMenu, 'click', toggleFs);
  on(document, 'fullscreenchange', refreshFs); refreshFs(); fsRefresh = refreshFs;
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.dataset.i18n = 'rotate'; rot.textContent = tx('rotate'); document.body.appendChild(rot);
  disposers.push(() => { css.remove(); ui.remove(); pause.remove(); rot.remove(); fsBtn.remove(); });

  const act = { jab: () => startPunch('jab'), heavy: () => startPunch('heavy'), upper: () => startPunch('upper'), slam: () => startPunch('slam'), dodge: () => startDodge(), grab: () => interact() };
  for (const id in act) {
    on(touchBtns[id], 'pointerdown', (e) => { e.preventDefault(); touchBtns[id].setPointerCapture?.(e.pointerId); touchBtns[id].classList.add('down');
      if (state.over) { restart(); return; }
      if (id === 'jab') touchHold.jab = true;
      if (locked) act[id](); });
    on(touchBtns[id], 'pointerup', () => { touchBtns[id].classList.remove('down'); if (id === 'jab') touchHold.jab = false; });
    on(touchBtns[id], 'pointercancel', () => { touchBtns[id].classList.remove('down'); if (id === 'jab') touchHold.jab = false; });
  }
  // joystick flutuante
  const zm = ui.querySelector('#tz-move'), st = ui.querySelector('#tstick'), knob = st.firstElementChild;
  let mid = null, ox = 0, oy = 0;
  const setKeys = (dx, dy) => { keys.KeyA = dx < -0.35; keys.KeyD = dx > 0.35; keys.KeyW = dy < -0.35; keys.KeyS = dy > 0.35; };
  on(zm, 'pointerdown', (e) => { if (mid !== null) return; mid = e.pointerId; zm.setPointerCapture?.(e.pointerId); ox = e.clientX; oy = e.clientY;
    st.style.display = 'block'; st.style.left = ox + 'px'; st.style.top = oy + 'px'; knob.style.transform = ''; });
  on(zm, 'pointermove', (e) => { if (e.pointerId !== mid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const R = 55, l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; setKeys(dx / R, dy / R); });
  const endMove = (e) => { if (e.pointerId !== mid) return; mid = null; st.style.display = 'none'; setKeys(0, 0); };
  on(zm, 'pointerup', endMove); on(zm, 'pointercancel', endMove);
  // olhar: arrastar o dedo em qualquer lugar fora do joystick e dos botões
  const zl = ui.querySelector('#tz-look');
  let lid = null, lx = 0, ly = 0;
  on(zl, 'pointerdown', (e) => { if (state.over) { restart(); return; } if (lid !== null) return; lid = e.pointerId; zl.setPointerCapture?.(e.pointerId); lx = e.clientX; ly = e.clientY; });
  on(zl, 'pointermove', (e) => { if (e.pointerId !== lid || !locked) return;
    look.yaw -= (e.clientX - lx) * 0.0052 * settings.sens; look.pitch -= (e.clientY - ly) * 0.0052 * settings.sens;
    look.pitch = THREE.MathUtils.clamp(look.pitch, -1.35, 1.35); lx = e.clientX; ly = e.clientY; });
  const endLook = (e) => { if (e.pointerId === lid) lid = null; };
  on(zl, 'pointerup', endLook); on(zl, 'pointercancel', endLook);
  // pausa
  on(pause, 'pointerdown', (e) => { e.preventDefault(); locked = false; setKeys(0, 0); updateMenu(); });
  on(document, 'visibilitychange', () => { if (document.hidden && locked) { locked = false; setKeys(0, 0); updateMenu(); } });
}
if (touchMode) setupTouch();
function touchUpdate() { // recarga dos golpes nos botões
  if (!touchMode) return;
  for (const k of ['heavy', 'upper', 'slam']) touchBtns[k]?.classList.toggle('cd', state.cd[k] > 0);
  const ui = document.getElementById('tui'); if (ui) ui.style.display = (locked || state.over) ? 'block' : 'none';
  const tp = document.getElementById('tpause'); if (tp) tp.style.visibility = locked ? 'visible' : 'hidden';
}

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
const elOptVol = document.getElementById('optVol');
const elOptVolV = document.getElementById('optVolV');
const elOptFlicker = document.getElementById('optFlicker');
const elOptSlow = document.getElementById('optSlow');
const elOptStop = document.getElementById('optStop');
const elOptShadow = document.getElementById('optShadow');
const elOptTex = document.getElementById('optTex');
function applyShadows() { // sombras são o recurso mais caro: desligar ajuda muito em computador fraco
  renderer.shadowMap.enabled = settings.shadows; moon.castShadow = settings.shadows;
  scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) m.needsUpdate = true; });
}

function lockMouse() {
  elMenuMsg.textContent = '';
  sfx.start(); // o clique do jogador libera o áudio
  if (touchMode) { // sem Pointer Lock no celular: "locked" passa a significar "jogando"
    locked = true; state.started = true; updateMenu();
    try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* ignora */ }
    return;
  }
  canvas.requestPointerLock?.();
}
function updateMenu() {
  const paused = !locked && !state.over;
  elMenu.style.display = paused ? 'flex' : 'none';
  if (!paused) return;
  elMenuTitle.textContent = state.started ? tx('paused') : tx('title');
  elMenuSub.textContent = state.started ? tx('stopped') : tx('sub');
  elBtnPlay.textContent = state.started ? tx('resume') : tx('play');
  elBtnRestart.style.display = state.started ? '' : 'none';
}
function refreshOptionLabels() {
  elOptSens.value = settings.sens; elOptSensV.textContent = settings.sens.toFixed(2) + 'x';
  elOptFov.value = settings.fov;   elOptFovV.textContent = settings.fov + '°';
  elOptFlicker.checked = settings.flicker;
  elOptSlow.checked = settings.slowmo;
  elOptStop.checked = settings.hitstop;
  elOptShadow.checked = settings.shadows; elOptTex.checked = settings.textures;
  elOptVol.value = settings.vol;   elOptVolV.textContent = settings.muted ? tx('muted') : Math.round(settings.vol * 100) + '%';
}
refreshOptionLabels();
if (!settings.shadows) applyShadows();
applyTextures();
// idioma: aplica nos textos fixos do HTML e nos botões de toque; o seletor do menu troca na hora
const elOptLang = document.getElementById('optLang');
function applyLang() {
  applyDom();
  elOptLang.options[0].textContent = tx('auto'); elOptLang.value = savedChoice();
  document.title = tx('title');
  for (const k in touchBtns) touchBtns[k].textContent = tx('tb.' + k);
  fsRefresh?.();
  elBossName.textContent = tx('boss');
}
on(elOptLang, 'change', () => { saveChoice(elOptLang.value); setLang(elOptLang.value === 'auto' ? undefined : elOptLang.value); applyLang(); });

on(document, 'pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) state.started = true;
  updateMenu();
});
on(document, 'pointerlockerror', () => {
  elMenuMsg.textContent = tx('lockerr');
});
on(elBtnPlay, 'click', lockMouse);
on(elBtnRestart, 'click', () => { restart(); lockMouse(); });
on(elOptSens, 'input', () => { settings.sens = +elOptSens.value; refreshOptionLabels(); saveSettings(); });
on(elOptFlicker, 'change', () => { settings.flicker = elOptFlicker.checked; saveSettings(); });
on(elOptSlow, 'change', () => { settings.slowmo = elOptSlow.checked; saveSettings(); });
on(elOptShadow, 'change', () => { settings.shadows = elOptShadow.checked; applyShadows(); saveSettings(); });
on(elOptTex, 'change', () => { settings.textures = elOptTex.checked; applyTextures(); saveSettings(); });
on(elOptStop, 'change', () => { settings.hitstop = elOptStop.checked; saveSettings(); });
on(elOptVol, 'input', () => { settings.vol = +elOptVol.value; sfx.setVolume(settings.vol); refreshOptionLabels(); saveSettings(); });
on(elOptFov, 'input', () => { settings.fov = +elOptFov.value; BASE_FOV = settings.fov; refreshOptionLabels(); saveSettings(); });

// ---------- Boss (fantasma: menina de vestido branco, cabelo preto comprido) ----------
// Modelo feito só de primitivas, em hierarquia: boss > bossVis (inclinação) > vestido, braços (cada um com pivô no ombro) e cabeça (rosto + cabelo).
const bossMat = new THREE.MeshStandardMaterial({            // vestido: translúcido, a cor emissiva mostra o estado do boss
  color: 0xe9e6ee, emissive: 0x4fa8ff, emissiveIntensity: 0.7,
  transparent: true, opacity: 0.9, roughness: 0.8, side: THREE.DoubleSide,
});
const bossSkin = new THREE.MeshStandardMaterial({ color: 0xc9c7c4, emissive: 0x4fa8ff, emissiveIntensity: 0.25, roughness: 0.6 });
const bossHair = new THREE.MeshStandardMaterial({ color: 0x060509, roughness: 1 });
const bossEyeGlow = new THREE.MeshBasicMaterial({ color: 0xb8bcc0 });  // olhos: brilho pálido fixo (sem cores)
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
// (sem luz própria: o fantasma não ilumina mais o ambiente com cores; só a casa e a sua lanterna iluminam)
// MODELO PRONTO do fantasma (opcional): se existir public/models/ghost.glb, ele substitui as primitivas acima e passa a
// tocar os clipes de animação do arquivo conforme o estado do chefe (ver ghostClip em updateBoss). Sem o arquivo, nada muda.
const ghostRig = createModelRig({
  url: import.meta.env.BASE_URL + 'models/ghost.glb', height: 1.8, parent: bossVis, shadows: !touchMode,
  onReady: (rig) => { for (const ch of bossVis.children) if (ch !== rig.root) ch.visible = false; },
});
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
    if (Math.random() < 0.6) sfx.boneCrack(bossAt(), 2); // o pescoço estala a cada espasmo
  }
  let armX = Math.sin(t * 1.3) * 0.12, armSpread = 0.12, lean = 0.12, headLoll = null;
  if (B.mode === 'windup') {                 // aviso: ergue os braços para frente e inclina o corpo
    const k = Math.min(1, B.t / (CFG.bossWindup * (B.phase2 ? 0.7 : 1)));
    armX = -1.5 * k + Math.sin(t * 40) * 0.06 * k; armSpread = 0.05; lean = 0.12 + 0.35 * k; headLoll = 0; ghostAnim.headZ += (Math.sin(t * 50) * 0.08 - ghostAnim.headZ) * 0.5;
  } else if (B.mode === 'dash' || B.mode === 'swipe') { // avanço / garras: braços esticados à frente
    armX = -1.75; armSpread = 0.02; lean = 0.55; headLoll = 0;
  } else if (B.mode === 'ceil') {            // rasteja no teto: garras estendidas
    armX = -1.9 + Math.sin(t * 14) * 0.25; armSpread = 0.35; lean = 0.3; headLoll = 0;
  } else if (B.mode === 'possess') {         // braços erguidos, tremendo, controlando os móveis
    armX = -2.7 + Math.sin(t * 38) * 0.08; armSpread = 0.6; lean = -0.1; headLoll = 0;
  } else if (B.mode === 'drop') {
    armX = -2.4; armSpread = 0.9; lean = 0.2; headLoll = 0;
  } else if (B.blockT > 0 && canGuard()) {   // defendendo: antebraços cruzados na frente do rosto
    armX = -2.0; armSpread = -0.25; lean = -0.15; headLoll = 0;
  } else if (B.mode === 'grabbed') {
    armX = -0.4 + Math.sin(t * 30) * 0.6; armSpread = 0.9 + Math.sin(t * 23) * 0.3; lean = 0; headLoll = 0.5;
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
  q: new THREE.Quaternion(),   // orientação "física" do corpo (cambalhota/rolagem)
  w: new THREE.Vector3(),      // velocidade angular (rad/s)
  tw: 0,             // 0..1: quanto o corpo está deitado/rolando (1) em vez de em pé (0); desce suave ao se levantar
  lieT: 0,           // quanto tempo fica caído depois de parar de deslizar
  wallCD: 0, ceilCD: 0, trailT: 0,
  hitOuter: false,
  grounded: true,
  swipeN: 0, swipeCD: 0, evadeCD: 0, hitThis: false, guard: 100, blockT: 0, broken: 0, grabT: 0,
  sub: 'approach', subT: 0, circDir: 1, mv: new THREE.Vector3(), ph1: Math.random() * 6.28, ph2: Math.random() * 6.28, yaw: 0,
  blinkCD: 0, blinkDest: new THREE.Vector3(), hiddenDur: 1, whispered: false, quick: false,
  specialCD: 5, cl: 0, ceilTarget: new THREE.Vector3(), aimed: false, poss: [], possLaunched: 0, crawlSnd: 0,
};

function setBossMode(m) {
  B.mode = m; B.t = 0;
  if (m === 'chase' || m === 'stun') B.quick = false;
  if (m === 'chase') { B.subT = 0; B.mv.set(0, 0, 0); }
  if (m === 'ceil') { B.aimed = false; B.crawlSnd = 0; sfx.flicker(2); }
  if (m === 'possess') { B.poss = []; B.possInit = false; B.possLaunched = 0; sfx.windup(1.1, bossAt()); }
  if (m === 'drop') { B.vy = -26; }
  if (m === 'vanish') { B.blinkCD = CFG.blinkCooldown; sfx.flicker(2); }
  else if (m === 'appear') { sfx.flicker(3); sfx.stinger(0.6); } // reaparece: acorde de susto
  if (m === 'windup') sfx.flicker(4);
  if (m === 'swipe') { if (!B.swipeN) B.swipeN = 2 + (Math.random() < (B.phase2 ? 0.6 : 0.35) ? 1 : 0); B.hitThis = false; sfx.windup(CFG.swipeWindup, bossAt()); }
  if (m === 'windup') sfx.windup(CFG.bossWindup * (B.phase2 ? 0.7 : 1), bossAt()); // gemido que sobe avisando o ataque
  else if (m === 'dash') { sfx.dash(bossAt()); sfx.flicker(1); }
  else if (m === 'dying') sfx.death(bossAt());
}

function bossReset() {
  B.hp = CFG.bossMaxHp; B.phase2 = false; B.flash = 0; B.vel.set(0, 0, 0); B.launch = false; B.stunDur = 0; B.vy = 0; B.squash = 0; B.spin = 10;
  B.chaseTime = 1.6; B.tw = 0; B.fear = 0; B.terrorT = 0; B.calmT = 0; B.pulled = false; B.swipeN = 0; B.swipeCD = 0; B.evadeCD = 0; B.guard = CFG.guardMax; B.blockT = 0; B.broken = 0; B.w.set(0, 0, 0); B.q.identity(); B.lieT = 0; B.wallCD = 0; B.ceilCD = 0; B.blinkCD = 3; B.quick = false;
  B.specialCD = 5; B.cl = 0; B.poss = []; lightFx.dark = 0; dropMark.visible = false;
  setBossMode('chase');
  boss.position.set(0, 0, -0.5);
  boss.scale.setScalar(CFG.bossScale);
  boss.rotation.set(0, 0, 0);
  bossVis.position.set(0, 0, 0);
}

const UP = new THREE.Vector3(0, 1, 0);

// ---------- Esquiva ----------
// ESQUIVA PERFEITA: esquivar no instante do golpe dele (fim do aviso, estocada das garras ou avanço, de perto)
// -> câmera lenta curta + CONTRA-ATAQUE (o próximo golpe que acertar dá dano dobrado)
function perfectDodge() {
  state.perfectUsed = true; state.counterT = CFG.perfectDodgeWindow;
  state.slow = Math.max(state.slow, 0.45); state.moveNameT = 1; elMoveName.textContent = tx('perfect');
  sfx.whoosh(0.8, 0);
}
function bossStriking() {
  const d = Math.hypot(boss.position.x - player.position.x, boss.position.z - player.position.z);
  if (d > 3.6 || Math.abs(boss.position.y - player.position.y) > 1.5) return false;
  if (B.mode === 'swipe') return B.t > CFG.swipeWindup * (B.phase2 ? 0.8 : 1) - 0.15;
  if (B.mode === 'windup') return B.t > CFG.bossWindup * (B.phase2 ? 0.7 : 1) * (B.quick ? 0.75 : 1) - 0.25;
  return B.mode === 'dash';
}
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
  state.dodgeT = 0; state.perfectUsed = false;
  state.dodgeCD = CFG.dodgeCooldown;
  sfx.dodge();
  if (bossStriking()) perfectDodge();
}

// ---------- Soco ----------
// MIRA ASSISTIDA (só no celular): ao socar com o fantasma perto e mais ou menos à frente, a câmera gira até ele
function aimAssist() {
  if (!touchMode || B.mode === 'hidden' || B.mode === 'dying') return;
  const dx = boss.position.x - player.position.x, dz = boss.position.z - player.position.z, d = Math.hypot(dx, dz);
  if (d > 4.5 || Math.abs(boss.position.y - player.position.y) > 2) return;
  let diff = Math.atan2(-dx, -dz) - look.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (Math.abs(diff) < 0.75) state.aimTo = look.yaw + diff; // gira suave nos próximos quadros
}
function startPunch(kind = 'jab') {
  if (state.held) { if (!state.over) throwHeld(); return; } // com um objeto na mão, atacar = arremessar
  if (state.throwT >= 0 || state.tossT >= 0 || B.mode === 'grabbed') return;     // mãos ocupadas
  if (state.over || state.atk) return;
  if (MOVES[kind].cd && state.cd[MOVES[kind].cd] > 0) return;
  aimAssist();
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
  elMoveName.textContent = tx('mv.' + kind);
  ghostTryGuard(kind);
  deflectIncoming();
  if ((kind === 'heavy' || kind === 'upper') && B.mode === 'chase' && B.evadeCD <= 0 && !B.launch && B.blockT <= 0) {
    toBoss.subVectors(boss.position, player.position).setY(0);
    if (toBoss.length() < 3.4 && Math.abs(boss.position.y - player.position.y) < 1.5 && Math.random() < (B.phase2 ? 0.45 : CFG.evadeChance)) {
      // DESVIA: salto lateral rápido (pela inércia da perseguição), o soco forte erra e abre a guarda de quem bateu
      const side = Math.random() < 0.5 ? -1 : 1; toBoss.normalize();
      B.mv.set(-toBoss.z * side * 6, 0, toBoss.x * side * 6); B.sub = 'stare'; B.subT = 0.8;
      B.evadeCD = CFG.evadeCooldown; B.chaseTime = Math.max(B.t + 0.5, B.chaseTime);
      sfx.whisper(bossAt()); spawnPuff(boss.position.x, boss.position.y + 1, boss.position.z, 1.1, 0x15121f, 0.5, 0.5, 0.3);
    }
  }
  if (M.area) sfx.whoosh(0.4, M.hitAt * M.dur * 0.5);
  else sfx.whoosh({ jab: 0.3, cross: 0.6, heavy: 1, upper: 0.75 }[kind], M.hitAt * M.dur * 0.45);
  if (kind === 'heavy' || kind === 'upper' || kind === 'slam') sfx.grunt(kind === 'heavy' ? 0.9 : 0.6, M.hitAt * M.dur * 0.3); else sfx.exhale(kind === 'cross' ? 0.6 : 0.3, M.hitAt * M.dur * 0.3);
}

const fwd = new THREE.Vector3();
const toBoss = new THREE.Vector3();

// dano no boss (usado pelo soco e pela batida na parede)
function damageBoss(amount) {
  addFear(CFG.fearPerHit);
  if (state.counterT > 0) { amount *= 2; state.counterT = 0; state.moveNameT = 1; elMoveName.textContent = tx('counter'); state.flash = Math.max(state.flash, 0.3); } // contra-ataque: dano dobrado
  B.hp -= amount;
  B.flash = 0.12;
  if (!B.phase2 && B.hp <= CFG.bossMaxHp * CFG.phase2At) {
    B.phase2 = true;
    sfx.phase2();
    startLightEvent('long');
    state.shake = 0.8;
  }
  if (B.hp <= 0 && B.mode !== 'dying') {
    B.hp = 0;
    setBossMode('dying');
    state.over = 'win';
    state.shake = 1;
    state.slow = 1.2; state.flash = 0.8; // câmera lenta no nocaute
    sfx.win();
  }
}

// efeitos de impacto: congela o jogo por um instante, amassa o boss e conta o combo
// VIBRAÇÃO (celular Android; o iPhone não deixa páginas vibrarem)
function vib(ms) { if (touchMode) try { navigator.vibrate?.(ms); } catch { /* ignora */ } }
// src = o que acertou: 'heavy' (soco forte), 'light' (outros socos), um tipo de objeto (som do material) ou 'none' (o efeito já tem som próprio)
function registerHit(stop, squash = 1, src = 'light') {
  vib(squash >= 0.9 ? 45 : 15);
  state.hitstop = Math.max(state.hitstop, stop);
  state.combo++;
  state.comboT = 2;
  B.squash = squash;
  if (squash >= 0.9) startLightEvent('hit'); // golpe forte faz a luz tremer
  if (squash >= 0.9) state.flash = Math.max(state.flash, 0.35);
  if (src === 'heavy' || src === 'light') sfx.hit(squash, 1 + Math.min(state.combo, 8) * 0.05, src === 'heavy'); // o tom sobe a cada golpe do combo
  else if (src !== 'none') sfx.impact(src, bossAt(), squash);
  sfx.bossHurt(squash, bossAt());
}

// todo golpe desloca o boss: velocidade horizontal + pulinho, e ele fica tonto por um tempo
// `atk` é um perfil de CFG.attacks (leve, pesado, ou o objeto que acertou); `boost` > 1 reforça tudo
// GUARDA DO FANTASMA. Ele só consegue levantar a guarda quando está de pé e livre (perseguindo/garras/aviso).
// Ao ver um soco leve chegando, ele defende (com chance); a defesa dura um instante e cada soco leve que bate nela gasta guarda.
// Soco forte, uppercut e esmagar atravessam a defesa e QUEBRAM a guarda: ele fica tonto e leva dano extra. Ele não tem chance.
function canGuard() { return !B.launch && B.broken <= 0 && (B.mode === 'chase' || B.mode === 'swipe' || B.mode === 'windup'); }
function guardHit(kind, dir) {
  if (B.blockT <= 0 || !canGuard()) return false;
  if (kind === 'heavy' || kind === 'upper') { breakGuard(dir); return false; } // atravessa e quebra
  B.guard -= kind === 'cross' ? CFG.guardCrossCost : CFG.guardJabCost;
  B.blockT = Math.max(B.blockT, 0.45);
  B.vel.set(dir.x, 0, dir.z).multiplyScalar(4); // recua um pouco ao segurar o soco
  spawnPuff(boss.position.x - dir.x * 0.4, boss.position.y + 1.3, boss.position.z - dir.z * 0.4, 0.7, 0xdad6cc, 0.35, 0.5, 0);
  sfx.knock(bossAt()); sfx.boneCrack(bossAt(), 1);
  if (B.guard <= 0) { breakGuard(dir); return false; } // o último soco quebra a guarda e acerta
  state.moveNameT = 0.6; elMoveName.textContent = tx('blocked');
  return true;
}
function breakGuard(dir) {
  vib(70);
  B.guard = 0; B.blockT = 0; B.broken = CFG.guardBrokenTime; B.swipeN = 0;
  state.moveNameT = 1.1; elMoveName.textContent = tx('guardBreak');
  state.flash = Math.max(state.flash, 0.3); state.hitstop = Math.max(state.hitstop, 0.08);
  sfx.boneCrack(bossAt(), 3); sfx.scream(0.7, bossAt(), 0.5, 'hit');
  spawnShockwave(boss.position, 2.2);
}
function registerBlock() { state.hitstop = Math.max(state.hitstop, 0.04); state.combo = Math.max(0, state.combo); }
// chamado quando você começa um golpe: um fantasma de pé, perto e de frente tenta se defender dos socos leves
function ghostTryGuard(kind) {
  if (!(kind === 'jab' || kind === 'cross') || !canGuard() || B.blockT > 0 || B.guard <= 0) return;
  toBoss.subVectors(boss.position, player.position).setY(0);
  if (toBoss.length() > 3.4 || Math.abs(boss.position.y - player.position.y) > 1.5) return;
  if (Math.random() < (B.phase2 ? 0.7 : CFG.guardChance)) { B.blockT = 0.5; if (B.mode === 'swipe') { B.swipeN = 0; B.swipeCD = 0.8; setBossMode('chase'); } }
}
// AGARRAR O FANTASMA: com ele tonto ou caído perto de você, F agarra pelos cabelos, ergue e arremessa para onde você olha
function canGrabBoss() {
  if (state.held || state.over || B.mode === 'grabbed') return false;
  if (!(B.mode === 'stun' || B.broken > 0)) return false;
  const d = Math.hypot(boss.position.x - player.position.x, boss.position.z - player.position.z);
  return d < 2.4 && Math.abs(boss.position.y - player.position.y) < 1.4;
}
function grabBoss() {
  B.vel.set(0, 0, 0); B.vy = 0; B.launch = false; B.tw = 0; B.w.set(0, 0, 0); B.broken = 0; B.blockT = 0;
  setBossMode('grabbed');
  state.moveNameT = 0.9; elMoveName.textContent = tx('grab');
  sfx.grabCloth(bossAt()); sfx.scream(0.5, bossAt(), 0.4, 'hit'); state.shake = Math.max(state.shake, 0.3);
}
function addFear(v) { B.fear = Math.min(100, (B.fear || 0) + v * ((B.calmT || 0) > 0 ? 0.5 : 1)); B.fearHold = CFG.fearHold; }
function launchBoss(dir, atk, boost = 1) {
  const speed = atk.speed * boost;
  B.q.copy(boss.quaternion);                                       // a cambalhota continua de onde o corpo estava
  B.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
  B.vy = atk.up * boost;                                           // pulo vertical (knock-up)
  B.spin = atk.spin ?? 4 + 12 * Math.min(1, speed / CFG.attacks.heavy.speed);  // golpe forte = gira muito mais
  // velocidade angular: cambalhota em torno do eixo perpendicular ao voo + um pouco de torção aleatória
  B.w.set(B.vel.z, 0, -B.vel.x).normalize().multiplyScalar(B.spin * (0.8 + Math.random() * 0.4));
  B.w.x += (Math.random() - 0.5) * B.spin * 0.5; B.w.y += (Math.random() - 0.5) * B.spin * 0.7; B.w.z += (Math.random() - 0.5) * B.spin * 0.5;
  B.launch = true; B.tw = 1;
  B.lieT = Math.min(1.4, atk.stagger + (boost - 1) * 0.6);         // quanto tempo fica caído depois de parar de deslizar
  if (B.mode !== 'dying') setBossMode('stun'); // cancela qualquer ataque do boss
  if (atk.big) sfx.scream(Math.min(1, Math.max(speed / 70, B.vy / 25)), bossAt(), 0.5 + B.vy / 14 + speed / 110, 'launch'); // GRITO durante o voo
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

// REBATER: móvel possuído vindo na sua direção + qualquer soco = ele volta voando no fantasma, mais rápido.
// Vale já no começo do soco (o móvel vem rápido; esperar o instante do impacto do soco seria injusto).
function deflectProp(p) {
  propDir.subVectors(boss.position, p.obj.position).setY(0).normalize();
  launchProp(p, propDir, 34, true, 2, 1.4); p.flyY = boss.position.y + 1.0;
  sfx.impact(p.type, p.obj.position, 0.9); state.hitstop = Math.max(state.hitstop, 0.07); state.shake = Math.max(state.shake, 0.4);
  state.moveNameT = 0.9; elMoveName.textContent = tx('deflect'); addFear(10);
}
function deflectIncoming() {
  fwd.set(0, 0, -1).applyQuaternion(player.quaternion);
  for (const p of props) {
    if (!p.hostile) continue;
    propDir.subVectors(p.obj.position, player.position).setY(0); const d = propDir.length();
    if (d < 3.6 && propDir.dot(fwd) > d * 0.5) deflectProp(p);
  }
}
function applyMoveHit(kind) {
  const M = MOVES[kind];
  fwd.set(0, 0, -1).applyQuaternion(player.quaternion);
  state.kick.pitch += M.kick;                       // a câmera dá um tranco no impacto
  state.kick.roll += (state.atk?.hand === 1 ? -1 : 1) * M.roll * 1.5;
  if (M.area) { applySlam(M); return; }

  // --- fantasma no teto bem em cima de você: o soco para cima arranca ele de lá e ele despenca sem fazer nada ---
  if (B.mode === 'ceil' && look.pitch > 0.3 && Math.hypot(boss.position.x - player.position.x, boss.position.z - player.position.z) < 3.2) {
    B.pulled = true; dropMark.visible = false; setBossMode('drop'); damageBoss(M.dmg);
    state.moveNameT = 1; elMoveName.textContent = tx('pulled'); sfx.boneCrack(bossAt(), 2); state.shake = 0.5; addFear(15);
    return;
  }
  // --- boss: SEMPRE leva dano e é empurrado ---
  if (B.mode !== 'dying') {
    const d = Math.abs(boss.position.y - player.position.y) < 2.2 ? punchDirTo(boss.position, CFG.bossRadius, M.range) : null;
    if (d) {
      let atk = CFG.attacks[M.atk];
      // GUARDA: socos leves batem na defesa dele (sem dano, gastam a guarda); soco forte/uppercut/esmagar QUEBRAM a guarda
      const blocked = guardHit(kind, d);
      if (blocked) { state.shake = 0.25; registerBlock(); }
      else {
        const air = B.launch && boss.position.y > groundY(boss.position.x, boss.position.z, boss.position.y + 0.3) + 0.6; // no ar: MALABARISMO
        if (air && (kind === 'jab' || kind === 'cross')) atk = CFG.attacks.juggle;
        damageBoss(M.dmg * (air ? 1.5 : 1) * (B.broken > 0 ? CFG.guardBrokenMul : 1));
        launchBoss(d, atk);
        registerHit(atk.hitstop, atk.squash, kind === 'heavy' ? 'heavy' : 'light');
        if (air) { state.moveNameT = 0.8; elMoveName.textContent = tx('juggle'); }
      }
      state.shake = Math.max(state.shake, blocked ? 0.25 : atk.shake);
      state.fovKick = M.fov; // o campo de visão "dá um soco" no impacto
      if (atk.big && !blocked) addFear(CFG.fearBigHit);
      if (atk.big && !blocked) { // golpes pesados: onda de choque no ponto do impacto e câmera lenta
        spawnShockwave(boss.position, kind === 'heavy' ? 4.5 : 3);
        spawnPuff(boss.position.x, boss.position.y + 1.4, boss.position.z, 2.4, 0xfff0c8, 0.5, 0.55, 0);
        state.slow = Math.max(state.slow, kind === 'heavy' ? 0.5 : 0.28);
      }
    }
  }
  punchWalls(M);

  // --- objetos: pequenos viram projéteis (ou sobem, no uppercut), grandes quebram ---
  for (const p of [...props]) {
    if (p.held) continue;
    if (p.hostile) { if (punchDirTo(p.obj.position, p.T.radius + 0.5, M.range + 0.8)) deflectProp(p); continue; }
    if (p.thrown) continue;
    const d = punchDirTo(p.obj.position, p.T.radius);
    if (!d) continue;
    if (p.T.size === 'small') {
      if (M.prop.pop) { launchProp(p, d, M.prop.speed, false); p.vel.y = M.prop.pop; } // uppercut: o objeto sobe
      else launchProp(p, d, M.prop.speed, true, M.prop.mul, M.prop.knock);
      sfx.impact(p.type, p.obj.position, 0.7);
      state.hitstop = Math.max(state.hitstop, 0.04);
      state.shake = Math.max(state.shake, 0.25);
    } else {
      damageProp(p, M.prop.large, d);
    }
  }
}

// o jogador é forte demais: soco forte e cruzado destroem parede de gesso à frente
const sameLevel = (s, y) => s.top > y + 0.3 && solidBase(s) < y + ENT_H; // a parede está na altura de quem bate?
function punchWalls(M) {
  if (!(M.atk === 'heavy' || M.atk === 'cross')) return;
  const px = player.position.x + fwd.x * 1.7, pz = player.position.z + fwd.z * 1.7;
  for (const s of [...allPanels]) {
    if (!s.alive || !sameLevel(s, player.position.y)) continue;
    const cx = THREE.MathUtils.clamp(px, s.x0, s.x1), cz = THREE.MathUtils.clamp(pz, s.z0, s.z1);
    if ((px - cx) ** 2 + (pz - cz) ** 2 > 1.3 * 1.3) continue;
    s.hp -= M.atk === 'heavy' ? 2 : 1;
    if (s.hp <= 0) breakWall(s, fwd);
    else { spawnDebris({ x: cx, y: 1.2, z: cz }, 0x8f8196, 6, fwd, 4); spawnPuff(cx, 1.5, cz, 1.6, 0x9a8fa0, 0.7, 0.45, 0.5); sfx.knock({ x: cx, y: 1.5, z: cz }); }
  }
}

// ESMAGAR: onda de choque em volta do jogador, empurra boss e objetos para longe
const shockwaves = [];
const ringGeo = new THREE.PlaneGeometry(2, 2);
const ringTex = (() => { // anel de poeira de borda suave (textura gerada): por dentro vazio, por fora esfumaçado
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  const gr = g.createRadialGradient(N / 2, N / 2, N * 0.18, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const ringPool = [];
function spawnShockwave(pos, R) {
  const m = new THREE.Mesh(ringGeo, ringPool.pop() ?? new THREE.MeshBasicMaterial({ color: 0x6b6158, map: ringTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); // (material reaproveitado: dispose recompilava o shader)
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, 0.06, pos.z);
  scene.add(m);
  shockwaves.push({ m, t: 0, R });
}
function updateShockwaves(dt) {
  for (const w of [...shockwaves]) {
    w.t += dt;
    const k = w.t / 0.7;
    w.m.scale.setScalar(0.3 + (1 - Math.pow(1 - Math.min(1, k), 2)) * w.R);
    w.m.material.opacity = 0.5 * Math.pow(Math.max(0, 1 - k), 1.4);
    if (k >= 1) { scene.remove(w.m); ringPool.push(w.m.material); shockwaves.splice(shockwaves.indexOf(w), 1); }
  }
}
const slamDir = new THREE.Vector3();
function applySlam(M) {
  const R = CFG.slamRadius;
  sfx.slam();
  spawnShockwave(player.position, R);
  spawnDebris(player.position, 0x8a8299, 16, null, 0); // poeira/pedaços do chão
  state.shake = 1;
  state.fovKick = M.fov;
  state.hitstop = Math.max(state.hitstop, 0.1);
  for (const s of [...allPanels]) { // a onda de choque derruba as paredes de gesso por perto
    if (!s.alive || !sameLevel(s, player.position.y)) continue;
    const cx = THREE.MathUtils.clamp(player.position.x, s.x0, s.x1), cz = THREE.MathUtils.clamp(player.position.z, s.z0, s.z1);
    if ((player.position.x - cx) ** 2 + (player.position.z - cz) ** 2 < 3.2 * 3.2) { slamDir.set(cx - player.position.x, 0, cz - player.position.z).normalize(); breakWall(s, slamDir); }
  }
  if (B.mode !== 'dying') {
    slamDir.subVectors(boss.position, player.position).setY(0);
    const dist = slamDir.length();
    if (dist < R + CFG.bossRadius && Math.abs(boss.position.y - player.position.y) < 2.2) {
      if (dist < 0.01) slamDir.set(0, 0, -1).applyAxisAngle(UP, look.yaw); else slamDir.divideScalar(dist);
      const atk = CFG.attacks.slam;
      if (B.blockT > 0 && canGuard()) breakGuard(slamDir); // a onda de choque também quebra a guarda
      damageBoss(M.dmg);
      launchBoss(slamDir, atk, 1 - 0.4 * Math.min(1, dist / R)); // quanto mais perto, mais forte
      registerHit(atk.hitstop, atk.squash, 'none');
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
function mat(color, rough = 0.85) { return (matCache[color] ??= useTex(new THREE.MeshStandardMaterial({ color, roughness: rough }), TEX.grime, color, 1.2)); } // móveis: sujeira por cima da cor
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// cada tipo: tamanho (small = arremessável, large = quebra), raio de colisão, dano ao acertar o boss, vida, cor dos estilhaços
// vidro e líquido da vodka: materiais únicos e compartilhados (criar um por garrafa recompilaria shaders)
const vodkaGlass = new THREE.MeshStandardMaterial({ color: 0xd8e6ec, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
const vodkaLiquid = new THREE.MeshStandardMaterial({ color: 0xbfd9e6, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
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
  vodka: { size: 'small', radius: 0.2, dmg: 3, hp: 1, color: 0xc8d6dc, build(g) { // garrafa de vodka: vidro transparente, líquido, rótulo e tampa vermelhos
    const glass = vodkaGlass;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.4, 14), glass); body.position.y = 0.2;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.095, 0.08, 14), glass); shoulder.position.y = 0.44;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 10), glass); neck.position.y = 0.55;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), mat(0xa01820, 0.4)); cap.position.y = 0.645;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 12), vodkaLiquid);
    liquid.position.y = 0.18; liquid.name = 'liquid';
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.097, 0.097, 0.15, 14), mat(0xe9e4da, 0.7)); label.position.y = 0.2;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.035, 14), mat(0xa01820, 0.6)); stripe.position.y = 0.24;
    body.castShadow = true; g.add(liquid, body, shoulder, neck, cap, label, stripe);
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
  bed: { size: 'large', radius: 1.3, hp: 4, color: 0x6b5a4a, chunks: ['pillow', 'plank'], build(g) { // cama de casal velha, lençol manchado
    g.add(box(1.7, 0.35, 2.3, 0x3a2618, 0, 0.3, 0), box(1.6, 0.25, 2.1, 0x9c9282, 0, 0.6, 0.02), box(1.8, 1.25, 0.12, 0x2e1e14, 0, 0.75, -1.16));
    g.add(box(1.62, 0.07, 1.25, 0x4a1418, 0, 0.75, 0.42), box(0.6, 0.14, 0.38, 0xb0a894, -0.42, 0.8, -0.82), box(0.6, 0.14, 0.38, 0xb0a894, 0.42, 0.8, -0.82));
  } },
  wardrobe: { size: 'large', radius: 0.9, hp: 4, color: 0x3e2a1c, build(g) { // guarda-roupa com uma porta entreaberta
    g.add(box(1.4, 2.2, 0.62, 0x2e1e14, 0, 1.1, 0), box(1.48, 0.1, 0.68, 0x23170f, 0, 2.25, 0));
    const door = box(0.68, 2.0, 0.04, 0x3a2618, 0.34, 1.1, 0.33); g.add(door);
    const ajar = new THREE.Group(); ajar.position.set(-0.68, 0, 0.33); ajar.rotation.y = -0.45; ajar.add(box(0.68, 2.0, 0.04, 0x3a2618, 0.34, 1.1, 0)); g.add(ajar);
    g.add(box(0.5, 1.6, 0.02, 0x050404, -0.36, 1.1, 0.3)); // escuro lá dentro
    for (const x of [0.08, -0.5]) g.add(box(0.04, 0.16, 0.05, 0x8a7040, x, 1.15, 0.37));
  } },
  crib: { size: 'large', radius: 0.8, hp: 2, color: 0xcfc6b4, build(g) { // berço de grades
    g.add(box(1.2, 0.08, 0.7, 0xb8ae9c, 0, 0.5, 0), box(1.1, 0.1, 0.62, 0x8f8778, 0, 0.58, 0));
    for (const [x, z] of [[-0.58, -0.33], [0.58, -0.33], [-0.58, 0.33], [0.58, 0.33]]) g.add(box(0.06, 1.05, 0.06, 0xcfc6b4, x, 0.52, z));
    for (const z of [-0.33, 0.33]) { g.add(box(1.2, 0.05, 0.05, 0xcfc6b4, 0, 1.02, z)); for (let i = 0; i < 9; i++) g.add(box(0.025, 0.46, 0.025, 0xcfc6b4, -0.48 + i * 0.12, 0.78, z)); }
  } },
  shelf: { size: 'large', radius: 0.95, hp: 4, color: 0x5e3a1f, build(g) {
    g.add(box(1.6, 2.4, 0.5, 0x5e3a1f, 0, 1.2, 0));
    const cols = [0x5a1c22, 0x26344a, 0x6b5a2a, 0x2c3f2e, 0x3e2a3e];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++)
      g.add(box(0.14, 0.5, 0.36, cols[(i + row) % cols.length], -0.6 + i * 0.2, 0.55 + row * 0.7, 0.1));
  } },
};

// Um móvel é montado com várias peças (uma estante tem dezenas de livros). Para desenhar, as peças do mesmo material
// viram uma só malha (no espaço do próprio móvel, então ele continua se mexendo inteiro). As peças originais ficam
// guardadas fora da cena e só reaparecem como destroços quando o móvel quebra.
function mergePropParts(g) {
  const meshes = []; g.updateMatrixWorld(true);
  g.traverse((m) => { if (m.isMesh && !Array.isArray(m.material)) meshes.push(m); });
  if (meshes.length < 3) return null;
  const parts = meshes.map((m) => ({ geometry: m.geometry, material: m.material, matrix: m.matrixWorld.clone() }));
  const byMat = new Map();
  for (const m of meshes) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); }
  const cast = meshes[0].castShadow;
  for (const m of meshes) m.removeFromParent();
  g.clear();
  for (const [material, list] of byMat) {
    const geos = list.map((m) => {
      const src = m.geometry, q = new THREE.BufferGeometry();
      q.setAttribute('position', src.attributes.position.clone()); q.setAttribute('normal', src.attributes.normal.clone());
      q.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
      if (src.index) q.setIndex(src.index.clone()); else q.setIndex([...Array(src.attributes.position.count).keys()]);
      return q.applyMatrix4(m.matrixWorld);
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), material); geos.forEach((q) => q.dispose());
    mesh.castShadow = cast; g.add(mesh);
  }
  return parts;
}
function createProp(type, x, z, y = 0, rotY = Math.random() * Math.PI * 2) {
  const T = PROP_TYPES[type];
  const g = new THREE.Group();
  T.build(g);
  g.traverse((m) => { if (m.isMesh) m.castShadow = T.size === 'large'; }); // só móveis grandes projetam sombra (desempenho)
  const parts = type === 'vodka' ? null : mergePropParts(g); // OTIMIZAÇÃO: peças do mesmo material viram uma malha só
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  scene.add(g);
  const p = { type, T, obj: g, parts, hp: T.hp, vel: new THREE.Vector3(), thrown: false, held: false, falling: y > 0.01, wobble: 0, spin: new THREE.Vector3(), dmgMul: 1, knock: 1 };
  props.push(p);
  return p;
}
function removeProp(p) { p.obj.removeFromParent(); const i = props.indexOf(p); if (i >= 0) props.splice(i, 1); }
function clearProps() {
  for (const p of [...props]) removeProp(p);
  for (const d of debris) scene.remove(d.mesh);
  debris.length = 0;
  for (const p of puffs) freePuff(p);
  puffs.length = 0;
}

function spawnLayout() {
  clearProps();
  const PI = Math.PI, P = F2 + 0.05; // P: altura do andar de cima
  // ===== TÉRREO =====
  // SALA DE ESTAR (sudoeste): sofá e poltronas viradas para a lareira, mesinha, estante, TV velha
  createProp('sofa', -11.2, 7, 0, -PI / 2); createProp('table', -13.3, 7, 0, PI / 2);
  createProp('chair', -13.2, 4.3, 0, 0.6); createProp('chair', -13.2, 9.8, 0, PI - 0.5);
  createProp('shelf', -9, 11.6, 0, PI); createProp('shelf', -12.5, 11.6, 0, PI);
  createProp('tv', -6, 3, 0, PI / 4); createProp('pillow', -10.6, 6.2); createProp('vase', -15.4, 11.3); createProp('vase', -5.7, 11.3);
  // SALA DE JANTAR (noroeste): mesa comprida com cadeiras (uma caída longe), cristaleira
  createProp('table', -10.5, -6.6, 0, PI / 2); createProp('table', -10.5, -4.4, 0, PI / 2);
  for (const z of [-7.3, -5.5, -3.7]) { createProp('chair', -11.8, z, 0, PI / 2); createProp('chair', -9.2, z, 0, -PI / 2); }
  createProp('chair', -7, -9.5, 0, 2.2); createProp('shelf', -15.6, -6, 0, PI / 2); createProp('shelf', -15.6, -2, 0, PI / 2);
  createProp('vase', -15.4, -11.4); createProp('vase', -5.8, -11.4);
  // DEPÓSITO (fundos do hall): caixas, barris, tábuas
  createProp('crate', -4, -11); createProp('crate', -3, -11.2); createProp('crate', -3.6, -10.1); createProp('barrel', 4, -11); createProp('barrel', 3.2, -11.2);
  createProp('shelf', 4.5, -7, 0, -PI / 2); createProp('plank', 0, -9, 0, 0.4); createProp('plank', 1, -10, 0, 1.4); createProp('barrel', -4, -5.2);
  // COZINHA (nordeste): bancadas fixas nas paredes, geladeira, mesa com cadeiras
  createProp('fridge', 15.3, -3.6, 0, -PI / 2); createProp('table', 9.5, -5, 0, 0.15);
  createProp('chair', 8.2, -5.8, 0, 0.3); createProp('chair', 10.8, -4.2, 0, PI + 0.2); createProp('chair', 9.4, -3.3, 0, PI);
  createProp('barrel', 15.3, -0.8); createProp('crate', 6, -1); createProp('vase', 7, -11.2, 1.0); createProp('vase', 12, -11.2, 1.0);
  // BIBLIOTECA (sudeste): estantes, mesa de leitura, bolas (pesos de papel)
  for (const z of [4.5, 8, 11]) createProp('shelf', 15.6, z, 0, -PI / 2);
  createProp('shelf', 8.5, 11.6, 0, PI); createProp('table', 10, 7, 0, 0.1);
  createProp('chair', 10, 5.7, 0, 0); createProp('chair', 8.8, 8.2, 0, 2.6); createProp('ball', 12, 9.5); createProp('ball', 6, 10.5); createProp('pillow', 6, 3);
  // HALL (o ringue, pé-direito duplo): quase vazio
  createProp('chair', 3.8, 9.5, 0, -0.4); createProp('vase', -4.4, 11.4); createProp('vase', 4.4, 11.4); createProp('crate', 3.8, -3.2); createProp('ball', 1, 3);
  // ===== ANDAR DE CIMA =====
  // GALERIA: coisas pesadas para jogar lá embaixo
  createProp('crate', 4, -2.6, P); createProp('barrel', -2.6, -2.8, P); createProp('chair', 1.5, -3.2, P, 0.4); createProp('ball', 0, -2.4, P);
  // BANHEIRO: a banheira é fixa; alguns frascos e um armário
  createProp('wardrobe', 4.4, -9, P, -PI / 2); createProp('vase', 0.5, -11.4, P); createProp('vase', 1.2, -11.4, P); createProp('barrel', 4, -5, P);
  // QUARTO DA CRIANÇA (noroeste): berço, brinquedos, guarda-roupa
  createProp('crib', -14.5, -10.6, P, 0); createProp('wardrobe', -6, -11.4, P, 0);
  createProp('ball', -11, -6, P); createProp('ball', -9, -8.5, P); createProp('pillow', -12, -4, P); createProp('pillow', -7, -6, P); createProp('chair', -13.5, -2, P, 2.5);
  // QUARTO DE HÓSPEDES (sudoeste)
  createProp('bed', -14.7, 8.5, P, PI / 2); createProp('wardrobe', -8, 2.5, P, 0); createProp('chair', -7, 10.5, P, -2); createProp('vase', -15.4, 11.4, P);
  // QUARTO PRINCIPAL (nordeste)
  createProp('bed', 14.7, -7.5, P, -PI / 2); createProp('wardrobe', 7, -11.4, P, 0); createProp('table', 9, -3, P, 0.2); createProp('tv', 15.3, -2.5, P, -PI / 2);
  createProp('pillow', 12.5, -8.8, P); createProp('chair', 8, -4.3, P, 0.6);
  // ESCRITÓRIO (sudeste)
  createProp('table', 10.5, 6.5, P, 0); createProp('chair', 10.5, 5.2, P, 0.2); createProp('shelf', 15.6, 6, P, -PI / 2); createProp('shelf', 15.6, 9.5, P, -PI / 2);
  createProp('crate', 7, 10.8, P); createProp('crate', 7.9, 11.1, P); createProp('ball', 13, 3.5, P);
  // GARRAFAS DE CERVEJA (curam ao beber com B, ou dá para arremessar no fantasma)
  for (const [x, z, y] of [[-2.5, 9, 0], [2.5, 5, 0], [-10, 4.5, 0], [-12, -9, 0], [0, -6.5, 0], [12.5, -7.5, 0], [12.5, 5, 0], [0, -2.8, P], [-9.5, -3, P], [-11, 5, P], [11.5, -10, P], [12, 9, P]]) createProp('vodka', x, z, y);
}

// ponto livre aleatório num dos dois andares (para objetos novos caírem do teto)
function randomSpot() {
  for (let tries = 0; tries < 16; tries++) {
    const x = (Math.random() * 2 - 1) * (HX - 1.5), z = (Math.random() * 2 - 1) * (HZ - 1.5);
    const y = Math.random() < 0.5 ? groundY(x, z, 0.1) : groundY(x, z, F2 + 0.1);
    if (touchingSolid(x, z, 0.6, y + 0.1)) continue; // não nasce dentro de parede, escada ou móvel fixo
    return { x, z, y, ceil: ceilAt(x, z, y) };
  }
  return null;
}
function launchProp(p, dir, speed, thrown, dmgMul = 1, knock = 1) {
  p.hostile = false; // (a possessão marca como hostil logo depois)
  p.vel.set(dir.x * speed, 0, dir.z * speed);
  p.thrown = thrown;
  p.falling = !thrown;
  if (!thrown) p.vel.y = 5 + Math.random() * 3;
  p.dmgMul = dmgMul;
  p.knock = knock; // multiplica o empurrão no boss
  p.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8);
  if (thrown) p.obj.position.y = Math.max(p.obj.position.y, 0.8);
  p.flyY = p.obj.position.y; // altura de voo: parte da altura do arremesso e vai caindo
}

const DEBRIS_MAX = 120;
function pushDebris(m, v, spin, life) {
  scene.add(m);
  debris.push({ mesh: m, vel: v, spin, life });
  while (debris.length > DEBRIS_MAX) scene.remove(debris.shift().mesh); // limite para não pesar
}
function spawnDebris(pos, color, n, dir, force) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(boxGeo, mat(color));
    const sz = 0.08 + Math.random() * 0.2;
    m.scale.set(sz, sz * (0.4 + Math.random()), sz * (0.6 + Math.random()));
    m.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y + 0.3 + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 0.5);
    const v = new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 6, (Math.random() - 0.5) * 7);
    if (dir) v.addScaledVector(dir, force * (0.4 + Math.random() * 0.6));
    pushDebris(m, v, new THREE.Vector3(Math.random() * 16, Math.random() * 16, Math.random() * 16), 4 + Math.random() * 3);
  }
}

// POEIRA / FUMAÇA (realista, não "cartoon"): sprites (quadrados que sempre olham para a câmera) com uma textura de
// fumaça gerada por código — borda bem suave e manchas irregulares — em vez de esferas de cor sólida. As cores passam
// por dustify(): perdem quase toda a saturação e ficam num cinza-marrom escuro de pó, então nada de nuvem azul/roxa/amarela.
// Cada nuvem gira devagar, cresce, sobe pouco e some; o fogo da garrafa de vodka é o único com brilho (mistura aditiva).
function makeSmokeTex() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  // várias manchas suaves sobrepostas = contorno irregular de fumaça
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * N * 0.2, x = N / 2 + Math.cos(a) * r, y = N / 2 + Math.sin(a) * r;
    const rad = N * (0.14 + Math.random() * 0.2), gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
  }
  // máscara redonda: nada encosta na borda do quadrado (senão aparece a "caixa" do sprite)
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.55, 'rgba(0,0,0,0.6)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const smokeTex = makeSmokeTex();
const dustCol = new THREE.Color(), dustHSL = {};
function dustify(hex) { // qualquer cor vira pó: pouca saturação, claridade entre escuro e cinza médio
  dustCol.setHex(hex).getHSL(dustHSL);
  return dustCol.setHSL(0.08, Math.min(0.12, dustHSL.s * 0.15), Math.min(0.42, Math.max(0.1, dustHSL.l * 0.6)));
}
const puffs = [];
// IMPORTANTE (desempenho): materiais reaproveitados de um "pool" e nunca descartados (dispose recompilava o shader: travadas)
const puffPool = [], firePool = [];
function getPuffMat(fire) {
  const pool = fire ? firePool : puffPool;
  return pool.pop() ?? new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending });
}
function freePuff(p) { scene.remove(p.m); (p.fire ? firePool : puffPool).push(p.m.material); }
for (const fire of [false, true]) { const warm = new THREE.Sprite(getPuffMat(fire)); warm.position.y = -50; warm.frustumCulled = false; scene.add(warm); (fire ? firePool : puffPool).push(warm.material); } // mantém os shaders compilados
function spawnPuff(x, y, z, size, color = 0x8a8299, life = 0.7, opacity = 0.45, rise = 1, fire = false) {
  const mt = getPuffMat(fire);
  if (fire) mt.color.setHex(color); else mt.color.copy(dustify(color));
  mt.rotation = Math.random() * Math.PI * 2;
  const m = new THREE.Sprite(mt);
  m.position.set(x, y, z); m.scale.setScalar(size * 0.7);
  scene.add(m);
  puffs.push({ m, t: 0, life: life * (fire ? 1 : 1.6), size: size * 2.2, opacity: opacity * (fire ? 0.8 : 0.5), rise: rise * 0.45, fire,
    spin: (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.7, vz: (Math.random() - 0.5) * 0.7 });
  while (puffs.length > 50) freePuff(puffs.shift());
}
function updatePuffs(dt) {
  for (const p of [...puffs]) {
    p.t += dt;
    const k = p.t / p.life;
    p.m.scale.setScalar(p.size * (0.32 + 0.68 * (1 - Math.pow(1 - Math.min(1, k), 2)))); // abre rápido e depois quase para
    p.m.material.opacity = p.opacity * Math.min(1, k * 6) * Math.pow(Math.max(0, 1 - k), 1.5); // entra suave, some devagar
    p.m.material.rotation += p.spin * dt;
    const drag = 1 - k * 0.8;
    p.m.position.x += p.vx * dt * drag; p.m.position.z += p.vz * dt * drag; p.m.position.y += p.rise * dt * (1 - k);
    if (k >= 1) { freePuff(p); puffs.splice(puffs.indexOf(p), 1); }
  }
}

// parede de gesso desabando: pedaços grandes voando na direção do golpe + nuvem de poeira
function breakWall(s, dir) {
  if (Math.hypot((s.x0 + s.x1) / 2 - boss.position.x, (s.z0 + s.z1) / 2 - boss.position.z) < 10) addFear(3); // você destrói a casa dele: ele se assusta
  if (!s.alive) return;
  s.alive = false;
  solids.splice(solids.indexOf(s), 1);
  scene.remove(s.mesh); s.extra?.forEach((p) => { p.visible = false; });
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, by = solidBase(s), hgt = s.top - by, wood = s.mesh.material === railMat;
  sfx.wallBreak({ x: cx, y: by + 1, z: cz });
  state.shake = Math.max(state.shake, 0.9);
  state.flash = Math.max(state.flash, 0.3);
  for (let i = 0; i < (wood ? 10 : 20); i++) {
    const m = new THREE.Mesh(boxGeo, mat(wood ? (i % 2 ? 0x3e2a1c : 0x23170f) : (i % 3 ? 0x8f8196 : 0x5a4a62)));
    const sz = 0.2 + Math.random() * 0.55;
    m.scale.set(sz * (0.6 + Math.random()), sz * (0.5 + Math.random() * 0.8), sz * (0.6 + Math.random()));
    m.position.set(s.x0 + Math.random() * (s.x1 - s.x0), by + 0.2 + Math.random() * Math.max(0.1, hgt - 0.4), s.z0 + Math.random() * (s.z1 - s.z0));
    const v = new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 5, (Math.random() - 0.5) * 5);
    if (dir) v.addScaledVector(dir, 4 + Math.random() * 10);
    pushDebris(m, v, new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), 6 + Math.random() * 3);
  }
  for (let i = 0; i < 6; i++) spawnPuff(cx + (Math.random() - 0.5) * (s.x1 - s.x0), by + 0.5 + Math.random() * Math.max(0.1, hgt - 1), cz + (Math.random() - 0.5) * (s.z1 - s.z0), 2.4 + Math.random() * 1.6, 0x9a8fa0, 1.6, 0.5, 0.4);
}
function rebuildWalls() {
  for (const s of allPanels) {
    if (!s.alive) { s.alive = true; scene.add(s.mesh); solids.push(s); s.extra?.forEach((p) => { p.visible = true; }); }
    s.hp = s.maxHp;
  }
}

const _pm = new THREE.Matrix4();
function breakProp(p, dir, force = 10) {
  if (p.obj.position.distanceTo(boss.position) < 9) addFear(p.T.size === 'large' ? 2 : 1);
  if (p.armed) { p.armed = false; vodkaBoom(p.obj.position, dir); }
  const pos = p.obj.position;
  const large = p.T.size === 'large';
  sfx.breakProp(p.type, pos, large);
  // as próprias peças do objeto viram destroços (com o mesmo formato e material) e voam para fora do centro
  p.obj.updateMatrixWorld(true);
  const center = new THREE.Vector3(pos.x, pos.y + 0.6, pos.z);
  let n = 0;
  const pieces = p.parts ? p.parts.map((pt) => ({ isMesh: true, geometry: pt.geometry, material: pt.material, matrixWorld: _pm.multiplyMatrices(p.obj.matrixWorld, pt.matrix).clone() })) : [];
  if (!p.parts) p.obj.traverse((m) => { if (m.isMesh) pieces.push(m); });
  pieces.forEach((m) => {
    if (n >= 20) return;
    n++;
    const d = new THREE.Mesh(m.geometry, m.material);
    m.matrixWorld.decompose(d.position, d.quaternion, d.scale);
    const v = d.position.clone().sub(center); v.y += 0.4;
    v.multiplyScalar(3 + Math.random() * 3);
    if (dir) v.addScaledVector(dir, force * (0.5 + Math.random() * 0.7));
    v.y += 2 + Math.random() * 4;
    pushDebris(d, v, new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18), 4 + Math.random() * 3);
  });
  spawnDebris(pos, p.T.color, large ? 16 : 10, dir, force); // lascas e farpas
  for (let i = 0; i < (large ? 4 : 2); i++) spawnPuff(pos.x + (Math.random() - 0.5), pos.y + 0.4 + Math.random() * 0.8, pos.z + (Math.random() - 0.5), (large ? 2.0 : 1.2) + Math.random() * 0.6, 0x8a8299, 0.9, 0.4, 0.8);
  if (large) {
    // móvel grande também vira tábuas arremessáveis
    for (const chunk of p.T.chunks ?? ['plank', 'plank']) {
      const q = createProp(chunk, pos.x, pos.z, pos.y + 0.8);
      const ang = (Math.random() - 0.5) * 2.2;
      const d = new THREE.Vector3(dir.x, 0, dir.z).applyAxisAngle(UP, ang);
      launchProp(q, d, 10 + Math.random() * 8, false);
    }
  }
  state.shake = Math.max(state.shake, large ? 0.7 : 0.3);
  removeProp(p);
}

function damageProp(p, amount, dir) {
  p.hp -= amount;
  p.wobble = 1;
  sfx.impact(p.type, p.obj.position, 0.8);
  spawnDebris(p.obj.position, p.T.color, 3, dir, 6);
  state.shake = Math.max(state.shake, 0.3);
  if (p.hp <= 0) breakProp(p, dir, 16);
}

const boomLight = new THREE.PointLight(0xff8a2a, 0, 12, 1.6); // existe desde o começo (acender/apagar não recompila os shaders)
scene.add(boomLight);
const boomTo = new THREE.Vector3();
function vodkaBoom(pos, dir) {
  vib(120);
  const R = CFG.vodkaBoomRadius, x = pos.x, y = pos.y, z = pos.z;
  boomLight.position.set(x, y + 0.6, z); state.boomT = 0.6;
  sfx.explosion({ x, y, z }); sfx.breakProp('vodka', { x, y, z });
  state.shake = Math.max(state.shake, 1.0); state.flash = Math.max(state.flash, 0.4); state.hitstop = Math.max(state.hitstop, 0.06);
  // bola de fogo + fumaça + anel no chão
  for (let i = 0; i < 9; i++) spawnPuff(x + (Math.random() - 0.5) * 1.6, y + 0.3 + Math.random() * 1.2, z + (Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 1.2, i % 3 ? 0xc0501a : 0xd08a30, 0.45 + Math.random() * 0.2, 0.7, 1.5, true);
  for (let i = 0; i < 6; i++) spawnPuff(x + (Math.random() - 0.5) * 2, y + 0.8 + Math.random() * 1.4, z + (Math.random() - 0.5) * 2, 2.2 + Math.random() * 1.4, 0x1a1414, 1.4 + Math.random() * 0.6, 0.6, 1.0);
  spawnShockwave({ x, y, z }, R);
  // fantasma: dano e empurrão que caem com a distância (mesmo andar)
  if (B.mode !== 'dying' && B.mode !== 'hidden') {
    boomTo.set(boss.position.x - x, 0, boss.position.z - z); const d = boomTo.length();
    if (d < R + CFG.bossRadius && Math.abs(boss.position.y + 1 - y) < 2.4) {
      const f = 1 - Math.min(1, d / (R + CFG.bossRadius)) * 0.6;
      if (d > 0.05) boomTo.divideScalar(d); else boomTo.set(dir?.x ?? 0, 0, dir?.z ?? -1);
      damageBoss(CFG.vodkaBoomDamage * f);
      launchBoss(boomTo, CFG.attacks.boom, f); registerHit(CFG.attacks.boom.hitstop, CFG.attacks.boom.squash, 'none');
    }
  }
  // você também se queima se estiver perto demais
  if (Math.hypot(player.position.x - x, player.position.z - z) < R * 0.55 && Math.abs(player.position.y + 1 - y) < 2) hurtPlayer(CFG.vodkaSelfDamage);
  // objetos em volta voam; móveis grandes levam dano; gesso e corrimão por perto racham
  for (const q of [...props]) {
    if (q.held || !props.includes(q)) continue;
    boomTo.set(q.obj.position.x - x, 0, q.obj.position.z - z); const d = boomTo.length();
    if (d > R || Math.abs(q.obj.position.y - y) > 1.8) continue;
    boomTo.divideScalar(d || 1);
    if (q.T.size === 'large') damageProp(q, 2, boomTo); else if (!q.thrown) launchProp(q, boomTo, 9 + 8 * (1 - d / R), false);
  }
  for (const s2 of [...allPanels]) {
    if (!s2.alive || !sameLevel(s2, y - 0.5)) continue;
    const cx = THREE.MathUtils.clamp(x, s2.x0, s2.x1), cz = THREE.MathUtils.clamp(z, s2.z0, s2.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 < (R * 0.6) ** 2) { s2.hp -= 1; if (s2.hp <= 0) breakWall(s2, boomTo.set(cx - x, 0, cz - z).normalize()); }
  }
}
function hitBossWithProp(p, dir) {
  const atk = CFG.attacks[p.type] ?? CFG.attacks.chair; // cada objeto empurra de um jeito (vaso < tábua < cadeira < caixa)
  damageBoss(p.T.dmg * p.dmgMul);
  launchBoss(dir, atk, p.knock);
  registerHit(atk.hitstop, atk.squash, p.type);
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
      const base = groundY(o.position.x, o.position.z, o.position.y + 0.5) + 1.1;
      p.flyY = Math.max(base, (p.flyY ?? base) - 9 * dt); // arremessado de cima (andar de cima) desce em direção ao fantasma
      o.position.y += (p.flyY - o.position.y) * Math.min(1, dt * 12);
      o.rotation.x += p.spin.x * dt;
      o.rotation.y += p.spin.y * dt;
      p.vel.x *= Math.pow(0.45, dt); p.vel.z *= Math.pow(0.45, dt);
    } else {
      // perdeu velocidade: cai e fica no chão (pode ser socado de novo)
      p.thrown = false; p.hostile = false;
      p.vel.y -= 24 * dt;
      o.position.y += p.vel.y * dt;
      const settle = Math.min(1, dt * 8);
      o.rotation.x -= o.rotation.x * settle;
      o.rotation.z -= o.rotation.z * settle;
      const gp = groundY(o.position.x, o.position.z, o.position.y + 0.5);
      if (o.position.y <= gp && p.armed) { o.position.y = gp; breakProp(p, propDir.set(p.vel.x, 0, p.vel.z).normalize(), 6); continue; } // garrafa armada explode no chão
      if (o.position.y <= gp) {
        if (p.vel.y < -3) sfx.impact(p.type, o.position, Math.min(0.8, -p.vel.y / 14)); // bateu no chão: som do material
        o.position.y = gp; p.vel.y = 0; p.falling = false;
        p.vel.x *= Math.pow(0.02, dt); p.vel.z *= Math.pow(0.02, dt);
      }
      if (!p.falling) { p.vel.x *= Math.pow(0.02, dt); p.vel.z *= Math.pow(0.02, dt); if (p.vel.lengthSq() < 0.05) p.vel.set(0, 0, 0); }
    }
    // objeto arremessado anda em passos curtos e pára no primeiro contato com parede (senão atravessa as finas)
    const nStep = p.thrown ? Math.min(16, Math.max(1, Math.ceil(hs * dt / 0.4))) : 1;
    for (let i = 0; i < nStep; i++) {
      o.position.x += p.vel.x * dt / nStep;
      o.position.z += p.vel.z * dt / nStep;
      if (p.thrown && touchingSolid(o.position.x, o.position.z, p.T.radius * 0.8, o.position.y)) break;
    }

    if (!p.thrown) { resolveSolids(o.position, p.T.radius * 0.8, o.position.y, 0.3); clampToRoom(o.position, 0.7); continue; }

    propDir.set(p.vel.x, 0, p.vel.z).normalize();
    // bateu na parede: estilhaça
    const limX = HX - 0.7, limZ = HZ - 0.7;
    const wallHit = touchingSolid(o.position.x, o.position.z, p.T.radius * 0.8, o.position.y);
    if (wallHit || Math.abs(o.position.x) > limX || Math.abs(o.position.z) > limZ) {
      if (wallHit?.breakable) { // objeto pesado e rápido estoura a parede de gesso; os leves só racham
        wallHit.hp -= hs >= 30 ? 2 : 1;
        if (wallHit.hp <= 0) breakWall(wallHit, propDir);
        else spawnPuff(o.position.x, o.position.y, o.position.z, 1.4, 0x9a8fa0, 0.7, 0.45, 0.4);
      }
      breakProp(p, propDir, 10); continue;
    }
    // móvel possuído acerta o jogador
    if (p.hostile) {
      const dx = o.position.x - player.position.x, dz = o.position.z - player.position.z, r = 0.55 + p.T.radius;
      if (dx * dx + dz * dz < r * r && Math.abs(o.position.y - (player.position.y + 0.9)) < 1.4) {
        hurtPlayer(CFG.possessDamage * (p.T.size === 'large' ? 1.5 : 1));
        state.shake = Math.max(state.shake, 0.5);
        breakProp(p, propDir, 10); continue;
      }
    }
    // acertou o boss
    if (B.mode !== 'dying' && !p.hostile) {
      const dx = o.position.x - boss.position.x, dz = o.position.z - boss.position.z;
      const r = CFG.bossRadius + p.T.radius;
      if (dx * dx + dz * dz < r * r && Math.abs(o.position.y - (boss.position.y + 1.0)) < 1.6) { hitBossWithProp(p, propDir); continue; }
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
    if (touchingSolid(m.position.x, m.position.z, 0.1, m.position.y)) { // bateu numa parede: quica de volta
      m.position.x -= d.vel.x * dt; m.position.z -= d.vel.z * dt;
      d.vel.x *= -0.4; d.vel.z *= -0.4;
    }
    const fl = groundY(m.position.x, m.position.z, m.position.y + 0.4) + Math.min(0.3, Math.max(m.scale.x, m.scale.y, m.scale.z) * 0.25);
    if (m.position.y < fl) {
      m.position.y = fl;
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
const labelOf = (type) => tx('p.' + type);
const SMALL_TYPES = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].size === 'small' && k !== 'plank' && k !== 'vodka');
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

// VODKA: ao pegar uma garrafa cheia, o jogador bebe na hora (animação levando a garrafa à boca) e a garrafa vazia
// continua na mão. Arremessada, ela explode no impacto.
function drinkVodka(p) {
  p.empty = true;
  p.obj.getObjectByName('liquid')?.removeFromParent();
  state.drinkT = CFG.vodkaDrinkTime; state.gulpN = -1;
  const before = state.hp;
  state.hp = Math.min(CFG.playerMaxHp, state.hp + CFG.vodkaHeal);
  sfx.drink();
  state.moveNameT = 1.2; elMoveName.textContent = state.hp > before ? tx('heal', Math.round(state.hp - before)) : tx('full');
}
function setCastShadow(obj, on) { obj.traverse((m) => { if (m.isMesh) m.castShadow = on; }); }

function interact() {
  if (state.over) return;
  if (state.held) { dropHeld(); return; }
  if (canGrabBoss()) { grabBoss(); return; }
  const p = findGrabbable();
  if (!p) return;
  // o objeto sai da cena e vira filho do grupo das MÃOS (que é filho da câmera): acompanha o olhar e as mãos o seguram
  state.held = p;
  p.held = true;
  p.vel.set(0, 0, 0);
  p.obj.rotation.set(0, 0, 0); p.obj.position.set(0, 0, 0); p.obj.scale.setScalar(1);
  const bb = new THREE.Box3().setFromObject(p.obj); // tamanho do objeto (para as mãos encostarem nas laterais)
  p.grip = { ...(GRIP[p.type] ?? GRIP_DEFAULT), halfW: (bb.max.x - bb.min.x) * 0.25, h: (bb.max.y - bb.min.y) * 0.5 };
  if (p.grip.two) { viewmodel.add(p.obj); p.obj.scale.setScalar(0.5); }
  else { const L = p.grip.local; hands[1].fist.add(p.obj); p.obj.position.fromArray(L.pos); p.obj.rotation.set(L.rot[0], L.rot[1], L.rot[2]); p.obj.scale.setScalar(L.s); }
  setCastShadow(p.obj, false);
  state.grabAnimT = 0.22; // a mão vai até o objeto
  if (p.type === 'vodka') sfx.clink(); else if (p.grip.two) sfx.heave(); else sfx.pick();
  state.shake = Math.max(state.shake, 0.1);
  if (p.type === 'vodka' && !p.empty) drinkVodka(p);
}

// devolve o objeto da mão para a cena, na posição do mundo dada
function releaseHeld(x, y, z) {
  const p = state.held; state.gulpN = -1;
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
  sfx.impact(p.type, p.obj.position, 0.35);
}

// ARREMESSO ANIMADO: o braço (ou os dois, em objeto pesado) vai para trás e lança; o objeto sai da mão no meio do movimento
const THROW_TIME = 0.34, THROW_RELEASE = 0.42;
function throwHeld() {
  if (!state.held || state.drinkT > 0 || state.throwT >= 0) return; // bebendo/arremessando: termina primeiro
  state.throwT = 0; state.throwTwo = !!state.held.grip?.two;
  sfx.grunt(state.throwTwo ? 0.8 : 0.5);
}
function releaseThrow() {
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
  const p = releaseHeld(player.position.x + throwDir.x * 0.9, player.position.y + 1.2, player.position.z + throwDir.z * 0.9);
  launchProp(p, throwDir, CFG.throwHeld, true, CFG.heldThrowMul, CFG.heldKnockMul);
  if (p.type === 'vodka') p.armed = true; // explode no primeiro impacto
  sfx.throwObj();
  state.shake = Math.max(state.shake, 0.3);
  state.hitstop = Math.max(state.hitstop, 0.03);
}

// o objeto na mão balança de leve; mostra a dica na tela
const smooth01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function updateHeld(t) {
  if (state.held) {
    const o = state.held.obj, g = state.held.grip ?? GRIP_DEFAULT;
    if (state.drinkT > 0) { // goles ("glup") no meio do gole; a animação é da mão (o objeto está preso nela)
      const u = 1 - state.drinkT / CFG.vodkaDrinkTime;
      const gulpN = Math.floor((u - 0.3) / 0.13); if (u > 0.3 && u < 0.8 && gulpN !== state.gulpN) { state.gulpN = gulpN; sfx.gulp(); }
    }
    if (g.two) {
      if (state.throwT >= 0) { const hp = hands[1].p; o.position.set(0, hp[1] - g.h * 0.55, hp[2] - 0.05); o.rotation.x += (g.rot[0] - 0.3 - o.rotation.x) * 0.3; }
      else {
        const bob = Math.sin(t * 3) * 0.012, k = state.grabAnimT > 0 ? 0.35 : 1; // acabou de pegar: o objeto "vem" até as mãos
        o.position.x += (g.obj[0] - o.position.x) * k; o.position.y += (g.obj[1] + bob - o.position.y) * k; o.position.z += (g.obj[2] - o.position.z) * k;
        o.rotation.set(g.rot[0], g.rot[1] + Math.sin(t * 1.7) * 0.04, g.rot[2]);
      }
    }
  }
  let msg = '';
  if (state.over) msg = '';
  else if (state.drinkT > 0) msg = '';
  else if (canGrabBoss()) msg = tx(touchMode ? 'prGrabBossT' : 'prGrabBoss');
  else if (state.held) msg = state.held.type === 'vodka' ? tx(touchMode ? 'prHeldVodkaT' : 'prHeldVodka') : tx(touchMode ? 'prHeldT' : 'prHeld');
  else { const g = findGrabbable(); if (g) msg = g.type === 'vodka' && !g.empty ? tx(touchMode ? 'prVodkaT' : 'prVodka', CFG.vodkaHeal) : tx(touchMode ? 'prGrabT' : 'prGrab', labelOf(g.type)); }
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
const elBossGuard = document.getElementById('bossGuard');
const elBossFear = document.getElementById('bossFear');
const elFearLabel = document.getElementById('fearLabel');
const elBossName = document.getElementById('bossName');
const elOver = document.getElementById('over');
const elOverTitle = document.getElementById('overTitle');
const elOverSub = document.getElementById('overSub');
const elMv = { heavy: document.getElementById('mvheavy'), upper: document.getElementById('mvupper'), slam: document.getElementById('mvslam') };
const elCombo = document.getElementById('combo');
const elMoveName = document.getElementById('moveName');
elBossName.textContent = tx('boss');
applyLang();
function updateHud() {
  elHp.style.width = Math.max(0, state.hp / CFG.playerMaxHp * 100) + '%';
  elBossHp.style.width = Math.max(0, B.hp / CFG.bossMaxHp * 100) + '%';
  elBossGuard.style.width = Math.max(0, B.guard / CFG.guardMax * 100) + '%'; elBossGuard.classList.toggle('broken', B.broken > 0);
  elBossFear.style.width = Math.min(100, B.fear || 0) + '%'; elBossFear.classList.toggle('high', (B.fear || 0) >= CFG.fearNoAttack); // barra de MEDO
  const fl = (B.fear || 0) >= CFG.fearNoAttack ? 'terrified' : (B.fear || 0) >= 35 ? 'scared' : 'fear'; if (elFearLabel.dataset.k !== fl) { elFearLabel.dataset.k = fl; elFearLabel.textContent = tx(fl); elFearLabel.classList.toggle('high', fl !== 'fear'); }
  elBossHp.classList.toggle('p2', B.phase2);
  for (const k in elMv) {
    elMv[k].querySelector('.track > div').style.width = (100 - state.cd[k] / CFG.cooldowns[k] * 100) + '%';
    elMv[k].classList.toggle('ready', state.cd[k] <= 0);
  }
  elMoveName.style.opacity = Math.min(1, state.moveNameT / 0.4);
  elCombo.textContent = state.combo >= 2 ? 'x' + state.combo : '';
  elCombo.style.opacity = state.combo >= 2 ? Math.min(1, state.comboT) : 0;
  updateMenu(); touchUpdate();
  if (state.over) {
    elOverTitle.textContent = tx(state.over === 'win' ? 'win' : 'lose');
    elOverSub.textContent = (state.over === 'win' ? tx('time', state.time.toFixed(1)) : '') + tx(touchMode ? 'retryT' : 'retry');
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
  player.position.set(0, 0, HZ - 2.5); state.eyeY = 0; state.pvy = 0; state.flash = 0; state.slow = 0;
  rebuildWalls();
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
  v.x = THREE.MathUtils.clamp(v.x, -HX + margin, HX - margin);
  v.z = THREE.MathUtils.clamp(v.z, -HZ + margin, HZ - margin);
}

function hurtPlayer(dmg) {
  if (state.dodgeT >= 0 && !state.over && !state.perfectUsed) perfectDodge(); // o golpe dele acertaria bem durante a esquiva
  if (state.hurtCooldown > 0 || state.dodgeT >= 0 || state.over) return; // esquiva = invulnerável
  vib([60, 40, 60]);
  state.hp -= dmg;
  state.hurtCooldown = 0.8;
  state.shake = 0.6;
  state.hurtFlash = 1;
  sfx.hurt();
  if (state.hp <= 0) { state.hp = 0; state.over = 'lose'; sfx.lose(); }
}

function fixPlayer() { // colisão com paredes/degraus + limite da casa
  resolveSolids(player.position, 0.45, player.position.y, 0.55);
  clampToRoom(player.position, 0.5);
}
function updatePlayer(dt) {
  state.dodgeCD = Math.max(0, state.dodgeCD - dt);

  if (state.dodgeT >= 0) {
    state.dodgeT += dt;
    player.position.addScaledVector(state.dodgeDir, CFG.dodgeSpeed * dt);
    fixPlayer();
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
      fixPlayer();
    }
  }

  pushPlayerOutOfProps();

  // vertical: sobe degraus (até 0,55 m por vez) e cai de plataformas com gravidade
  const gyP = groundYR(player.position.x, player.position.z, player.position.y + 0.56, 0.3);
  state.pvy -= 30 * dt;
  player.position.y += state.pvy * dt;
  if (player.position.y <= gyP) { player.position.y = gyP; state.pvy = 0; }

  player.rotation.y = look.yaw; // usado no cone do soco

  for (const k in state.cd) state.cd[k] = Math.max(0, state.cd[k] - dt);
  state.drinkT = Math.max(0, (state.drinkT ?? 0) - dt);
  state.counterT = Math.max(0, (state.counterT ?? 0) - dt);
  if (state.aimTo != null) { // mira assistida: aproxima o olhar do alvo rapidamente
    let dd = state.aimTo - look.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    look.yaw += dd * Math.min(1, dt * 18); if (Math.abs(dd) < 0.01) state.aimTo = null;
  }
  if (touchHold.jab && locked && !state.atk && !state.held && !state.over) startPunch('jab'); // segurar SOCO repete o combo
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
        fixPlayer();
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
const _ht = [0, 0, 0, 0, 0, 0, 1];
function updateHands(dt) {
  // relógios das animações de mão
  state.grabAnimT = Math.max(0, (state.grabAnimT ?? 0) - dt);
  if (state.tossT >= 0) { state.tossT += dt; if (state.tossT > 0.4) state.tossT = -1; }
  if (state.throwT >= 0) {
    const before = state.throwT; state.throwT += dt;
    if (before < THROW_TIME * THROW_RELEASE && state.throwT >= THROW_TIME * THROW_RELEASE && state.held) releaseThrow(); // solta no meio do movimento
    if (state.throwT > THROW_TIME) state.throwT = -1;
  }
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
    const ht = _ht; let shape = 'fist';
    for (let j = 0; j < 7; j++) ht[j] = h.p[j];
    const special = !frames ? handTarget(h, ht) : null;
    if (frames) {
      sampleKF(frames, THREE.MathUtils.clamp(a.t / MOVES[a.kind].dur, 0, 1), h.p);
    } else if (special) {
      // segurando/bebendo/arremessando/agarrando: segue o alvo rápido (o arremesso já vem interpolado)
      const k = state.throwT >= 0 || state.tossT >= 0 || state.drinkT > 0 ? 1 : 1 - Math.exp(-dt * (state.grabAnimT > 0 ? 22 : 16));
      for (let j = 0; j < 7; j++) h.p[j] += (ht[j] - h.p[j]) * k;
      shape = special;
    } else {
      const target = state.dodgeT >= 0 ? DODGE_POSE : G;
      const k = 1 - Math.exp(-dt * 16);
      for (let j = 0; j < 7; j++) h.p[j] += (target[j] - h.p[j]) * k;
    }
    setShape(h, shape);
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

// ---------- POSES DAS MÃOS segurando, bebendo, agarrando e arremessando (Etapa 44) ----------
// Cada tipo de objeto diz como é segurado: com uma mão (a direita; a esquerda fica em guarda baixa) ou com as duas
// (uma de cada lado, encostadas nas laterais). `obj` é onde o objeto fica (espaço das mãos/câmera) e `rot` a rotação dele.
const GRIP_DEFAULT = { two: false, local: { pos: [0.08, -0.06, -0.06], rot: [0, 0, Math.PI / 2], s: 0.4 } };
const HOLD1 = [0.30, -0.36, -0.66, -0.15, 0.15, -1.35, 1]; // segurando com uma mão: mão de lado (polegar para cima)
// beber: leva a mão até a boca e inclina a garrafa para trás (o gargalo vem para o rosto)
const DRINK_KF = [[0, ...HOLD1], [0.25, 0.06, -0.1, -0.4, 2.15, 0.1, -1.35, 0.95], [0.8, 0.06, -0.08, -0.38, 2.35, 0.1, -1.35, 0.95], [1, ...HOLD1]];
const GRIP = {
  // uma mão: `local` = posição/rotação/escala do objeto DENTRO do punho (a mão gira de lado, polegar para cima,
  // e o objeto atravessa a mão fechada); a mão faz a animação e o objeto vai junto
  vodka:  { two: false, local: { pos: [0.09, -0.02, -0.04], rot: [0, 0, Math.PI / 2], s: 0.42 } },
  vase:   { two: false, local: { pos: [0.16, -0.02, -0.06], rot: [0, 0, Math.PI / 2], s: 0.34 } },
  ball:   { two: false, local: { pos: [0.0, -0.13, -0.08], rot: [0, 0, 0], s: 0.42 } },
  pillow: { two: false, local: { pos: [0.08, -0.1, -0.06], rot: [0, 0, Math.PI / 2], s: 0.4 } },
  plank:  { two: false, local: { pos: [0.0, -0.02, -0.05], rot: [0, 0, Math.PI / 2], s: 0.42 } },
  crate:  { two: true, obj: [0, -0.86, -0.92], rot: [0.05, 0.2, 0] },
  barrel: { two: true, obj: [0, -0.90, -0.92], rot: [0.05, 0, 0] },
  tv:     { two: true, obj: [0, -0.86, -0.92], rot: [0.05, Math.PI, 0] },
  chair:  { two: true, obj: [0, -0.95, -0.98], rot: [0.1, Math.PI, 0] },
};
const LOW_GUARD = [0.36, -0.52, -0.55, -0.45, 0, 0, 1];
const _hv = new THREE.Vector3(), _hq = new THREE.Quaternion(), _he = new THREE.Euler();
function setShape(h, k) { if (!h.shapes) return; for (const n in h.shapes) h.shapes[n].visible = n === k; }
// pose de cada mão (direita = side 1) e formato da mão, conforme o que o jogador está fazendo agora
function handTarget(h, out) {
  const side = h.side, right = side > 0, p = state.held;
  // AGARRANDO O FANTASMA: as duas mãos vão abertas até ele e fecham nos cabelos/ombros, sacudindo
  if (B.mode === 'grabbed') {
    const k = Math.min(1, B.t / 0.15), shake = Math.sin(state.time * 38 + side) * 0.02;
    out.splice(0, 7, 0.27, -0.4 + shake, -0.98 + 0.25 * (1 - k), -0.12, 0.15, -0.8, 0.95); // braços baixos esticados, mãos fechando nela (palmas meio para dentro)
    return k < 1 ? 'open' : 'grip';
  }
  if (state.tossT >= 0) { // arremessou o fantasma: as duas mãos terminam o movimento para a frente
    const u = Math.min(1, state.tossT / 0.4);
    sampleKF([[0, 0.27, -0.4, -0.98, -0.12, 0.15, -0.8, 0.95], [0.35, 0.22, -0.28, -1.1, -0.6, 0, -0.5, 1], [1, ...G]], u, out); // empurra para a frente e volta à guarda
    return u < 0.35 ? 'open' : 'fist';
  }
  if (p && state.throwT >= 0) { // ARREMESSANDO um objeto
    const u = Math.min(1, state.throwT / THROW_TIME);
    if (state.throwTwo || right) {
      const g = p.grip, back = state.throwTwo ? [g.halfW + 0.08, -0.72, -0.55, 0.25, 0.3, -1.3, 0.95] : [0.40, 0.02, -0.25, 0.35, 0.1, -1.35, 1];
      sampleKF([[0, ...(state.throwTwo ? out : HOLD1)], [0.38, ...back], [0.6, state.throwTwo ? 0.22 : 0.12, state.throwTwo ? -0.3 : -0.08, -1.05, state.throwTwo ? -0.7 : -1.5, 0, state.throwTwo ? -1.1 : -1.0, 1], [1, ...G]], u, out);
      return u < 0.6 ? 'grip' : 'open';
    }
    out.splice(0, 7, ...LOW_GUARD); return 'fist';
  }
  if (p) {
    const g = p.grip;
    if (g.two) { // uma mão de cada lado do objeto
      out.splice(0, 7, g.halfW + 0.11, g.obj[1] + g.h * 0.6, g.obj[2] + 0.12, -0.2, 0.25, -1.3, 0.95); // mãos nas laterais, palmas para dentro, braços vindo de baixo
      return 'grip';
    }
    if (!right) { out.splice(0, 7, ...LOW_GUARD); return 'fist'; }
    // uma mão: o objeto está preso no punho; a mão faz a pose (parada de lado, ou bebendo)
    if (state.drinkT > 0) sampleKF(DRINK_KF, 1 - state.drinkT / CFG.vodkaDrinkTime, out);
    else { out.splice(0, 7, ...HOLD1); out[1] += Math.sin(state.time * 3) * 0.008; }
    return 'grip';
  }
  return null; // sem objeto: guarda/socos (decidido em updateHands)
}

const COLORS = {
  chase: 0x4fa8ff, windup: 0xff2a2a, dash: 0xff8a00, stun: 0xffe14f, p2chase: 0xb06bff,
};

// ---------- Luzes piscando ----------
// `lvl` (0 a 1) multiplica as lâmpadas, a lua e a luz ambiente. Quem pisca: eventos aleatórios (a cada 9 a 20 s),
// o aviso do ataque do fantasma (pisca cada vez mais), o avanço (apaga de uma vez), a fase 2 (pisca e fica no escuro)
// e golpes fortes. As trocas são irregulares, mas com no mínimo 0,17 s entre elas (no máximo ~3 por segundo),
// e dá para desligar tudo no menu (opção para quem é sensível a luz piscando).
const lightFx = { event: null, t: 0, dur: 0, hold: 0, on: true, lvl: 1, ambientT: 12, dark: 0 };
function startLightEvent(kind) {
  if (!settings.flicker) return;
  lightFx.event = kind; lightFx.t = 0; lightFx.hold = 0;
  lightFx.dur = { short: 0.9, hit: 0.35, long: 2.4 }[kind];
  if (kind !== 'hit') sfx.flicker(kind === 'long' ? 6 : 3);
}
function updateLights(dt) {
  const fx = lightFx;
  let target = 1;
  if (settings.flicker) {
    fx.ambientT -= dt;
    if (fx.ambientT <= 0 && !fx.event) { fx.ambientT = 9 + Math.random() * 11; startLightEvent('short'); }
    fx.hold -= dt;
    let pOn = 1, offLevel = 0.3, active = false;
    if (fx.event) {
      active = true; fx.t += dt;
      pOn = fx.event === 'long' ? 0.4 : 0.5;
      if (fx.event === 'long' && fx.t > fx.dur - 0.6) target = 0.06;  // termina no escuro e volta de uma vez
      if (fx.t >= fx.dur) fx.event = null;
    } else if (B.mode === 'windup' || B.mode === 'swipe') {            // aviso: pisca cada vez mais
      active = true; pOn = 0.7 - 0.4 * Math.min(1, B.t / CFG.bossWindup); offLevel = 0.22;
    } else if (B.mode === 'dash' && B.t < 0.22) {
      target = 0.08;                                                    // avanço: apaga
    }
    if (active && target === 1) {
      if (fx.hold <= 0) { fx.on = Math.random() < pOn; fx.hold = 0.17 + Math.random() * 0.2; }
      target = fx.on ? 1 : offLevel;
    }
  }
  // APAGÃO (habilidade do fantasma): luzes apagadas por alguns segundos; só o brilho do fantasma ilumina
  const wasDark = fx.dark > 0; fx.dark = Math.max(0, fx.dark - dt);
  if (fx.dark > 0) target = 0.06; else if (wasDark) { sfx.flicker(3); startLightEvent('short'); }
  fx.lvl += (target - fx.lvl) * (1 - Math.exp(-dt * 40));
  const k = 0.12 + 0.88 * fx.lvl;
  ambient.intensity = AMBIENT0 * k;
  moon.intensity = MOON0 * k;
  for (const b of bulbs) {
    if (b.light) b.light.intensity = BULB0 * fx.lvl;
    b.bulbMat.color.setRGB(1 * (0.1 + 0.9 * fx.lvl), 0.886 * (0.1 + 0.9 * fx.lvl), 0.66 * (0.1 + 0.9 * fx.lvl));
  }
}

const rollW = new THREE.Vector3(), rollAxis = new THREE.Vector3(), dq = new THREE.Quaternion();
const upQ = new THREE.Quaternion(), upE = new THREE.Euler(), pivotV = new THREE.Vector3(), pivotC = new THREE.Vector3(), pivotQ = new THREE.Quaternion();

// efeitos de um impacto do corpo (parede, chão, teto)
function bossHitFx(into, k = 1) {
  if (B.wallCD > 0) return;
  B.wallCD = 0.14;
  const power = Math.min(1, into / 45);
  if (B.mode !== 'dying') damageBoss(CFG.wallSlamDamage * k + into * 0.02);
  sfx.wall();
  sfx.scream(power, bossAt(), 0.4, 'hit');
  registerHit(0.05 + 0.07 * power, 0.9, 'none');
  state.shake = Math.max(state.shake, 0.5 + 0.5 * power);
  state.flash = Math.max(state.flash, 0.2 + 0.4 * power);
  if (power > 0.6) state.slow = Math.max(state.slow, 0.2);
  spawnPuff(boss.position.x, boss.position.y + 1.4, boss.position.z, 1.6 + power, 0xcfe9ff, 0.7, 0.45, 0.5);
  B.vy += into * 0.05;
  B.lieT = Math.max(B.lieT, CFG.wallStagger);
  B.w.x += (Math.random() - 0.5) * 10; B.w.z += (Math.random() - 0.5) * 10;
}
function bossFloorImpact(imp) {
  const power = Math.min(1, imp / 22);
  sfx.thud(power, bossAt());
  for (let i = 0; i < 3; i++) spawnPuff(boss.position.x + (Math.random() - 0.5) * 1.2, boss.position.y + 0.4, boss.position.z + (Math.random() - 0.5) * 1.2, 1.0 + power, 0x6f6678, 0.9, 0.45, 1);
  state.shake = Math.max(state.shake, 0.25 + 0.5 * power);
  if (imp > 9 && B.mode !== 'dying') {
    damageBoss(0.3 + imp * 0.02);
    sfx.scream(power, bossAt(), 0.35, 'hit');
    B.w.x += (Math.random() - 0.5) * 8; B.w.z += (Math.random() - 0.5) * 8;
  }
}
function bossCeilingImpact() {
  B.ceilCD = 0.4;
  const p = boss.position;
  sfx.thud(0.7, bossAt()); sfx.scream(0.6, bossAt(), 0.35, 'hit');
  const cy = ceilAt(p.x, p.z, p.y);
  spawnPuff(p.x, cy - 0.4, p.z, 1.8, 0x8a8299, 0.8, 0.5, -0.5);
  spawnDebris({ x: p.x, y: cy - 1.2, z: p.z }, 0x8f8196, 10, null, 0);
  state.shake = Math.max(state.shake, 0.6);
  if (B.mode !== 'dying') damageBoss(1);
}
// colisão do corpo com paredes/plataformas.
// Em perseguição/ataque o fantasma só esbarra nas paredes externas (ele atravessa as de gesso); arremessado, é um corpo sólido:
// bate e quica, ou se o impacto for forte (>= wallBreakSpeed) ATRAVESSA a parede de gesso, quebrando-a.
function bossCollide() {
  const flying = B.launch;
  resolveSolids(boss.position, CFG.bossRadius, boss.position.y, flying ? 0.4 : 3.2, flying ? null : (s) => s.outer, (s, nx, nz) => {
    if (!flying) { if (s.outer) B.hitOuter = true; return false; }
    const into = -(B.vel.x * nx + B.vel.z * nz); // velocidade contra a parede
    if (into < 2) return false;                  // encostando de leve: só empurra para fora
    if (s.breakable && (into >= CFG.wallBreakSpeed || s.hp <= 1)) {
      propDir.set(B.vel.x, 0, B.vel.z).normalize();
      breakWall(s, propDir);
      B.vel.multiplyScalar(0.8);                 // atravessa perdendo um pouco de velocidade
      bossHitFx(into, 0.6);
      return true;                               // parede já era: não empurra
    }
    if (s.breakable) { s.hp -= 1; spawnDebris({ x: boss.position.x, y: boss.position.y + 0.5, z: boss.position.z }, 0x8f8196, 5, null, 0); }
    B.vel.x += nx * into * (1 + CFG.bounceWall); // quica: v' = v - (1+e)(v.n)n
    B.vel.z += nz * into * (1 + CFG.bounceWall);
    bossHitFx(into, 1);
    return false;
  });
}
// no avanço (dash) o fantasma esmaga as paredes de gesso do caminho
function smashWallsInDash() {
  for (const s of [...allPanels]) {
    if (!s.alive || !sameLevel(s, boss.position.y)) continue;
    const cx = THREE.MathUtils.clamp(boss.position.x, s.x0, s.x1), cz = THREE.MathUtils.clamp(boss.position.z, s.z0, s.z1);
    if ((boss.position.x - cx) ** 2 + (boss.position.z - cz) ** 2 < (CFG.bossRadius + 0.2) ** 2) { breakWall(s, B.dashDir); state.shake = Math.max(state.shake, 0.5); }
  }
}

// onde o fantasma reaparece: com chance blinkBehind, a ~3 m ATRÁS de onde o jogador olha; senão, num ponto qualquer a 4-9 m.
// Rejeita pontos dentro de paredes/plataformas, fora da casa ou fora de alcance.
const fwdP = new THREE.Vector3(), desiredV = new THREE.Vector3();
function pickBlinkDest() {
  fwdP.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
  const flee = B.fleeBlink;
  const behind = !flee && Math.random() < CFG.blinkBehind;
  for (let i = 0; i < 12; i++) {
    let ang, d;
    if (behind && i < 8) { ang = Math.atan2(-fwdP.x, -fwdP.z) + (Math.random() - 0.5) * 0.9; d = 2.8 + Math.random() * 1.6; }
    else { ang = Math.random() * Math.PI * 2; d = flee ? 9 + Math.random() * 6 : 4 + Math.random() * 5; }
    const x = player.position.x + Math.sin(ang) * d, z = player.position.z + Math.cos(ang) * d;
    if (Math.abs(x) > HX - 1.2 || Math.abs(z) > HZ - 1.2) continue;
    if (touchingSolid(x, z, 1.1, player.position.y + 0.5)) continue;
    return new THREE.Vector3(x, groundY(x, z, player.position.y + 0.6), z);
  }
  return new THREE.Vector3(player.position.x, player.position.y, player.position.z).addScaledVector(fwdP, -2.5).setY(player.position.y);
}

// ---------- Habilidades especiais (Etapa 20) ----------
const dropMark = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0x3a0010, transparent: true, opacity: 0.6, depthWrite: false }));
dropMark.rotation.x = -Math.PI / 2; dropMark.visible = false; dropMark.renderOrder = 2; scene.add(dropMark);
const flipQ = new THREE.Quaternion(), flipX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
const flipZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI); // modelo com clipe de rastejar: gira de barriga para o teto
const CEIL_Y = () => ceilAt(boss.position.x, boss.position.z, player.position.y + 0.2) - 1.8 * CFG.bossScale - 0.05; // pos.y do fantasma preso ao teto do andar do jogador
function possessCandidates() {
  return props.filter((p) => !p.held && !p.thrown && !p.falling && p.type !== 'vodka' && p.vel.lengthSq() < 0.5 && Math.abs(p.obj.position.y - player.position.y) < 1.5 &&
    Math.hypot(p.obj.position.x - player.position.x, p.obj.position.z - player.position.z) < 16)
    .sort((a, b) => a.obj.position.distanceToSquared(player.position) - b.obj.position.distanceToSquared(player.position));
}
const terrified = () => (B.fear || 0) >= CFG.fearNoAttack; // APAVORADO: não ataca de jeito nenhum
function chooseAfterChase(p2) {
  if (terrified()) { // apavorado: só foge (às vezes some e reaparece LONGE de você) e continua fugindo/encolhido
    if (B.blinkCD <= 0 && Math.random() < 0.4) { B.fleeBlink = true; setBossMode('vanish'); return; }
    B.chaseTime = B.t + 1.5 + Math.random(); B.sub = Math.random() < 0.5 ? 'retreat' : 'cower'; B.subT = 1.2; return;
  }
  if (B.blinkCD <= 0 && Math.random() < (p2 ? 0.5 : CFG.blinkChance)) { setBossMode('vanish'); return; }
  if (B.specialCD <= 0 && !state.over && Math.random() < CFG.specialChance * (p2 ? 1.3 : 1)) {
    const opts = ['ceil'];
    if (possessCandidates().length >= 1) opts.push('possess');
    if (lightFx.dark <= 0) opts.push('blackout');
    const pick = opts[Math.floor(Math.random() * opts.length)];
    B.specialCD = p2 ? 6 : CFG.specialCooldown;
    if (pick === 'blackout') { // apaga as luzes e continua perseguindo, mais rápido e já com o ataque encurtado
      lightFx.dark = CFG.blackoutDur[0] + Math.random() * (CFG.blackoutDur[1] - CFG.blackoutDur[0]);
      sfx.flicker(5); sfx.whisper(bossAt());
      B.chaseTime = 1.3 + Math.random() * 0.8; B.t = 0; B.quick = true;
      return;
    }
    setBossMode(pick); return;
  }
  setBossMode('windup');
}
function dropSlam() {
  const pos = boss.position;
  sfx.thud(1, bossAt());
  state.shake = Math.max(state.shake, 0.9); state.flash = Math.max(state.flash, 0.15);
  for (let i = 0; i < 6; i++) spawnPuff(pos.x + (Math.random() - 0.5) * 2, pos.y + 0.4, pos.z + (Math.random() - 0.5) * 2, 1.6, 0x6f6678, 0.9, 0.5, 1);
  spawnPuff(pos.x, pos.y + 0.3, pos.z, 3.2, 0xcfe9ff, 0.6, 0.35, 0);
  const d = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
  if (!B.pulled && d < CFG.ceilDropRadius && Math.abs(player.position.y - groundY(pos.x, pos.z, pos.y + 0.5)) < 1.2) hurtPlayer(CFG.ceilDropDamage);
  B.stunDur = B.pulled ? 2.0 : 1.3; B.pulled = false; setBossMode('stun'); // arrancado do teto: cai de cara e fica mais tempo no chão
}
function updateSpecials(dt) { // chamado por updateBoss nos modos novos; devolve true se o modo é "especial"
  const pos = boss.position;
  if (B.mode === 'ceil') {
    // sobe para o teto, de cabeça para baixo, e rasteja em direção ao jogador (fora do alcance de socos e objetos)
    const aimT = CFG.ceilCrawl * (B.phase2 ? 0.75 : 1);
    if (B.t < aimT) {
      const to = _v1.subVectors(player.position, pos).setY(0); const d = to.length() || 1;
      const sp = CFG.bossChaseSpeed * 1.8 * (B.phase2 ? 1.15 : 1) * (d > 3 ? 1 : 0.3);
      desiredV.set(to.x / d * sp + Math.sin(state.time * 5) * 0.8, 0, to.z / d * sp);
      B.mv.lerp(desiredV, 1 - Math.exp(-dt * 4));
      pos.addScaledVector(B.mv, dt);
      B.crawlSnd -= dt; if (B.crawlSnd <= 0) { B.crawlSnd = 0.9; sfx.whisper(bossAt()); }
    } else {
      B.mv.multiplyScalar(Math.exp(-dt * 8)); pos.addScaledVector(B.mv, dt);
      if (!B.aimed) { B.aimed = true; B.ceilTarget.copy(player.position); sfx.windup(CFG.ceilAim, bossAt()); }
      // desliza para cima do ponto marcado
      pos.x += (B.ceilTarget.x - pos.x) * Math.min(1, dt * 7); pos.z += (B.ceilTarget.z - pos.z) * Math.min(1, dt * 7);
      const gy = groundY(B.ceilTarget.x, B.ceilTarget.z, player.position.y + 0.6);
      dropMark.visible = true; dropMark.position.set(B.ceilTarget.x, gy + 0.06, B.ceilTarget.z);
      const k = Math.min(1, (B.t - aimT) / CFG.ceilAim);
      dropMark.scale.setScalar(CFG.ceilDropRadius * (0.5 + 0.5 * k));
      dropMark.material.opacity = 0.35 + 0.4 * k;
      if (B.t >= aimT + CFG.ceilAim) { dropMark.visible = false; setBossMode('drop'); }
    }
    pos.y += (CEIL_Y() - pos.y) * Math.min(1, dt * 7); B.vy = 0;
    B.cl = Math.min(1, B.cl + dt * 3);
    return true;
  }
  if (B.mode === 'drop') {
    B.cl = Math.max(0, B.cl - dt * 5);
    return false; // a queda usa a física normal (gravidade); o impacto é tratado depois, em updateBoss
  }
  if (B.mode === 'possess') {
    B.cl = Math.max(0, B.cl - dt * 5);
    if (!B.possInit) { B.possInit = true; B.poss = possessCandidates().slice(0, CFG.possessMax).map((p) => ({ p, y0: p.obj.position.y })); }
    B.poss = B.poss.filter((e) => props.includes(e.p) && !e.p.thrown && !e.p.falling && !e.p.held);
    const T0 = 1.0, gap = 0.4;
    B.poss.forEach((e, i) => {
      const o = e.p.obj, k = THREE.MathUtils.clamp((B.t - i * 0.15) / T0, 0, 1);
      o.position.y = e.y0 + 1.7 * k * k * (3 - 2 * k) + Math.sin(state.time * 3 + i) * 0.08 * k;
      o.rotation.z = Math.sin(state.time * 55 + i) * 0.18 * k; o.rotation.x = Math.sin(state.time * 47 + i * 2) * 0.12 * k;
      if (Math.random() < dt * 10) spawnPuff(o.position.x, o.position.y + 0.3, o.position.z, 0.7, 0xb45cff, 0.6, 0.35, 0.3);
    });
    // lança um a um na direção do jogador
    while (B.possLaunched < B.poss.length && B.t > T0 + 0.15 + B.possLaunched * gap) {
      const e = B.poss[B.possLaunched++], o = e.p.obj;
      propDir.subVectors(player.position, o.position).setY(0).normalize();
      launchProp(e.p, propDir, CFG.possessSpeed, true, 1, 0);
      e.p.hostile = true; e.p.flyY = o.position.y;
      sfx.dash(bossAt());
    }
    if (B.t > T0 + 0.15 + Math.max(1, B.poss.length) * gap + 0.4 || B.poss.length === 0 && B.t > 0.3) {
      B.chaseTime = 1.0 + Math.random() * 0.8; setBossMode('chase');
    }
    return false;
  }
  B.cl = Math.max(0, B.cl - dt * 4);
  return false;
}
const _v1 = new THREE.Vector3();

function updateBoss(dt) {
  B.t += dt;
  B.blinkCD = Math.max(0, B.blinkCD - dt); B.specialCD = Math.max(0, B.specialCD - dt);
  B.swipeCD = Math.max(0, B.swipeCD - dt); B.evadeCD = Math.max(0, B.evadeCD - dt);
  B.fearHold = Math.max(0, (B.fearHold || 0) - dt); B.calmT = Math.max(0, (B.calmT || 0) - dt);
  // DESESPERO: apavorado por tempo demais, ele "cria coragem" (encurralado), solta um grito e volta a atacar
  if (terrified() && B.mode !== 'dying' && B.mode !== 'grabbed') B.terrorT = (B.terrorT || 0) + dt; else if (!terrified()) B.terrorT = 0;
  if (B.terrorT >= CFG.terrorMax && !B.launch && (B.mode === 'chase' || B.mode === 'stun')) { // (mesmo apanhando: levanta gritando)
    B.terrorT = 0; B.fear = 35; B.fearHold = 0; B.calmT = CFG.calmAfterSnap;
    sfx.shriek(bossAt(), 1.0, 1); sfx.stinger(0.7); state.moveNameT = 1; elMoveName.textContent = tx('snap');
    B.quick = true; if (Math.hypot(boss.position.x - player.position.x, boss.position.z - player.position.z) < 9) setBossMode('windup');
  }
  if (terrified() && (B.mode === 'windup' || B.mode === 'swipe' || B.mode === 'dash' || B.mode === 'possess' || B.mode === 'ceil')) {
    // desiste do ataque no meio e foge (do teto ele cai de medo)
    dropMark.visible = false; B.swipeN = 0;
    for (const e of B.poss || []) if (props.includes(e.p) && !e.p.thrown) { e.p.falling = true; e.p.vel.set(0, 0, 0); } // os móveis que levitavam caem
    if (B.mode === 'ceil') { B.pulled = true; setBossMode('drop'); }
    else { setBossMode('chase'); B.chaseTime = 2; B.sub = 'retreat'; B.subT = 1.5; }
  }
  if (B.fearHold <= 0) B.fear = Math.max(0, (B.fear || 0) - CFG.fearDecay * dt);
  B.blockT = Math.max(0, B.blockT - dt); B.broken = Math.max(0, B.broken - dt);
  if (B.blockT <= 0 && B.broken <= 0) B.guard = Math.min(CFG.guardMax, B.guard + CFG.guardRegen * dt);
  bossVis.visible = true; // (as piscadas apagam por quadro)
  B.flash = Math.max(0, B.flash - dt);
  const p2 = B.phase2;
  const speedMul = (p2 ? 1.2 : 1) * (lightFx.dark > 0 ? 1.1 : 1);
  const timeMul = p2 ? 0.7 : 1;

  dirToPlayer.subVectors(player.position, boss.position).setY(0);
  const dist = dirToPlayer.length();
  if (dist > 0.001) dirToPlayer.divideScalar(dist);

  let emissive = p2 ? COLORS.p2chase : COLORS.chase;
  let intensity = 0.7;
  let sc = CFG.bossScale; // escala base deste frame (aviso e morte alteram)

  if (B.mode === 'chase' && B.broken > 0) {
    // GUARDA QUEBRADA: cambaleia no lugar, aberto para apanhar
    B.mv.multiplyScalar(Math.exp(-dt * 6)); boss.position.addScaledVector(B.mv, dt);
  } else if (B.mode === 'chase') {
    // PERSEGUIÇÃO NATURAL: alterna comportamentos (aproximar em curva, rodear, encarar, avançar de repente, recuar),
    // com velocidade oscilando e inércia ao mudar de direção.
    B.subT -= dt;
    if (B.subT <= 0) {
      const r = Math.random();
      const fr = (B.fear || 0) / 100; // com medo, ele foge de você ou se encolhe (treme no lugar) em vez de atacar
      if (terrified() || Math.random() < fr * 0.75) { B.sub = dist < 4 && Math.random() < 0.5 ? 'cower' : 'retreat'; B.subT = 0.8 + Math.random() * 1.0; if (Math.random() < 0.5) sfx.scream(0.35, bossAt(), 0.4, 'hit'); }
      else if (dist > 10) { B.sub = r < 0.5 ? 'surge' : 'approach'; B.subT = 0.8 + Math.random() * 0.8; }
      else if (dist < 4.5) {
        B.sub = r < 0.3 ? 'circle' : r < 0.6 ? 'stare' : r < 0.9 ? 'approach' : 'retreat'; // perto: mais tempo parado/encarando (dá para bater)
        B.subT = 0.5 + Math.random() * 0.9;
      } else {
        B.sub = r < 0.4 ? 'approach' : r < 0.7 ? 'circle' : r < 0.85 ? 'stare' : 'surge';
        B.subT = 0.6 + Math.random() * 1.4;
      }
      if (B.sub === 'circle') B.circDir = Math.random() < 0.5 ? -1 : 1;
    }
    const base = CFG.bossChaseSpeed * speedMul;
    const tt = state.time;
    const n = 0.5 + 0.5 * Math.sin(tt * 2.1 + B.ph2);
    const weave = Math.sin(tt * 1.3 + B.ph1) * 0.5;
    const ca = Math.cos(weave), sa = Math.sin(weave);
    let dx = dirToPlayer.x * ca - dirToPlayer.z * sa, dz = dirToPlayer.x * sa + dirToPlayer.z * ca, spd = base;
    if (B.sub === 'approach') spd = base * (0.7 + 0.6 * n);
    else if (B.sub === 'surge') spd = base * 1.7;
    else if (B.sub === 'stare') spd = base * 0.12;
    else if (B.sub === 'retreat') { dx = -dirToPlayer.x + Math.sin(tt * 3 + B.ph1) * 0.6; dz = -dirToPlayer.z; spd = base * (0.6 + (B.fear || 0) / 100); }
    else if (B.sub === 'cower') { spd = 0; }
    else if (B.sub === 'circle') {
      const k = THREE.MathUtils.clamp((dist - 5.5) * 0.5, -1, 1);
      dx = -dirToPlayer.z * B.circDir + dirToPlayer.x * k; dz = dirToPlayer.x * B.circDir + dirToPlayer.z * k; spd = base * 0.8;
    }
    const dl = Math.hypot(dx, dz) || 1;
    desiredV.set(dx / dl * spd, 0, dz / dl * spd);
    if (state.over) desiredV.set(0, 0, 0);
    B.mv.lerp(desiredV, 1 - Math.exp(-dt * (B.sub === 'surge' ? 6 : 3)));
    boss.position.addScaledVector(B.mv, dt);
    if (B.t >= B.chaseTime * timeMul && !state.over) {
      if (dist > 9) { B.chaseTime += 0.6; B.sub = 'surge'; B.subT = 1.0; }
      else if (dist < CFG.swipeRange + 0.6 && B.swipeCD <= 0 && !terrified()) { B.swipeN = 0; setBossMode('swipe'); }
      else chooseAfterChase(p2);
    }
    // perto demais: ataca com as garras sem esperar o fim da perseguição
    if (B.mode === 'chase' && dist < CFG.swipeRange && B.swipeCD <= 0 && !state.over && B.sub !== 'cower' && !terrified() && Math.abs(boss.position.y - player.position.y) < 1.2) { B.swipeN = 0; setBossMode('swipe'); }
    // contato leve enquanto persegue
    if (dist < CFG.bossRadius + 0.6 && !terrified()) hurtPlayer(CFG.bossContactDamage);
  } else if (B.mode === 'windup') {
    // AVISO: pisca em vermelho e "encolhe" (carregando). Dá tempo de reagir.
    emissive = COLORS.windup;
    intensity = 1.2;
    const wd = CFG.bossWindup * timeMul * (B.quick ? 0.75 : 1); // logo depois de reaparecer o aviso é um pouco mais curto
    const k = Math.min(B.t / wd, 1);
    sc = CFG.bossScale * (1 - 0.18 * k);
    if (!state.over) B.dashDir.copy(dirToPlayer); // mira até o último instante
    if (B.t >= wd) {
      setBossMode('dash');
      sc = CFG.bossScale;
    }
  } else if (B.mode === 'grabbed') {
    // ERGUIDO: fica preso na sua frente se debatendo e, depois de um instante, voa para onde você estiver olhando
    fwdP.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
    boss.position.set(player.position.x + fwdP.x * 1.45, player.position.y + Math.min(0.25, B.t * 0.6), player.position.z + fwdP.z * 1.45); // erguida um pouco do chão
    B.vy = 0; B.vel.set(0, 0, 0); sc = CFG.bossScale * (1 + Math.sin(B.t * 40) * 0.03);
    if (B.t >= 0.55) {
      damageBoss(CFG.tossDamage); launchBoss(fwdP, CFG.attacks.toss); registerHit(CFG.attacks.toss.hitstop, CFG.attacks.toss.squash, 'none');
      sfx.throwObj(); sfx.grunt(1); state.tossT = 0; state.shake = 0.9; state.slow = Math.max(state.slow, 0.35); state.kick.pitch += 0.08;
    }
  } else if (B.mode === 'swipe') {
    // GARRAS: aviso curto (encolhe e mira) e uma estocada curta; repete 2 ou 3 vezes seguidas
    const wd = CFG.swipeWindup * (B.phase2 ? 0.8 : 1), lunge = 0.2;
    if (B.t < wd) { if (!state.over) B.dashDir.copy(dirToPlayer); sc = CFG.bossScale * (1 - 0.08 * (B.t / wd)); }
    else if (B.t < wd + lunge) {
      boss.position.addScaledVector(B.dashDir, 5 * speedMul * dt);
      fwdP.subVectors(player.position, boss.position).setY(0);
      if (!B.hitThis && fwdP.length() < CFG.bossRadius + 1.0 && fwdP.normalize().dot(B.dashDir) > 0.3) { B.hitThis = true; hurtPlayer(CFG.swipeDamage); }
    } else if (B.t >= wd + lunge + 0.12) {
      B.swipeN--;
      if (B.swipeN > 0 && !state.over) setBossMode('swipe');
      else { B.swipeN = 0; B.swipeCD = CFG.swipeCooldown * (B.phase2 ? 0.7 : 1); B.chaseTime = 0.8 + Math.random() * 0.8; setBossMode('chase'); }
    }
  } else if (B.mode === 'dash') {
    emissive = COLORS.dash;
    intensity = 2;
    boss.position.addScaledVector(B.dashDir, CFG.bossDashSpeed * speedMul * dt);
    if (dist < CFG.bossRadius + 0.6) hurtPlayer(CFG.bossDashDamage);
    // bateu na parede: fica atordoado, vulnerável
    const hitWall = B.hitOuter;
    if (hitWall) { state.shake = 0.7; B.stunDur = CFG.bossRecover * timeMul; setBossMode('stun'); }
    else if (B.t >= CFG.bossDashTime) { B.stunDur = CFG.bossRecover * timeMul; setBossMode('stun'); }
  } else if (B.mode === 'stun') {
    emissive = COLORS.stun;
    intensity = 0.5;
    if (B.t >= B.stunDur && !B.launch) {
      B.chaseTime = 0.5 + Math.random() * 0.7;
      setBossMode('chase');
    }
  } else if (B.mode === 'vanish') {
    // SOME: pisca (no máximo ~3x por segundo), encolhe e solta fumaça escura
    const k = Math.min(1, B.t / CFG.blinkVanish);
    emissive = 0x9aa8ff; intensity = 1 + 2 * k;
    sc = CFG.bossScale * (1 - 0.7 * k);
    if (settings.flicker) bossVis.visible = Math.sin(B.t * 18) > -0.2 - k * 0.7;
    if (Math.random() < dt * 14) spawnPuff(boss.position.x, boss.position.y + 1.3, boss.position.z, 1.3, 0x15121f, 0.7, 0.55, 0.6);
    if (B.t >= CFG.blinkVanish) {
      B.blinkDest.copy(pickBlinkDest());
      B.hiddenDur = CFG.blinkHidden[0] + Math.random() * (CFG.blinkHidden[1] - CFG.blinkHidden[0]);
      B.whispered = false;
      setBossMode('hidden');
    }
  } else if (B.mode === 'hidden') {
    // INVISÍVEL e intocável (fica "debaixo do chão"); um sussurro 3D avisa de onde ele vai surgir
    bossVis.visible = false;
    if (!B.whispered && B.t > 0.15) { B.whispered = true; sfx.whisper({ x: B.blinkDest.x, y: 1.4, z: B.blinkDest.z }); }
    if (B.t >= B.hiddenDur) {
      boss.position.copy(B.blinkDest); B.vy = 0; B.vel.set(0, 0, 0);
      B.yaw = Math.atan2(player.position.x - B.blinkDest.x, player.position.z - B.blinkDest.z);
      spawnPuff(B.blinkDest.x, B.blinkDest.y + 1.3, B.blinkDest.z, 2.2, 0x15121f, 0.8, 0.6, 0.5);
      state.shake = Math.max(state.shake, 0.2);
      setBossMode('appear');
    }
  } else if (B.mode === 'appear') {
    // REAPARECE: brilho branco, cresce e estabiliza; fica vulnerável e depois parte para o ataque
    const k = Math.min(1, B.t / CFG.blinkAppear);
    emissive = 0xffffff; intensity = 3 - 2 * k;
    sc = CFG.bossScale * (0.5 + 0.5 * k);
    if (settings.flicker) bossVis.visible = Math.sin(B.t * 18) > -0.5 + k * 1.4;
    if (B.t >= CFG.blinkAppear) { if (B.fleeBlink || terrified()) { B.fleeBlink = false; B.chaseTime = 1.5; setBossMode('chase'); B.sub = 'cower'; B.subT = 1; } else { B.quick = true; setBossMode('windup'); } }
  } else if (B.mode === 'ceil' || B.mode === 'drop' || B.mode === 'possess') {
    emissive = B.mode === 'drop' ? 0xff3040 : 0xb45cff; intensity = 1.2;
  } else if (B.mode === 'dying') {
    const s = Math.max(0, 1 - B.t / 1.2);
    sc = CFG.bossScale * s;
    boss.rotation.y += dt * 10;
    emissive = 0xffffff; intensity = 3;
  }

  if (B.mode === 'dying') { dropMark.visible = false; lightFx.dark = Math.min(lightFx.dark, 0.01); }
  const onCeil = updateSpecials(dt);
  if (B.mode === 'hidden') { // sem corpo: sem física nem hitbox (y = -40 também o tira de qualquer teste de acerto)
    boss.position.y = -40; bossLight.intensity = 0; B.vel.set(0, 0, 0); B.launch = false; B.vy = 0;
    return;
  }
  // ----- FÍSICA DE CORPO RÍGIDO: arremessado, o boss voa, quica, rola e atravessa paredes de gesso -----
  B.wallCD = Math.max(0, B.wallCD - dt); B.ceilCD = Math.max(0, B.ceilCD - dt);
  const pos = boss.position;
  if (B.launch) {
    // resistência: bem pequena no ar; no chão, atrito constante + proporcional (desliza e pára de forma natural)
    const sp = Math.hypot(B.vel.x, B.vel.z);
    if (sp > 0) {
      const dec = (B.grounded ? CFG.groundDecel + sp * CFG.groundDrag : sp * CFG.airDrag) * dt;
      const k = Math.max(0, sp - dec) / sp;
      B.vel.x *= k; B.vel.z *= k;
    }
  } else {
    B.vel.multiplyScalar(Math.pow(0.001, dt)); // empurrões leves (sem estar "caído") somem rápido
  }
  B.hitOuter = false;
  // passos curtos (<= 0,4 u): a 78 u/s ele andaria ~4 u por quadro e ATRAVESSARIA paredes finas sem colidir
  const nSub = Math.min(16, Math.max(1, Math.ceil(Math.hypot(B.vel.x, B.vel.z) * dt / 0.4)));
  for (let i = 0; i < nSub; i++) {
    pos.x += B.vel.x * dt / nSub; pos.z += B.vel.z * dt / nSub;
    bossCollide();
  }
  if (B.mode === 'dash') smashWallsInDash();
  clampToRoom(pos, 0.9);

  // arremessado (ou avançando) contra móveis: destrói tudo no caminho
  const speedNow = B.vel.length();
  const smashing = (B.launch && speedNow > 8) || B.mode === 'dash';
  if (smashing) {
    propDir.copy(B.launch ? B.vel : B.dashDir).setY(0).normalize();
    for (const p of [...props]) {
      if (p.thrown || p.held) continue;
      if (Math.abs(p.obj.position.y - pos.y) > 3) continue;
      const dx = pos.x - p.obj.position.x, dz = pos.z - p.obj.position.z;
      const r = CFG.bossRadius + p.T.radius;
      if (dx * dx + dz * dz < r * r) {
        breakProp(p, propDir, 14);
        // só móveis grandes machucam o boss (tábuas e objetos pequenos não)
        if (B.launch && B.mode !== 'dying' && p.T.size === 'large') { damageBoss(CFG.smashSelfDamage); registerHit(0.05, 0.5, 'none'); }
      }
    }
  }

  // vertical: gravidade, quique no chão/degraus e batida no teto
  // flutuando, o fantasma vai para o andar do jogador ATRAVESSANDO o piso/teto (é um fantasma: não precisa de escada)
  const floating = !B.launch && B.mode !== 'stun' && B.mode !== 'dying' && B.mode !== 'grabbed';
  const gyB = groundY(pos.x, pos.z, floating ? player.position.y + 0.6 : pos.y + 0.5);
  const minY = gyB - 0.45 * B.tw; // deitado, o centro do corpo fica mais baixo
  if (onCeil || B.mode === 'grabbed') { /* altura controlada pelo modo (teto ou agarrado) */ }
  else if (!B.launch && Math.abs(B.vy) < 0.5 && B.mode !== 'dying') {
    B.vy = 0;
    pos.y += (minY - pos.y) * Math.min(1, dt * (Math.abs(minY - pos.y) > 1 ? 2.2 : 8)); // flutua acompanhando o piso e os degraus (devagar quando atravessa um andar)
  } else {
    B.vy -= CFG.gravityBoss * dt;
    pos.y += B.vy * dt;
    if (pos.y <= minY) {
      const imp = -B.vy;
      pos.y = minY;
      if (B.launch && imp > 5) {
        B.vy = imp * CFG.bounceFloor; B.vel.x *= 0.72; B.vel.z *= 0.72; // quica e perde um pouco de velocidade
        bossFloorImpact(imp);
      } else B.vy = 0;
    }
  }
  const maxY = ceilAt(pos.x, pos.z, Math.max(pos.y, gyB)) - 1.95; // a cabeça do boss não atravessa o teto
  if (pos.y > maxY && !onCeil) {
    pos.y = maxY;
    if (B.vy > 6 && B.launch && B.ceilCD <= 0) bossCeilingImpact();
    if (B.vy > 0) B.vy = -B.vy * 0.2;
  }
  B.grounded = pos.y <= minY + 0.03;
  if (B.mode === 'drop' && ((B.grounded && B.t > 0.08) || B.t > 2)) dropSlam();

  // terminou de deslizar: fica caído (B.lieT) e depois se levanta
  if (B.launch) {
    const sp = Math.hypot(B.vel.x, B.vel.z);
    if (B.grounded && sp < 2.5 && Math.abs(B.vy) < 1) {
      B.launch = false; B.vel.set(0, 0, 0); B.w.set(0, 0, 0);
      if (B.mode !== 'dying') { B.t = 0; B.stunDur = Math.max(0.35, B.lieT); }
    }
    // rastro: poeira levantada no chão (o antigo "eco" azul no ar saiu: era cartoon demais)
    B.trailT -= dt;
    if (B.trailT <= 0 && sp > 8) {
      B.trailT = 0.04;
      if (B.grounded && Math.random() < 0.6) spawnPuff(pos.x, 0.25 + gyB, pos.z, 0.8 + sp * 0.02, 0x6f6678, 0.8, 0.4, 1.2);
    }
  }

  // flutuar e olhar para o jogador
  B.bob += dt * 3;
  bossTop.position.y = BOSS_HEAD_Y + Math.sin(B.bob) * 0.05;
  animateGhost(dt, state.time + B.bob);
  if (ghostRig.ready) { // modelo com esqueleto: o estado do chefe escolhe o clipe
    const m = B.mode; let st = 'idle'; const o = {};
    if (m === 'chase') {
      // o passo acompanha a velocidade de verdade (sem "patinar"): parado = idle; devagar = andar; rápido = correr
      const v = Math.hypot(B.mv.x, B.mv.z);
      if (v < 0.35 || B.sub === 'stare') st = 'idle';
      else if (v < 2.4) { st = 'walk'; o.speed = THREE.MathUtils.clamp(v / 1.25, 0.6, 1.7); }
      else { st = 'run'; o.speed = THREE.MathUtils.clamp(v / 3.4, 0.7, 1.5); }
    }
    else if (m === 'windup') st = 'attack';
    else if (m === 'swipe') { st = 'attack'; o.speed = 2.2; }
    if (m === 'chase' && B.sub === 'cower') { st = 'hit'; o.speed = 0.25; }
    if (B.blockT > 0 && canGuard()) { st = 'hit'; o.speed = 0.6; }   // defendendo: encolhe com os braços na frente
    if (B.broken > 0 && m === 'chase') { st = 'down'; o.speed = 0.5; } // guarda quebrada: cambaleia
    if (m === 'grabbed') { st = 'fall'; o.speed = 1.6; }
    else if (m === 'dash') { st = 'run'; o.speed = 1.5; }
    else if (m === 'ceil') { st = 'crawl'; o.speed = B.aimed ? 0.3 : 1.3; }
    else if (m === 'drop') st = 'fall';
    else if (m === 'possess') st = 'cast';
    else if (m === 'stun') st = B.launch ? 'fall' : 'down';
    else if (m === 'dying') { st = 'death'; o.once = true; }
    ghostRig.play(st, o); ghostRig.update(dt, false); // animação contínua (o "tranco" de 14 quadros/s ficava esquisito com o modelo novo)
    bossVis.rotation.x = 0;
  }
  if (B.launch) {
    // corpo rígido: integra a velocidade angular (rolando no chão, cambalhota no ar)
    if (B.grounded) { rollW.set(B.vel.z, 0, -B.vel.x).multiplyScalar(0.9); B.w.lerp(rollW, 1 - Math.exp(-dt * 7)); }
    else B.w.multiplyScalar(Math.exp(-dt * 0.25));
    const wl = B.w.length();
    if (wl > 40) { B.w.multiplyScalar(40 / wl); }
    if (wl * dt > 1e-5) { dq.setFromAxisAngle(rollAxis.copy(B.w).divideScalar(wl), Math.min(wl, 40) * dt); B.q.premultiply(dq).normalize(); }
    boss.quaternion.copy(B.q);
    if (ghostRig.ready) boss.quaternion.copy(upQ.setFromEuler(upE.set(0, B.yaw, 0))); // modelo: a queda/rolagem vem do clipe (girar o corpo junto deixava ele de pé ou de cabeça para baixo)
  } else if (B.mode === 'dying') {
    // (o giro da morte já foi aplicado acima)
  } else if (B.mode === 'dash') {
    B.tw = 0;
  } else {
    // levantando: o corpo caído volta suavemente para a posição em pé olhando para o jogador
    if (B.mode === 'stun') B.tw = Math.min(B.tw, THREE.MathUtils.clamp((B.stunDur - B.t) / Math.min(0.7, Math.max(0.2, B.stunDur)), 0, 1));
    else B.tw = 0;
    const fleeing = B.mode === 'chase' && B.sub === 'retreat' && (B.fear || 0) > 35; // fugindo de medo: vira de costas e corre
    const mvv = Math.hypot(B.mv.x, B.mv.z);
    const walkAway = B.mode === 'chase' && mvv > 0.6 && (B.sub === 'circle' || B.sub === 'retreat'); // rodeando/recuando: olha para onde anda
    const targetYaw = walkAway ? Math.atan2(B.mv.x, B.mv.z) : Math.atan2(player.position.x - pos.x, player.position.z - pos.z) + (fleeing ? Math.PI : 0);
    let dyaw = targetYaw - B.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    B.yaw += dyaw * Math.min(1, dt * (B.mode === 'windup' ? 14 : 5));
    upQ.setFromEuler(upE.set(0, B.yaw, 0));
    if (B.tw > 0 && !ghostRig.ready) boss.quaternion.slerpQuaternions(upQ, B.q, B.tw * B.tw * (3 - 2 * B.tw)); else boss.quaternion.copy(upQ); // (o modelo deita pela animação)
    if (B.cl > 0.001) { flipQ.copy(upQ).multiply(ghostRig.ready && ghostRig.has('crawl') ? flipZ : flipX); boss.quaternion.slerpQuaternions(upQ, flipQ, B.cl * B.cl * (3 - 2 * B.cl)); } // de cabeça para baixo no teto
  }
  // o corpo gira em torno do CENTRO (e não dos pés): compensa o deslocamento do pivô
  pivotV.set(0, 0.9, 0).applyQuaternion(pivotQ.copy(boss.quaternion).invert()).sub(pivotC.set(0, 0.9, 0));
  bossVis.position.copy(pivotV);
  // NÃO ATRAVESSA O JOGADOR: os dois têm corpo; se encostarem, o fantasma é empurrado para fora (o avanço para em você)
  if (B.mode !== 'grabbed' && B.mode !== 'hidden' && B.mode !== 'dying' && B.mode !== 'ceil' && Math.abs(pos.y - player.position.y) < 1.6) {
    const ddx = pos.x - player.position.x, ddz = pos.z - player.position.z, dd = Math.hypot(ddx, ddz), minD = CFG.bossRadius + 0.45;
    if (dd < minD) {
      const nx = dd > 1e-4 ? ddx / dd : -Math.sin(look.yaw), nz = dd > 1e-4 ? ddz / dd : -Math.cos(look.yaw);
      pos.x = player.position.x + nx * minD; pos.z = player.position.z + nz * minD;
      const vn = B.vel.x * nx + B.vel.z * nz; if (vn < 0) { B.vel.x -= vn * nx; B.vel.z -= vn * nz; }
      const mn = B.mv.x * nx + B.mv.z * nz; if (mn < 0) { B.mv.x -= mn * nx; B.mv.z -= mn * nz; }
      if (B.mode === 'dash') B.t = Math.max(B.t, 99); // trombou em você: o avanço acaba aqui
    }
  }
  // MEDO VISÍVEL: o corpo treme (mais quanto mais medo), encolhido ele se agacha, e de vez em quando choraminga/grita
  const fr = (B.fear || 0) / 100;
  if (fr > 0.15 && !B.launch && B.mode !== 'dying' && B.mode !== 'hidden') {
    const amp = 0.012 + 0.05 * fr * fr;
    bossVis.position.x += (Math.random() - 0.5) * amp * 2; bossVis.position.z += (Math.random() - 0.5) * amp * 2;
    if (B.mode === 'chase' && B.sub === 'cower') bossVis.position.y -= 0.3;
    B.whimper = (B.whimper ?? 1) - dt;
    if (B.whimper <= 0) { B.whimper = 2.6 - 1.6 * fr + Math.random(); if (fr > 0.5) sfx.scream(0.18 + 0.25 * fr, bossAt(), 0.35, 'hit'); else sfx.whisper(bossAt()); }
  }

  // amassado ao levar golpe (squash & stretch)
  B.squash = Math.max(0, B.squash - dt * 5);
  const sq = ghostRig.ready ? 0.08 : 0.35; // o modelo com esqueleto deforma pouco (achatar muito parecia defeito)
  boss.scale.set(sc * (1 + sq * B.squash), sc * (1 - sq * B.squash), sc * (1 + sq * B.squash));

  // SEM CORES: o fantasma não brilha mais em azul/vermelho/laranja conforme o estado (os avisos ficam na animação,
  // no som e nas luzes da casa). Só um clarão branco rápido quando leva um golpe.
  const fl = B.flash > 0 ? B.flash / 0.12 : 0;
  bossMat.emissive.setHex(0xffffff); bossMat.emissiveIntensity = 0.9 * fl;
  bossSkin.emissive.setHex(0xffffff); bossSkin.emissiveIntensity = 0.9 * fl;
  if (ghostRig.ready) ghostRig.setEmissive(0xffffff, 0.7 * fl);
  void emissive; void intensity;
}

let realDtAudio = 0.016;
function animate() {
  rafId = requestAnimationFrame(animate);
  clock.update();
  let dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsed();
  // PAUSADO: sem mouse capturado o jogo não avança (só desenha o menu por cima)
  const pausedNow = !locked && !state.over;
  if (pausedNow !== audioPaused) { audioPaused = pausedNow; sfx.setPaused(pausedNow); } // pausa também congela o som
  if (!locked && !state.over) { updateHud(); renderer.render(scene, camera); return; }
  // hitstop: o jogo quase congela por um instante quando um golpe acerta
  const realDt = dt; realDtAudio = dt;
  if (!settings.hitstop) state.hitstop = 0;
  if (!settings.slowmo) state.slow = 0;
  if (state.hitstop > 0) { state.hitstop -= dt; dt *= 0.08; }
  else if (state.slow > 0) { state.slow -= dt; dt *= 0.3; } // câmera lenta depois do congelamento do impacto
  state.flash = Math.max(0, state.flash - realDt * 6);
  flashEl.style.opacity = (state.flash * 0.7).toFixed(3);

  state.hurtCooldown = Math.max(0, state.hurtCooldown - dt);

  if (!state.over) state.time += dt;
  if (!state.over || state.over === 'win') updatePlayer(dt);
  updateBoss(dt);
  updateProps(dt, t);
  updateDebris(dt);
  updatePuffs(dt);
  updateShockwaves(dt);
  updateLights(dt);
  updateHeld(t);

  // combo expira; caixas caem do teto se houver poucos objetos
  state.comboT = Math.max(0, state.comboT - dt);
  if (state.comboT <= 0) state.combo = 0;
  state.propTimer += dt;
  if (state.propTimer >= CFG.propSpawnEvery && !state.over) {
    state.propTimer = 0;
    if (props.filter((p) => p.T.size === 'small').length < CFG.minSmallProps) {
      const sp = randomSpot(); if (sp) createProp(SMALL_TYPES[Math.floor(Math.random() * SMALL_TYPES.length)], sp.x, sp.z, sp.ceil - 0.6);
    }
  }

  // cerveja nova nasce pelo mapa (cai do teto); mais rápido quando a vida está baixa
  state.vodkaT = (state.vodkaT ?? 0) + dt;
  if (state.vodkaT >= CFG.vodkaSpawnEvery * (state.hp < 40 ? 0.5 : 1) && !state.over) {
    state.vodkaT = 0;
    if (props.filter((p) => p.type === 'vodka' && !p.empty).length < CFG.vodkaMax) {
      const sp = randomSpot(); if (sp) createProp('vodka', sp.x, sp.z, sp.ceil - 0.6);
    }
  }

  // lanterna na mão (filha da câmera) com leve tremida
  lantern.intensity = 30 + Math.sin(t * 17) * 1.5;
  if (state.boomT > 0) { state.boomT -= dt; boomLight.intensity = Math.max(0, 100 * state.boomT); } else boomLight.intensity = 0;

  // câmera nos olhos do jogador, olhando para yaw/pitch
  const moving = keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
  const bob = moving && state.dodgeT < 0 ? Math.sin(t * 9) * 0.03 : 0; // balanço leve ao andar
  state.eyeY += (player.position.y - state.eyeY) * Math.min(1, dt * 14);
  camera.position.set(player.position.x, state.eyeY + EYE_HEIGHT + bob, player.position.z);
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
  const gulp = state.drinkT > 0 ? Math.sin(Math.PI * (1 - state.drinkT / CFG.vodkaDrinkTime)) : 0; // a cabeça inclina para trás no gole
  camera.rotation.set(look.pitch + aPitch + state.kick.pitch + gulp * 0.12, look.yaw + aYaw, aRoll + state.kick.roll);
  // tremor de impacto (posição + inclinação lateral)
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt * 2.5);
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.15;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.15;
    camera.rotation.z += (Math.random() - 0.5) * state.shake * 0.08;
  }
  // áudio: ouvidos na câmera; tensão sobe quando o fantasma está perto (batimento e zumbido)
  sfx.listener(camera);
  sfx.presence(bossAt(), B.mode);
  const bd = Math.hypot(boss.position.x - player.position.x, boss.position.z - player.position.z);
  sfx.setTension(B.mode === 'dying' ? 0 : THREE.MathUtils.clamp(1 - (bd - 2) / 8, 0, 1));
  sfx.tick(dt, { walking: !!moving && state.dodgeT < 0, listenerPos: player.position });
  sfx.watchdog(realDtAudio); // vigia do áudio: se a saída travar (mudo/valor inválido), reconstrói

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
if (location.search.includes('debug')) window.__gp = { camera, renderer, canGrabBoss, touchHold, startDodge, interact, keys, ceilAt, ghostRig, decals, scene, dropMark, lightFx, startLightEvent, ambient, bulbs, sfx, state, B, boss, player, CFG, look, fist, hands, MOVES, startPunch, applyMoveHit, props, debris, createProp, breakProp, camera, settings, throwHeld, setBossMode, solids, allPanels, breakWall, groundY, puffs, B_q: B.q };

restart();

// ---------- Hot reload: guardar / restaurar o estado ----------
function saveState() {
  return {
    state: { ...state, dodgeDir: state.dodgeDir.toArray() },
    look: { ...look },
    player: player.position.toArray(),
    boss: boss.position.toArray(),
    B: { ...B, vel: B.vel.toArray(), dashDir: B.dashDir.toArray(), q: B.q.toArray(), w: B.w.toArray() },
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
  const { vel, dashDir, q, w, ...b } = d.B;
  Object.assign(B, b);
  B.vel.fromArray(vel);
  B.dashDir.fromArray(dashDir);
  if (q) B.q.fromArray(q);
  if (w) B.w.fromArray(w);
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
    if (locked) sfx.start();
    console.log('[hot reload] código atualizado, luta mantida');
  }
  import.meta.hot.dispose((data) => {
    dropHeld(); // objeto na mão volta para o chão antes de guardar o estado
    data.saved = saveState();
    data.canvas = renderer.domElement;
    data.gl = renderer.getContext();
    cancelAnimationFrame(rafId);
    sfx.dispose();
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
