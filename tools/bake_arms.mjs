// Prepara os braços em primeira pessoa a partir de um modelo estático (sem esqueleto, braços pendurados, mãos abertas):
//  1) separa braço esquerdo e direito; 2) reorienta cada um para o referencial do punho do jogo (dedos para -Z, costas da mão
//  para +Y, origem no meio do punho); 3) FECHA A MÃO dobrando os vértices dos dedos em duas "juntas" (deformador de dobra);
//  4) grava um .glb com os nós arm_A e arm_B e a textura reduzida em WebP.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, quantize, prune, dedup, weld } from '@gltf-transform/functions';
import sharp from 'sharp'; import fs from 'fs';
const [,, inPath, texPath, outPath, curlArg] = process.argv; const CURL = curlArg === undefined ? 1 : +curlArg;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = await io.read(inPath);
const V = { sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]], mul: (a, k) => [a[0]*k, a[1]*k, a[2]*k],
  dot: (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], len: (a) => Math.hypot(...a), norm: (a) => { const l = Math.hypot(...a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; } };
// junta todas as malhas em listas de triângulos (posição, normal, uv por vértice de triângulo)
const tris = [];
for (const node of src.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
  const tp = (p) => [M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12], M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13], M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14]];
  const tn = (p) => V.norm([M[0]*p[0]+M[4]*p[1]+M[8]*p[2], M[1]*p[0]+M[5]*p[1]+M[9]*p[2], M[2]*p[0]+M[6]*p[1]+M[10]*p[2]]);
  for (const prim of mesh.listPrimitives()) { const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), U = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
    const n = I ? I.getCount() : P.getCount();
    for (let i = 0; i < n; i += 3) { const t = []; for (let k = 0; k < 3; k++) { const vi = I ? I.getScalar(i + k) : i + k; t.push({ p: tp(P.getElement(vi, [])), n: tn(N.getElement(vi, [])), u: U ? U.getElement(vi, []) : [0, 0] }); } tris.push(t); } } }
