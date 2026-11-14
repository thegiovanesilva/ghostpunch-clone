// TEXTURAS (abordagem híbrida):
//  - SUPERFÍCIES (piso, papel de parede, gesso, teto, madeira, sujeira dos móveis): geradas aqui por código, num <canvas>
//    (cor + mapa de relevo/bump), sem nenhum arquivo. Cada função desenha camadas: base, padrão, manchas, rachaduras, ruído.
//  - DESTAQUES (retratos, tapetes, azulejo, porta, sangue): imagens em public/textures/, desenhadas por tools/bake_textures.py.
// Paredes, piso e teto usam coordenadas de textura calculadas a partir da POSIÇÃO NO MUNDO (worldUV), para que a textura
// não estique quando a mesma caixa unitária é escalada em paredes de tamanhos diferentes.
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
// mancha suave; wrapX/wrapY repetem a mancha do outro lado para a textura emendar sem costura
function blob(g, W, H, x, y, r, color, a, wrapX = true, wrapY = true, sy = 1) {
  for (const ox of wrapX ? [-W, 0, W] : [0]) for (const oy of wrapY ? [-H, 0, H] : [0]) {
    const cx = x + ox, cy = y + oy;
    if (cx + r < 0 || cx - r > W || cy + r * sy < 0 || cy - r * sy > H) continue;
    g.save(); g.translate(cx, cy); g.scale(1, sy);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(0.6, `rgba(${color},${a * 0.55})`); gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
  }
}
function grain(g, W, H, amp, R) { // ruído fino pixel a pixel
  const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
}
function crack(g, R, x, y, ang, steps, len, width, style, branch = 0.12) { // rachadura: caminhada aleatória com ramificações
  g.strokeStyle = style; g.lineWidth = width; g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < steps; i++) {
    ang += (R() - 0.5) * 0.9; x += Math.cos(ang) * len; y += Math.sin(ang) * len; g.lineTo(x, y);
    if (R() < branch && steps > 6) { g.stroke(); crack(g, R, x, y, ang + (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.6), Math.floor(steps * 0.5), len, Math.max(0.6, width * 0.7), style, branch * 0.6); g.strokeStyle = style; g.lineWidth = width; g.beginPath(); g.moveTo(x, y); }
  }
  g.stroke();
}
function tex(c, { srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- TÁBUAS (piso colorido escuro; versão neutra para escada/vigas, que a cor do material tinge) ----------
function planks(seed, { S = 512, rows = 16, base = [44, 27, 16], vary = 12, dirt = 1 } = {}) {
  const R = rng(seed), [c, g] = canvas(S), [cb, b] = canvas(S), rh = S / rows;
  b.fillStyle = '#b0b0b0'; b.fillRect(0, 0, S, S);
  for (let r = 0; r < rows; r++) {
    const y = r * rh; let x = -R() * S * 0.6;
    while (x < S) {
      const w = S * (0.35 + R() * 0.5), v = (R() - 0.5) * 2 * vary;
      g.fillStyle = `rgb(${base[0] + v | 0},${base[1] + v * 0.7 | 0},${base[2] + v * 0.5 | 0})`; g.fillRect(x, y, w, rh);
      const hv = 150 + R() * 60 | 0; b.fillStyle = `rgb(${hv},${hv},${hv})`; b.fillRect(x, y, w, rh);
      g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x + w - 1.5, y, 2, rh); b.fillStyle = '#000'; b.fillRect(x + w - 1.5, y, 2.5, rh); // emenda
      if (R() < 0.3) { // nó da madeira
        const kx = x + R() * w, ky = y + rh * (0.3 + R() * 0.4);
        for (let k = 5; k > 0; k--) { g.strokeStyle = `rgba(8,4,2,${0.12 + 0.06 * k})`; g.lineWidth = 1; g.beginPath(); g.ellipse(kx, ky, k * 2.4, k * 1.1, 0, 0, 7); g.stroke(); }
        g.fillStyle = 'rgba(6,3,2,.8)'; g.beginPath(); g.ellipse(kx, ky, 2.5, 1.6, 0, 0, 7); g.fill();
      }
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,.85)'; g.fillRect(0, y, S, 1.5); b.fillStyle = '#000'; b.fillRect(0, y, S, 2); // fresta entre tábuas
    g.fillStyle = 'rgba(255,220,180,.05)'; g.fillRect(0, y + 2, S, 1);
  }
  for (let i = 0; i < 900; i++) { // veios
    const y = R() * S, x = R() * S, w = 20 + R() * 120, d = R() < 0.6;
    g.fillStyle = d ? `rgba(0,0,0,${0.05 + R() * 0.12})` : `rgba(255,210,160,${0.02 + R() * 0.05})`; g.fillRect(x, y, w, 1);
    if (x + w > S) g.fillRect(x - S, y, w, 1);
    if (d && R() < 0.3) { b.fillStyle = 'rgba(0,0,0,.25)'; b.fillRect(x, y, w, 1); }
  }
  for (let i = 0; i < 34 * dirt; i++) blob(g, S, S, R() * S, R() * S, 30 + R() * 90, '0,0,0', 0.1 + R() * 0.3);      // encardido
  for (let i = 0; i < 5 * dirt; i++) blob(g, S, S, R() * S, R() * S, 20 + R() * 50, '50,6,6', 0.14 + R() * 0.2);      // manchas avermelhadas antigas
  for (let i = 0; i < 26; i++) { // arranhões (móveis arrastados)
    const x = R() * S, y = R() * S, a = (R() - 0.5) * 1.2, L = 20 + R() * 90;
    g.strokeStyle = `rgba(190,160,120,${0.05 + R() * 0.1})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    b.strokeStyle = 'rgba(0,0,0,.35)'; b.lineWidth = 1; b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); b.stroke();
  }
  grain(g, S, S, 16, R); grain(b, S, S, 24, R);
  return { map: tex(c), bump: tex(cb, { srgb: false }) };
}

// ---------- PAPEL DE PAREDE vitoriano apodrecendo. A textura cobre o pé-direito inteiro (topo = teto): fuligem em cima,
// lambri de madeira escura e mofo embaixo, escorridos de infiltração, pedaços descascados mostrando o reboco ----------
function wallpaper(seed, S = 1024) {
  const R = rng(seed), [c, g] = canvas(S), [cb, b] = canvas(S);
  const wains = S * 0.83; // daqui para baixo é lambri (~1,1 m)
  g.fillStyle = '#3a2836'; g.fillRect(0, 0, S, S); b.fillStyle = '#909090'; b.fillRect(0, 0, S, S);
  const stripes = 16, sw = S / stripes;
  for (let i = 0; i < stripes; i++) {
    if (i % 2) { g.fillStyle = 'rgba(96,66,84,.5)'; g.fillRect(i * sw, 0, sw, wains); }
    g.fillStyle = 'rgba(160,128,70,.32)'; g.fillRect(i * sw - 1, 0, 2, wains);            // filete dourado desbotado
    for (let y = sw * 0.7; y < wains - 20; y += sw * 1.6) { // arabesco (damasco) repetido
      const cx = i * sw + sw / 2, cy = y + (i % 2) * sw * 0.8, s = sw * 0.3;
      g.strokeStyle = 'rgba(190,150,110,.2)'; g.fillStyle = 'rgba(20,8,16,.3)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(cx, cy - s * 1.4); g.bezierCurveTo(cx + s * 1.3, cy - s * 0.5, cx + s * 0.5, cy + s * 0.6, cx, cy + s * 1.4);
      g.bezierCurveTo(cx - s * 0.5, cy + s * 0.6, cx - s * 1.3, cy - s * 0.5, cx, cy - s * 1.4); g.fill(); g.stroke();
      g.beginPath(); g.arc(cx, cy, s * 0.28, 0, 7); g.stroke();
    }
  }
  // lambri: madeira quase preta com almofadas e friso
  g.fillStyle = '#1c1210'; g.fillRect(0, wains, S, S - wains);
  b.fillStyle = '#c8c8c8'; b.fillRect(0, wains, S, S - wains);
  g.fillStyle = '#2c1c14'; g.fillRect(0, wains, S, 12); g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(0, wains + 12, S, 3);
  b.fillStyle = '#fff'; b.fillRect(0, wains, S, 12); b.fillStyle = '#000'; b.fillRect(0, wains + 12, S, 3);
  for (let i = 0; i < 8; i++) {
    const x = i * S / 8 + 14, w = S / 8 - 28, y = wains + 30, h = S - wains - 52;
    g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 4; g.strokeRect(x, y, w, h); g.strokeStyle = 'rgba(120,84,56,.25)'; g.lineWidth = 1.5; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
    b.strokeStyle = '#000'; b.lineWidth = 5; b.strokeRect(x, y, w, h);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.25})`; g.fillRect(R() * S, wains + R() * (S - wains), 1, 6 + R() * 40); }
  // sujeira geral
  for (let i = 0; i < 60; i++) blob(g, S, S, R() * S, R() * S, 50 + R() * 140, '8,4,8', 0.08 + R() * 0.2, true, false);
  for (let i = 0; i < 16; i++) blob(g, S, S, R() * S, R() * wains, 40 + R() * 90, '110,90,50', 0.05 + R() * 0.07, true, false); // amarelado de umidade
  // fuligem no alto e sombra no pé da parede
  let gr = g.createLinearGradient(0, 0, 0, S * 0.3); gr.addColorStop(0, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.3);
  gr = g.createLinearGradient(0, S * 0.72, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = gr; g.fillRect(0, S * 0.72, S, S * 0.28);
  // escorridos de infiltração vindos do teto
  for (let i = 0; i < 46; i++) {
    const x = R() * S, L = S * (0.1 + R() * R() * 0.75), w = 2 + R() * 12, dark = R() < 0.75;
    const lg = g.createLinearGradient(0, 0, 0, L); const col = dark ? '10,6,8' : '90,70,40';
    lg.addColorStop(0, `rgba(${col},${0.5 + R() * 0.3})`); lg.addColorStop(0.7, `rgba(${col},.25)`); lg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = lg;
    for (const ox of [-S, 0, S]) { g.beginPath(); g.moveTo(x + ox - w, 0); g.lineTo(x + ox + w, 0); g.lineTo(x + ox + w * 0.25 + (R() - 0.5) * 6, L); g.lineTo(x + ox - w * 0.25, L); g.fill(); }
  }
  // um escorrido vermelho-escuro, grande, de vez em quando
  for (let i = 0; i < 3; i++) {
    const x = R() * S, y0 = S * (0.2 + R() * 0.3), L = S * (0.15 + R() * 0.3);
    blob(g, S, S, x, y0, 26 + R() * 22, '60,4,6', 0.75, true, false);
    for (let k = 0; k < 6; k++) { const dx = (R() - 0.5) * 40, l = L * (0.3 + R() * 0.7); const lg = g.createLinearGradient(0, y0, 0, y0 + l); lg.addColorStop(0, 'rgba(58,4,6,.85)'); lg.addColorStop(1, 'rgba(58,4,6,0)'); g.fillStyle = lg; g.fillRect(x + dx, y0, 2 + R() * 4, l); }
  }
  // mofo: colônias de pontos escuros esverdeados, mais perto do chão e do teto
  for (let i = 0; i < 30; i++) {
    const cx = R() * S, cy = R() < 0.6 ? wains - R() * S * 0.25 : R() * S * 0.2, n = 30 + R() * 120, sp = 20 + R() * 60;
    for (let k = 0; k < n; k++) { const a = R() * 7, r = R() * R() * sp; blob(g, S, S, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5 + R() * 5, R() < 0.5 ? '6,12,6' : '2,2,2', 0.5 + R() * 0.4, true, false); }
  }
  // papel descascado: reboco claro aparecendo, com a borda do papel fazendo sombra
  for (let i = 0; i < 9; i++) {
    const cx = R() * S, cy = S * (0.12 + R() * 0.6), n = 9, rad = 22 + R() * 60, pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * 6.283, r = rad * (0.5 + R() * 0.8); pts.push([cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 1.3]); }
    for (const ox of [-S, 0, S]) {
      const path = () => { g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x + ox, y) : g.moveTo(x + ox, y)); g.closePath(); };
      g.save(); g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 8; g.shadowOffsetY = 3; path(); g.fillStyle = '#6f675f'; g.fill(); g.restore();
      path(); g.save(); g.clip(); for (let k = 0; k < 8; k++) blob(g, S, S, cx + ox + (R() - 0.5) * rad * 2, cy + (R() - 0.5) * rad * 2, 10 + R() * 30, '30,24,20', 0.4, false, false); g.restore();
      b.beginPath(); pts.forEach(([x, y], k) => k ? b.lineTo(x + ox, y) : b.moveTo(x + ox, y)); b.closePath(); b.fillStyle = '#404040'; b.fill();
    }
  }
  for (let i = 0; i < 7; i++) crack(g, R, R() * S, R() * wains, Math.PI / 2 + (R() - 0.5), 30, 9, 1.2, 'rgba(0,0,0,.6)');
  grain(g, S, S, 14, R); grain(b, S, S, 18, R);
  return { map: tex(c, { aniso: 8 }), bump: tex(cb, { srgb: false }) };
}

