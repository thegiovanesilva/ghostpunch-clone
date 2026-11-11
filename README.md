# Ghostpunch Mini

Trabalho individual de Computação Gráfica, feito em **Three.js**.
Uma **boss fight 1x1 em primeira pessoa**: o jogador (um brutamontes) enfrenta um fantasma gigante e resistente numa casa assombrada. Cada golpe lança o fantasma pelos ares, e os móveis da casa quebram e viram munição.

> **Inspiração:** o jogo *GHOSTPUNCH* (Rat in a Bag, previsto para Q2 2027 na Steam):
> roguelite beat 'em up em que você é um monstro defendendo uma casa assombrada.
> Este projeto é uma versão **própria e muito reduzida**, com código, visual e texturas autorais.
> Nenhum asset ou código do jogo original foi usado.

## Como rodar

Projeto Node com **Vite** e **Three.js** (r187) instalado via npm. Requer Node 18+.

```bash
npm install        # instala three e vite
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # gera a versão final na pasta dist/
npm run preview    # testa a versão de dist/
```

### Hot reload (editar o código com o jogo rodando)

Com `npm run dev` aberto, ao **salvar `src/main.js`** o jogo se atualiza **sem recarregar a página** e a luta continua do ponto onde estava: vida do boss e do jogador, posições, direção do olhar, recarga do soco forte e o mouse continua capturado. É ótimo para equilibrar a luta: mude um número do `CFG`, salve, e o efeito aparece na hora, no meio da partida. A mensagem `[hot reload] código atualizado, luta mantida` aparece no console.

Limites: mudanças em `index.html` (HUD) recarregam a página inteira, e o estado é perdido. Mudar a forma como algo é criado na cena (por exemplo, a posição inicial do boss) não reposiciona quem já está em jogo, porque o estado salvo vale mais; aperte `R` para ver o efeito.

### Pausa e opções

O jogo fica **pausado sempre que o mouse não está capturado**: ao apertar `Esc`, ao apertar `P`, ao trocar de janela, e antes do primeiro clique em Jogar. Nada se mexe (boss, tempo, recargas) e as teclas de ação são ignoradas. Um menu aparece por cima do jogo:

- **Continuar / Jogar:** captura o mouse e volta ao jogo. (O navegador exige um clique para capturar o mouse e, logo depois de um `Esc`, pode recusar por cerca de 1 s; se isso acontecer, o menu avisa para clicar de novo.)
- **Reiniciar luta**
- **Sensibilidade do mouse** (0,4x a 2,5x) e **Campo de visão** (60° a 110°): valem na hora e **ficam salvos no navegador** (`localStorage`).
- Lista de controles.

Na tela de vitória ou derrota o menu não aparece, mesmo com o mouse solto.

## Controles

| Ação | Tecla |
|---|---|
| Mover (relativo para onde você olha) | W A S D (ou setas) |
| Olhar | Mouse (o botão Jogar captura o mouse) |
| Socar: **combo jab, jab, cruzado** (alterna esquerda e direita) | Clique esquerdo ou Espaço |
| Soco forte, o "haymaker" (arremessa tudo; recarga de 1,8 s) | Botão direito ou E |
| **Uppercut**: lança o boss para o alto (recarga de 1,4 s) | Q |
| **Esmagar**: onda de choque em área, com as duas mãos (recarga de 4 s) | C |
| Pegar / soltar objeto pequeno | F |
| Arremessar o objeto da mão | Qualquer ataque (clique, Espaço, botão direito, E, Q ou C) |
| Esquivar (invulnerável por 0,2 s, na direção do WASD) | Shift |
| Pausar / continuar | Esc ou P |
| Reiniciar | R |

## Estrutura

```
index.html      página e HUD (HTML/CSS)
src/main.js     toda a lógica do jogo (import * as THREE from 'three')
package.json    dependências e scripts (dev, build, preview)
README.md       este documento (atualizado a cada etapa)
```

Os valores de balanceamento (velocidade, alcance do soco, dano, etc.) estão no objeto `CFG`, no topo de `src/main.js`.

### Como o hot reload funciona (para o relatório)

O Vite re-executa o módulo `main.js` quando ele muda. Como o módulo tem efeitos colaterais (cria o renderer, registra eventos, roda um loop), ele precisa se "desmontar" direito:

1. `import.meta.hot.dispose`: guarda o estado da luta, cancela o loop (`cancelAnimationFrame`), remove os eventos, libera geometrias, materiais e texturas, e entrega o canvas e o contexto WebGL ao próximo módulo.
2. O módulo novo reaproveita o mesmo canvas (assim o navegador não solta o mouse) e restaura o estado salvo.
3. `import.meta.hot.accept()` avisa o Vite que o módulo se atualiza sozinho. O texto precisa estar escrito literalmente assim, senão o Vite recarrega a página inteira.

## Técnicas de aula usadas (para a avaliação)

