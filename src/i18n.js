// Idiomas: português, inglês e espanhol. O idioma vem do navegador/celular (navigator.languages),
// pode ser forçado com ?lang=pt|en|es na URL ou escolhido no menu (fica salvo no navegador).
const D = {
  pt: {
    title: 'Ghostpunch Mini', sub: 'Boss fight em primeira pessoa', paused: 'Pausado', stopped: 'O jogo está parado',
    play: 'Jogar', resume: 'Continuar', restart: 'Reiniciar luta',
    sens: 'Sensibilidade', flicker: 'Luzes piscando (desligue se incomodar)', slow: 'Câmera lenta nos golpes fortes (tecla T)',
    hitstop: 'Congelar o jogo por um instante no impacto', shadows: 'Sombras (desligue se estiver travando)', vol: 'Volume', fov: 'Campo de visão',
    lang: 'Idioma', auto: 'Automático', muted: 'mudo',
    touchhelp: 'Controles no celular (deite o aparelho): arraste o dedo na <b>metade esquerda</b> para andar (joystick) e em qualquer outro ponto da tela para <b>olhar</b>. Botões: SOCO (combo), FORTE, UPPER, ESMAGAR, ESQUIVA e PEGAR (vodka: bebe na hora; com a garrafa vazia na mão, SOCO arremessa e ela explode). ❚❚ no canto pausa.',
    'k.move': 'Mover', 'v.move': 'W A S D', 'k.look': 'Olhar', 'v.look': 'Mouse', 'k.punch': 'Socar (combo de 3)', 'v.punch': 'Clique esquerdo ou Espaço',
    'k.heavy': 'Soco forte', 'v.heavy': 'Botão direito ou E', 'k.upper': 'Uppercut (lança para cima)', 'v.upper': 'Q', 'k.slam': 'Esmagar (onda em área)', 'v.slam': 'C',
    'k.grab': 'Pegar / soltar objeto', 'v.grab': 'F (clique arremessa)', 'k.beer': 'Vodka (recupera vida)', 'v.beer': 'Pegar a garrafa (F) já bebe; vazia, arremesse e ela explode',
    'k.dodge': 'Esquivar', 'v.dodge': 'Shift', 'k.pause': 'Pausar', 'v.pause': 'Esc ou P', 'k.mute': 'Mudo', 'v.mute': 'M',
    'k.slowkey': 'Câmera lenta liga/desliga', 'v.slowkey': 'T', 'k.restart': 'Reiniciar a luta', 'v.restart': 'R',
    help: 'clique = combo · botão dir. = forte · Q = uppercut · C = esmagar · F = pegar (vodka: bebe) · Shift = esquiva · Esc/P = pausa e controles',
    boss: 'O Fantasma da Casa', hp: 'Vida',
    'cd.heavy': 'FORTE · botão dir. / E', 'cd.upper': 'UPPERCUT · Q', 'cd.slam': 'ESMAGAR · C',
    'mv.jab': 'JAB', 'mv.cross': 'CRUZADO!', 'mv.heavy': 'SOCO FORTE!', 'mv.upper': 'UPPERCUT!', 'mv.slam': 'ESMAGAR!',
    'tb.jab': 'SOCO', 'tb.heavy': 'FORTE', 'tb.upper': 'UPPER', 'tb.slam': 'ESMAGAR', 'tb.dodge': 'ESQUIVA', 'tb.grab': 'PEGAR',
    textures: 'Texturas, sangue e vinheta (desligue para comparar com a cor lisa)',
    fsEnter: 'Tela cheia', fsExit: 'Sair da tela cheia',
   rotate: 'Gire o celular para o modo paisagem (deitado) para jogar',
    lockerr: 'O navegador não deixou capturar o mouse agora. Espere um instante e clique de novo.',
    slowOn: 'CÂMERA LENTA: LIGADA', slowOff: 'CÂMERA LENTA: DESLIGADA', perfect: 'ESQUIVA PERFEITA!', counter: 'CONTRA-ATAQUE!', juggle: 'NO AR!', blocked: 'DEFENDEU', guardBreak: 'GUARDA QUEBRADA!', grab: 'AGARROU!', prGrabBoss: 'F = AGARRAR O FANTASMA E ARREMESSAR', prGrabBossT: 'PEGAR = AGARRAR O FANTASMA', deflect: 'DEVOLVEU!', pulled: 'ARRANCOU DO TETO!', fear: 'Medo', scared: 'Com medo', terrified: 'Apavorado!', snap: 'ELE SE DESESPEROU!', heal: '+{0} VIDA', full: 'VIDA CHEIA',
    'p.chair': 'cadeira', 'p.crate': 'caixa', 'p.vase': 'vaso', 'p.plank': 'tábua', 'p.barrel': 'barril', 'p.tv': 'TV', 'p.ball': 'bola de boliche', 'p.pillow': 'almofada', 'p.vodka': 'garrafa de vodka',
    prHeld: 'Clique = ARREMESSAR  ·  F = soltar', prHeldT: 'SOCO = ARREMESSAR  ·  PEGAR = soltar',
    prHeldVodka: 'Clique = ARREMESSAR (explode)  ·  F = soltar', prHeldVodkaT: 'SOCO = ARREMESSAR (explode)  ·  PEGAR = soltar',
    prVodka: 'F = PEGAR E BEBER VODKA (+{0} vida)', prVodkaT: 'PEGAR E BEBER VODKA (+{0} vida)',
    prGrab: 'F = pegar {0}', prGrabT: 'PEGAR {0}',
    win: 'Vitória!', lose: 'Você foi derrotado', time: 'Tempo: {0}s · ', retry: 'Pressione R para tentar de novo', retryT: 'Toque para tentar de novo',
  },
  en: {
    title: 'Ghostpunch Mini', sub: 'First-person boss fight', paused: 'Paused', stopped: 'The game is paused',
    play: 'Play', resume: 'Resume', restart: 'Restart fight',
    sens: 'Sensitivity', flicker: 'Flickering lights (turn off if uncomfortable)', slow: 'Slow motion on heavy hits (T key)',
    hitstop: 'Freeze the game briefly on impact', shadows: 'Shadows (turn off if laggy)', vol: 'Volume', fov: 'Field of view',
    lang: 'Language', auto: 'Automatic', muted: 'muted',
    touchhelp: 'Phone controls (hold the device sideways): drag on the <b>left half</b> to move (joystick) and anywhere else on the screen to <b>look</b>. Buttons: PUNCH (combo), HEAVY, UPPER, SMASH, DODGE and GRAB (vodka: drinks it right away; holding the empty bottle, PUNCH throws it and it explodes). ❚❚ in the corner pauses.',
    'k.move': 'Move', 'v.move': 'W A S D', 'k.look': 'Look', 'v.look': 'Mouse', 'k.punch': 'Punch (3-hit combo)', 'v.punch': 'Left click or Space',
    'k.heavy': 'Heavy punch', 'v.heavy': 'Right click or E', 'k.upper': 'Uppercut (launches upward)', 'v.upper': 'Q', 'k.slam': 'Smash (area shockwave)', 'v.slam': 'C',
    'k.grab': 'Grab / drop object', 'v.grab': 'F (click throws)', 'k.beer': 'Vodka (restores health)', 'v.beer': 'Grabbing the bottle (F) drinks it; empty, throw it and it explodes',
    'k.dodge': 'Dodge', 'v.dodge': 'Shift', 'k.pause': 'Pause', 'v.pause': 'Esc or P', 'k.mute': 'Mute', 'v.mute': 'M',
    'k.slowkey': 'Toggle slow motion', 'v.slowkey': 'T', 'k.restart': 'Restart the fight', 'v.restart': 'R',
    help: 'click = combo · right click = heavy · Q = uppercut · C = smash · F = grab (vodka: drink) · Shift = dodge · Esc/P = pause and controls',
    boss: 'The Ghost of the House', hp: 'Health',
    'cd.heavy': 'HEAVY · right click / E', 'cd.upper': 'UPPERCUT · Q', 'cd.slam': 'SMASH · C',
    'mv.jab': 'JAB', 'mv.cross': 'CROSS!', 'mv.heavy': 'HEAVY PUNCH!', 'mv.upper': 'UPPERCUT!', 'mv.slam': 'SMASH!',
    'tb.jab': 'PUNCH', 'tb.heavy': 'HEAVY', 'tb.upper': 'UPPER', 'tb.slam': 'SMASH', 'tb.dodge': 'DODGE', 'tb.grab': 'GRAB',
    textures: 'Textures, blood and vignette (turn off to compare with flat colors)',
    fsEnter: 'Fullscreen', fsExit: 'Exit fullscreen',
   rotate: 'Rotate your phone to landscape mode to play',
    lockerr: "The browser wouldn't capture the mouse right now. Wait a moment and click again.",
    slowOn: 'SLOW MOTION: ON', slowOff: 'SLOW MOTION: OFF', perfect: 'PERFECT DODGE!', counter: 'COUNTER!', juggle: 'AIR COMBO!', blocked: 'BLOCKED', guardBreak: 'GUARD BREAK!', grab: 'GRABBED!', prGrabBoss: 'F = GRAB THE GHOST AND THROW', prGrabBossT: 'GRAB = GRAB THE GHOST', deflect: 'RETURNED!', pulled: 'PULLED DOWN!', fear: 'Fear', scared: 'Scared', terrified: 'Terrified!', snap: 'HE SNAPPED!', heal: '+{0} HEALTH', full: 'FULL HEALTH',
    'p.chair': 'chair', 'p.crate': 'crate', 'p.vase': 'vase', 'p.plank': 'plank', 'p.barrel': 'barrel', 'p.tv': 'TV', 'p.ball': 'bowling ball', 'p.pillow': 'pillow', 'p.vodka': 'vodka bottle',
    prHeld: 'Click = THROW  ·  F = drop', prHeldT: 'PUNCH = THROW  ·  GRAB = drop',
    prHeldVodka: 'Click = THROW (explodes)  ·  F = drop', prHeldVodkaT: 'PUNCH = THROW (explodes)  ·  GRAB = drop',
    prVodka: 'F = GRAB AND DRINK VODKA (+{0} health)', prVodkaT: 'GRAB AND DRINK VODKA (+{0} health)',
    prGrab: 'F = grab {0}', prGrabT: 'GRAB {0}',
    win: 'Victory!', lose: 'You were defeated', time: 'Time: {0}s · ', retry: 'Press R to try again', retryT: 'Tap to try again',
  },
  es: {
    title: 'Ghostpunch Mini', sub: 'Pelea contra un jefe en primera persona', paused: 'En pausa', stopped: 'El juego está detenido',
    play: 'Jugar', resume: 'Continuar', restart: 'Reiniciar pelea',
    sens: 'Sensibilidad', flicker: 'Luces parpadeantes (desactívalo si molesta)', slow: 'Cámara lenta en golpes fuertes (tecla T)',
    hitstop: 'Congelar el juego un instante al impactar', shadows: 'Sombras (desactívalo si va lento)', vol: 'Volumen', fov: 'Campo de visión',
    lang: 'Idioma', auto: 'Automático', muted: 'silencio',
    touchhelp: 'Controles en el celular (ponlo en horizontal): arrastra el dedo en la <b>mitad izquierda</b> para moverte (joystick) y en cualquier otro punto de la pantalla para <b>mirar</b>. Botones: GOLPE (combo), FUERTE, UPPER, APLASTAR, ESQUIVAR y AGARRAR (vodka: se bebe al momento; con la botella vacía en la mano, GOLPE la lanza y explota). ❚❚ en la esquina pausa.',
    'k.move': 'Moverse', 'v.move': 'W A S D', 'k.look': 'Mirar', 'v.look': 'Ratón', 'k.punch': 'Golpear (combo de 3)', 'v.punch': 'Clic izquierdo o Espacio',
    'k.heavy': 'Golpe fuerte', 'v.heavy': 'Clic derecho o E', 'k.upper': 'Uppercut (lanza hacia arriba)', 'v.upper': 'Q', 'k.slam': 'Aplastar (onda en área)', 'v.slam': 'C',
    'k.grab': 'Agarrar / soltar objeto', 'v.grab': 'F (el clic lo lanza)', 'k.beer': 'Vodka (recupera vida)', 'v.beer': 'Agarrar la botella (F) ya la bebe; vacía, lánzala y explota',
    'k.dodge': 'Esquivar', 'v.dodge': 'Shift', 'k.pause': 'Pausar', 'v.pause': 'Esc o P', 'k.mute': 'Silenciar', 'v.mute': 'M',
    'k.slowkey': 'Cámara lenta sí/no', 'v.slowkey': 'T', 'k.restart': 'Reiniciar la pelea', 'v.restart': 'R',
    help: 'clic = combo · clic der. = fuerte · Q = uppercut · C = aplastar · F = agarrar (vodka: beber) · Shift = esquivar · Esc/P = pausa y controles',
    boss: 'El Fantasma de la Casa', hp: 'Vida',
    'cd.heavy': 'FUERTE · clic der. / E', 'cd.upper': 'UPPERCUT · Q', 'cd.slam': 'APLASTAR · C',
    'mv.jab': 'JAB', 'mv.cross': '¡CRUZADO!', 'mv.heavy': '¡GOLPE FUERTE!', 'mv.upper': '¡UPPERCUT!', 'mv.slam': '¡APLASTAR!',
    'tb.jab': 'GOLPE', 'tb.heavy': 'FUERTE', 'tb.upper': 'UPPER', 'tb.slam': 'APLASTAR', 'tb.dodge': 'ESQUIVAR', 'tb.grab': 'AGARRAR',
    textures: 'Texturas, sangre y viñeta (desactívalo para comparar con el color liso)',
    fsEnter: 'Pantalla completa', fsExit: 'Salir de pantalla completa',
   rotate: 'Gira el celular a modo horizontal para jugar',
    lockerr: 'El navegador no dejó capturar el ratón ahora. Espera un momento y haz clic de nuevo.',
    slowOn: 'CÁMARA LENTA: SÍ', slowOff: 'CÁMARA LENTA: NO', perfect: '¡ESQUIVA PERFECTA!', counter: '¡CONTRAATAQUE!', juggle: '¡EN EL AIRE!', blocked: 'BLOQUEÓ', guardBreak: '¡GUARDIA ROTA!', grab: '¡AGARRADO!', prGrabBoss: 'F = AGARRAR AL FANTASMA Y LANZARLO', prGrabBossT: 'AGARRAR AL FANTASMA', deflect: '¡DEVUELTO!', pulled: '¡ARRANCADO DEL TECHO!', fear: 'Miedo', scared: 'Asustado', terrified: '¡Aterrado!', snap: '¡SE DESESPERÓ!', heal: '+{0} VIDA', full: 'VIDA COMPLETA',
    'p.chair': 'silla', 'p.crate': 'caja', 'p.vase': 'jarrón', 'p.plank': 'tabla', 'p.barrel': 'barril', 'p.tv': 'TV', 'p.ball': 'bola de boliche', 'p.pillow': 'almohada', 'p.vodka': 'botella de vodka',
    prHeld: 'Clic = LANZAR  ·  F = soltar', prHeldT: 'GOLPE = LANZAR  ·  AGARRAR = soltar',
    prHeldVodka: 'Clic = LANZAR (explota)  ·  F = soltar', prHeldVodkaT: 'GOLPE = LANZAR (explota)  ·  AGARRAR = soltar',
    prVodka: 'F = AGARRAR Y BEBER VODKA (+{0} vida)', prVodkaT: 'AGARRAR Y BEBER VODKA (+{0} vida)',
    prGrab: 'F = agarrar {0}', prGrabT: 'AGARRAR {0}',
    win: '¡Victoria!', lose: 'Fuiste derrotado', time: 'Tiempo: {0}s · ', retry: 'Pulsa R para intentarlo de nuevo', retryT: 'Toca para intentarlo de nuevo',
  },
};
const LS = 'ghostpunch-lang';
export function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (D[q]) return q;
  let saved = null; try { saved = localStorage.getItem(LS); } catch { /* sem armazenamento */ }
  if (D[saved]) return saved;
  for (const l of navigator.languages?.length ? navigator.languages : [navigator.language || 'en']) {
    const c = String(l).slice(0, 2).toLowerCase(); if (D[c]) return c;
  }
  return 'en';
}
export function savedChoice() { try { return localStorage.getItem(LS) || 'auto'; } catch { return 'auto'; } }
export function saveChoice(v) { try { if (v === 'auto') localStorage.removeItem(LS); else localStorage.setItem(LS, v); } catch { /* ignora */ } }
let lang = detectLang();
export const getLang = () => lang;
export function setLang(l) { lang = D[l] ? l : detectLang(); }
export function t(key, ...a) {
  let s = D[lang][key] ?? D.pt[key] ?? key;
  a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
// textos estáticos do index.html: data-i18n (texto) e data-i18n-html (com <b>)
export function applyDom() {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((e) => { e.innerHTML = t(e.dataset.i18nHtml); });
}
