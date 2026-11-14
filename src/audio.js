// ============================================================
// ÁUDIO DO GHOSTPUNCH MINI: tudo sintetizado por código (Web Audio API).
// Não há arquivos de som: cada efeito é montado com osciladores (tom),
// ruído filtrado e envelopes de volume. Os sons do fantasma são 3D
// (PannerNode): você ouve de que lado ele está.
// ============================================================

export function createAudio(initial = {}) {
  const base = initial.base ?? 'sounds/';
  let ctx = null, master, analyser, noiseBuf, drone, droneGain, windGain, revIn = null, bed = null;
  let vol = initial.vol ?? 0.7;
  let muted = !!initial.muted;
  let tension = 0, tensionSm = 0;        // 0 = longe do fantasma, 1 = colado nele
  let presence = null;
  let whisperT = 6, creakT = 14, dripT = 7, beatT = 0, stepT = 0, farT = 9, croakT = 4;
  const api = {};

  // ---------- infraestrutura ----------
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC({ latencyHint: 'balanced' }); // buffer um pouco maior: o áudio não picota quando o jogo pesa (câmera lenta, explosões)
    master = ctx.createGain();
    master.gain.value = muted ? 0 : vol;
    // REVERBERAÇÃO (ConvolverNode): os sons 3D e o fundo passam por uma "sala" de ~2 s gerada por código
    // (ruído que decai exponencialmente, com os graves durando mais) — dá o eco de casarão vazio de filme de terror
    const len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.35 + 0.5 * (1 - t)); ch[i] = lp * Math.pow(1 - t, 2.6); } }
    irBuf = ir; revIn = ctx.createGain();
    buildOutput();
    // ruído branco de 2 s, reaproveitado por todos os efeitos
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // SAÍDA (compressor + analisador + reverberação). Fica numa função para poder ser RECONSTRUÍDA: se algum filtro do
  // navegador produzir um valor inválido (NaN/infinito), ele "envenena" o compressor e a reverberação para sempre e o
  // jogo fica mudo — o vigia (api.watchdog) detecta isso e monta a saída de novo.
  let irBuf = null, outNodes = [];
  function buildOutput() {
    for (const n of outNodes) { try { n.disconnect(); } catch { /* ignora */ } }
    try { master.disconnect(); revIn.disconnect(); } catch { /* ignora */ }
    const comp = ctx.createDynamicsCompressor(); // evita estourar quando vários sons tocam juntos
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    analyser = ctx.createAnalyser(); analyser.fftSize = 8192; // janela de ~0,18 s (os testes leem o pico dessa janela)
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    const conv = ctx.createConvolver(); conv.buffer = irBuf;
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    outNodes = [comp, analyser, conv, revOut];
  }
  let silentFor = 0, wdT = 0;
  api.watchdog = (dt) => {
    if (!ctx) return;
    if (ctx.state !== 'running' && !pausedByGame) { ctx.resume?.(); return; } // o navegador suspendeu/interrompeu: retoma
    wdT += dt; if (wdT < 0.5) return; wdT = 0;
    const buf = new Float32Array(1024); analyser.getFloatTimeDomainData(buf);
    let bad = false, s = 0; for (const x of buf) { if (!Number.isFinite(x)) { bad = true; break; } s += x * x; }
    const rms = Math.sqrt(s / buf.length);
    silentFor = (!muted && vol > 0 && rms < 1e-6) ? silentFor + 0.5 : 0; // o fundo sempre faz algum som: silêncio total = travou
    if (bad || silentFor >= 2) { silentFor = 0; buildOutput(); console.warn('[áudio] saída reconstruída (' + (bad ? 'valor inválido' : 'silêncio') + ')'); }
  };
  let pausedByGame = false;
  // ---------- SONS GRAVADOS (public/sounds/, ver CREDITOS.md lá) ----------
  // Cada arquivo é baixado e decodificado uma vez; enquanto não carregou (ou se faltar), o jogo usa o som sintetizado.
  const S = {};
  const SAMPLE_FILES = ['ambience_loop', 'explosion', 'ghost_crawl', 'ghost_run', 'ghost_scream', 'ghost_whisper', 'glass_break', 'metal_hit', 'punch_heavy', 'punch_light', 'wall_hit', 'wood_break'];
  function loadSamples() {
    for (const n of SAMPLE_FILES) {
      fetch(base + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((ab) => ctx.decodeAudioData(ab)).then((buf) => { S[n] = buf; if (n === 'ambience_loop') startAmbience(); })
        .catch(() => console.info('[áudio] sem ' + n + '.mp3: usando o som sintetizado'));
    }
  }
  // toca um trecho de um arquivo. at = posição 3D (ou nó de destino); rate = velocidade/altura; offset/dur = trecho
  function play(name, { at = null, gain = 1, rate = 1, offset = 0, dur = null, delay = 0, fade = 0.05, ghost = false } = {}) {
    const buf = S[name]; if (!buf || !ok()) return null;
    const s = now() + delay, src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); src.connect(g); g.connect(ghost ? ghostDest(at, 1.0) : dest(at));
    const len = dur ?? (buf.duration - offset) / rate;
    g.gain.setValueAtTime(gain, s);
    if (dur != null) { g.gain.setValueAtTime(gain, s + Math.max(0, len - fade)); g.gain.linearRampToValueAtTime(0.0001, s + len); }
    src.start(s, Math.min(offset, buf.duration - 0.05)); src.stop(s + len + 0.02);
    return { src, g };
  }
  const has = (n) => !!S[n];
  // FUNDO: trilha ambiente em loop (gravada) por cima do grave sintetizado; o volume sobe com a tensão
  let amb = null;
  function startAmbience() {
    if (amb || !S.ambience_loop || !ctx) return;
    const src = ctx.createBufferSource(); src.buffer = S.ambience_loop; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.32, now(), 2); // entra devagar
    src.connect(g); g.connect(master); src.start();
    amb = { src, g };
    if (bed) bed.clG.gain.value = 0; // a trilha substitui o acorde sintetizado
  }
  // RASTEJAR NO TETO: loop do arquivo enquanto ela rasteja, saindo da posição dela
  let crawl = null;
  function crawlLoop(on, pos) {
    if (on && !crawl && S.ghost_crawl) {
      const src = ctx.createBufferSource(); src.buffer = S.ghost_crawl; src.loop = true; src.playbackRate.value = 1.1;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.9, now(), 0.15);
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 5; p.rolloffFactor = 0.6;
      src.connect(g); g.connect(p); p.connect(master); if (revIn) p.connect(revIn); src.start(now(), Math.random() * 6);
      crawl = { src, g, p };
    }
    if (crawl && pos) { crawl.p.positionX.value = pos.x; crawl.p.positionY.value = pos.y; crawl.p.positionZ.value = pos.z; }
    if (!on && crawl) { const c = crawl; crawl = null; c.g.gain.setTargetAtTime(0.0001, now(), 0.1); c.src.stop(now() + 0.6); }
  }
  const now = () => ctx.currentTime;
  const R = (a, b) => a + Math.random() * (b - a);

  // destino: direto no master, ou através de um panner 3D na posição `at` ({x,y,z})
  function dest(at) {
    if (!at) return master;
    if (at.connect) return at; // já é um nó de áudio (ex.: ghostDest)
    const p = ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 7; p.rolloffFactor = 0.4; // a sala é grande: o fantasma tem que ser ouvido de longe
    p.positionX.value = at.x; p.positionY.value = at.y ?? 1; p.positionZ.value = at.z;
    p.connect(master); if (revIn) p.connect(revIn); // tudo que vem de um ponto da casa ecoa
    return p;
  }
  // destino com MAIS eco (sons do fantasma): o seco vai baixo e a reverberação alta = vem "de dentro das paredes"
  function ghostDest(at, wet = 1.4) {
    const g = ctx.createGain(); g.gain.value = 1;
    const p = dest(at); g.connect(p);
    if (revIn) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(revIn); }
    return g;
  }
  function env(g, s, dur, gain, attack) {
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(gain, s + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * 0.3), s + Math.max(attack + 0.001, dur * 0.35)); // queda rápida...
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);                                                       // ...e cauda
  }
  // ruído filtrado (estalo, vento, sopro, estilhaço)
  function noise(dur, { type = 'bandpass', f0 = 1000, f1 = null, q = 1, gain = 0.4, attack = 0.004, delay = 0, at = null } = {}) {
    const s = now() + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, s);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, s + dur);
    const makeup = type === 'bandpass' ? Math.sqrt(q) * 1.5 : 1; // faixa estreita deixa passar pouca energia do ruído
    const g = ctx.createGain(); env(g, s, dur, gain * makeup, attack);
    src.connect(f); f.connect(g); g.connect(dest(at));
    src.start(s, Math.random()); src.stop(s + dur + 0.05);
  }
  // tom (batida grave, estalo de madeira, vidro)
  function tone(dur, { type = 'sine', f0 = 100, f1 = null, gain = 0.4, attack = 0.004, delay = 0, at = null, lp = null } = {}) {
    const s = now() + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, s);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, s + dur);
    const g = ctx.createGain(); env(g, s, dur, gain, attack);
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(dest(at));
    o.start(s); o.stop(s + dur + 0.05);
  }
  // VOZ GROTESCA: três osciladores (serra, serra desafinada, onda quadrada uma oitava abaixo = rosnado) com a altura tremendo
  // de forma irregular (jitter), passando por formantes de vogal que "abrem e fecham a boca", distorcidos (WaveShaper, rouquidão),
  // com chocalho opcional (corta o som 20 a 40 vezes por segundo, como um estertor) e sopro de ar por baixo.
  const VOWELS = { aah: [800, 1200], ooh: [350, 800], eee: [300, 2300], ohh: [500, 900] };
  const curves = {}; const curveOf = (k) => (curves[k] ??= distCurve(k));
  const distCurve = (k) => { const c = new Float32Array(512); for (let i = 0; i < 512; i++) c[i] = Math.tanh((i / 256 - 1) * k); return c; };
  let voicesOn = 0; // cada voz são ~12 nós de áudio: com muitas ao mesmo tempo (golpes em sequência + câmera lenta) o áudio engasgava
  function voice(dur, { f0 = 300, f1 = null, gain = 0.15, delay = 0, at = null, vowel = 'aah', jitter = 0.05, rattle = 0, growl = 0.6, dist = 3, breath = 0.25, attack = 0.05 } = {}) {
    if (voicesOn >= 6 || !(dur > 0)) return; // no máximo 6 vozes ao mesmo tempo
    voicesOn++; setTimeout(() => { voicesOn--; }, (dur + delay + 0.1) * 1000);
    const s = now() + delay, out = dest(at), end = f1 ?? f0;
    const steps = Math.max(2, Math.round(dur / 0.045));
    const sum = ctx.createGain();
    for (const [type, mul, det, lvl] of [['sawtooth', 1, 0, 1], ['sawtooth', 1, 35, 0.7], ['square', 0.5, -10, growl]]) {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = det;
      o.frequency.setValueAtTime(f0 * mul, s);
      for (let k = 1; k <= steps; k++) {                 // altura instável: pulinhos aleatórios a cada ~45 ms
        const t = k / steps;
        o.frequency.linearRampToValueAtTime(Math.max(20, f0 * Math.pow(end / f0, t) * mul * (1 + (Math.random() - 0.5) * 2 * jitter)), s + dur * t);
      }
      const g = ctx.createGain(); g.gain.value = lvl;
      o.connect(g); g.connect(sum); o.start(s); o.stop(s + dur + 0.05);
    }
    const form = ctx.createGain();
    for (const fc of VOWELS[vowel]) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(fc * 0.8, s); f.frequency.linearRampToValueAtTime(fc * 1.15, s + dur * 0.5); f.frequency.linearRampToValueAtTime(fc * 0.7, s + dur);
      sum.connect(f); f.connect(form);
    }
    const sh = ctx.createWaveShaper(); sh.curve = curveOf(dist); sh.oversample = 'none';
    form.connect(sh);
    const am = ctx.createGain(); am.gain.value = 1;
    if (rattle) {
      const l = ctx.createOscillator(); l.type = 'square'; l.frequency.value = rattle;
      const lg = ctx.createGain(); lg.gain.value = 0.5;
      am.gain.value = 0.5; l.connect(lg); lg.connect(am.gain); l.start(s); l.stop(s + dur + 0.05);
    }
    const g = ctx.createGain(); env(g, s, dur, gain * 2.6, attack);
    sh.connect(am); am.connect(g); g.connect(out);
    if (breath > 0) noise(dur, { f0: 1800, f1: 900, q: 1.5, gain: breath * gain * 2, attack, delay, at });
  }
  // gorgolejo molhado: ruído por um filtro ressonante cuja frequência balança rápido (bolhas na garganta)
  function gurgle(dur, { gain = 0.4, delay = 0, at = null, rate = 11 } = {}) {
    const s = now() + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6; f.frequency.value = 550; // (Q alto + frequência modulada rápido podia desestabilizar o filtro e gerar NaN)
    const l = ctx.createOscillator(); l.frequency.value = rate;
    const lg = ctx.createGain(); lg.gain.value = 380;
    l.connect(lg); lg.connect(f.frequency);
    const g = ctx.createGain(); env(g, s, dur, gain, 0.03);
    src.connect(f); f.connect(g); g.connect(dest(at));
    src.start(s, Math.random()); l.start(s); src.stop(s + dur + 0.05); l.stop(s + dur + 0.05);
  }
  // esguicho: o impacto "afunda" na carne
  function squelch(power, at = null, delay = 0) {
    gurgle(0.12 + 0.1 * power, { gain: 0.5, rate: 18, at, delay });
    noise(0.12 + 0.12 * power, { type: 'lowpass', f0: 3000, f1: 150, gain: 0.32, delay, at });
    tone(0.12, { f0: 110, f1: 45, gain: 0.3, delay, at });
  }
  const ok = () => ctx && ctx.state === 'running';

  // ---------- controle ----------
  api.start = () => {            // chamado num clique do jogador (política de autoplay do navegador)
    if (!ctx && !build()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (drone) return;
    loadSamples();
    // FUNDO TENSO de filme de terror, em 3 camadas que crescem com a tensão (fantasma perto):
    //  1) sub-grave: dois senos a 36 Hz quase iguais (batimento lento, sente mais do que ouve) + serra abafada que "respira"
    //  2) cluster dissonante de "cordas": 4 serras em intervalos de semitom (Lá, Si bemol, Mi bemol, Mi), filtradas,
    //     cada uma com vibrato lento próprio — o acorde desafinado típico de trilha de terror
    //  3) agudo vítreo: seno muito alto e fraco com tremolo (sensação de zumbido no ouvido)
    droneGain = ctx.createGain(); droneGain.gain.value = 0.7; droneGain.connect(master);
    const mk = (type, f, g, out) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const gg = ctx.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(out); o.start(); return { o, g: gg }; };
    const lfoTo = (param, rate, depth) => { const l = ctx.createOscillator(); l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = depth; l.connect(lg); lg.connect(param); l.start(); return l; };
    const subF = ctx.createBiquadFilter(); subF.type = 'lowpass'; subF.frequency.value = 160; subF.connect(droneGain);
    lfoTo(subF.frequency, 0.07, 70);
    drone = [mk('sine', 36, 0.11, droneGain), mk('sine', 36.35, 0.09, droneGain), mk('sawtooth', 54.2, 0.035, subF)].map((x) => x.o);
    const clF = ctx.createBiquadFilter(); clF.type = 'lowpass'; clF.frequency.value = 700; clF.Q.value = 0.7;
    const clG = ctx.createGain(); clG.gain.value = 0; clF.connect(clG); clG.connect(master); if (revIn) clG.connect(revIn);
    const cluster = [220, 233.1, 311.1, 329.6].map((f, i) => { const v = mk('sawtooth', f, 0.012, clF); lfoTo(v.o.frequency, 0.13 + i * 0.05, f * 0.006); return v; });
    const hiG = ctx.createGain(); hiG.gain.value = 0; hiG.connect(master); if (revIn) hiG.connect(revIn);
    const hi = mk('sine', 1864, 0.5, hiG); const hiAm = lfoTo(hi.g.gain, 0.3, 0.45);
    bed = { clG, clF, hiG, cluster };
    const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 320; wf.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lg = ctx.createGain(); lg.gain.value = 140;
    lfo.connect(lg); lg.connect(wf.frequency);
    windGain = ctx.createGain(); windGain.gain.value = 0.03;
    w.connect(wf); wf.connect(windGain); windGain.connect(master);
    w.start(); lfo.start();
    // presença do fantasma: respiração ofegante (ruído que "infla e esvazia" a ~0,42 Hz) e um arrastar molhado, os dois saindo da posição dele
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse'; panner.refDistance = 7; panner.rolloffFactor = 0.4;
    panner.connect(master);
    const loopNoise = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      src.connect(f); src.start(); return f;
    };
    const amOf = (node, rate) => {            // tremolo: ganho base 0,5 + LFO de +-0,5
      const am = ctx.createGain(); am.gain.value = 0.5;
      const l = ctx.createOscillator(); l.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = 0.5;
      l.connect(lg); lg.connect(am.gain); l.start(); node.connect(am); return { am, lfo: l };
    };
    const breathAM = amOf(loopNoise('bandpass', 700, 1.3), 0.42);
    const breathG = ctx.createGain(); breathG.gain.value = 0;
    breathAM.am.connect(breathG); breathG.connect(panner);
    const dragAM = amOf(loopNoise('lowpass', 220, 6), 2.2);
    const dragG = ctx.createGain(); dragG.gain.value = 0;
    dragAM.am.connect(dragG); dragG.connect(panner);
    presence = { panner, breathG, dragG, breathLfo: breathAM.lfo };
  };
  // todo frame: posição do fantasma e o quanto ele respira/arrasta em cada estado
  api.presence = (pos, mode) => {
    if (!presence || !ok()) return;
    const p = presence.panner;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    const t = { chase: [0.5, 0.35], windup: [0.3, 0], dash: [0, 0], stun: [0.9, 0], dying: [0.2, 0] }[mode] ?? [0.3, 0];
    const tc = ctx.currentTime;
    presence.breathG.gain.setTargetAtTime(t[0] * 0.6, tc, 0.15);
    presence.dragG.gain.setTargetAtTime(t[1] * 0.5, tc, 0.15);
    presence.breathLfo.frequency.setTargetAtTime(mode === 'stun' ? 0.9 : 0.42, tc, 0.3); // tonto: respira mais rápido, engasgado
    crawlLoop(mode === 'ceil', pos);
    croakT -= 1 / 60;
    if (croakT <= 0 && (mode === 'chase' || mode === 'ceil' || mode === 'appear')) { croakT = R(3.5, 8); api.croak({ x: pos.x, y: pos.y, z: pos.z }, R(0.7, 1.6), 0.45); }
  };
  api.setPaused = (p) => { pausedByGame = p; if (!ctx) return; if (p) ctx.suspend(); else ctx.resume(); };
  api.setVolume = (v) => { vol = v; if (master) master.gain.value = muted ? 0 : vol; };
  api.setMuted = (m) => { muted = m; if (master) master.gain.value = muted ? 0 : vol; };
  api.toggleMute = () => { api.setMuted(!muted); return muted; };
  api.isMuted = () => muted;
  api.setTension = (v) => { tension = v; };
  api.level = () => { // volume instantâneo (usado nos testes)
    if (!analyser) return 0;
    const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    let s = 0; for (const x of a) s += x * x; return Math.sqrt(s / a.length);
  };
  api.peak = () => { // maior amplitude instantânea (usado nos testes)
    if (!analyser) return 0;
    const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    let m = 0; for (const x of a) m = Math.max(m, Math.abs(x)); return m;
  };
  api.state = () => ctx?.state ?? 'none';
  api.dispose = () => { try { ctx?.close(); } catch { /* ignora */ } amb = null; crawl = null; ctx = null; drone = null; droneGain = null; presence = null; };

  // posição e direção dos ouvidos (a câmera), para os sons 3D
  api.listener = (camera) => {
    if (!ctx) return;
    const l = ctx.listener, p = camera.position;
    camera.getWorldDirection(camera._fwd ??= camera.position.clone());
    const f = camera._fwd;
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  };

  // chamado todo frame: tensão, batimento cardíaco, sussurros, rangidos, passos
  api.tick = (dt, { walking = false, listenerPos = null } = {}) => {
    if (!ok()) return;
    tensionSm += (tension - tensionSm) * Math.min(1, dt * 2);
    if (droneGain) droneGain.gain.value = 0.55 + tensionSm * 0.9;
    if (amb) amb.g.gain.setTargetAtTime(0.28 + tensionSm * 0.3, ctx.currentTime, 0.8);
    if (bed) { // o cluster e o agudo entram com a tensão; o filtro abre (o acorde fica mais "áspero" com ele perto)
      const tc = ctx.currentTime;
      bed.clG.gain.setTargetAtTime(amb ? 0 : 0.25 + tensionSm * 1.1, tc, 0.5);
      bed.clF.frequency.setTargetAtTime(500 + tensionSm * 1800, tc, 0.5);
      bed.hiG.gain.setTargetAtTime(0.004 + tensionSm * 0.018, tc, 0.8);
    }
    // eventos distantes da casa: porta batendo longe, metal arranhado, ruído que cresce e corta
    farT -= dt;
    if (farT <= 0 && listenerPos) {
      farT = R(14, 30) - tensionSm * 6;
      const ang = R(0, Math.PI * 2), at = { x: listenerPos.x + Math.cos(ang) * 12, y: 2, z: listenerPos.z + Math.sin(ang) * 12 };
      const r = Math.random();
      if (r < 0.35) api.farBoom(at); else if (r < 0.7) api.metalScrape(at); else api.swell(R(1.2, 2.2));
    }
    // batimento cardíaco: mais rápido e mais alto quando o fantasma está perto
    if (tensionSm > 0.2) {
      beatT -= dt;
      if (beatT <= 0) {
        beatT = 1.15 - 0.7 * tensionSm;
        const g = 0.12 + 0.3 * tensionSm;
        tone(0.16, { f0: 62, f1: 38, gain: g });
        tone(0.14, { f0: 55, f1: 35, gain: g * 0.7, delay: 0.17 });
      }
    }
    // sussurros em posições aleatórias em volta do jogador
    whisperT -= dt;
    if (whisperT <= 0 && listenerPos) {
      whisperT = R(7, 16) - tensionSm * 4;
      const a = R(0, Math.PI * 2), r = R(3, 7);
      api.whisper({ x: listenerPos.x + Math.cos(a) * r, y: 1.4, z: listenerPos.z + Math.sin(a) * r });
    }
    dripT -= dt;
    if (dripT <= 0 && listenerPos) { dripT = R(5, 11); const a2 = R(0, Math.PI * 2); api.drip({ x: listenerPos.x + Math.cos(a2) * 5, y: 0.2, z: listenerPos.z + Math.sin(a2) * 5 }); }
    creakT -= dt;
    if (creakT <= 0 && listenerPos) {
      creakT = R(12, 26);
      const a = R(0, Math.PI * 2);
      tone(R(0.5, 0.9), { type: 'sawtooth', f0: R(70, 110), f1: R(120, 180), gain: 0.05, lp: 420, at: { x: listenerPos.x + Math.cos(a) * 6, y: 1, z: listenerPos.z + Math.sin(a) * 6 } });
    }
    if (walking) {
      stepT -= dt;
      if (stepT <= 0) { stepT = 0.36; api.step(); }
    } else stepT = 0;
  };

  // ---------- efeitos ----------
  // golpe cortando o ar (atrasado até o meio da animação)
  api.whoosh = (power = 0.5, delay = 0) => ok() && noise(0.12 + 0.12 * power, { f0: 500 + 300 * power, f1: 1800 + 1500 * power, q: 1.2, gain: 0.3 + 0.35 * power, attack: 0.03, delay });
  // Impactos "de verdade": nada de tom que cai de altura (isso é o "bonk" de desenho animado). Uma pancada real é
  // ruído de banda larga com decaimento rápido (o corpo), um estalo agudo (a superfície) e ressonâncias de frequência FIXA.
  function modes(freqs, dur, gain, at = null, delay = 0, q = 20) { // modos de ressonância: cada um é um ruído passa-faixa estreito e curto
    for (const f of freqs) noise(dur, { f0: f * R(0.97, 1.03), q, gain, delay, at, attack: 0.002 });
  }
  api.hit = (power = 0.5, pitch = 1) => {
    if (!ok()) return;
    if (has('punch_light')) { // soco no fantasma: arquivo gravado (forte acima de 0,75) + um grave curto por baixo e o osso
      play(power > 0.75 ? 'punch_heavy' : 'punch_light', { gain: 0.7 + 0.5 * power, rate: (power > 0.75 ? 0.95 : 1) * (0.94 + Math.random() * 0.12) * (0.97 + 0.03 * pitch) });
      if (power > 0.6) noise(0.3, { type: 'lowpass', f0: 140, gain: 1.6 }); if (power > 0.45) api.boneCrack(null, power > 0.8 ? 3 : 2, 0.02);
      return;
    }
    const p = power;
    noise(0.09 + 0.12 * p, { type: 'lowpass', f0: 220 + 160 * p, q: 0.8, gain: 4.0 + 2.5 * p });      // corpo: pancada abafada
    noise(0.06, { type: 'lowpass', f0: 900, q: 0.7, gain: 1.6 + 1.0 * p });                           // médios
    modes([95, 140], 0.14 + 0.16 * p, 0.3 + 0.3 * p, null, 0, 6);                                    // ressonância do corpo
    noise(0.025, { f0: 1800 * (0.9 + 0.1 * pitch), q: 0.9, gain: 0.8 + 0.4 * p });                     // tapa na pele
    noise(0.008, { type: 'highpass', f0: 5000, gain: 0.35 });                                          // estalo
    squelch(p * 0.7);                                                                                  // carne cedendo
    if (p > 0.45) api.boneCrack(null, p > 0.8 ? 3 : 2, 0.02);                                          // osso
    if (p > 0.6) noise(0.45, { type: 'lowpass', f0: 140, gain: 2.4, delay: 0.01 });                    // peso do golpe forte (grave sem melodia)
  };
  // gemido de dor: grave, rouco, com estertor e gorgolejo (nada de "uuh" limpo)
  let lastScream = -1; // (também usado pelo grito)
  api.bossHurt = (power = 0.5, at = null) => {
    if (!ok()) return;
    if (now() - lastScream < 0.6) return; // já está gritando: não empilhar mais uma voz em cima
    if (has('ghost_scream') && Math.random() < 0.6) { lastScream = now(); play('ghost_scream', { at, ghost: true, gain: 0.35 + 0.3 * power, rate: 0.7 + Math.random() * 0.15, offset: Math.random() * 5.6, dur: 0.35 + 0.25 * power, fade: 0.12 }); return; }
    if (Math.random() < 0.5) { api.croak(at, 0.4 + 0.3 * power, 0.7); gurgle(0.4, { gain: 0.3, delay: 0.1, at }); return; } // dor: engasgo/estertor
    voice(0.5 + 0.5 * power, { f0: 280 - 40 * power, f1: 120, gain: 0.26 + 0.18 * power, at, vowel: 'ohh', jitter: 0.12, rattle: 24 + 10 * power, dist: 4 });
    voice(0.35 + 0.3 * power, { f0: 560, f1: 250, gain: 0.12 + 0.1 * power, at, vowel: 'aah', jitter: 0.18, dist: 3, breath: 0.4 }); // grito de dor, no médio-agudo
    gurgle(0.5, { gain: 0.4, delay: 0.1, at });
  };
  // estalo de osso (também toca a cada espasmo da cabeça do fantasma); no máximo um a cada 0,5 s
  let lastCrack = -1;
  api.boneCrack = (at = null, n = 2, delay = 0) => {
    if (!ok() || now() - lastCrack < 0.5) return;
    lastCrack = now();
    for (let i = 0; i < n; i++) {
      const d = delay + i * R(0.03, 0.09);
      noise(0.012, { type: 'highpass', f0: 2500, gain: 0.6, delay: d, at });
      tone(0.035, { type: 'triangle', f0: R(1200, 2400), f1: R(400, 800), gain: 0.35, delay: d, at });
      noise(0.05, { f0: R(300, 700), q: 2, gain: 0.5, delay: d + 0.01, at });
    }
    tone(0.12, { f0: 90, f1: 50, gain: 0.3, delay, at });
  };
  // GRITO de quem está sendo arremessado: dura quase o tempo do voo, sobe e desce como um "doppler" desesperado.
  // power 0..1 (força do golpe), dur em segundos, kind: 'launch' (longo) | 'hit' (grito curto de dor ao bater)
  api.scream = (power = 0.5, at = null, dur = 1.0, kind = 'launch') => {
    if (!ok()) return;
    if (now() - lastScream < (kind === 'hit' ? 0.25 : 0.5)) return; // não empilhar gritos
    lastScream = now();
    if (has('ghost_scream')) { // trecho aleatório do grito gravado: curto ao levar golpe, longo ao ser arremessada
      const d = kind === 'hit' ? 0.35 + 0.3 * power : Math.min(2.2, Math.max(0.6, dur || 1));
      play('ghost_scream', { at, ghost: true, gain: 0.55 + 0.4 * power, rate: 0.9 + Math.random() * 0.25, offset: Math.random() * (6.2 - d), dur: d, fade: Math.min(0.25, d * 0.4) });
      if (kind !== 'hit') api.croak(at, d * 0.6, 0.35);
      return;
    }
    if (kind === 'hit') { api.shriek(at, 0.3 + 0.3 * power, 0.5 + 0.4 * power); return; }
    if (Math.random() < 0.5) { api.shriek(at, Math.min(1.6, Math.max(0.6, dur)), 0.6 + 0.4 * power); return; } // arremessada: grito de terror
    const d = Math.min(2.2, Math.max(0.5, dur));
    // agudo rasgado que sobe e cai (a cabeça passa voando) + rugido grave por baixo + gorgolejo
    voice(d, { f0: 380 + 180 * power, f1: 1250 + 500 * power, gain: 0.3 + 0.18 * power, at, vowel: 'eee', jitter: 0.16, rattle: 38, dist: 6, breath: 0.5, attack: 0.03 });
    voice(d * 0.8, { f0: 190, f1: 90, gain: 0.3 + 0.1 * power, at, vowel: 'aah', jitter: 0.2, rattle: 17, dist: 5, delay: 0.04 });
    voice(d * 0.5, { f0: 900, f1: 380, gain: 0.14, at, vowel: 'aah', jitter: 0.25, rattle: 55, dist: 4, delay: d * 0.5 }); // o grito quebra no final
    gurgle(Math.min(d, 1.0), { gain: 0.35, at, delay: 0.1, rate: 14 });
  };
  // pancada do corpo no chão (quique ou queda) – mais forte = mais grave
  api.thud = (power = 0.5, at = null) => {
    if (!ok()) return;
    if (has('wall_hit')) { play('wall_hit', { at, gain: 0.6 + 0.6 * power, rate: 0.6 + 0.2 * (1 - power) }); noise(0.3 + 0.3 * power, { type: 'lowpass', f0: 140, gain: 1.5 + 1.5 * power, at }); return; }
    noise(0.25 + 0.3 * power, { type: 'lowpass', f0: 140 + 60 * power, gain: 2.0 + 2.5 * power, at });
    tone(0.2, { f0: 85, f1: 38, gain: 0.35 + 0.3 * power, at });
    noise(0.03, { type: 'lowpass', f0: 1200, gain: 1.0 * power, at });
  };
  // parede de gesso desabando: estouro grave, crepitar de pedaços e um chiado de poeira
  let lastWB = -1;
  api.wallBreak = (at = null) => {
    if (!ok() || now() - lastWB < 0.25) return; // vários painéis de uma vez: um estrondo só
    lastWB = now();
    if (has('wood_break')) { play('wall_hit', { at, gain: 1.2, rate: 0.7 }); play('wood_break', { at, gain: 1, rate: 0.75 + Math.random() * 0.1 }); noise(0.9, { type: 'highpass', f0: 2500, gain: 0.4, attack: 0.05, delay: 0.05, at }); return; }
    noise(0.7, { type: 'lowpass', f0: 160, gain: 5.5, at });
    noise(0.35, { type: 'lowpass', f0: 1100, f1: 200, gain: 2.5, at });
    crackle(8, at, true);
    noise(0.9, { type: 'highpass', f0: 2500, gain: 0.5, attack: 0.05, delay: 0.05, at }); // poeira caindo
    modes([55, 95], 0.7, 0.3, at, 0, 6);
  };
  let lastWall = -1;
  api.wall = () => {
    if (!ok() || now() - lastWall < 0.12) return;
    lastWall = now();
    if (has('wall_hit')) { play('wall_hit', { gain: 1.1, rate: 0.85 + Math.random() * 0.2 }); noise(0.3, { type: 'lowpass', f0: 160, gain: 2.5 }); return; }
    noise(0.5, { type: 'lowpass', f0: 180, gain: 5.0 });
    noise(0.25, { type: 'lowpass', f0: 900, gain: 2.2 });
    modes([60, 110], 0.4, 0.25, null, 0, 6);
    noise(0.01, { type: 'highpass', f0: 4000, gain: 0.45 });
  };
  api.slam = () => {
    if (!ok()) return;
    noise(1.0, { type: 'lowpass', f0: 160, gain: 3.0 });
    noise(0.7, { type: 'lowpass', f0: 700, f1: 90, gain: 1.4 });
    modes([50, 80], 0.8, 0.3, null, 0, 6);
    noise(0.012, { type: 'highpass', f0: 3500, gain: 0.5 });
    crackle(5, null, true);  // pedaços do chão
  };
  api.knock = (at = null) => { if (!ok()) return; noise(0.07, { type: 'lowpass', f0: 500, gain: 2.6, at }); modes([700, 1500], 0.05, 0.5, at, 0, 10); };
  function crackle(n, at, big) { for (let i = 0; i < n; i++) { const d = i * 0.03 + R(0, 0.03); noise(0.05, { f0: R(700, 1600), q: 3, gain: big ? 0.75 : 0.55, delay: d, at }); modes([R(500, 2500)], 0.06, 0.25, at, d, 15); } }
  const glass = (at) => {
    for (let i = 0; i < 7; i++) tone(R(0.22, 0.5), { f0: R(2200, 5800), gain: 0.1, delay: R(0, 0.14), at });
    noise(0.22, { type: 'highpass', f0: 4200, gain: 0.3, at });
  };
  api.breakProp = (type, at = null, large = false) => {
    if (!ok()) return;
    if (has('wood_break')) { // arquivos: vidro (vaso, garrafa, TV), metal (barril, TV) e madeira (o resto)
      const r = 0.9 + Math.random() * 0.2;
      if (type === 'vase' || type === 'vodka') return void play('glass_break', { at, gain: 1, rate: r });
      if (type === 'tv') { play('glass_break', { at, gain: 0.9, rate: r * 0.9 }); play('metal_hit', { at, gain: 0.8, rate: 0.8 }); return; }
      if (type === 'barrel') return void play('metal_hit', { at, gain: 1, rate: 0.7 * r });
      if (type === 'ball') return void play('wall_hit', { at, gain: 1, rate: 0.8 });
      if (type === 'pillow') return void noise(0.18, { type: 'lowpass', f0: 420, gain: 0.4, at });
      play('wood_break', { at, gain: large ? 1 : 0.7, rate: (large ? 0.85 : 1.15) * r, dur: large ? null : 0.6 }); return;
    }
    if (type === 'vase' || type === 'vodka') glass(at);
    else if (type === 'tv') { glass(at); for (let i = 0; i < 3; i++) noise(0.03, { type: 'highpass', f0: 2500, gain: 0.5, delay: i * 0.06, at }); noise(0.15, { type: 'lowpass', f0: 300, gain: 1.0, at }); }
    else if (type === 'barrel') { noise(0.2, { type: 'lowpass', f0: 350, gain: 3.2, at }); modes([280, 610, 1180], 0.5, 0.6, at, 0, 30); noise(0.01, { type: 'highpass', f0: 3500, gain: 0.4, at }); }
    else if (type === 'ball') noise(0.15, { type: 'lowpass', f0: 250, gain: 3.5, at });
    else if (type === 'pillow') noise(0.18, { type: 'lowpass', f0: 420, gain: 0.4, at });
    else { crackle(large ? 8 : 4, at, large); noise(0.15, { type: 'lowpass', f0: 300, gain: large ? 3.2 : 2.4, at }); if (large) noise(0.4, { type: 'lowpass', f0: 120, gain: 2.2, at }); }
  };
  // lâmpada falhando: estalinhos elétricos e um zumbido curto em cada piscada
  api.flicker = (n = 3) => {
    if (!ok()) return;
    for (let i = 0; i < n; i++) {
      const d = i * 0.12 + R(0, 0.06);
      noise(0.03, { type: 'highpass', f0: 3000, gain: 0.35, delay: d });
      tone(0.08, { type: 'square', f0: 120, f1: 100, gain: 0.07, delay: d, lp: 600 });
    }
  };
  // beber: tampinha abrindo (chiado), três goles e um "ahh" aliviado
  api.drink = () => {
    if (!ok()) return;
    noise(0.12, { type: 'highpass', f0: 4000, gain: 0.4 }); tone(0.05, { f0: 1800, f1: 1200, gain: 0.15 });
    for (let i = 0; i < 3; i++) gurgle(0.16, { gain: 0.45, rate: 8 + i * 2, delay: 0.2 + i * 0.24 });
    voice(0.4, { f0: 160, f1: 120, gain: 0.08, vowel: 'aah', jitter: 0.05, dist: 1, breath: 0.6, delay: 1.0, attack: 0.08 });
  };
  api.pick = () => { if (!ok()) return; tone(0.07, { f0: 480, f1: 720, gain: 0.14 }); noise(0.05, { f0: 2000, gain: 0.1 }); };
  api.throwObj = () => api.whoosh(0.9);
  // ---- sons do jogador (Etapa 44) ----
  // grunhido de esforço: voz grave e curta, sem palavras (golpe forte, arremesso, levantar peso)
  api.grunt = (power = 0.6, delay = 0) => { if (!ok()) return; voice(0.12 + 0.12 * power, { f0: 125 + 30 * power, f1: 85, gain: 0.05 + 0.07 * power, vowel: 'ohh', jitter: 0.08, growl: 0.9, dist: 2, breath: 0.7, attack: 0.02, delay }); noise(0.1 + 0.08 * power, { type: 'bandpass', f0: 900, q: 0.8, gain: 0.08 + 0.1 * power, delay }); };
  // expirar forte no soco ("hah")
  api.exhale = (power = 0.5, delay = 0) => { if (!ok()) return; noise(0.09 + 0.08 * power, { type: 'bandpass', f0: 1300, q: 0.7, gain: 0.07 + 0.12 * power, attack: 0.01, delay }); };
  // pegar uma garrafa: tilintar de vidro
  api.clink = (at = null) => { if (!ok()) return; modes([2350, 3180, 4410], 0.25, 0.22, at, 0, 40); };
  // pegar algo pesado com as duas mãos: madeira rangendo + baque surdo
  api.heave = () => { if (!ok()) return; noise(0.18, { type: 'bandpass', f0: 320, q: 3, gain: 0.25 }); noise(0.06, { type: 'lowpass', f0: 220, gain: 0.6, delay: 0.05 }); api.grunt(0.5, 0.02); };
  // agarrar o fantasma: pano/cabelo agarrado + grunhido
  api.grabCloth = (at = null) => { if (!ok()) return; noise(0.22, { type: 'bandpass', f0: 1800, f1: 900, q: 0.9, gain: 0.35, at }); noise(0.08, { type: 'lowpass', f0: 400, gain: 0.5, at }); api.grunt(0.7, 0.03); };
  // engolir: "glup" (som curto, grave e molhado) — usado durante o gole
  api.gulp = (delay = 0) => { if (!ok()) return; tone(0.08, { f0: 260, f1: 140, gain: 0.25, delay }); noise(0.05, { type: 'lowpass', f0: 600, gain: 0.3, delay: delay + 0.03 }); };
  api.dodge = () => ok() && noise(0.22, { f0: 900, f1: 280, q: 0.8, gain: 0.25, attack: 0.03 });
  api.step = () => { if (!ok()) return; noise(0.09, { type: 'lowpass', f0: 380, gain: 1.0 }); tone(0.09, { f0: 90, f1: 55, gain: 0.25 }); };
  // aviso do ataque: berro rouco e dissonante que sobe (duas vozes desafinadas) sobre um rosnado de fundo, com ossos estalando
  api.windup = (dur = 0.8, at = null) => {
    if (!ok()) return;
    api.croak(at, dur + 0.2, 0.8); // aviso do ataque: o estertor sobe junto com o gemido
    if (Math.random() < 0.5) { api.boneCrack(at, 4, 0.05); return; } // às vezes só o estertor e os ossos estalando (mais seco, mais assustador)
    voice(dur, { f0: 170, f1: 820, gain: 0.2, at, vowel: 'eee', jitter: 0.1, rattle: 34, dist: 5, attack: 0.15 });
    voice(dur, { f0: 182, f1: 870, gain: 0.14, at, vowel: 'eee', jitter: 0.1, rattle: 31, dist: 5, attack: 0.15 });
    voice(dur, { f0: 55, f1: 95, gain: 0.3, at, vowel: 'ohh', growl: 1, rattle: 20, dist: 6, attack: 0.3 });
    noise(dur, { f0: 2500, f1: 4500, q: 6, gain: 0.08, attack: 0.3, at });
    tone(dur, { f0: 40, f1: 70, gain: 0.35, attack: 0.3 });
    api.boneCrack(at, 3, 0.1);
  };
  api.dash = (at = null) => {
    if (!ok()) return;
    if (has('ghost_run')) { play('ghost_run', { at, ghost: true, gain: 1.2, rate: 1 + Math.random() * 0.1 }); api.croak(at, 0.6, 0.5); return; } if (!ok()) return; noise(0.5, { f0: 400, f1: 1500, q: 0.7, gain: 0.7, attack: 0.05, at }); voice(0.5, { f0: 900, f1: 220, gain: 0.34, at, vowel: 'aah', jitter: 0.1, rattle: 40, dist: 5 }); gurgle(0.4, { gain: 0.4, at }); };
  api.phase2 = () => {
    if (!ok()) return;
    api.stinger(1);
    tone(1.8, { f0: 42, f1: 30, gain: 0.8, attack: 0.2 });
    voice(1.8, { f0: 110, f1: 45, gain: 0.3, vowel: 'ohh', growl: 1.2, rattle: 18, dist: 6, attack: 0.3, jitter: 0.1 });
    gurgle(1.8, { gain: 0.35, rate: 7 });
    noise(2, { type: 'lowpass', f0: 200, f1: 900, gain: 0.35, attack: 0.8 });
  };
  api.death = (at = null) => {
    if (!ok()) return;
    if (has('ghost_scream')) { play('ghost_scream', { at, ghost: true, gain: 1, rate: 0.8, offset: 0, dur: 4, fade: 1.5 }); api.croak(at, 2.6, 0.6); api.boneCrack(at, 3, 0.8); return; }
    api.shriek(at, 1.6, 1); api.croak(at, 2.6, 0.6);
    voice(3, { f0: 420, f1: 48, gain: 0.4, at, vowel: 'aah', jitter: 0.14, rattle: 26, dist: 5, attack: 0.1 });
    gurgle(1.8, { delay: 1.2, gain: 0.4, rate: 9, at });  // termina afogando no próprio gorgolejo
    api.boneCrack(at, 3, 0.8);
    noise(2.5, { f0: 1200, q: 0.7, gain: 0.12, attack: 0.5, at });
    tone(1.5, { f0: 60, f1: 25, gain: 0.5 });
  };
  api.hurt = () => { if (!ok()) return; noise(0.3, { type: 'lowpass', f0: 200, gain: 5.0 }); modes([80, 130], 0.25, 0.4, null, 0, 6); tone(0.6, { f0: 880, gain: 0.05, attack: 0.02 }); noise(0.2, { type: 'lowpass', f0: 800, gain: 0.45 }); };
  api.win = () => { if (!ok()) return; [262, 330, 392, 523].forEach((f, i) => tone(1.2, { type: 'triangle', f0: f, gain: 0.16, delay: 0.25 + i * 0.16, attack: 0.02 })); };
  api.lose = () => { if (!ok()) return; tone(2, { f0: 110, f1: 38, gain: 0.55 }); voice(2, { f0: 200, f1: 70, gain: 0.16, vowel: 'ooh', jitter: 0.08, rattle: 12, dist: 4 }); };
  // sussurro: sílabas de ruído rouco (mais grave que antes) vindas de algum canto; às vezes termina em gorgolejo ou estalo
  api.whisper = (at) => {
    if (!ok()) return;
    if (has('ghost_whisper') && Math.random() < 0.75) { play('ghost_whisper', { at, ghost: true, gain: 0.7, rate: 0.85 + Math.random() * 0.25 }); return; }
    if (Math.random() < 0.35) { api.croak(at, R(0.8, 1.6), 0.4); return; }
    const n = 3 + Math.floor(Math.random() * 3), out = at ? ghostDest(at, 2) : null;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const d = R(0.07, 0.18), rev = Math.random() < 0.4; // sílabas "ao contrário": crescem e cortam
      noise(d, { f0: R(900, 2200), f1: R(700, 2000), q: 5, gain: 0.5, attack: rev ? d * 0.95 : 0.02, delay: t, at: out });
      t += d + R(0.03, 0.12);
    }
    const r = Math.random();
    if (r < 0.4) gurgle(0.5, { gain: 0.22, delay: t, at });
    else if (r < 0.7) api.boneCrack(at, 2, t);
  };
  // ---- terror cinematográfico (Etapa 45) ----
  // ESTERTOR ("o ruído da garganta" de fantasma de filme japonês): trem de pulsos glóticos muito rápidos (20–40 por s),
  // cada pulso é um estalo de ruído passando por formantes de voz; o ritmo e a altura oscilam (gargarejo seco)
  // (versão leve: UM ruído, dois filtros de formante e um "trem de pulsos" de oscilador modulando o volume — antes cada
  // pulso era um nó novo, ~40 nós por segundo de estertor, e nos golpes com câmera lenta isso picotava o áudio)
  let croaksOn = 0;
  api.croak = (at = null, dur = 1.4, power = 0.6) => {
    if (!ok() || croaksOn >= 2) return; // no máximo 2 estertores ao mesmo tempo
    croaksOn++; setTimeout(() => { croaksOn--; }, (dur + 0.1) * 1000);
    const out = ghostDest(at, 1.2), s = now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = R(450, 600); f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = R(1300, 1800); f2.Q.value = 7;
    const am = ctx.createGain(); am.gain.value = 0;                 // multiplicado pelo trem de pulsos
    const env = ctx.createGain(); env.gain.setValueAtTime(0, s); env.gain.linearRampToValueAtTime(power * 1.3, s + dur * 0.25); env.gain.setValueAtTime(power * 1.3, s + dur * 0.7); env.gain.linearRampToValueAtTime(0, s + dur);
    const pulse = ctx.createOscillator(); pulse.setPeriodicWave(pulseWave());
    let r = R(22, 30); pulse.frequency.setValueAtTime(r, s);
    for (let t = 0.08; t < dur; t += 0.08) { r = Math.min(42, Math.max(16, r + R(-5, 5))); pulse.frequency.linearRampToValueAtTime(r, s + t); } // ritmo irregular
    pulse.connect(am.gain);
    src.connect(f1); src.connect(f2); f1.connect(am); f2.connect(am); am.connect(env); env.connect(out);
    src.start(s, R(0, 1.5)); pulse.start(s); src.stop(s + dur + 0.05); pulse.stop(s + dur + 0.05);
  };
  let pw = null; // trem de impulsos estreitos (soma de harmônicos): cada ciclo = um "estalo" de glote
  function pulseWave() { if (pw) return pw; const n = 24, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) re[i] = 1 / Math.sqrt(i); pw = ctx.createPeriodicWave(re, im); return pw; }
  // EXPLOSÃO (garrafa de vodka)
  api.explosion = (at = null) => { if (!ok()) return; if (has('explosion')) { play('explosion', { at, gain: 1.3, rate: 0.95 + Math.random() * 0.1 }); noise(0.6, { type: 'lowpass', f0: 120, gain: 2 }); } else api.slam(); };
  // ACORDE DE SUSTO ("stinger"): ruído ao contrário que cresce e corta + cluster de metais dissonante + baque sub-grave
  api.stinger = (power = 0.8) => {
    if (!ok()) return;
    api.swell(0.5);
    const s = 0.5;
    for (const f of [110, 116.5, 155.6, 164.8, 233.1]) tone(1.8, { type: 'sawtooth', f0: f * 1.01, f1: f * 0.96, gain: 0.05 * power, delay: s, attack: 0.01, lp: 1400 });
    tone(1.4, { f0: 48, f1: 28, gain: 0.7 * power, delay: s });
    noise(0.6, { type: 'highpass', f0: 3000, gain: 0.25 * power, delay: s, attack: 0.005 });
  };
  // ruído que cresce e para de repente (efeito de fita ao contrário)
  api.swell = (dur = 1.5) => { if (!ok()) return; noise(dur, { type: 'bandpass', f0: 300, f1: 2400, q: 0.6, gain: 0.32, attack: dur * 0.97 }); };
  // porta batendo / algo caindo longe
  api.farBoom = (at) => { if (!ok()) return; noise(0.5, { type: 'lowpass', f0: 160, gain: 1.6, at }); tone(0.6, { f0: 55, f1: 32, gain: 0.35, at }); };
  // metal arranhado (arco em metal): ruído em ressonância estreita que desliza
  api.metalScrape = (at) => { if (!ok()) return; const d = R(1.2, 2.4); noise(d, { type: 'bandpass', f0: R(500, 800), f1: R(1100, 1700), q: 28, gain: 0.5, attack: 0.4, at }); noise(d, { type: 'bandpass', f0: R(2200, 2600), f1: R(1800, 2100), q: 30, gain: 0.25, attack: 0.5, at }); };
  // GRITO DE TERROR (fantasma): agudo rasgado com distorção forte, um segundo agudo meio-tom acima (atrito) e o estertor por baixo
  let lastShriek = -1;
  api.shriek = (at = null, dur = 1.0, power = 0.8) => {
    if (!ok() || now() - lastShriek < 0.4) return; // não empilhar gritos (cada um são várias vozes)
    lastShriek = now();
    if (has('ghost_scream')) { const d = Math.min(2.5, Math.max(0.4, dur)); play('ghost_scream', { at, ghost: true, gain: 0.5 + 0.45 * power, rate: 0.85 + Math.random() * 0.25, offset: Math.random() * (6.2 - d), dur: d, fade: 0.2 }); api.croak(at, d * 0.7, 0.4); return; }
    const out = ghostDest(at, 1.6);
    voice(dur, { f0: 900 + 300 * power, f1: 1500 + 300 * power, gain: 0.22 * power, at: out, vowel: 'eee', jitter: 0.25, rattle: 60, dist: 9, breath: 0.6, attack: 0.02 });
    voice(dur * 0.9, { f0: 960 + 300 * power, f1: 1420, gain: 0.16 * power, at: out, vowel: 'aah', jitter: 0.3, rattle: 47, dist: 9, breath: 0.5, attack: 0.03 });
    voice(dur, { f0: 140, f1: 90, gain: 0.18 * power, at: out, vowel: 'ohh', growl: 1.2, rattle: 22, dist: 7 });
    noise(dur, { type: 'highpass', f0: 3500, gain: 0.18 * power, attack: 0.02, at: out });
    api.croak(at, dur * 0.8, 0.45);
  };
  // gota que cai (úmida) em algum lugar
  api.drip = (at) => { if (!ok()) return; tone(0.09, { f0: 1500, f1: 280, gain: 0.7, at }); noise(0.02, { type: 'highpass', f0: 3000, gain: 0.35, at }); };

  return api;
}