| Técnica | Onde aparece no código | Aula |
|---|---|---|
| Eventos de teclado com variáveis de estado (`keys{}`) | WASD no loop `animate()` | 7.2 |
| Eventos de mouse (`mousemove`, `mousedown`) e Pointer Lock | Olhar com `movementX/Y` (yaw e pitch); clique para socar e para capturar o mouse | 7.2 |
| Loop de animação (`animate`, ~60 fps, `dt`) | Movimento independente de FPS | 7.2 |
| Vetores: direção, normalização, distância | Boss persegue o jogador; direção do dash; alcance do soco; direção do olhar e da esquiva (vetor girado em torno do eixo Y) | 4 |
| Produto escalar | Cone do soco: o boss ou o objeto está à frente do jogador? | 4 |
| Colisão círculo-círculo (distância ao quadrado) | Objeto arremessado x boss; boss x móvel; jogador x móvel parado | 4 |
| Transformações geométricas (translação, rotação, escala) | Punho avança e cresce no soco; boss encolhe no aviso, gira ao voar, é **amassado** ao levar golpe (escala não uniforme: squash & stretch) e encolhe ao morrer; objetos giram em voo; estilhaços giram e encolhem | 6 |
| Iluminação (ambiente, direcional, pontual, emissiva) | Luz ambiente, "lua", lanterna do jogador; a cor emissiva e a luz do boss mudam conforme o estado (aviso, dash...) | 8 |
| Integração de velocidade, atrito e gravidade | Posição += velocidade x dt; atrito exponencial `base^dt` (independente de FPS) no arremesso do boss e dos objetos; gravidade e quique nos estilhaços e no pulinho do boss | 6 |
| Câmera em perspectiva em primeira pessoa | `PerspectiveCamera` (FOV 80) nos olhos do jogador; rotação Euler em ordem YXZ; FOV se abre na esquiva | 5 |
| Hierarquia de transformações (grafo de cena) | As **duas mãos** (punho + antebraço + punho de manga) e a lanterna são **filhos da câmera**: herdam a posição e a rotação dela | 6 |
| Animação por keyframes e interpolação | Cada golpe é uma lista de poses (posição, rotação e escala) por instante; `sampleKF()` interpola entre elas com suavização (`smoothstep`); a mão esquerda é o **espelho** da direita (troca de sinal em x e nas rotações Y e Z) | 6 |
| Z-buffer / profundidade | Feito pelo WebGL automaticamente (cena opaca + fantasmas translúcidos) | 10 |
| Texturas | `CanvasTexture` do piso e das paredes | 3 |
| Hierarquia de transformações (objeto pego) | Ao apertar F, o objeto troca de pai: sai da cena e vira **filho da câmera** (`camera.add`), herdando a posição e a rotação do olhar; ao arremessar, volta para a cena com a posição de mundo | 6 |
| Modelagem 3D com primitivas e hierarquia | O **fantasma** (vestido de cone, braços com pivô no ombro, cabeça com cabelo e 16 mechas; todas as partes são filhas de `bossVis`) e os móveis (cadeira, mesa, estante, caixa, vaso...) são grupos de caixas, cilindros e esferas (`Group`); cada estilhaço é uma caixa de tamanho aleatório | 6 |

## Conteúdo autoral

- **Hoje:** as texturas do piso e da parede são **geradas por código** (canvas), e os móveis usam cores lisas. Tudo é placeholder.
- **A fazer:** criar texturas desenhadas por mim (piso, papel de parede, rosto do fantasma, madeira dos móveis) e trocar os placeholders. Esse é um critério explícito de avaliação.

## A luta contra o boss

**Ideia de design:** o jogador é **muito mais forte** que o fantasma em golpes, e o fantasma compensa com **muita vida** (120). A graça é socar, lançar, ver ele quicar na parede e voltar. Cada golpe mexe com ele; nenhum fica "sem efeito".

Barra de vida no topo da tela, com marca em 50% (fase 2). O boss repete um ciclo de ataque com **aviso visual**:

| Estado | Cor | O que acontece |
|---|---|---|
| Perseguir | azul | Anda até o jogador; encostar causa dano leve (6) |
| Aviso (windup) | vermelho piscando | Fica parado "carregando" e mira no jogador até o último instante |
| Avanço (dash) | laranja | Dispara em linha reta; dano alto (18). **Esquivar com Shift** evita. Ele destrói os móveis que atravessa |
| Tonto (stun) | amarelo | Depois de **qualquer golpe**: não ataca por um tempo (0,4 s no soco leve, 1,7 s no forte; veja os perfis de golpe abaixo). Também ocorre ao bater em algo ou ao errar o avanço |

**Todo golpe desloca o boss, em qualquer estado, e cancela o ataque dele**, inclusive no meio do avanço. Se você não parar de bater, ele nunca consegue atacar (é o "malabarismo" da luta). **Cada ataque tem um peso diferente** (veja os perfis a seguir): o leve só empurra e dá para combar; o pesado manda o fantasma longe e para o alto.

