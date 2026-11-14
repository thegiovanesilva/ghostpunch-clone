// MODELOS PRONTOS (glTF/GLB com esqueleto e animações). O jogo funciona sem eles: se o arquivo não existir, continua com o
// personagem feito de primitivas. Coloque o fantasma em public/models/ghost.glb (ver README, Etapa 28).
//
// Otimizações aplicadas a todo modelo carregado (Aula 10: remoção de faces ocultas):
//  - BACK-FACE CULLING: muitos modelos vêm com material "dupla face"; aqui volta para FrontSide, então o WebGL descarta
//    os triângulos de costas para a câmera (teste do sinal da normal) antes de pintar.
//  - Z-BUFFER em vez do ALGORITMO DO PINTOR: material transparente obriga o three.js a ordenar os objetos de trás para
//    frente a cada quadro (pintor) e não grava profundidade. Texturas com recorte (cabelo, renda) passam a usar alphaTest:
//    o pixel é "tudo ou nada", continua opaco para o z-buffer e não precisa de ordenação.
//  - Volume envolvente fixo e folgado para o descarte por frustum (o padrão recalcularia os ossos ou erraria na animação).
//  - Animação em "degraus" (≈14 quadros/s): além de dar o tranco de filme de terror, calcula as poses menos vezes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// nome do clipe -> papel no jogo (aceita os nomes do Mixamo e parecidos, em qualquer caixa)
const ROLES = {
  crawl: /crawl|rastej/, run: /run|sprint|charge|corr/, walk: /walk|float|shamble|and(ar|ando)/, idle: /idle|stand|breath|parad/,
  attack: /attack|swipe|claw|punch|scream|roar|bite|ataq/, cast: /cast|spell|magic|summon|pray/, hit: /hit|react|impact|hurt|dano/,
  fall: /fall|knock|flying|air|thrown/, down: /lying|laying|down|stun|dizzy|get.?up|chao/, death: /death|die|dying|mort/,
};
// o que tocar em cada estado; o primeiro papel que o modelo tiver é usado
const WANT = {
  idle: ['idle', 'walk'], walk: ['walk', 'idle'], run: ['run', 'walk', 'idle'], crawl: ['crawl', 'walk', 'idle'],
  attack: ['attack', 'cast', 'idle'], cast: ['cast', 'attack', 'idle'], fall: ['fall', 'hit', 'idle'], down: ['down', 'hit', 'death', 'idle'],
  death: ['death', 'down', 'fall', 'idle'], hit: ['hit', 'idle'],
};