// ---------- GESSO/REBOCO rachado (divisórias quebráveis). Também cobre o pé-direito inteiro ----------
function plaster(seed, S = 512) {
  const R = rng(seed), [c, g] = canvas(S), [cb, b] = canvas(S);
  g.fillStyle = '#7b7078'; g.fillRect(0, 0, S, S); b.fillStyle = '#a0a0a0'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) blob(g, S, S, R() * S, R() * S, 20 + R() * 80, R() < 0.5 ? '40,34,40' : '150,140,140', 0.06 + R() * 0.12, true, false);
  for (let i = 0; i < 12; i++) blob(g, S, S, R() * S, R() * S, 30 + R() * 60, '110,90,40', 0.08 + R() * 0.1, true, false);
  let gr = g.createLinearGradient(0, 0, 0, S * 0.25); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S * 0.25);
  gr = g.createLinearGradient(0, S * 0.7, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,8,4,.75)'); g.fillStyle = gr; g.fillRect(0, S * 0.7, S, S * 0.3);
  for (let i = 0; i < 26; i++) { // escorridos
    const x = R() * S, L = S * (0.1 + R() * 0.6), w = 1.5 + R() * 6; const lg = g.createLinearGradient(0, 0, 0, L);
    lg.addColorStop(0, 'rgba(20,14,12,.6)'); lg.addColorStop(1, 'rgba(20,14,12,0)'); g.fillStyle = lg; g.fillRect(x, 0, w, L);
  }
  for (let i = 0; i < 16; i++) {
    const x = R() * S, y = R() * S, a = R() * 7;
    crack(g, R, x, y, a, 26, 7, 1.4, 'rgba(8,6,8,.85)', 0.2);
  }
  for (let i = 0; i < 16; i++) crack(b, R, R() * S, R() * S, R() * 7, 26, 7, 2, 'rgba(0,0,0,.9)', 0.2);
  for (let i = 0; i < 40; i++) blob(b, S, S, R() * S, R() * S, 6 + R() * 20, '0,0,0', 0.3, true, false); // lascas
  grain(g, S, S, 18, R); grain(b, S, S, 30, R);
  return { map: tex(c), bump: tex(cb, { srgb: false }) };
}