### Os golpes (dois braços)

Em primeira pessoa você tem **duas mãos**, sempre erguidas em guarda, com balanço de respiração e de caminhada. Cada golpe tem uma animação própria em `MOVES` (keyframes), um perfil de empurrão em `CFG.attacks` e um efeito de câmera:

| Golpe | Tecla | Mão | Dano | O que faz |
|---|---|---|---|---|
| **Jab** | clique | alterna E/D | 2 | Rápido, empurra pouco; dá para combar. |
| **Cruzado** | 3º clique seguido (janela de 0,9 s) | alterna | 5 | Finalizador do combo: giro de corpo maior, empurra a 30 u/s. |
| **Soco forte** | botão direito / E | direita | 6 | Haymaker: o braço vai para trás e a direita, dá um golpe em arco; 58 u/s. |
| **Uppercut** | Q | alterna | 5 | Quase não empurra (9 u/s), mas **lança a 19 u/s para cima**, até bater no teto (3 u de altura). Objetos socados também **sobem**. |
| **Esmagar** | C | as duas | 5 | As duas mãos sobem e batem no chão: **onda de choque de 4,5 unidades** (anel visível). Empurra o boss e todos os objetos pequenos para longe de você; móveis grandes perdem 2 de vida. Mais forte quanto mais perto. |

- **Combo aéreo (juggle):** golpear o boss enquanto ele está no ar dá **+50% de dano** e o mantém no ar (a velocidade vertical nunca cai abaixo de 8). Uppercut, depois jab, jab, cruzado: ele fica quicando.
- **Avanço do corpo (lunge):** durante a preparação do golpe, o jogador dá um passo à frente (0,4 a 0,9 u), sem entrar dentro do boss.
- **Câmera:** o corpo inclina (roll) e gira (yaw) conforme a mão que bate, a câmera dá um **tranco** no impacto (esmagar olha para baixo, uppercut para cima) e o campo de visão se abre (`fovKick`).
- **Nome do golpe** aparece na tela ("UPPERCUT!") e três barras de recarga ficam embaixo.
- A mão que não golpeia puxa para dentro (guarda); quando você pega um objeto (F), as duas mãos vão para as laterais dele; na esquiva, os braços encolhem.

### Perfis de golpe (leve x pesado)

Cada golpe tem um perfil em `CFG.attacks`. Todos usam os mesmos 6 números, então dá para ajustar o "peso" de cada um:

| Golpe | Empurrão (u/s) | Pulo (u/s) | Tonto (s) | Amassa | Hitstop (s) | Tremor |
|---|---|---|---|---|---|---|
| **Soco leve** | 15 | 3,0 | 0,40 | 0,45 | 0,05 | 0,35 |
| **Cruzado** | 30 | 5,0 | 0,90 | 0,80 | 0,10 | 0,70 |
| **Soco forte** | **58** | **9,5** | **1,70** | **1,00** | **0,14** | **1,00** |
| **Uppercut** | 9 | **19** | 1,50 | 1,00 | 0,13 | 0,85 |
| **Esmagar** (do centro) | 34 | 7,0 | 1,40 | 1,00 | 0,14 | 1,00 |
| Vaso | 20 | 1,5 | 0,50 | 0,50 | 0,06 | 0,40 |
| Tábua | 24 | 2,0 | 0,50 | 0,55 | 0,06 | 0,40 |
| Cadeira | 32 | 2,8 | 0,80 | 0,75 | 0,09 | 0,60 |
| Caixa | 42 | 3,5 | 1,00 | 0,90 | 0,11 | 0,80 |
| Barril | 38 | 3,2 | 0,90 | 0,85 | 0,10 | 0,70 |
| TV | 36 | 3,0 | 1,00 | 0,85 | 0,10 | 0,70 |
| Bola de boliche | 50 | 2,2 | 1,10 | 0,95 | 0,12 | 0,85 |
| Almofada | 6 | 0,6 | 0,25 | 0,20 | 0,02 | 0,10 |

- **Empurrão:** velocidade horizontal inicial. Com o atrito baixo do arremesso, 15 u/s leva o fantasma a cerca de 5 unidades e 58 u/s atravessa a sala toda.
- **Pulo (knock-up):** velocidade vertical inicial. O golpe leve mal tira o fantasma do chão (pico de 0,1 u); o pesado o lança a cerca de 1,3 u de altura (há um teto: a cabeça dele não atravessa o forro).
- **Tonto:** tempo sem atacar, também o tempo que ele fica vulnerável.
- O giro no ar, o amassado, o congelamento do impacto, o tremor de câmera e o "soco" no campo de visão também crescem com o peso do golpe.
- **Objetos** empurram conforme o peso (e o pulo vertical deles é bem pequeno: uma caixa arremessada da mão sobe só 0,23 u, contra 1,28 u do soco forte): vaso < tábua < cadeira < caixa. A mesma caixa fica mais forte conforme a origem: socada leve (x1), socada com o soco forte (x1,15 no empurrão) e **arremessada da mão (x1,25**, e +0,3 s de tonto). Medido: tonto de 1,0 / 1,18 / 1,3 s e dano de 8 / 12 / 16.
- Bater na parede (+4 de dano) deixa o fantasma tonto por 1,3 s.
- Dano ao acertar o boss (objeto arremessado): barril 7, TV 9, bola de boliche 10, almofada 1 (além dos 8 / 6 / 5 / 5 da caixa, cadeira, vaso e tábua).