const out = new Document(); const buf = out.createBuffer(); const scene = out.createScene('arms');
const tex = out.createTexture('base').setImage(fs.readFileSync(texPath)).setMimeType('image/png');
const mat = out.createMaterial('arms').setBaseColorTexture(tex).setRoughnessFactor(0.75).setMetallicFactor(0);
const parts = { '-1': tris.filter((t) => t[0].p[0] + t[1].p[0] + t[2].p[0] < 0), '1': tris.filter((t) => t[0].p[0] + t[1].p[0] + t[2].p[0] >= 0) };
// 3 formatos de mão: punho fechado (socos), pegada (segurar objetos / agarrar) e aberta (alcançar)
for (const [suffix, curl] of [['', CURL], ['_grip', 0.55], ['_open', 0.12]])
for (const [base, sgn] of [['arm_A', -1], ['arm_B', 1]]) {
  const name = base + suffix;
  const T = parts[sgn]; const verts = T.flat().map((v) => ({ p: [...v.p], n: [...v.n], u: v.u }));
  const ys = verts.map((v) => v.p[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys), H = y1 - y0;
  const cen = (f) => { const s = verts.filter(f); return V.mul(s.reduce((a, v) => V.add(a, v.p), [0, 0, 0]), 1 / s.length); };
  const tip = cen((v) => v.p[1] < y0 + H * 0.04), mid = cen((v) => v.p[1] > y0 + H * 0.3 && v.p[1] < y0 + H * 0.4);
  const d = V.norm(V.sub(tip, mid));                                    // eixo antebraço -> ponta dos dedos
  let up = [sgn, 0, 0]; up = V.norm(V.sub(up, V.mul(d, V.dot(up, d)))); // costas da mão = para fora do corpo
  const right = V.norm(V.cross(up, V.mul(d, -1)));                      // X = Y × Z, com Z = -d
  const toL = (p) => { const q = V.sub(p, tip); return [V.dot(q, right), V.dot(q, up), -V.dot(q, d)]; }; // dedos em -Z: ponta em z=0, braço em z>0
  const toLn = (n) => [V.dot(n, right), V.dot(n, up), -V.dot(n, d)];
  for (const v of verts) { v.p = toL(v.p); v.n = toLn(v.n); }
  // perfil de largura ao longo do braço para achar o punho (estreitamento depois da palma)
  const zmax = Math.max(...verts.map((v) => v.p[2])); const bins = 80, w = new Array(bins).fill(0), lo = new Array(bins).fill(1e9), hi = new Array(bins).fill(-1e9);
  for (const v of verts) { const b = Math.min(bins - 1, Math.floor(v.p[2] / zmax * bins)); lo[b] = Math.min(lo[b], v.p[0]); hi[b] = Math.max(hi[b], v.p[0]); }
  for (let b = 0; b < bins; b++) w[b] = hi[b] >= lo[b] ? hi[b] - lo[b] : NaN;
  for (let b = 1; b < bins; b++) if (Number.isNaN(w[b])) { w[b] = w[b - 1]; lo[b] = lo[b - 1]; hi[b] = hi[b - 1]; }
  let bmax = 0; for (let b = 1; b < bins * 0.3; b++) if (w[b] > w[bmax]) bmax = b;
  let bw = bmax; for (let b = bmax; b < bins * 0.45; b++) if (w[b] < w[bw]) bw = b;
  const Lh = (bw + 0.5) / bins * zmax;                                 // comprimento da mão (ponta -> punho)
  const palmW = w[bmax];
  // dobra: junta 1 (nós dos dedos) e junta 2 (meio dos dedos). Em cada uma, os vértices além da junta giram em torno do eixo X.
  const yAt = (z) => { const s = verts.filter((v) => Math.abs(v.p[2] - z) < Lh * 0.05); return s.reduce((a, v) => a + v.p[1], 0) / (s.length || 1); };
  const bend = (zj, ang, band) => { const yj = yAt(zj) - Lh * 0.02;
    for (const v of verts) { const k = Math.min(1, Math.max(0, (zj + band - v.p[2]) / (2 * band))); if (k <= 0) continue; const a = ang * k, c = Math.cos(a), s = Math.sin(a);
      const y = v.p[1] - yj, z = v.p[2] - zj; v.p = [v.p[0], yj + y * c + z * s, zj - y * s + z * c]; v.n = [v.n[0], v.n[1] * c + v.n[2] * s, -v.n[1] * s + v.n[2] * c]; } };
  if (curl > 0) { bend(Lh * 0.24, 1.75 * curl, Lh * 0.05); bend(Lh * 0.50, 1.45 * curl, Lh * 0.06); }
  // origem no meio do punho fechado; escala para o tamanho do punho do jogo (palma ~0,23 de largura)
  const s = 0.23 / palmW; const xc = (lo[bmax] + hi[bmax]) / 2, zc = Lh * 0.55, yc = yAt(Lh * 0.7);
  for (const v of verts) v.p = [(v.p[0] - xc) * s, (v.p[1] - yc) * s, (v.p[2] - zc) * s];
  const pos = new Float32Array(verts.length * 3), nor = new Float32Array(verts.length * 3), uv = new Float32Array(verts.length * 2);
  verts.forEach((v, i) => { pos.set(v.p, i * 3); nor.set(V.norm(v.n), i * 3); uv.set(v.u, i * 2); });
  const prim = out.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
    .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
    .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf));
  scene.addChild(out.createNode(name).setMesh(out.createMesh(name).addPrimitive(prim)));
  console.log(name, 'tris', T.length, 'mão', Lh.toFixed(4), 'palma', palmW.toFixed(4), 'escala', s.toFixed(2));
}
await out.transform(weld(), dedup(), prune(), quantize({ quantizePosition: 14, quantizeTexcoord: 12 }), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }));
await io.write(outPath, out); console.log('bytes', fs.statSync(outPath).size);
