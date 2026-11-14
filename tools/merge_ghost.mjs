// Junta o personagem (com pele) e as animações (sem pele) do Mixamo num único .glb, renomeando os clipes para os papéis do jogo.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, unpartition, mergeDocuments, prune, dedup, resample, quantize, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
const RATIO = +(process.env.SIMPLIFY || 1);
import fs from 'fs';
const [,, dir, out, texPath] = process.argv;
const MAP = { idle: 'Zombie Idle', walk: 'Walking', run: 'Zombie Run', crawl: 'Zombie Crawl', attack: 'Zombie Attack', cast: 'Zombie Scream', hit: 'Hit Reaction', fall: 'Falling Back Death', down: 'Knocked Down', death: 'Zombie Death' };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base = await io.read(`${dir}/${MAP.idle}.glb`);
const root = base.getRoot();
const byName = new Map(); for (const n of root.listNodes()) if (!byName.has(n.getName())) byName.set(n.getName(), n);
root.listAnimations()[0].setName('idle');
console.log('base: nodes', root.listNodes().length, 'meshes', root.listMeshes().length, 'textures', root.listTextures().map(t => t.getName() + ':' + t.getMimeType() + ':' + (t.getImage()?.length || 0)), 'materials', root.listMaterials().map(m => m.getName()));
for (const [role, file] of Object.entries(MAP)) {
  if (role === 'idle') continue;
  const doc = await io.read(`${dir}/${file}.glb`);
  const before = new Set(root.listAnimations()), scenesBefore = new Set(root.listScenes());
  mergeDocuments(base, doc);
  for (const a of root.listAnimations()) if (!before.has(a)) {
    a.setName(role); let miss = 0;
    for (const ch of a.listChannels()) { const t = ch.getTargetNode(); const o = t && byName.get(t.getName()); if (o) ch.setTargetNode(o); else { miss++; ch.dispose(); } }
    if (miss) console.log(role, 'canais sem osso correspondente:', miss);
  }
  for (const s of root.listScenes()) if (!scenesBefore.has(s)) { for (const n of s.listChildren()) n.dispose(); s.dispose(); }
}
// nós órfãos das cenas removidas
const keep = new Set(); const walk = (n) => { keep.add(n); n.listChildren().forEach(walk); }; root.listScenes().forEach(s => s.listChildren().forEach(walk));
for (const n of root.listNodes()) if (!keep.has(n)) n.dispose();
// texturas por material: texPath = pasta; procura "<nome do material sem _low>_low_Base_Color.png" ou "<material>*Base*"
if (texPath && fs.existsSync(texPath) && fs.statSync(texPath).isDirectory()) {
  const files = fs.readdirSync(texPath);
  for (const m of root.listMaterials()) {
    const key = m.getName().replace(/_low$/i, '').toLowerCase();
    const f = files.find((x) => x.toLowerCase().startsWith(key) && /base_?color/i.test(x));
    if (!f) { console.log('sem textura para', m.getName()); continue; }
    const tex = base.createTexture(m.getName()).setImage(fs.readFileSync(texPath + '/' + f)).setMimeType('image/png');
    m.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85);
    console.log(m.getName(), '<-', f);
  }
} else if (texPath && fs.existsSync(texPath)) {
  const img = fs.readFileSync(texPath);
  let tex = root.listTextures()[0] || base.createTexture('diffuse');
  tex.setImage(img).setMimeType('image/png');
  for (const m of root.listMaterials()) if (!m.getBaseColorTexture()) m.setBaseColorTexture(tex);
}
await base.transform(unpartition(), ...(RATIO < 1 ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.002 })] : []), dedup(), resample(), prune(), quantize(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }));
await io.write(out, base);
console.log('animações:', root.listAnimations().map(a => a.getName() + '(' + a.listChannels().length + ')').join(' '), '| bytes', fs.statSync(out).size);