**Fase 2** (abaixo de 50% de vida): a cor da perseguição muda para roxo, ele fica 40% mais rápido e os tempos de aviso e recuperação caem 30%.

**Em primeira pessoa você não vê o que está atrás**, então enquanto o boss carrega ou avança fora do seu campo de visão, a borda da tela do lado dele fica vermelha (esquerda, direita ou as duas, se ele estiver atrás). Levar dano também dá um flash vermelho.

**Derrota:** vida do jogador chega a 0. **Vitória:** vida do boss chega a 0 (mostra o tempo da luta). `R` reinicia.

### Tabela de dano

| Fonte | Dano no boss |
|---|---|
| Soco normal | 2 |
| Soco forte | 6 |
| Boss arremessado bate na parede | +4 |
| Boss arremessado destrói um móvel grande | +2 |
| Caixa / cadeira / vaso / tábua arremessados nele | 8 / 6 / 5 / 5 (x1,5 se socados com o soco forte; **x2 se arremessados da mão**) |

Exemplo: um soco forte (6) que o manda contra a parede (4) rende 10 de 120. Uma caixa socada com o forte (8 x 1,5 = 12) mais a parede (4) rende 16. Uma caixa **pega e arremessada da mão** (8 x 2 = 16) mais a parede (4) rende **20**.

## Objetos: móveis destrutíveis e projéteis

A sala começa cheia: 1 mesa, 4 cadeiras, 2 estantes, 1 sofá, 1 geladeira, 3 caixas, 3 barris, 1 TV, 2 bolas de boliche, 3 almofadas e 3 vasos (24 objetos; o centro fica livre para a luta). Todos são feitos de primitivas do Three.js e quebram em **estilhaços** (caixas pequenas com gravidade, quique e atrito, que somem sozinhas; no máximo 160 ao mesmo tempo).

| Tipo | Exemplos | Ao ser socado |
|---|---|---|
| **Pequeno** (arremessável) | cadeira, caixa, vaso, tábua, barril, TV, bola de boliche, almofada | Vira **projétil**: voa reto na altura do peito, girando, a 32 u/s (50 u/s com o soco forte) |
| **Grande** (destrutível) | mesa (3 de vida), estante (4), sofá (4), geladeira (5) | Soco normal tira 1 de vida, cruzado e uppercut 2, soco forte 4. Ao quebrar, solta estilhaços e **2 tábuas arremessáveis** (o sofá solta 2 **almofadas**) |

Regras dos projéteis:
- Acertou o **boss**: causa o dano da tabela, empurra o boss a 34 u/s e se estilhaça.
- Acertou a **parede**: se estilhaça (sem dano).
- Acertou um **móvel grande**: tira 2 de vida dele e se estilhaça.
- Perdeu velocidade antes de acertar nada: cai, pousa e **pode ser socado de novo**.

Outras regras:
- O jogador **não atravessa** móveis parados (colisão por círculo).
- O fantasma **flutua e atravessa** móveis normalmente, **a menos que esteja sendo lançado ou avançando**: aí ele destrói tudo no caminho.
- Se sobrarem menos de 3 objetos pequenos, uma **caixa cai do teto** a cada 9 s (para a luta nunca ficar sem munição).

### Pegar e arremessar (tecla F)

Além de socar, dá para **pegar** um objeto pequeno e **arremessá-lo no inimigo**, que é a jogada mais forte do jogo:

1. **Pegar:** chegue perto de um objeto pequeno parado (cadeira, caixa, vaso ou tábua, a até 2,8 unidades e à frente) e aperte **F**. A dica "F = pegar caixa" aparece no centro da tela quando há algo ao alcance.
2. **Segurar:** o objeto aparece nas suas mãos, menor e embaixo da mira, acompanhando o olhar, e o punho some. Móveis grandes (mesa, estante) não podem ser pegos; quebre-os para virar tábuas.
3. **Arremessar:** qualquer botão de ataque lança o objeto na direção da mira a 46 u/s, **com o dobro do dano** de um objeto socado e 25% mais empurrão. Ele voa reto e estilhaça ao acertar o boss, a parede ou um móvel grande.
4. **Mira assistida:** se o boss estiver a menos de 12° da mira, o arremesso vai direto nele; mais longe que isso, vai reto e pode errar.
5. **Soltar:** apertar **F** de novo larga o objeto no chão, à frente.