// ---------- TETO: reboco escuro com auréolas de infiltração ----------
function ceilingTex(seed, S = 512) {
  const R = rng(seed), [c, g] = canvas(S);
  g.fillStyle = '#211a22'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) blob(g, S, S, R() * S, R() * S, 30 + R() * 90, R() < 0.6 ? '4,3,5' : '60,50,56', 0.1 + R() * 0.2);
  for (let i = 0; i < 9; i++) { // auréolas: anel marrom com miolo mais claro
    const x = R() * S, y = R() * S, r = 30 + R() * 70;
    blob(g, S, S, x, y, r, '70,48,20', 0.35); blob(g, S, S, x, y, r * 0.75, '26,20,24', 0.5);
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.strokeStyle = 'rgba(90,60,24,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + ox, y + oy, r * 0.8, r * 0.7, R() * 3, 0, 7); g.stroke(); }
  }
  for (let i = 0; i < 10; i++) crack(g, R, R() * S, R() * S, R() * 7, 30, 8, 1.2, 'rgba(0,0,0,.8)', 0.15);
  grain(g, S, S, 12, R);
  return { map: tex(c) };
}

// ---------- SUJEIRA dos móveis (multiplica a cor do material): bordas escurecidas, arranhões, manchas ----------
function grime(seed, S = 256) {
  const R = rng(seed), [c, g] = canvas(S), [cb, b] = canvas(S);
  g.fillStyle = '#e4e0da'; g.fillRect(0, 0, S, S); b.fillStyle = '#b4b4b4'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) blob(g, S, S, R() * S, R() * S, 14 + R() * 50, R() < 0.75 ? '30,22,18' : '255,250,240', 0.1 + R() * 0.25, false, false);
  for (const [x0, y0, x1, y1] of [[0, 0, 0, 44], [0, S, 0, S - 44], [0, 0, 44, 0], [S, 0, S - 44, 0]]) { // bordas de cada face mais escuras
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,.72)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  for (let i = 0; i < 60; i++) {
    const x = R() * S, y = R() * S, a = R() * 7, L = 8 + R() * 60, light = R() < 0.4;
    g.strokeStyle = light ? `rgba(255,255,255,${0.15 + R() * 0.3})` : `rgba(0,0,0,${0.2 + R() * 0.4})`; g.lineWidth = 0.8 + R();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    b.strokeStyle = 'rgba(0,0,0,.5)'; b.lineWidth = 1.2; b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); b.stroke();
  }
  for (let i = 0; i < 3; i++) blob(g, S, S, R() * S, R() * S, 10 + R() * 26, '70,8,8', 0.35, false, false);
  grain(g, S, S, 26, R); grain(b, S, S, 30, R);
  return { map: tex(c, { aniso: 2 }), bump: tex(cb, { srgb: false, aniso: 2 }) };
}

