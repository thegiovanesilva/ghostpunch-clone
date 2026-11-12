import * as THREE from 'three';
import { createAudio } from './audio.js';

// ============================================================
// GHOSTPUNCH MINI - Etapa 1
// Cena, sala, jogador (WASD + mouse), soco e fantasma que persegue.
// ============================================================

// ---------- Configuração (fácil de ajustar) ----------
const CFG = {
  roomHalf: 20,         // metade do lado da casa (40x40, com paredes internas e escadas)
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
    light: { speed: 17, up: 3.5, stagger: 0.45, squash: 0.45, hitstop: 0.05, shake: 0.35 }, // soco normal: empurrãozinho, dá para combar
    heavy: { speed: 78, up: 7.5, stagger: 2.40, squash: 1.00, hitstop: 0.16, shake: 1.00, spin: 18, big: true }, // soco forte: manda longe e para o alto
    cross: { speed: 38, up: 6.0, stagger: 1.30, squash: 0.80, hitstop: 0.10, shake: 0.70, big: true }, // 3º golpe do combo: finalizador
    upper: { speed: 8,  up: 22,  stagger: 1.90, squash: 1.00, hitstop: 0.13, shake: 0.85, spin: 14, big: true }, // uppercut: quase não empurra, LANÇA para cima
    slam:  { speed: 52, up: 9.0, stagger: 1.90, squash: 1.00, hitstop: 0.14, shake: 1.00, big: true }, // esmagar: onda em área, empurra para longe de você
    // OBJETOS: efeito bem mais contido que os golpes do jogador (squash < 0,9: sem clarão, sem luz tremendo, sem grito de arremesso)
    barrel: { speed: 30, up: 2.2, stagger: 0.70, squash: 0.60, hitstop: 0.05, shake: 0.30 },
    tv:     { speed: 28, up: 2.0, stagger: 0.70, squash: 0.60, hitstop: 0.05, shake: 0.30 },
    ball:   { speed: 38, up: 1.6, stagger: 0.80, squash: 0.70, hitstop: 0.06, shake: 0.35 }, // bola de boliche: pesada e rápida
    pillow: { speed: 4,  up: 0.4, stagger: 0.20, squash: 0.15, hitstop: 0.01, shake: 0.05 }, // almofada: faz cócegas
    vase:  { speed: 14, up: 1.0, stagger: 0.35, squash: 0.35, hitstop: 0.03, shake: 0.15 },
    beer:  { speed: 12, up: 0.8, stagger: 0.30, squash: 0.30, hitstop: 0.03, shake: 0.12 }, // garrafa: estilhaça e deixa o fantasma tonto de leve
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
  beerHeal: 25,          // vida recuperada ao beber uma garrafa de cerveja (tecla B)
  beerMax: 8,            // máximo de garrafas no mapa
  beerSpawnEvery: 8,     // seg: nasce uma garrafa nova (mais rápido se a vida estiver baixa)
  // --- boss ---
  bossName: 'O Fantasma da Casa',
  bossMaxHp: 1200,      // 10x mais vida: a luta é longa e engraçada (cada soco é uma fração pequena)
  bossScale: 1.8,
  bossRadius: 1.0,
  bossChaseSpeed: 2.4,
  bossWindup: 0.8,      // tempo de aviso antes do ataque
  bossDashSpeed: 14,
  bossDashTime: 0.5,
  bossRecover: 1.3,     // fica atordoado: leva dano dobrado
  bossContactDamage: 3,   // (reduzido: era 6)
  bossDashDamage: 9,      // (reduzido: era 18)
  // --- habilidades especiais (Etapa 20) ---
  specialCooldown: 9,     // seg mínimos entre teto / possessão / apagão (fase 2: 6)
  specialChance: 0.5,     // chance de usar uma especial ao fim da perseguição
  ceilCrawl: 3.0,         // seg rastejando no teto antes de mirar
  ceilAim: 0.9,           // seg parado em cima do alvo (mancha no chão avisa)
  ceilDropDamage: 12, ceilDropRadius: 3.4,
  possessMax: 3, possessDamage: 6, possessSpeed: 24,
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
const settings = { sens: 1, fov: 80, vol: 0.7, muted: false, flicker: true, slowmo: true, hitstop: true, shadows: !touchMode }; // no celular as sombras começam desligadas
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
} catch { /* sem armazenamento: usa o padrão */ }
function saveSettings() { try { localStorage.setItem('ghostpunch-settings', JSON.stringify(settings)); } catch { /* ignora */ } }

// Som: tudo sintetizado em audio.js (sem arquivos). O contexto de áudio só nasce no clique em Jogar.
const sfx = createAudio({ vol: settings.vol, muted: settings.muted });
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
// Tudo é cor lisa: as texturas autorais ainda não foram decididas. Para colocar a sua, use `map:` nos materiais abaixo.

// ---------- Sala ----------
const H = CFG.roomHalf;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(H * 2, H * 2),
  new THREE.MeshStandardMaterial({ color: 0x3a2718, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const WALL_H = 6.5; // pé-direito alto: o uppercut lança o boss bem para cima
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2a4d, roughness: 1 });

// ---------- COLISÃO: tudo que é sólido (paredes, degraus, plataformas) é uma caixa alinhada aos eixos (AABB) ----------
// { x0,x1,z0,z1, top } -> ocupa do chão até `top`. Quem tem altura (y) maior que `top` passa por cima (é assim que se sobe um degrau).
const solids = [];       // sólidos ativos (os painéis quebrados saem daqui)
const allPanels = [];    // todos os painéis de parede quebráveis (para reconstruir no restart)
const solidGeo = new THREE.BoxGeometry(1, 1, 1);
function addSolid(x0, x1, z0, z1, top, { outer = false, breakable = false, material = wallMat, y0 = 0 } = {}) {
  const mesh = new THREE.Mesh(solidGeo, material);
  mesh.scale.set(x1 - x0, top - y0, z1 - z0);
  mesh.position.set((x0 + x1) / 2, (top + y0) / 2, (z0 + z1) / 2);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const sol = { x0, x1, z0, z1, top, mesh, outer, breakable, hp: breakable ? 2 : Infinity, alive: true };
  solids.push(sol);
  if (breakable) allPanels.push(sol);
  return sol;
}
// paredes externas (espessura 1, a face de dentro fica em ±H)
addSolid(-H - 1, H + 1, -H - 1, -H, WALL_H, { outer: true });
addSolid(-H - 1, H + 1, H, H + 1, WALL_H, { outer: true });
addSolid(-H - 1, -H, -H, H, WALL_H, { outer: true });
addSolid(H, H + 1, -H, H, WALL_H, { outer: true });