Enquanto segura um objeto você **não soca**: todo ataque vira arremesso. Esquivar e andar continuam normais. Reiniciar (`R`) ou recarregar o código solta o objeto.

### Impacto (juice)

- **Hitstop:** quando um golpe acerta, o jogo quase congela por 0,04 a 0,12 s.
- **Squash & stretch:** o boss é amassado ao levar o golpe.
- **Tremor de câmera** proporcional ao impacto, estilhaços e pulinho do boss.
- **Contador de combo** (x2, x3...) no canto direito; zera se ficar 2 s sem acertar.

## Soco forte (arremesso)

Botão direito do mouse (ou `E`). É um golpe lento, com recarga de 1,8 s:

1. **Carga (0,3 s):** o punho é puxado para trás e para baixo.
2. **Golpe:** o punho avança até o centro da tela. O acerto usa o mesmo cone do soco normal e atinge **o boss e os objetos ao mesmo tempo**.
3. **Arremesso:** o boss recebe 58 u/s na direção do golpe, com um pulo alto, e **atravessa a sala girando**. O atrito é baixo de propósito (`launchFriction`), então ele só para na parede.
4. **Batida na parede:** dano extra de 4, tremor forte e hitstop, e ele fica tonto por 1,3 s.
5. A barra "SOCO FORTE" na parte de baixo da tela mostra a recarga. Ela acende em rosa quando está pronto. Errar o golpe também gasta a recarga.

## Como funciona o soco normal

1. Clique ou Espaço inicia a animação (0,28 s). O punho sai do canto da tela até o centro e volta.
2. Em 45% da animação ocorre o **momento do impacto**.
3. No impacto: para o boss e para cada objeto, calcula a distância e o produto escalar entre a direção do olhar (yaw) e a direção até o alvo. Se estiver perto e dentro do cone de 60°, ele é atingido.
4. O boss perde 2 de vida e é **sempre empurrado** (15 u/s, perfil leve). Objetos pequenos viram projéteis; móveis grandes perdem 1 de vida. Ao morrer, o boss gira e encolhe.

## Diário de desenvolvimento

### Etapa 1: base jogável
- Sala 18x18 com piso e paredes texturizados, luz ambiente, luz "lunar" e lanterna.
- Jogador (cilindro + esfera) com WASD e mira no mouse (raio da câmera contra o plano do chão).
- Soco com animação, cone de acerto, knockback, tremor de câmera.
- Fantasmas que nascem nas bordas, perseguem, flutuam e causam dano ao encostar.
- HUD com pontos e vida, game over e reinício com R.
- Ajuste visual: removida a sombra da lanterna (criava uma mancha preta sob o jogador) e adicionada luz de contorno.
- Trocado `THREE.Clock` (depreciado) por `THREE.Timer`.

### Etapa 1.1: projeto Node
- Convertido para projeto Node com Vite; Three.js agora vem do npm (`import * as THREE from 'three'`).
- Removida a pasta `lib/` e o importmap.

### Etapa 2: boss fight 1x1
- Decisão: **sem ondas de fantasmas**; a luta passa a ser jogador contra um único boss.
- Removidos a lista de fantasmas, o spawn e a pontuação.
- Boss com máquina de estados (perseguir, aviso, avanço, atordoado, morrendo) e fase 2 aos 50% de vida.
- Barra de vida do boss no topo da tela (azul; roxa na fase 2), com marca em 50%.
- Esquiva com Shift (invulnerável por 0,2 s, recarga de 0,8 s), necessária para a luta ser justa.
- Telas de vitória (com tempo) e de derrota; `R` reinicia.
- Modo de teste: abrir com `?debug` na URL expõe `window.__gp` (estado do jogo) no console.

### Etapa 3: primeira pessoa
- Decisão: **câmera em primeira pessoa completa** (sem modo alternativo). A câmera de cima foi removida.
- Câmera nos olhos (altura 1,6), mouse olha com Pointer Lock (yaw e pitch limitado a ±77°), FOV 80.
- WASD e esquiva passaram a ser relativos ao olhar.
- Removidos o corpo do jogador, a mira por raio no chão e a luz de contorno.
- Punho e antebraço presos à câmera; lanterna também (atrás e acima da câmera, senão estoura o brilho do punho).
- Mira (ponto) no centro da tela; flash vermelho ao levar dano; bordas vermelhas avisam ataque do boss fora da visão; balanço leve ao andar; FOV se abre na esquiva.
- Sala mais alta (5) e com teto, para dar para olhar para cima.
- Tela inicial "Clique para jogar" (necessária para capturar o mouse).
- Testado: movimento relativo ao yaw, soco só acerta olhando para o boss, avisos laterais, esquiva, vitória e reinício. Não testado no meu ambiente: sensibilidade do mouse e conforto, que dependem de jogar de verdade.