export function makeProcedural() {
  return {
    floor: planks(11), wood: planks(12, { rows: 8, base: [150, 132, 118], vary: 22, dirt: 0.8 }),
    wallpaper: wallpaper(21), plaster: plaster(31), ceiling: ceilingTex(41), grime: grime(51),
  };
}

// UV pelo MUNDO: em faces verticais u = x + z (uma das duas é constante em cada face de caixa alinhada aos eixos) e v = altura;
// em faces horizontais (piso, teto, tampo) usa (x, z). `su`/`sv` são repetições por metro.
export function worldUV(material, su, sv = su) {
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 wpT = modelMatrix * vec4(transformed, 1.0);
        vec3 wnT = normalize(mat3(modelMatrix) * objectNormal);
        vec2 tuv = abs(wnT.y) > 0.5 ? wpT.xz * ${su.toFixed(5)} : vec2((wpT.x + wpT.z) * ${su.toFixed(5)}, wpT.y * ${sv.toFixed(5)});
        #ifdef USE_MAP
          vMapUv = tuv;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = tuv;
        #endif
      }`);
  };
  material.customProgramCacheKey = () => 'wuv' + su + '_' + sv;
  return material;
}

export function loadImages(base = 'textures/') {
  const L = new THREE.TextureLoader();
  const img = (f, repeat) => { const t = L.load(base + f); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  return {
    portraits: ['portrait_1.jpg', 'portrait_2.jpg', 'portrait_3.jpg', 'portrait_4.jpg'].map((f) => img(f)),
    scenes: ['scene_1.jpg', 'scene_2.jpg'].map((f) => img(f)),
    rug: img('rug.jpg'), runner: img('runner.jpg'), tiles: img('tiles.jpg', true), door: img('door.jpg'),
    bloodFloor: ['blood_floor_1.png', 'blood_floor_2.png'].map((f) => img(f)), bloodWall: ['blood_wall_1.png', 'blood_wall_2.png'].map((f) => img(f)),
  };
}