// paredes internas. ESTRUTURAIS (papel de parede + rodapé de madeira, indestrutíveis) separam o salão das alas;
// as de GESSO (divisórias finas, em painéis de 3 m) ficam só nas cruzadas e quebram.
const plasterMat = new THREE.MeshStandardMaterial({ color: 0x8f8196, roughness: 1 }); // gesso: mais claro que as paredes estruturais
const WT = 0.6; // espessura das paredes internas
const wallpaperShared = new THREE.MeshStandardMaterial({ color: 0x4b3a5c, roughness: 1 });
function wallpaperMat() { return wallpaperShared; }
const trimMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.8 });
// batente de porta (só visual): dois montantes e uma verga sobre o vão (quem passa tem 3,7 m de altura livre)
function doorFrame(cx, cz, len, alongZ) {
  const w = alongZ ? WT + 0.25 : len, d = alongZ ? len : WT + 0.25;
  const head = new THREE.Mesh(solidGeo, wallpaperMat(len)); head.scale.set(alongZ ? WT : len, WALL_H - 3.7, alongZ ? len : WT); head.position.set(cx, 3.7 + (WALL_H - 3.7) / 2, cz); scene.add(head);
  const trim = new THREE.Mesh(solidGeo, trimMat); trim.scale.set(w, 0.22, d); trim.position.set(cx, 3.7, cz); scene.add(trim);
  for (const sgn of [-1, 1]) {
    const post = new THREE.Mesh(solidGeo, trimMat);
    post.scale.set(alongZ ? WT + 0.25 : 0.22, 3.7, alongZ ? 0.22 : WT + 0.25);
    post.position.set(alongZ ? cx : cx + sgn * len / 2, 1.85, alongZ ? cz + sgn * len / 2 : cz); scene.add(post);
  }
}
function structRunX(x, segs, gaps) {
  for (const [a, b] of segs) addSolid(x - WT / 2, x + WT / 2, a, b, WALL_H, { material: wallpaperMat(b - a) });
  for (const [a, b] of gaps) doorFrame(x, (a + b) / 2, b - a, true);
}
function plasterRunZ(z, segs, gaps) {
  for (const [a, b] of segs) for (let x = a; x < b - 0.01; x += 3) addSolid(x, Math.min(b, x + 3), z - WT / 2, z + WT / 2, WALL_H, { breakable: true, material: plasterMat });
  for (const [a, b] of gaps) doorFrame((a + b) / 2, z, b - a, false);
}
structRunX(-9, [[-20, -6], [-2, 6], [10, 20]], [[-6, -2], [6, 10]]);
structRunX(9, [[-20, -13], [-9, 2], [6, 20]], [[-13, -9], [2, 6]]);
plasterRunZ(2, [[-20, -17], [-13, -9]], [[-17, -13]]);   // ala oeste: sala de estar (norte) / depósito (sul)
plasterRunZ(-4, [[9, 13], [17, 20]], [[13, 17]]);        // ala leste: cozinha (norte) / biblioteca e mezanino (sul)

// escadas e plataformas (madeira): degraus de 0,43 m, menores que o passo máximo (0,55 m) dos personagens
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.85 });
const woodTop = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.8 });
const STAIR_RISE = 0.43, STAIR_RUN = 0.9, STAIR_N = 6, PLAT_TOP = STAIR_RISE * STAIR_N;
function addStairsZ(x0, x1, zBottom, dir) { // sobe andando na direção `dir` (+1 ou -1) em z
  for (let k = 1; k <= STAIR_N; k++) {
    const a = zBottom + dir * (k - 1) * STAIR_RUN, b = zBottom + dir * k * STAIR_RUN;
    addSolid(x0, x1, Math.min(a, b), Math.max(a, b), k * STAIR_RISE, { material: k % 2 ? woodMat : woodTop });
  }
}
addSolid(-8.7, 8.7, -H, -15, PLAT_TOP, { material: woodTop });   // ANDAR DE CIMA norte: largura do salão inteira
addStairsZ(-1.5, 1.5, -9.6, -1);
// parapeito na borda (1 m de altura); o vão entre x = 4 e 7 é a "janela de pulo": quem anda por ali cai no salão
for (const [x0, x1] of [[-8.7, -2], [2, 4], [7, 8.7]]) addSolid(x0, x1, -15.1, -14.9, PLAT_TOP + 1, { material: woodMat, y0: PLAT_TOP });
addSolid(15, H, 11.6, H, PLAT_TOP, { material: woodTop });   // mezanino sudeste
addStairsZ(16, 19, 6.2, 1);
// parapeitos do mezanino sudeste (a escada entra pelo meio da borda sul)
addSolid(14.9, 15.1, 11.6, H, PLAT_TOP + 1, { material: woodMat, y0: PLAT_TOP });
addSolid(15, 16, 11.5, 11.7, PLAT_TOP + 1, { material: woodMat, y0: PLAT_TOP });
addSolid(19, H, 11.5, 11.7, PLAT_TOP + 1, { material: woodMat, y0: PLAT_TOP });

// altura do chão num ponto: o topo mais alto que dá para "pisar" (<= maxTop)
function groundY(x, z, maxTop = 0) {
  let g = 0;
  for (const s of solids) if (s.top > g && s.top <= maxTop && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) g = s.top;
  return g;
}
// círculo (raio r) contra as caixas: empurra para fora. Sólidos mais baixos que y+stepH são pisáveis (não bloqueiam).
// `only(s)` filtra quais sólidos contam. `hit(s, nx, nz, depth)` é chamado em cada contato; se devolver true o sólido é ignorado (ex.: parede quebrou)
function resolveSolids(pos, r, y, stepH, only = null, hit = null) {
  let touched = false;
  for (let it = 0; it < 3; it++) {
    let any = false;
    for (const s of [...solids]) {
      if (!s.alive || s.top <= y + stepH || (only && !only(s))) continue;
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
// algum sólido alto (parede/plataforma) toca este círculo? (sem empurrar; usado por projéteis)
function touchingSolid(x, z, r, y, only = null) {
  for (const s of solids) {
    if (s.top <= y || (only && !only(s))) continue;
    const cx = THREE.MathUtils.clamp(x, s.x0, s.x1), cz = THREE.MathUtils.clamp(z, s.z0, s.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return s;
  }
  return null;
}

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(H * 2, H * 2),
  new THREE.MeshStandardMaterial({ color: 0x1b1428, roughness: 1 })
);
ceiling.rotation.x = Math.PI / 2; // virada para baixo
ceiling.position.y = WALL_H;
scene.add(ceiling);

// ---------- Luzes ----------
const AMBIENT0 = 0.55, MOON0 = 0.5, BULB0 = 14;
const ambient = new THREE.AmbientLight(0x4a3f7a, AMBIENT0);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x8fa0ff, MOON0);
moon.position.set(-8, 16, 6);
moon.castShadow = true;
moon.shadow.camera.left = moon.shadow.camera.bottom = -H - 2;
moon.shadow.camera.right = moon.shadow.camera.top = H + 2;
moon.shadow.mapSize.set(2048, 2048); // sala maior: mais resolução para a sombra não ficar borrada
scene.add(moon);

// seis lâmpadas penduradas no teto (fio + bulbo + luz pontual). Piscam junto com a sala (updateLights)
// (só 5 têm luz de verdade; as outras duas são só o bulbo aceso: cada luz pontual custa em todos os pixels da tela)
const bulbs = [[-14, -9, 1], [14, -11, 1], [0, -5, 1], [-14, 11, 1], [14, 4, 0], [0, 11, 1], [0, -18, 0]].map(([x, z, lit]) => {
  const g = new THREE.Group();
  g.position.set(x, WALL_H, z);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  cord.position.y = -0.4;
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), bulbMat);
  bulb.position.y = -0.9;
  const light = lit ? new THREE.PointLight(0xffd9a0, BULB0, 20, 1.6) : null;
  if (light) light.position.y = -1.0;
  g.add(cord, bulb);
  if (light) g.add(light);
  scene.add(g);
  return { light, bulbMat };
});