### Etapa 4: soco forte
- Novo golpe com carga lenta, recarga de 2,5 s e barra de recarga na tela.
- Arremessa o boss com velocidade inicial alta e atrito baixo; ele gira ao voar e, ao bater na parede, leva dano extra e fica atordoado por mais tempo.
- Botão direito (com o menu de contexto do navegador desativado) ou `E`.
- O golpe forte cancela o ataque do boss (inclusive o avanço) e o deixa vulnerável.
- Refatorado: `damageBoss()` concentra o dano, a fase 2 e a morte, usado pelos socos e pela batida na parede.
- Testado: arremesso e batida (vida 20 -> 17 -> 15), recarga bloqueando o 2º golpe, botão direito, dano dobrado em atordoado, golpe errando gasta a recarga, soco normal inalterado, vitória pelo golpe forte. Detalhe do ambiente de teste: ele roda a ~3 quadros/s, então esperei por quadros e não por milissegundos.
- Não testado: a sensação de impacto e o equilíbrio (5 de 20 de vida em um golpe pode ser muito).

### Etapa 5: hot reload
- Salvar `src/main.js` com `npm run dev` rodando atualiza o jogo sem recarregar a página e mantém a luta, a posição, o olhar, a recarga e a captura do mouse.
- Todos os eventos passam por `on()` para poderem ser removidos; o loop guarda o `rafId`; a cena antiga é liberada no `dispose`.
- Corrigido durante o teste: o Vite recarregava a página inteira porque eu usava um apelido (`hot.accept()`); ele só reconhece o texto literal `import.meta.hot.accept()`.
- Testado com o jogo rodando e o código editado por fora (2 salvamentos seguidos): sem recarga da página (marcador de memória mantido), 1 canvas, vida do boss 7 e do jogador 61 mantidas, posição e olhar mantidos, mouse ainda capturado, `CFG` novo valendo na hora (3 -> 4 -> 5), velocidade do jogo estável e soco funcionando depois. Cena continua desenhada.

### Etapa 6: móveis destrutíveis, objetos arremessáveis e "brutamontes vs. fantasma"
- Decisão: o personagem é **muito mais forte** que o fantasma em golpes, e o fantasma tem **muita vida** (20 -> 120) para aguentar muitos golpes e a luta ficar engraçada.
- **Todo golpe desloca o boss**, em qualquer estado, e cancela o ataque dele (antes, o soco normal só o empurrava de leve e não valia durante o avanço). Substituiu `stunExtra` por `stunDur` (duração do tonto); removido o "dano dobrado em atordoado", que passaria a valer em todo golpe.
- Dano rebalanceado: soco 1 -> 2, soco forte 3 -> 6, batida na parede 2 -> 4, recarga do forte 2,5 -> 1,8 s. Boss um pouco mais fraco contra o jogador (contato 8 -> 6, avanço 22 -> 18) e um pouco mais rápido (2,0 -> 2,4).
- Móveis: mesa, cadeiras, estantes, caixas e vasos, modelados com primitivas. Pequenos viram projéteis ao serem socados; grandes quebram em estilhaços e tábuas.
- Boss lançado contra móvel grande destrói e se machuca (-2); o avanço também destrói móveis.
- Estilhaços com gravidade, quique e atrito (limite de 160); caixa cai do teto se faltar munição.
- Impacto: hitstop, squash & stretch no boss, pulinho vertical ao ser atingido, contador de combo.
- Estado dos objetos também sobrevive ao hot reload.
- Testado: soco normal empurra o boss em 4 estados (perseguir, aviso, avanço, tonto); caixa socada acerta o boss (-8) e o lança; mesa quebra com 3 socos normais e a estante com 1 soco forte, soltando 2 tábuas; vaso arremessado se estilhaça na parede sem dano; boss lançado destrói a mesa; jogador para antes da mesa (z = 6,38); caixa cai do teto e pousa; combo conta 3 e aparece "x3"; hitstop reduz o tempo de jogo de ~0,12 para 0,008 em 3 quadros; vitória por soco; hot reload mantém os 10 objetos, a vida da mesa e as posições.
- Corrigido durante o teste: tábuas soltas por uma mesa também contavam como "móvel esmagado" e tiravam 2 de vida do boss cada; agora só móveis grandes machucam o boss.
- **Não testado** (depende de jogar): o equilíbrio (120 de vida é muito ou pouco?), a graça do arremesso e se a recarga do forte está boa.