export function createModelRig({ url, height, parent, onReady, shadows = false }) {
  const rig = { ready: false, root: null, clips: {}, current: null, mixer: null, mats: [], acc: 0, tris: 0, info: '' };
  rig.has = (role) => !!rig.clips[role];
  new GLTFLoader().load(url, (gltf) => {
    const root = gltf.scene;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = shadows; o.receiveShadow = false;
      rig.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.side = THREE.FrontSide;                                              // back-face culling
        if (m.transparent && m.map) { m.transparent = false; m.alphaTest = 0.5; m.depthWrite = true; } // recorte no z-buffer, sem ordenação
        if (m.map) m.map.anisotropy = 2;
        if (!rig.mats.includes(m)) rig.mats.push(m);
      }
    });
    rig.mixer = new THREE.AnimationMixer(root);
    for (const clip of gltf.animations) {
      // tira o deslocamento horizontal do quadril ("root motion"): quem move o personagem é a física do jogo
      for (const tr of clip.tracks) if (/hips?\.position$/i.test(tr.name)) for (let i = 3; i < tr.values.length; i += 3) { tr.values[i] = tr.values[0]; tr.values[i + 2] = tr.values[2]; }
      const n = clip.name.toLowerCase();
      for (const role in ROLES) if (!rig.clips[role] && ROLES[role].test(n)) { rig.clips[role] = rig.mixer.clipAction(clip); break; }
    }
    if (!rig.clips.idle && gltf.animations[0]) rig.clips.idle = rig.mixer.clipAction(gltf.animations[0]);
    // encaixa no tamanho do personagem do jogo: pés em y = 0, centralizado, altura = `height`
    // (malha com esqueleto: a caixa precisa considerar os ossos, senão modelos em centímetros ficam gigantes)
    if (rig.clips.idle) { rig.clips.idle.play(); rig.mixer.update(0); } // mede na pose da animação parada (a pose de repouso do arquivo pode estar afundada/torta)
    root.updateMatrixWorld(true);
    const box = new THREE.Box3(), tmpB = new THREE.Box3();
    root.traverse((o) => { if (!o.isMesh) return; if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); tmpB.copy(o.boundingBox); } else { o.geometry.computeBoundingBox(); tmpB.copy(o.geometry.boundingBox); } box.union(tmpB.applyMatrix4(o.matrixWorld)); });
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const s = height / (size.y || 1);
    root.scale.multiplyScalar(s); root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    root.updateMatrixWorld(true);
    root.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = true; o.boundingSphere = new THREE.Sphere(o.worldToLocal(new THREE.Vector3(0, height / 2, 0)), height * 1.6 / (o.matrixWorld.getMaxScaleOnAxis() || 1)); } }); // volume folgado para as animações
    if (rig.clips.idle) { rig.current = rig.clips.idle; }
    rig.root = root; parent.add(root); rig.ready = true;
    rig.info = `${url}: ${Math.round(rig.tris)} triângulos, clipes: ${Object.keys(rig.clips).join(', ') || 'nenhum'}`;
    console.info('[modelo] ' + rig.info + (rig.tris > 40000 ? ' — PESADO: rode tools/optimize_models.sh' : ''));
    onReady?.(rig);
  }, undefined, () => console.info('[modelo] ' + url + ' não encontrado: usando o personagem de primitivas'));

  // escolhe o clipe do estado, com transição suave; `once` = toca uma vez e segura a última pose (morte, queda)
  rig.play = (state, { speed = 1, once = false, fade = 0.18 } = {}) => {
    if (!rig.ready) return;
    const role = (WANT[state] || [state]).find((r) => rig.clips[r]); const act = rig.clips[role];
    if (!act) return;
    act.timeScale = speed;
    if (act === rig.current) return;
    act.reset(); act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); act.clampWhenFinished = once;
    if (rig.current) act.crossFadeFrom(rig.current, fade, false);
    act.play(); rig.current = act;
  };
  rig.update = (dt, stepped = true) => {
    if (!rig.ready) return;
    if (!stepped) { rig.mixer.update(dt); return; }
    rig.acc += dt; const step = 1 / 14;
    if (rig.acc >= step) { rig.mixer.update(rig.acc); rig.acc = 0; }
  };
  rig.setEmissive = (hex, intensity) => { for (const m of rig.mats) if (m.emissive) { m.emissive.setHex(hex); m.emissiveIntensity = intensity; } };
  rig.setOpacity = (a) => { for (const m of rig.mats) { m.transparent = a < 1; m.opacity = a; } };
  return rig;
}

// BRAÇOS EM PRIMEIRA PESSOA (opcional): public/models/arms.glb com os nós arm_A (direito) e arm_B (esquerdo), já no
// referencial do punho do jogo (ver tools/bake_arms.mjs). Cada braço entra como filho do grupo do punho, então as poses
// de soco por quadros-chave continuam valendo. Sem o arquivo, ficam as mãos de primitivas.
export function loadFirstPersonArms(url, hands, onReady) {
  new GLTFLoader().load(url, (gltf) => {
    for (const h of hands) {
      const base = h.side > 0 ? 'arm_A' : 'arm_B';
      const node = gltf.scene.getObjectByName(base); if (!node) continue;
      for (const ch of h.fist.children) ch.visible = false;
      // 3 formatos de mão (feitos em tools/bake_arms.mjs): punho fechado, pegada e aberta; só um aparece por vez
      h.shapes = {};
      for (const [k, suf] of [['fist', ''], ['grip', '_grip'], ['open', '_open']]) {
        const n = gltf.scene.getObjectByName(base + suf); if (!n) continue;
        n.traverse((o) => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
          const m = o.material; m.side = THREE.FrontSide; m.emissive = new THREE.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = 0.13; }); // um pouco de luz própria: os braços não somem no escuro
        n.visible = k === 'fist'; h.fist.add(n); h.shapes[k] = n;
      }
      h.model = node;
    }
    console.info('[modelo] ' + url + ': braços carregados'); onReady?.();
  }, undefined, () => console.info('[modelo] ' + url + ' não encontrado: usando as mãos de primitivas'));
}