// ---------- Decoração do cenário (não bloqueia nada: só deixa a casa com cara de casa) ----------
const decoBox = new THREE.BoxGeometry(1, 1, 1); // (o boxGeo dos objetos só é criado mais abaixo)
function floorPatch(w, d, x, z, color) { // remendo no chão (tapete, piso da cozinha), um pouco acima do piso para não "brigar" com ele
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); m.receiveShadow = true;
  scene.add(m);
}
floorPatch(9, 7, -14.5, -13.5, 0x4a1722);   // sala de estar: tapete vermelho-escuro
floorPatch(3.8, 17, 0, -0.9, 0x3a1020);        // passadeira do salão até a escada
floorPatch(10, 10, 14.5, -12, 0x4d4a55);       // cozinha: piso mais claro
// janela: moldura + vidro azulado (emissivo = luar) + travessas; (x, z) na parede, `ry` aponta para dentro da sala
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.9 });
const glassMat = new THREE.MeshBasicMaterial({ color: 0x28386e });
function addWindow(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 3.4, z); g.rotation.y = ry;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), glassMat); pane.position.z = 0.02;
  g.add(pane);
  for (const [w, h, px, py] of [[2.5, 0.15, 0, 1.4], [2.5, 0.15, 0, -1.4], [0.15, 2.9, -1.2, 0], [0.15, 2.9, 1.2, 0], [0.08, 2.6, 0, 0], [2.2, 0.08, 0, 0]]) {
    const b = new THREE.Mesh(decoBox, frameMat); b.scale.set(w, h, 0.12); b.position.set(px, py, 0.05); g.add(b);
  }
  scene.add(g);
}
// quadros: moldura dourada + tela escura com um rosto pálido (terror)
function addPicture(x, y, z, ry, w, h, face) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  const frame = new THREE.Mesh(decoBox, new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.6 })); frame.scale.set(w + 0.2, h + 0.2, 0.08);
  const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ roughness: 1, color: face ? 0x241c2c : 0x1b2a22 }));
  canvasM.position.z = 0.05;
  g.add(frame, canvasM); scene.add(g);
}
const WI = H - 0.02; // face interna das paredes
for (const x of [-15, -4, 4, 15]) { addWindow(x, WI * -1 + 0.05, 0); addWindow(x, WI - 0.05, Math.PI); } // paredes norte e sul
for (const z of [-14, -8, 6, 14]) addWindow(WI - 0.05, z, -Math.PI / 2);                               // leste
for (const z of [-14, -6, 10, 16]) addWindow(-WI + 0.05, z, Math.PI / 2);                              // oeste
addPicture(-11, 3.4, -WI + 0.06, 0, 1.2, 1.6, true);
addPicture(11, 3.4, -WI + 0.06, 0, 1.6, 1.1, false);
addPicture(-12, 3.4, WI - 0.06, Math.PI, 1.0, 1.4, true);
addPicture(11, 3.4, WI - 0.06, Math.PI, 1.5, 1.0, false);
addPicture(-WI + 0.06, 3.4, -10, Math.PI / 2, 1.2, 1.6, true);
addPicture(-WI + 0.06, 3.4, 13, Math.PI / 2, 1.3, 1.0, false);
addPicture(WI - 0.06, 3.4, 0, -Math.PI / 2, 1.3, 1.0, false);
addPicture(WI - 0.06, 3.4, -18, -Math.PI / 2, 1.0, 1.4, true);
// porta da entrada, no meio da parede sul (de onde o jogador veio)
{
  const g = new THREE.Group(); g.position.set(0, 0, WI - 0.06); g.rotation.y = Math.PI;
  const door = new THREE.Mesh(decoBox, new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.8 })); door.scale.set(2.2, 3.6, 0.1); door.position.y = 1.8;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a15a, roughness: 0.3 })); knob.position.set(0.8, 1.7, 0.1);
  const top = new THREE.Mesh(decoBox, frameMat); top.scale.set(2.6, 0.2, 0.14); top.position.y = 3.7;
  for (const sx of [-1.2, 1.2]) { const p = new THREE.Mesh(decoBox, frameMat); p.scale.set(0.2, 3.8, 0.14); p.position.set(sx, 1.9, 0); g.add(p); }
  g.add(door, knob, top); scene.add(g);
}
// vigas no teto
for (const z of [-15, -10, -5, 0, 5, 10, 15]) {
  const b = new THREE.Mesh(decoBox, frameMat); b.scale.set(H * 2, 0.3, 0.4); b.position.set(0, WALL_H - 0.15, z); scene.add(b);
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
  if (e.code === 'KeyT') { settings.slowmo = !settings.slowmo; if (!settings.slowmo) state.slow = 0; refreshOptionLabels(); saveSettings(); state.moveNameT = 1; elMoveName.textContent = settings.slowmo ? 'CÂMERA LENTA: LIGADA' : 'CÂMERA LENTA: DESLIGADA'; } // T = liga/desliga a câmera lenta
  if (e.code === 'KeyM') { settings.muted = sfx.toggleMute(); refreshOptionLabels(); saveSettings(); } // M = mudo
  // P pausa / continua (Esc também pausa: o navegador solta o mouse sozinho)
  if (e.code === 'KeyP') { if (locked) document.exitPointerLock(); else if (state.started) lockMouse(); }
  if (!locked) return; // pausado: ignora as ações do jogo
  if (e.code === 'Space') { e.preventDefault(); startPunch('jab'); }
  if (e.code === 'KeyE') startPunch('heavy'); // soco forte (alternativa ao botão direito)
  if (e.code === 'KeyQ') startPunch('upper'); // uppercut
  if (e.code === 'KeyC') startPunch('slam');  // esmagar (área)
  if (e.code === 'KeyF') interact();       // pegar / soltar objeto
  if (e.code === 'KeyB') drinkBeer();      // beber cerveja (recupera vida)
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
    #tui .stick { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); background: rgba(255,255,255,.08); display: none; pointer-events: none; }
    #tui .stick i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: rgba(255,122,176,.55); border: 2px solid rgba(255,255,255,.6); }
    #tui .tb { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,.55); background: rgba(40,20,60,.55); color: #fff; font: 800 11px system-ui, sans-serif; letter-spacing: .5px;
               display: flex; align-items: center; justify-content: center; text-align: center; touch-action: none; padding: 0; }
    #tui .tb:active, #tui .tb.down { background: rgba(255,122,176,.75); }
    #tui .tb.cd { opacity: .45; }
    #tui .tb.main { background: rgba(179,38,94,.7); font-size: 14px; }
    #tpause { position: fixed; top: 10px; right: 10px; z-index: 5; width: 44px; height: 44px; border-radius: 10px; border: 2px solid rgba(255,255,255,.5); background: rgba(40,20,60,.6); color: #fff; font-size: 20px; display: none; }
    body.touch #tpause { display: block; }
    #rotate { position: fixed; inset: 0; z-index: 9; background: #07060c; color: #ffd1e6; display: none; align-items: center; justify-content: center; text-align: center; font-size: 20px; padding: 24px; }
    @media (orientation: portrait) { body.touch #rotate { display: flex; } }
    @media (max-height: 460px) { #menu .panel, #menu > div { max-height: 92vh; overflow-y: auto; } }
  `;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'tui';
  ui.innerHTML = `<div class="zone" id="tz-look"></div><div class="zone" id="tz-move"></div><div class="stick" id="tstick"><i></i></div>`;
  const defs = [ // [id, rótulo, direita, baixo, tamanho, classe]
    ['jab', 'SOCO', 20, 20, 96, 'main'], ['heavy', 'FORTE', 126, 28, 68, ''], ['upper', 'UPPER', 24, 128, 62, ''],
    ['slam', 'ESMAGAR', 94, 114, 62, ''], ['dodge', 'ESQUIVA', 164, 106, 58, ''],
  ];
  for (const [id, label, r, b, size, cls] of defs) {
    const el = document.createElement('button'); el.className = 'tb ' + cls; el.textContent = label; touchBtns[id] = el;
    el.style.cssText = `right:${r}px;bottom:${b}px;width:${size}px;height:${size}px`; ui.appendChild(el);
  }
  for (const [id, label, l, b] of [['grab', 'PEGAR', 22, 196], ['beer', 'BEBER', 92, 196]]) {
    const el = document.createElement('button'); el.className = 'tb'; el.textContent = label; touchBtns[id] = el;
    el.style.cssText = `left:${l}px;bottom:${b}px;width:58px;height:58px`; ui.appendChild(el);
  }
  document.body.appendChild(ui);
  const pause = document.createElement('button'); pause.id = 'tpause'; pause.textContent = '❚❚'; document.body.appendChild(pause);
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.textContent = 'Gire o celular para o modo paisagem (deitado) para jogar'; document.body.appendChild(rot);
  disposers.push(() => { css.remove(); ui.remove(); pause.remove(); rot.remove(); });

  const act = { jab: () => startPunch('jab'), heavy: () => startPunch('heavy'), upper: () => startPunch('upper'), slam: () => startPunch('slam'), dodge: () => startDodge(), grab: () => interact(), beer: () => drinkBeer() };
  for (const id in act) {
    on(touchBtns[id], 'pointerdown', (e) => { e.preventDefault(); touchBtns[id].setPointerCapture?.(e.pointerId); touchBtns[id].classList.add('down');
      if (state.over) { restart(); return; }
      if (locked) act[id](); });
    on(touchBtns[id], 'pointerup', () => touchBtns[id].classList.remove('down'));
    on(touchBtns[id], 'pointercancel', () => touchBtns[id].classList.remove('down'));
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
  elMenuTitle.textContent = state.started ? 'Pausado' : 'Ghostpunch Mini';
  elMenuSub.textContent = state.started ? 'O jogo está parado' : 'Boss fight em primeira pessoa';
  elBtnPlay.textContent = state.started ? 'Continuar' : 'Jogar';
  elBtnRestart.style.display = state.started ? '' : 'none';
}
function refreshOptionLabels() {
  elOptSens.value = settings.sens; elOptSensV.textContent = settings.sens.toFixed(2) + 'x';
  elOptFov.value = settings.fov;   elOptFovV.textContent = settings.fov + '°';
  elOptFlicker.checked = settings.flicker;
  elOptSlow.checked = settings.slowmo;
  elOptStop.checked = settings.hitstop;
  elOptShadow.checked = settings.shadows;
  elOptVol.value = settings.vol;   elOptVolV.textContent = settings.muted ? 'mudo' : Math.round(settings.vol * 100) + '%';
}
refreshOptionLabels();
if (!settings.shadows) applyShadows();

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
on(elOptFlicker, 'change', () => { settings.flicker = elOptFlicker.checked; saveSettings(); });
on(elOptSlow, 'change', () => { settings.slowmo = elOptSlow.checked; saveSettings(); });
on(elOptShadow, 'change', () => { settings.shadows = elOptShadow.checked; applyShadows(); saveSettings(); });
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
    if (Math.random() < 0.6) sfx.boneCrack(bossAt(), 2); // o pescoço estala a cada espasmo
  }
  let armX = Math.sin(t * 1.3) * 0.12, armSpread = 0.12, lean = 0.12, headLoll = null;
  if (B.mode === 'windup') {                 // aviso: ergue os braços para frente e inclina o corpo
    const k = Math.min(1, B.t / (CFG.bossWindup * (B.phase2 ? 0.7 : 1)));
    armX = -1.5 * k + Math.sin(t * 40) * 0.06 * k; armSpread = 0.05; lean = 0.12 + 0.35 * k; headLoll = 0; ghostAnim.headZ += (Math.sin(t * 50) * 0.08 - ghostAnim.headZ) * 0.5;
  } else if (B.mode === 'dash') {            // avanço: braços esticados à frente, em garras
    armX = -1.75; armSpread = 0.02; lean = 0.55; headLoll = 0;
  } else if (B.mode === 'ceil') {            // rasteja no teto: garras estendidas
    armX = -1.9 + Math.sin(t * 14) * 0.25; armSpread = 0.35; lean = 0.3; headLoll = 0;
  } else if (B.mode === 'possess') {         // braços erguidos, tremendo, controlando os móveis
    armX = -2.7 + Math.sin(t * 38) * 0.08; armSpread = 0.6; lean = -0.1; headLoll = 0;
  } else if (B.mode === 'drop') {
    armX = -2.4; armSpread = 0.9; lean = 0.2; headLoll = 0;
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
  else if (m === 'appear') sfx.flicker(3);
  if (m === 'windup') sfx.flicker(4);
  if (m === 'windup') sfx.windup(CFG.bossWindup * (B.phase2 ? 0.7 : 1), bossAt()); // gemido que sobe avisando o ataque
  else if (m === 'dash') { sfx.dash(bossAt()); sfx.flicker(1); }
  else if (m === 'dying') sfx.death(bossAt());
}

function bossReset() {
  B.hp = CFG.bossMaxHp; B.phase2 = false; B.flash = 0; B.vel.set(0, 0, 0); B.launch = false; B.stunDur = 0; B.vy = 0; B.squash = 0; B.spin = 10;
  B.chaseTime = 2.5; B.tw = 0; B.w.set(0, 0, 0); B.q.identity(); B.lieT = 0; B.wallCD = 0; B.ceilCD = 0; B.blinkCD = 3; B.quick = false;
  B.specialCD = 5; B.cl = 0; B.poss = []; lightFx.dark = 0; dropMark.visible = false;
  setBossMode('chase');
  boss.position.set(0, 0, -9);
  boss.scale.setScalar(CFG.bossScale);
  boss.rotation.set(0, 0, 0);
  bossVis.position.set(0, 0, 0);
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
  sfx.dodge();
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
  if (M.area) sfx.whoosh(0.4, M.hitAt * M.dur * 0.5);
  else sfx.whoosh({ jab: 0.3, cross: 0.6, heavy: 1, upper: 0.75 }[kind], M.hitAt * M.dur * 0.45);
}

const fwd = new THREE.Vector3();
const toBoss = new THREE.Vector3();

// dano no boss (usado pelo soco e pela batida na parede)
function damageBoss(amount) {
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
function registerHit(stop, squash = 1) {
  state.hitstop = Math.max(state.hitstop, stop);
  state.combo++;
  state.comboT = 2;
  B.squash = squash;
  if (squash >= 0.9) startLightEvent('hit'); // golpe forte faz a luz tremer
  if (squash >= 0.9) state.flash = Math.max(state.flash, 0.35);
  sfx.hit(squash, 1 + Math.min(state.combo, 8) * 0.05); // o tom sobe a cada golpe do combo
  sfx.bossHurt(squash, bossAt());
}

// todo golpe desloca o boss: velocidade horizontal + pulinho, e ele fica tonto por um tempo
// `atk` é um perfil de CFG.attacks (leve, pesado, ou o objeto que acertou); `boost` > 1 reforça tudo
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
  B.lieT = Math.min(2.6, atk.stagger + (boost - 1) * 1.2);         // quanto tempo fica caído depois de parar de deslizar
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

function applyMoveHit(kind) {
  const M = MOVES[kind];
  fwd.set(0, 0, -1).applyQuaternion(player.quaternion);
  state.kick.pitch += M.kick;                       // a câmera dá um tranco no impacto
  state.kick.roll += (state.atk?.hand === 1 ? -1 : 1) * M.roll * 1.5;
  if (M.area) { applySlam(M); return; }

  // --- boss: SEMPRE leva dano e é empurrado ---
  if (B.mode !== 'dying') {
    const d = Math.abs(boss.position.y - player.position.y) < 3.4 ? punchDirTo(boss.position, CFG.bossRadius, M.range) : null;
    if (d) {
      const atk = CFG.attacks[M.atk];
      const air = boss.position.y > 0.5; // boss no ar: combo aéreo (juggle) = mais dano e ele continua subindo
      damageBoss(M.dmg * (air ? 1.5 : 1));
      launchBoss(d, atk);
      if (air) B.vy = Math.max(B.vy, 8);
      registerHit(atk.hitstop, atk.squash);
      state.shake = atk.shake;
      state.fovKick = M.fov; // o campo de visão "dá um soco" no impacto
      if (atk.speed >= 35) { // golpes pesados: onda de choque no ponto do impacto e câmera lenta
        spawnShockwave(boss.position, atk.speed >= 60 ? 4.5 : 3);
        spawnPuff(boss.position.x, boss.position.y + 1.4, boss.position.z, 2.4, 0xfff0c8, 0.5, 0.55, 0);
        state.slow = Math.max(state.slow, atk.speed >= 60 ? 0.5 : 0.28);
      }
    }
  }
  punchWalls(M);

  // --- objetos: pequenos viram projéteis (ou sobem, no uppercut), grandes quebram ---
  for (const p of [...props]) {
    if (p.thrown || p.held) continue;
    const d = punchDirTo(p.obj.position, p.T.radius);
    if (!d) continue;
    if (p.T.size === 'small') {
      if (M.prop.pop) { launchProp(p, d, M.prop.speed, false); p.vel.y = M.prop.pop; } // uppercut: o objeto sobe
      else launchProp(p, d, M.prop.speed, true, M.prop.mul, M.prop.knock);
      sfx.knock(p.obj.position);
      state.hitstop = Math.max(state.hitstop, 0.04);
      state.shake = Math.max(state.shake, 0.25);
    } else {
      damageProp(p, M.prop.large, d);
    }
  }
}

// o jogador é forte demais: soco forte e cruzado destroem parede de gesso à frente
function punchWalls(M) {
  if (!(M.atk === 'heavy' || M.atk === 'cross')) return;
  const px = player.position.x + fwd.x * 1.7, pz = player.position.z + fwd.z * 1.7;
  for (const s of [...allPanels]) {
    if (!s.alive) continue;
    const cx = THREE.MathUtils.clamp(px, s.x0, s.x1), cz = THREE.MathUtils.clamp(pz, s.z0, s.z1);
    if ((px - cx) ** 2 + (pz - cz) ** 2 > 1.3 * 1.3) continue;
    s.hp -= M.atk === 'heavy' ? 2 : 1;
    if (s.hp <= 0) breakWall(s, fwd);
    else { spawnDebris({ x: cx, y: 1.2, z: cz }, 0x8f8196, 6, fwd, 4); spawnPuff(cx, 1.5, cz, 1.6, 0x9a8fa0, 0.7, 0.45, 0.5); sfx.knock({ x: cx, y: 1.5, z: cz }); }
  }
}

// ESMAGAR: onda de choque em volta do jogador, empurra boss e objetos para longe
const shockwaves = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
const ringPool = [];
function spawnShockwave(pos, R) {
  const m = new THREE.Mesh(ringGeo, ringPool.pop() ?? new THREE.MeshBasicMaterial({ color: 0xffe3a8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); // (material reaproveitado: dispose recompilava o shader)
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
    if (!s.alive) continue;
    const cx = THREE.MathUtils.clamp(player.position.x, s.x0, s.x1), cz = THREE.MathUtils.clamp(player.position.z, s.z0, s.z1);
    if ((player.position.x - cx) ** 2 + (player.position.z - cz) ** 2 < 3.2 * 3.2) { slamDir.set(cx - player.position.x, 0, cz - player.position.z).normalize(); breakWall(s, slamDir); }
  }
  if (B.mode !== 'dying') {
    slamDir.subVectors(boss.position, player.position).setY(0);
    const dist = slamDir.length();
    if (dist < R + CFG.bossRadius && Math.abs(boss.position.y - player.position.y) < 3.4) {
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
  beer: { size: 'small', radius: 0.2, dmg: 3, hp: 1, color: 0x8a5a14, build(g) { // garrafa de cerveja (âmbar, rótulo creme, tampinha dourada)
    const glass = mat(0x8a5a14, 0.25);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 12), glass); body.position.y = 0.17; body.castShadow = true;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.1, 0.1, 12), glass); shoulder.position.y = 0.39;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.16, 10), glass); neck.position.y = 0.52;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 10), mat(0xd9b04a, 0.3)); cap.position.y = 0.61;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.12, 12), mat(0xe7d3b8, 0.8)); label.position.y = 0.18;
    g.add(body, shoulder, neck, cap, label);
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
  g.traverse((m) => { if (m.isMesh) m.castShadow = T.size === 'large'; }); // só móveis grandes projetam sombra (desempenho)
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
  for (const p of puffs) freePuff(p);
  puffs.length = 0;
}

function spawnLayout() {
  clearProps();
  const PI = Math.PI, P = PLAT_TOP + 0.1;
  // SALA DE ESTAR (ala oeste, norte): sofá, TV, mesa de centro, poltronas, almofadas, estantes
  createProp('sofa', -14.5, -18.3, 0, 0);
  createProp('table', -14.5, -13.6, 0, 0.2);
  createProp('tv', -14.5, -8.4, 0, PI);
  createProp('chair', -18.3, -13.8); createProp('chair', -10.8, -13.4);
  createProp('pillow', -16.4, -17.0); createProp('pillow', -12.6, -17.0); createProp('pillow', -10.6, -5.5);
  createProp('shelf', -19.3, -11, 0, PI / 2); createProp('shelf', -19.3, -6, 0, PI / 2); createProp('shelf', -19.3, -1, 0, PI / 2);
  createProp('vase', -18.8, -18.6); createProp('vase', -9.9, -18.6); createProp('vase', -17.5, 0.6);
  // COZINHA (ala leste, norte): duas geladeiras, mesa com 4 cadeiras, barris
  createProp('fridge', 19.2, -17.2, 0, -PI / 2); createProp('fridge', 19.2, -14.8, 0, -PI / 2);
  createProp('table', 14.5, -13.5, 0, 0.3);
  createProp('chair', 12.3, -14.2); createProp('chair', 16.7, -14.1); createProp('chair', 12.6, -12.0); createProp('chair', 16.4, -11.8);
  createProp('barrel', 19.0, -6.3); createProp('barrel', 18.1, -6.9); createProp('barrel', 11.5, -18.6);
  createProp('vase', 10.3, -5.7); createProp('plank', 18.5, -19.0, 0, 0.4); createProp('crate', 10.4, -19.0);
  // DEPÓSITO (ala oeste, sul): caixas, barris, estantes
  createProp('shelf', -19.3, 6, 0, PI / 2); createProp('shelf', -19.3, 11, 0, PI / 2); createProp('shelf', -19.3, 16, 0, PI / 2);
  createProp('crate', -16, 5); createProp('crate', -14.9, 5.2); createProp('crate', -15.5, 6.3);
  createProp('crate', -12, 18.5); createProp('crate', -11, 15.5);
  createProp('barrel', -18, 19); createProp('barrel', -12, 12.5); createProp('barrel', -14.2, 9.5);
  createProp('ball', -15, 13); createProp('ball', -11, 4.2);
  // BIBLIOTECA / BOLICHE (ala leste, sul): mesa, cadeiras, estante, bolas de boliche, TV; mezanino no canto
  createProp('table', 12.5, 6.5, 0, -0.2);
  createProp('chair', 10.6, 6.0); createProp('chair', 14.0, 7.0); createProp('chair', 12.2, 8.6);
  createProp('shelf', 10.2, 19.3, 0, PI);
  createProp('ball', 11, 15.5); createProp('ball', 11.8, 16.2); createProp('ball', 12.6, 15.5);
  createProp('vase', 19.2, 2.0); createProp('vase', 19.2, -2.0); createProp('pillow', 11.5, 11.8);
  createProp('crate', 13, 0.5); createProp('barrel', 19, 4.2); createProp('tv', 19.3, 0, 0, -PI / 2);
  createProp('crate', 17.5, 16, P); createProp('barrel', 19.2, 14, P); createProp('vase', 16, 18.6, P); createProp('ball', 18, 13, P);
  // SALÃO CENTRAL: o ringue. Poucas coisas no meio; objetos pesados no mezanino para arremessar de cima
  createProp('chair', -6, 6); createProp('chair', 5, 8); createProp('crate', -5, -2); createProp('barrel', 6, -3); createProp('barrel', -7, 10);
  createProp('ball', 2, 4); createProp('table', -6, 14, 0, 0.3); createProp('crate', 5, 14); createProp('crate', 6.1, 14.8);
  createProp('vase', 7.5, -8); createProp('shelf', 8.3, -4, 0, -PI / 2); createProp('shelf', -8.3, 1.8, 0, PI / 2);
  createProp('sofa', -6.5, -18.4, P, 0); createProp('table', 6, -17, P, 0.3); createProp('shelf', 8.3, -18.2, P, -PI / 2); createProp('chair', 4.2, -17.4, P);
  createProp('crate', -3.2, -18.6, P); createProp('barrel', 3, -19, P); createProp('ball', -1.5, -17, P); createProp('ball', 1.5, -17.6, P); createProp('vase', 0, -19, P);
  createProp('barrel', -3.2, -16.2, P); createProp('pillow', -6.5, -17.2, P + 0.5);
  // GARRAFAS DE CERVEJA (curam ao beber com B, ou dá para arremessar no fantasma)
  for (const [x, z, y] of [[-3, 12, 0], [4.5, 11, 0], [0, 2, 0], [-6.5, -8, 0], [6.5, -9, 0], [-14.5, -3, 0], [-14, 8, 0], [14.5, -8, 0], [14, 9, 0], [-1, -17.5, P], [17.5, 14.5, P], [-16.5, -15, 0]]) createProp('beer', x, z, y);
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

// nuvens de poeira / eco: esferas translucidas que crescem e somem
const puffs = [];
const puffGeo = new THREE.SphereGeometry(1, 8, 6);
// IMPORTANTE (desempenho): materiais reaproveitados de um "pool" e nunca descartados. Criar e dar dispose() num material por nuvem
// fazia o three.js destruir e recompilar o shader sempre que as nuvens acabavam: travadas a cada parede/objeto quebrado.
const puffPool = [];
function getPuffMat() { return puffPool.pop() ?? new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }); } // sem iluminação: bem mais barato com 9 luzes
function freePuff(p) { scene.remove(p.m); puffPool.push(p.m.material); }
{ const warm = new THREE.Mesh(puffGeo, getPuffMat()); warm.position.y = -50; warm.frustumCulled = false; scene.add(warm); puffPool.push(warm.material); } // mantém o shader compilado
function spawnPuff(x, y, z, size, color = 0x8a8299, life = 0.7, opacity = 0.45, rise = 1) {
  const mt = getPuffMat(); mt.color.setHex(color); mt.opacity = opacity;
  const m = new THREE.Mesh(puffGeo, mt);
  m.position.set(x, y, z); m.scale.setScalar(size * 0.35);
  scene.add(m);
  puffs.push({ m, t: 0, life, size, opacity, rise, vx: (Math.random() - 0.5) * 1.6, vz: (Math.random() - 0.5) * 1.6 });
  while (puffs.length > 50) freePuff(puffs.shift());
}
function updatePuffs(dt) {
  for (const p of [...puffs]) {
    p.t += dt;
    const k = p.t / p.life;
    p.m.scale.setScalar(p.size * (0.35 + 0.65 * Math.sqrt(Math.min(1, k))));
    p.m.material.opacity = p.opacity * Math.max(0, 1 - k);
    p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.m.position.y += p.rise * dt * (1 - k);
    if (k >= 1) { freePuff(p); puffs.splice(puffs.indexOf(p), 1); }
  }
}

// parede de gesso desabando: pedaços grandes voando na direção do golpe + nuvem de poeira
function breakWall(s, dir) {
  if (!s.alive) return;
  s.alive = false;
  solids.splice(solids.indexOf(s), 1);
  scene.remove(s.mesh);
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  sfx.wallBreak({ x: cx, y: 2, z: cz });
  state.shake = Math.max(state.shake, 0.9);
  state.flash = Math.max(state.flash, 0.3);
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(boxGeo, mat(i % 3 ? 0x8f8196 : 0x5a4a62));
    const sz = 0.2 + Math.random() * 0.55;
    m.scale.set(sz * (0.6 + Math.random()), sz * (0.5 + Math.random() * 0.8), sz * (0.6 + Math.random()));
    m.position.set(s.x0 + Math.random() * (s.x1 - s.x0), 0.3 + Math.random() * (WALL_H - 0.6), s.z0 + Math.random() * (s.z1 - s.z0));
    const v = new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 5, (Math.random() - 0.5) * 5);
    if (dir) v.addScaledVector(dir, 4 + Math.random() * 10);
    pushDebris(m, v, new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), 6 + Math.random() * 3);
  }
  for (let i = 0; i < 6; i++) spawnPuff(cx + (Math.random() - 0.5) * (s.x1 - s.x0), 0.8 + Math.random() * (WALL_H - 1.5), cz + (Math.random() - 0.5) * (s.z1 - s.z0), 2.4 + Math.random() * 1.6, 0x9a8fa0, 1.6, 0.5, 0.4);
}
function rebuildWalls() {
  for (const s of allPanels) {
    if (!s.alive) { s.alive = true; scene.add(s.mesh); solids.push(s); }
    s.hp = 2;
  }
}

function breakProp(p, dir, force = 10) {
  const pos = p.obj.position;
  const large = p.T.size === 'large';
  sfx.breakProp(p.type, pos, large);
  // as próprias peças do objeto viram destroços (com o mesmo formato e material) e voam para fora do centro
  p.obj.updateMatrixWorld(true);
  const center = new THREE.Vector3(pos.x, pos.y + 0.6, pos.z);
  let n = 0;
  p.obj.traverse((m) => {
    if (!m.isMesh || n >= 20) return;
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
  sfx.knock(p.obj.position);
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
      if (o.position.y <= gp) {
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
    const lim = H - 0.7;
    const wallHit = touchingSolid(o.position.x, o.position.z, p.T.radius * 0.8, o.position.y);
    if (wallHit || Math.abs(o.position.x) > lim || Math.abs(o.position.z) > lim) {
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
      if (dx * dx + dz * dz < r * r && Math.abs(o.position.y - (boss.position.y + 1.3)) < 2.6) { hitBossWithProp(p, propDir); continue; }
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
const LABELS = { chair: 'cadeira', crate: 'caixa', vase: 'vaso', plank: 'tábua', barrel: 'barril', tv: 'TV', ball: 'bola de boliche', pillow: 'almofada', beer: 'garrafa de cerveja' };
const SMALL_TYPES = Object.keys(PROP_TYPES).filter((k) => PROP_TYPES[k].size === 'small' && k !== 'plank' && k !== 'beer');
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

// beber cerveja (tecla B): a garrafa na mão ou a mais próxima à frente; cura e some
function drinkBeer() {
  if (state.over) return;
  let p = state.held?.type === 'beer' ? state.held : null;
  if (!p) { const g = findGrabbable(); if (g?.type === 'beer') p = g; }
  if (!p) return;
  if (state.held === p) state.held = null;
  removeProp(p); // (removeFromParent também tira da câmera, se estava na mão)
  const before = state.hp;
  state.hp = Math.min(CFG.playerMaxHp, state.hp + CFG.beerHeal);
  sfx.drink();
  state.moveNameT = 1; elMoveName.textContent = state.hp > before ? '+' + Math.round(state.hp - before) + ' VIDA' : 'VIDA CHEIA';
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
  sfx.pick();
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
  sfx.knock();
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
  const p = releaseHeld(player.position.x + throwDir.x * 0.9, player.position.y + 1.2, player.position.z + throwDir.z * 0.9);
  launchProp(p, throwDir, CFG.throwHeld, true, CFG.heldThrowMul, CFG.heldKnockMul);
  sfx.throwObj();
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
  else if (state.held) msg = state.held.type === 'beer' ? 'Clique = ARREMESSAR  ·  B = beber (+' + CFG.beerHeal + ')  ·  F = soltar' : 'Clique = ARREMESSAR  ·  F = soltar';
  else { const g = findGrabbable(); if (g) msg = g.type === 'beer' ? 'B = BEBER (+' + CFG.beerHeal + ' vida)  ·  F = pegar para arremessar' : 'F = pegar ' + LABELS[g.type]; }
  if (touchMode) msg = msg.replace(/Clique = /g, 'SOCO = ').replace(/\bB = /g, 'BEBER = ').replace(/\bF = /g, 'PEGAR = ');
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
  updateMenu(); touchUpdate();
  if (state.over) {
    elOverTitle.textContent = state.over === 'win' ? 'Vitória!' : 'Você foi derrotado';
    elOverSub.textContent = (state.over === 'win' ? 'Tempo: ' + state.time.toFixed(1) + 's · ' : '') + (touchMode ? 'Toque para tentar de novo' : 'Pressione R para tentar de novo');
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
  player.position.set(0, 0, H - 3); state.eyeY = 0; state.pvy = 0; state.flash = 0; state.slow = 0;
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
  const gyP = groundY(player.position.x, player.position.z, player.position.y + 0.56);
  state.pvy -= 30 * dt;
  player.position.y += state.pvy * dt;
  if (player.position.y <= gyP) { player.position.y = gyP; state.pvy = 0; }

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
    } else if (B.mode === 'windup') {                                   // aviso: pisca cada vez mais
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
  registerHit(0.05 + 0.07 * power, 0.9);
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
  spawnPuff(p.x, WALL_H - 0.4, p.z, 1.8, 0x8a8299, 0.8, 0.5, -0.5);
  spawnDebris({ x: p.x, y: WALL_H - 1.5, z: p.z }, 0x8f8196, 10, null, 0);
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
    if (!s.alive) continue;
    const cx = THREE.MathUtils.clamp(boss.position.x, s.x0, s.x1), cz = THREE.MathUtils.clamp(boss.position.z, s.z0, s.z1);
    if ((boss.position.x - cx) ** 2 + (boss.position.z - cz) ** 2 < (CFG.bossRadius + 0.2) ** 2) { breakWall(s, B.dashDir); state.shake = Math.max(state.shake, 0.5); }
  }
}

// onde o fantasma reaparece: com chance blinkBehind, a ~3 m ATRÁS de onde o jogador olha; senão, num ponto qualquer a 4-9 m.
// Rejeita pontos dentro de paredes/plataformas, fora da casa ou fora de alcance.
const fwdP = new THREE.Vector3(), desiredV = new THREE.Vector3();
function pickBlinkDest() {
  fwdP.set(0, 0, -1).applyAxisAngle(UP, look.yaw);
  const behind = Math.random() < CFG.blinkBehind;
  for (let i = 0; i < 12; i++) {
    let ang, d;
    if (behind && i < 8) { ang = Math.atan2(-fwdP.x, -fwdP.z) + (Math.random() - 0.5) * 0.9; d = 2.8 + Math.random() * 1.6; }
    else { ang = Math.random() * Math.PI * 2; d = 4 + Math.random() * 5; }
    const x = player.position.x + Math.sin(ang) * d, z = player.position.z + Math.cos(ang) * d;
    if (Math.abs(x) > H - 1.6 || Math.abs(z) > H - 1.6) continue;
    if (touchingSolid(x, z, 1.1, player.position.y + 0.5)) continue;
    return new THREE.Vector3(x, groundY(x, z, player.position.y + 0.6), z);
  }
  return new THREE.Vector3(player.position.x, player.position.y, player.position.z).addScaledVector(fwdP, -2.5).setY(player.position.y);
}

// ---------- Habilidades especiais (Etapa 20) ----------
const dropMark = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0x3a0010, transparent: true, opacity: 0.6, depthWrite: false }));
dropMark.rotation.x = -Math.PI / 2; dropMark.visible = false; dropMark.renderOrder = 2; scene.add(dropMark);
const flipQ = new THREE.Quaternion(), flipX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
const CEIL_Y = () => WALL_H - 1.5 - 0.9 * CFG.bossScale; // pos.y do fantasma preso ao teto (centro do corpo ~1,5 abaixo do teto)
function possessCandidates() {
  return props.filter((p) => !p.held && !p.thrown && !p.falling && p.type !== 'beer' && p.vel.lengthSq() < 0.5 &&
    Math.hypot(p.obj.position.x - player.position.x, p.obj.position.z - player.position.z) < 16)
    .sort((a, b) => a.obj.position.distanceToSquared(player.position) - b.obj.position.distanceToSquared(player.position));
}
function chooseAfterChase(p2) {
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
  if (d < CFG.ceilDropRadius && Math.abs(player.position.y - groundY(pos.x, pos.z, pos.y + 3.2)) < 2) hurtPlayer(CFG.ceilDropDamage);
  B.stunDur = 1.9; setBossMode('stun');
}
function updateSpecials(dt) { // chamado por updateBoss nos modos novos; devolve true se o modo é "especial"
  const pos = boss.position;
  if (B.mode === 'ceil') {
    // sobe para o teto, de cabeça para baixo, e rasteja em direção ao jogador (fora do alcance de socos e objetos)
    const aimT = CFG.ceilCrawl * (B.phase2 ? 0.75 : 1);
    if (B.t < aimT) {
      const to = _v1.subVectors(player.position, pos).setY(0); const d = to.length() || 1;
      const sp = CFG.bossChaseSpeed * 2.2 * (B.phase2 ? 1.3 : 1) * (d > 3 ? 1 : 0.3);
      desiredV.set(to.x / d * sp + Math.sin(state.time * 5) * 0.8, 0, to.z / d * sp);
      B.mv.lerp(desiredV, 1 - Math.exp(-dt * 4));
      pos.addScaledVector(B.mv, dt);
      B.crawlSnd -= dt; if (B.crawlSnd <= 0) { B.crawlSnd = 0.9; sfx.whisper(bossAt()); }
    } else {
      B.mv.multiplyScalar(Math.exp(-dt * 8)); pos.addScaledVector(B.mv, dt);
      if (!B.aimed) { B.aimed = true; B.ceilTarget.copy(player.position); sfx.windup(CFG.ceilAim, bossAt()); }
      // desliza para cima do ponto marcado
      pos.x += (B.ceilTarget.x - pos.x) * Math.min(1, dt * 7); pos.z += (B.ceilTarget.z - pos.z) * Math.min(1, dt * 7);
      const gy = groundY(B.ceilTarget.x, B.ceilTarget.z, 3);
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
  bossVis.visible = true; // (as piscadas apagam por quadro)
  B.flash = Math.max(0, B.flash - dt);
  const p2 = B.phase2;
  const speedMul = (p2 ? 1.4 : 1) * (lightFx.dark > 0 ? 1.2 : 1);
  const timeMul = p2 ? 0.7 : 1;

  dirToPlayer.subVectors(player.position, boss.position).setY(0);
  const dist = dirToPlayer.length();
  if (dist > 0.001) dirToPlayer.divideScalar(dist);

  let emissive = p2 ? COLORS.p2chase : COLORS.chase;
  let intensity = 0.7;
  let sc = CFG.bossScale; // escala base deste frame (aviso e morte alteram)

  if (B.mode === 'chase') {
    // PERSEGUIÇÃO NATURAL: alterna comportamentos (aproximar em curva, rodear, encarar, avançar de repente, recuar),
    // com velocidade oscilando e inércia ao mudar de direção.
    B.subT -= dt;
    if (B.subT <= 0) {
      const r = Math.random();
      if (dist > 10) { B.sub = r < 0.5 ? 'surge' : 'approach'; B.subT = 0.8 + Math.random() * 0.8; }
      else if (dist < 4.5) {
        B.sub = r < 0.4 ? 'circle' : r < 0.6 ? 'stare' : r < 0.8 ? 'approach' : 'retreat';
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
    else if (B.sub === 'surge') spd = base * 2.3;
    else if (B.sub === 'stare') spd = base * 0.12;
    else if (B.sub === 'retreat') { dx = -dirToPlayer.x; dz = -dirToPlayer.z; }
    else if (B.sub === 'circle') {
      const k = THREE.MathUtils.clamp((dist - 5.5) * 0.5, -1, 1);
      dx = -dirToPlayer.z * B.circDir + dirToPlayer.x * k; dz = dirToPlayer.x * B.circDir + dirToPlayer.z * k; spd = base * 1.1;
    }
    const dl = Math.hypot(dx, dz) || 1;
    desiredV.set(dx / dl * spd, 0, dz / dl * spd);
    if (state.over) desiredV.set(0, 0, 0);
    B.mv.lerp(desiredV, 1 - Math.exp(-dt * (B.sub === 'surge' ? 6 : 3)));
    boss.position.addScaledVector(B.mv, dt);
    if (B.t >= B.chaseTime * timeMul && !state.over) {
      if (dist > 9) { B.chaseTime += 0.6; B.sub = 'surge'; B.subT = 1.0; }
      else chooseAfterChase(p2);
    }
    // contato leve enquanto persegue
    if (dist < CFG.bossRadius + 0.6) hurtPlayer(CFG.bossContactDamage);
  } else if (B.mode === 'windup') {
    // AVISO: pisca em vermelho e "encolhe" (carregando). Dá tempo de reagir.
    emissive = COLORS.windup;
    intensity = 1.2 + Math.sin(B.t * 30) * 0.8;
    const wd = CFG.bossWindup * timeMul * (B.quick ? 0.75 : 1); // logo depois de reaparecer o aviso é um pouco mais curto
    const k = Math.min(B.t / wd, 1);
    sc = CFG.bossScale * (1 - 0.18 * k);
    if (!state.over) B.dashDir.copy(dirToPlayer); // mira até o último instante
    if (B.t >= wd) {
      setBossMode('dash');
      sc = CFG.bossScale;
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
    intensity = 0.5 + Math.sin(B.t * 12) * 0.3;
    if (B.t >= B.stunDur && !B.launch) {
      B.chaseTime = 1.2 + Math.random() * 1.2;
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
    if (B.t >= CFG.blinkAppear) { B.quick = true; setBossMode('windup'); }
  } else if (B.mode === 'ceil' || B.mode === 'drop' || B.mode === 'possess') {
    emissive = B.mode === 'drop' ? 0xff3040 : 0xb45cff; intensity = 1.2 + Math.sin(B.t * 20) * 0.3;
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
        if (B.launch && B.mode !== 'dying' && p.T.size === 'large') { damageBoss(CFG.smashSelfDamage); registerHit(0.05, 0.5); }
      }
    }
  }

  // vertical: gravidade, quique no chão/degraus e batida no teto
  const gyB = groundY(pos.x, pos.z, pos.y + (B.launch ? 0.5 : 3.2));
  const minY = gyB - 0.45 * B.tw; // deitado, o centro do corpo fica mais baixo
  if (onCeil) { /* preso ao teto: altura controlada por updateSpecials */ }
  else if (!B.launch && Math.abs(B.vy) < 0.5 && B.mode !== 'dying') {
    B.vy = 0;
    pos.y += (minY - pos.y) * Math.min(1, dt * 8); // flutua acompanhando o piso e os degraus
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
  const maxY = WALL_H - 3.5; // a cabeça do boss não atravessa o teto
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
    // rastro: poeira no chão, "eco" fantasma no ar
    B.trailT -= dt;
    if (B.trailT <= 0 && sp > 8) {
      B.trailT = 0.04;
      if (B.grounded) spawnPuff(pos.x, 0.25 + gyB, pos.z, 0.8 + sp * 0.02, 0x6f6678, 0.8, 0.4, 1.2);
      else spawnPuff(pos.x, pos.y + 1.3, pos.z, 1.0, 0x9fd0ff, 0.45, 0.28, 0);
    }
  }

  // flutuar e olhar para o jogador
  B.bob += dt * 3;
  bossTop.position.y = BOSS_HEAD_Y + Math.sin(B.bob) * 0.05;
  animateGhost(dt, state.time + B.bob);
  if (B.launch) {
    // corpo rígido: integra a velocidade angular (rolando no chão, cambalhota no ar)
    if (B.grounded) { rollW.set(B.vel.z, 0, -B.vel.x).multiplyScalar(0.9); B.w.lerp(rollW, 1 - Math.exp(-dt * 7)); }
    else B.w.multiplyScalar(Math.exp(-dt * 0.25));
    const wl = B.w.length();
    if (wl > 40) { B.w.multiplyScalar(40 / wl); }
    if (wl * dt > 1e-5) { dq.setFromAxisAngle(rollAxis.copy(B.w).divideScalar(wl), Math.min(wl, 40) * dt); B.q.premultiply(dq).normalize(); }
    boss.quaternion.copy(B.q);
  } else if (B.mode === 'dying') {
    // (o giro da morte já foi aplicado acima)
  } else if (B.mode === 'dash') {
    B.tw = 0;
  } else {
    // levantando: o corpo caído volta suavemente para a posição em pé olhando para o jogador
    if (B.mode === 'stun') B.tw = Math.min(B.tw, THREE.MathUtils.clamp((B.stunDur - B.t) / Math.min(0.7, Math.max(0.2, B.stunDur)), 0, 1));
    else B.tw = 0;
    let dyaw = Math.atan2(player.position.x - pos.x, player.position.z - pos.z) - B.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    B.yaw += dyaw * Math.min(1, dt * (B.mode === 'windup' ? 14 : 5));
    upQ.setFromEuler(upE.set(0, B.yaw, 0));
    if (B.tw > 0) boss.quaternion.slerpQuaternions(upQ, B.q, B.tw * B.tw * (3 - 2 * B.tw)); else boss.quaternion.copy(upQ);
    if (B.cl > 0.001) { flipQ.copy(upQ).multiply(flipX); boss.quaternion.slerpQuaternions(upQ, flipQ, B.cl * B.cl * (3 - 2 * B.cl)); } // de cabeça para baixo no teto
  }
  // o corpo gira em torno do CENTRO (e não dos pés): compensa o deslocamento do pivô
  pivotV.set(0, 0.9, 0).applyQuaternion(pivotQ.copy(boss.quaternion).invert()).sub(pivotC.set(0, 0.9, 0));
  bossVis.position.copy(pivotV);

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
  const pausedNow = !locked && !state.over;
  if (pausedNow !== audioPaused) { audioPaused = pausedNow; sfx.setPaused(pausedNow); } // pausa também congela o som
  if (!locked && !state.over) { updateHud(); renderer.render(scene, camera); return; }
  // hitstop: o jogo quase congela por um instante quando um golpe acerta
  const realDt = dt;
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
      createProp(SMALL_TYPES[Math.floor(Math.random() * SMALL_TYPES.length)], (Math.random() * 2 - 1) * (H - 2), (Math.random() * 2 - 1) * (H - 2), WALL_H - 0.6);
    }
  }

  // cerveja nova nasce pelo mapa (cai do teto); mais rápido quando a vida está baixa
  state.beerT = (state.beerT ?? 0) + dt;
  if (state.beerT >= CFG.beerSpawnEvery * (state.hp < 40 ? 0.5 : 1) && !state.over) {
    state.beerT = 0;
    if (props.filter((p) => p.type === 'beer').length < CFG.beerMax) {
      for (let tries = 0; tries < 12; tries++) {
        const x = (Math.random() * 2 - 1) * (H - 2), z = (Math.random() * 2 - 1) * (H - 2);
        if (touchingSolid(x, z, 0.6, 0)) continue; // não nasce dentro de parede, escada ou plataforma
        createProp('beer', x, z, WALL_H - 0.6);
        break;
      }
    }
  }

  // lanterna na mão (filha da câmera) com leve tremida
  lantern.intensity = 30 + Math.sin(t * 17) * 1.5;

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
  camera.rotation.set(look.pitch + aPitch + state.kick.pitch, look.yaw + aYaw, aRoll + state.kick.roll);
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
if (location.search.includes('debug')) window.__gp = { dropMark, lightFx, startLightEvent, ambient, bulbs, sfx, state, B, boss, player, CFG, look, fist, hands, MOVES, startPunch, applyMoveHit, props, debris, createProp, breakProp, camera, settings, throwHeld, setBossMode, solids, allPanels, breakWall, groundY, puffs, B_q: B.q };

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