### Etapa 7: pegar e arremessar objetos (tecla F)
- Nova mecânica: **F** pega o objeto pequeno mais próximo à frente; ele fica na mão (filho da câmera) e qualquer ataque o arremessa no inimigo com dano x2.
- **Mira assistida** de 12° (`aimAssistDeg`): perto da mira, o arremesso vai direto no boss.
- Dica na tela ("F = pegar caixa" / "Clique = ARREMESSAR · F = soltar"); o punho some enquanto segura.
- Objeto na mão não tem física, não colide e não pode ser socado; restart e hot reload o soltam.
- Móveis grandes não podem ser pegos (a ideia é quebrá-los para obter tábuas).
- Testado: sem objeto por perto, F não faz nada e não há dica; dica aparece com caixa à frente; pegar (objeto vira filho da câmera, punho some, escala 0,5); soltar (volta para a cena e cai no chão); mesa não pode ser pega; arremesso acerta o boss: 120 - 16 (8 x 2) - 4 (parede) = 100; mira assistida acerta com 8° de erro; com 30° de erro o objeto erra e estilhaça na parede sem dano; E com objeto na mão também arremessa; R solta; hot reload com objeto na mão: o objeto cai no chão, a vida do boss e os 11 objetos são mantidos e dá para pegar e arremessar de novo.
- Ajuste visual durante o teste: o objeto na mão (escala 0,65) tapava a visão do boss; reduzido para 0,5 e baixado.
- **Não testado** (depende de jogar): se a mira assistida de 12° está boa, e se o objeto na mão atrapalha ou ajuda a ver o boss.

### Etapa 8: golpes com pesos diferentes e menu de pausa
- **Perfis de golpe** (`CFG.attacks`): soco leve, soco forte e cada objeto (vaso, tábua, cadeira, caixa) têm empurrão, pulo vertical, tempo tonto, amassado, hitstop e tremor próprios. Antes, todo golpe tinha praticamente o mesmo efeito (o pulo era sempre 14% da velocidade, e todo objeto empurrava 34, fosse vaso ou caixa).
- Soco leve: empurra pouco (15) e mal tira o boss do chão, para dar para combar. Soco forte: 58 de empurrão e 9,5 de pulo, tonto por 1,7 s.
- Pulo (knock-up) real e separado do empurrão; teto: a cabeça do boss não atravessa o forro (altura máxima 1,5).
- Giro no ar proporcional à força; o campo de visão "dá um soco" no impacto (+9° no forte, +2° no leve).
- Objetos socados com o soco forte empurram 15% mais; objetos arremessados da mão, 25% mais.
- **Menu de pausa**: jogo congela sem mouse capturado (Esc, P, perder o foco); botões Continuar e Reiniciar luta; sliders de sensibilidade e de campo de visão salvos no `localStorage`; lista de controles; tela inicial "Jogar" que também mantém o jogo parado até o primeiro clique (antes o boss já se mexia atrás da tela inicial).
- Removido o "clique em qualquer lugar captura o mouse": agora só o botão captura, senão clicar nos sliders retomaria o jogo.
- Painel do menu com rolagem: em janelas baixas o título era cortado.
- Testado: leve x pesado (tonto 0,4 x 1,7 s; pico de altura 0,08 x 1,28; giro 7 x 16; dano 2 x 6 e +4 na parede = 10); teto respeitado; objetos em ordem (altura 0,18 / 0,30 / 0,55 / 0,88 e tonto 0,5 / 0,5 / 0,8 / 1,0); mesma caixa 8 / 12 / 16 de dano e tonto 1,0 / 1,18 / 1,3; pausa (tempo, boss e jogador congelados, Espaço e W ignorados, P pausa e continua, Continuar recaptura, opções salvas e FOV da câmera vai a 100, sem menu na vitória); hot reload mantém luta, mouse e menu fechado, e a pausa funciona depois dele.
- Erro do meu teste, corrigido: passei a posição como lista e gerou NaN; refeito antes de confiar nos números.
- **Não testado** (depende de jogar): se a diferença de peso está perceptível e agradável, e o conforto do campo de visão extra no impacto.

### Etapa 9: dois braços, mais golpes, mais objetos
Feedback do usuário: "dois braços seria legal, mas não está divertido; mais variedade de ataques, mais objetos na tela, animações mais de luta".
- **Dois braços**: `makeHand(side)` cria punho + antebraço + punho de manga; a esquerda é o espelho da direita. Os dois ficam em guarda com respiração e balanço ao andar, vão às laterais do objeto quando você o segura e encolhem na esquiva.
- **Animações por keyframes** (`MOVES`, `sampleKF`): antes era uma só fórmula de ida e volta. Agora cada golpe tem sua própria sequência de poses (preparação, impacto, retorno) e a outra mão faz sua própria guarda. O código antigo do soco (`punchT`, `punchHeavy`) virou `state.atk`.
- **Variedade de ataques**: combo jab, jab, cruzado (alternando as mãos), uppercut (Q) que lança para o alto, esmagar (C) em área com onda de choque visível, e o soco forte. Recargas independentes (`CFG.cooldowns`), com três barras na tela e o nome do golpe ("UPPERCUT!").
- **Sensação de luta**: avanço do corpo antes do soco, inclinação e giro da câmera, tranco no impacto, combo aéreo (+50% de dano no boss que está no ar).
- **Mais objetos**: barril, TV (tela emissiva), bola de boliche, almofada (quase não faz nada: é engraçado), sofá e geladeira (móveis grandes; o sofá solta almofadas). A sala começa com 24 objetos (eram 10) e cai um objeto aleatório do teto quando sobram menos de 6 pequenos (eram 3, de 9 em 9 s; agora a cada 6 s).
- **Pé-direito de 5 para 6,5**: o teto antigo cortava o uppercut (a cabeça do boss batia nele antes de subir).
- Testado: jab (2 de dano, pico de altura 0,08), forte (6 + 4 na parede), uppercut (pico = teto, 3,0), esmagar (boss, objeto arremessado e mesa com dano); combo jab, jab, cruzado, jab (a janela fecha depois de 0,9 s); juggle (3 de dano = 2 x 1,5); pegar o barril com as duas mãos; hot reload mantém a luta; sem erros no console. As poses de cada golpe no impacto foram conferidas em screenshots (jab, cruzado, forte, uppercut, esmagar).
- Corrigido durante o teste: a preparação do soco forte e a do esmagar saíam do enquadramento (mãos fora da tela); aproximei os keyframes. O texto de ajuda sobrepunha os braços; encurtei.
- **Não testado** (depende de jogar): se os golpes novos estão divertidos e equilibrados (o esmagar de 4 s e o uppercut de 1,4 s podem estar baratos demais) e se 24 objetos pesam em computadores mais fracos (o teste rodou em renderização por software).

### Etapa 10: pulo dos objetos menor e fantasma de terror
Feedback do usuário: "o knockup de lançamento de objetos está muito forte ainda; o fantasma deveria ser mais de terror, tipo aqueles fantasmas de cabelo comprido de filmes japoneses".
- **Pulo dos objetos**: o pulo vertical (`up`) de cada objeto caiu de 1,5 a 8 para 0,6 a 3,5 u/s (vaso 1,5, tábua 2, cadeira 2,8, caixa 3,5, barril 3,2, TV 3, bola 2,2, almofada 0,6). Medido com o objeto arremessado da mão (x1,25): pico de 0,02 a 0,23 u de altura (caixa 0,23, o maior), contra 1,28 u do soco forte e 3 u do uppercut. Os objetos empurram e machucam como antes; só deixaram de lançar o boss para o alto.
- **Novo fantasma** (inspirado nos *yūrei* / *onryō* da tradição japonesa; design original): menina pálida de **vestido branco rasgado** (cone facetado + 11 tiras desiguais na barra), **cabelo preto comprido** (massa atrás, duas cortinas na frente deixando só uma fresta do rosto, 16 mechas que balançam), **olhos fundos** com brilho, boca aberta e **braços compridos demais**, com dedos finos.
- **Animação** (`animateGhost`): a cabeça "estala" de lado em degraus (de propósito sem suavização), os braços balançam; no **aviso do ataque** ele ergue os braços, se inclina para você e a cabeça treme (olhos **vermelhos**); no avanço, os braços ficam esticados em garra; **tonto**, os braços soltam e a cabeça cai mole (olhos amarelos); voando, os braços se debatem.
- A cor do estado (azul, vermelho, laranja, amarelo, roxo na fase 2) agora aparece no **brilho dos olhos**, no vestido e na luz, não no corpo todo. O flash branco do golpe continua.
- Tamanho e hitbox iguais aos de antes (raio 1,0; escala 1,8), então a luta não muda.
- Testado: capturas do fantasma andando de longe e de perto, no aviso, tonto e no avanço; pico de altura dos 8 objetos; sem erros no console.
- **Ideias de terror a seguir** (não feitas): andar de forma entrecortada, luz da sala piscando e escurecendo quando ele ataca, respiração/sussurro e som de cabelo, rosto que se revela só na fase 2 (o cabelo se abre), e aparecer atrás de você.

## Próximas etapas (a decidir)

- Jogar e equilibrar: `bossMaxHp`, `punchDamage`, `heavyDamage`, `wallSlamDamage`, `heavyCooldown`, `propLaunch`, `throwSpeed` no `CFG` (o hot reload ajuda).
- Texturas autorais (piso, parede, rosto do boss, madeira dos móveis). Critério explícito de avaliação.
- Sons (impacto, quebra, aviso do boss; ajudam muito em primeira pessoa) e partículas.
- Mais ideias: poder pegar móveis grandes (com mais dano e mais lento); arremesso carregado (segurar para dar mais força); medidor de medo (do jogo original); parry; boss reagindo ao esmagar (pulo para trás); golpe em corrida (dash punch).
- Ajustar `aimAssistDeg`, `heldThrowMul`, `grabRange` e `throwHeld` no `CFG` depois de jogar.
- Sensibilidade e FOV agora se ajustam no menu de pausa; falta só achar os valores bons jogando.
