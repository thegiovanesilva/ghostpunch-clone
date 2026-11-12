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

### O cenário

A casa tem **40 x 40 unidades** (`CFG.roomHalf: 20`; na Etapa 12 eram 28 x 28) com **paredes internas, portas e duas escadas**:

| Área | Onde | O que tem |
|---|---|---|
| **Salão central** | meio | o "ringue": tapete-passadeira, poucos objetos e o **andar de cima** (altura 2,58, largura do salão inteiro) |
| **Andar de cima** | norte do salão | a escada de 6 degraus leva a uma **sala-mirante** com sofá, mesa, cadeira, estante, lâmpada própria e objetos pesados para arremessar lá de baixo; **parapeito** de 1 m na borda, com um **vão de pulo** (x = 4 a 7) para cair de volta no salão e esmagar o fantasma |
| **Sala de estar** | ala oeste, norte | tapete, sofá, TV, mesa, poltronas, estantes, vasos |
| **Depósito** | ala oeste, sul | caixas, barris, estantes, bolas |
| **Cozinha** | ala leste, norte | piso quadriculado, 2 geladeiras, mesa com 4 cadeiras, barris |
| **Biblioteca / boliche** | ala leste, sul | mesa, estante, bolas de boliche, TV e **mezanino sudeste** (com parapeito) e escada |

- Duas divisórias norte-sul (x = -9 e x = 9) e duas cruzadas separam as alas; cada uma tem vãos de porta de 4 m.
- **Estilo de casa**: as duas divisórias principais (x = -9 e 9) são **estruturais**: cor lisa roxa-escura, batentes de porta de madeira com verga (3,7 m livres) e **indestrutíveis**. Só as **divisórias finas de gesso** (cruzadas z = 2 e z = -4, **6 painéis de 3 m**, 2 de vida, de cor **mais clara** para avisar) quebram. O restart reconstrói tudo.
- **Colisão** (`solids`, `groundY`, `resolveSolids` em `main.js`): cada parede, degrau e plataforma é uma caixa alinhada aos eixos (AABB) com altura `top`. Um personagem só é bloqueado por caixas mais altas que `y + passo` (0,55 m para o jogador), por isso sobe degraus de 0,43 m e cai de plataformas com gravidade. A câmera sobe suavizada (`eyeY`), sem tranco.
- Decoração: 14 janelas, 8 quadros, porta de entrada na parede sul (de onde o jogador veio), vigas, **6 lâmpadas** (as luzes que piscam), sombra da lua em 4096 x 4096.

### Luzes piscando

Quatro lâmpadas no teto (fio, bulbo e luz pontual), mais a luz ambiente e a "lua", compartilham um nível `lvl` (0 a 1) que `updateLights()` calcula todo frame:

| Situação | O que acontece |
|---|---|
| Aleatório, a cada 9 a 20 s | Pisca por ~0,9 s (nível cai a 30%), com estalinhos elétricos |
| **Aviso do ataque** do fantasma | Pisca cada vez mais (a chance de ficar apagada sobe de 30% para 60% ao longo do aviso; nível mínimo 22%) |
| **Avanço** do fantasma | Apaga por 0,22 s (nível 8%) e volta de uma vez |
| Entra na **fase 2** | Pisca por 2,4 s e termina no escuro por 0,6 s |
| Golpe forte (soco forte, uppercut, esmagar) | Treme por 0,35 s |

**Segurança:** as trocas são irregulares, mas com no mínimo **0,17 s entre elas** (no máximo cerca de 3 por segundo), nenhuma lâmpada vai a preto total no pisca normal, e o menu de pausa tem a opção **"Luzes piscando"**, que desliga tudo (fica salva). Se for apresentar para outras pessoas, avise.

### Som

Tudo é gerado na hora pela **Web Audio API** (`src/audio.js`): osciladores (tons), ruído branco filtrado e envelopes de volume. Não há arquivos de som. O áudio só começa no clique em **Jogar**, porque os navegadores exigem um gesto do usuário.

| Som | Como é feito |
|---|---|
| Golpe cortando o ar (whoosh) | Ruído passa-faixa com varredura de frequência para cima, atrasado até o meio da animação; mais forte nos golpes fortes |
| Impacto no fantasma | **Sem tom que cai de altura** (isso soava como "bonk" de desenho): corpo de ruído grave com decaimento rápido + médios + ressonâncias de frequência fixa + tapa agudo na pele + estalo + **esguicho** (gorgolejo curto e ruído que "afunda") + **osso estalando** nos golpes médios e fortes; golpe forte ganha um boom de ~62 Hz. **O tom sobe a cada golpe do combo** |
| Parede, esmagar | Ruído muito grave com decaimento + ressonâncias de 50 a 110 Hz (frequência fixa) + estalo agudo; o esmagar solta ainda pedacinhos do chão |
| Quebrar objeto | Depende do material: **madeira** (estalos de ruído + lascas ressonantes + baque abafado), **vidro** do vaso (7 "plins" agudos aleatórios + ruído agudo), **barril** (baque + ressonâncias metálicas de 280, 610 e 1180 Hz), **TV** (vidro + estalinhos elétricos), **bola** (baque), **almofada** (fofo) |
| Voz do fantasma (**grotesca**) | Três osciladores (serra, serra desafinada e onda quadrada uma oitava abaixo = rosnado) com a altura **tremendo de forma irregular**, passando por filtros de vogal que abrem e fecham, **distorcidos** (rouquidão) e com **estertor** (o som é cortado 20 a 40 vezes por segundo) + sopro de ar. Dor: grave e rouca, com gorgolejo. Aviso do ataque: berro dissonante de duas vozes que sobe, sobre um rosnado, com ossos estalando. Morte: voz que cai por 3 s e termina **afogando em gorgolejo** |
| Gorgolejo e ossos | Gorgolejo = ruído por um filtro ressonante cuja frequência balança rápido (bolhas na garganta). Osso = estalo seco de ruído agudo + tom que cai + "pop" grave. **A cada espasmo da cabeça o pescoço estala** (60% das vezes) |
| Respiração do fantasma | Ruído que infla e esvazia a ~0,42 Hz saindo da posição dele (tonto: mais rápido, engasgado) + um arrastar molhado enquanto ele persegue |
| Ambiente | Zumbido grave contínuo (dois tons de 48 e 48,7 Hz, levemente desafinados), vento com variação lenta, **sussurros** roucos (sílabas de ruído, às vezes terminando em gorgolejo ou estalo de osso) em lugares aleatórios da sala, rangidos distantes e **gotas** caindo |
| Tensão | Quanto mais perto o fantasma, mais alto o zumbido e mais rápido o **batimento cardíaco** (de 1,15 s a 0,45 s entre batidas) |
| Outros | Passos ao andar, esquiva, pegar e arremessar objeto, dano no jogador, vitória, derrota |

- **Som 3D:** os sons do fantasma e dos objetos passam por um `PannerNode` (alcance de 7 unidades sem perda, queda suave: a sala tem 28) na posição deles e o "ouvinte" é a câmera (posição e direção atualizadas todo frame). Você ouve de que lado ele está e o gemido de aviso funciona mesmo quando ele está atrás de você.
- **Pausa congela o som** (o contexto de áudio é suspenso e depois retomado).
- **Volume** no menu de pausa e tecla **M** para mudo; os dois ficam salvos no navegador. Um compressor no final evita estourar quando vários sons tocam juntos.
- Com hot reload, o áudio é recriado e continua tocando.

### Pausa e opções

O jogo fica **pausado sempre que o mouse não está capturado**: ao apertar `Esc`, ao apertar `P`, ao trocar de janela, e antes do primeiro clique em Jogar. Nada se mexe (boss, tempo, recargas) e as teclas de ação são ignoradas. Um menu aparece por cima do jogo:

- **Volume** (0 a 100%) e **M** para mudo, também salvos no `localStorage`.
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
| Mudo (liga e desliga o som) | M |
| Reiniciar | R |

## Estrutura

```
index.html      página e HUD (HTML/CSS)
src/main.js     toda a lógica do jogo (import * as THREE from 'three')
src/audio.js    todos os sons, sintetizados por código (Web Audio API, sem arquivos)
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
| Texturas | (removidas na Etapa 15f: tudo é cor lisa até as autorais ficarem prontas) | 3 |
| Hierarquia de transformações (objeto pego) | Ao apertar F, o objeto troca de pai: sai da cena e vira **filho da câmera** (`camera.add`), herdando a posição e a rotação do olhar; ao arremessar, volta para a cena com a posição de mundo | 6 |
| Modelagem 3D com primitivas e hierarquia | O **fantasma** (vestido de cone, braços com pivô no ombro, cabeça com cabelo e 16 mechas; todas as partes são filhas de `bossVis`) e os móveis (cadeira, mesa, estante, caixa, vaso...) são grupos de caixas, cilindros e esferas (`Group`); cada estilhaço é uma caixa de tamanho aleatório | 6 |

## Conteúdo autoral

- **Sons:** todos **sintetizados por mim em código** (`src/audio.js`), sem arquivos de áudio nem bibliotecas. Detalhes na seção "Som".
- **Hoje:** **não há nenhuma textura**: piso, paredes, tapetes e quadros são cores lisas (removi as texturas geradas por código na Etapa 15f, já que ainda não foi decidido como elas serão). Os móveis usam cores lisas desde o começo. Tudo é placeholder.
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

A sala começa com **55 objetos** espalhados pelas quatro áreas (veja "O cenário"); o centro fica livre para a luta. Todos são feitos de primitivas do Three.js e quebram em **estilhaços** (caixas pequenas com gravidade, quique e atrito, que somem sozinhas; no máximo 160 ao mesmo tempo).

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
- Sala 18x18 (hoje 28x28, Etapa 12) com piso e paredes texturizados, luz ambiente, luz "lunar" e lanterna.
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

### Etapa 11: sons
Pedido do usuário: "Sons". Decisões: **sintetizar tudo por código** (Web Audio), sem arquivos, para o projeto continuar só com Node e o conteúdo ser autoral.
- `src/audio.js`: motor de som (`createAudio`) com três ferramentas: `tone` (oscilador com glissando), `noise` (ruído filtrado) e `voice` (serra + formantes). Todos os efeitos são combinações delas.
- Ligações no jogo: `registerHit` (impacto + gemido), `setBossMode` (aviso, avanço, morte), golpes (whoosh), objetos (quebra por material), jogador (dano, esquiva, passos), pausa (suspende) e vitória/derrota.
- Ambiente de terror: zumbido, vento, sussurros e rangidos; **tensão** (distância do fantasma) controla o volume do zumbido e o ritmo do batimento cardíaco.
- Menu: slider de volume e tecla M.
- Testado: o áudio só existe depois do clique; mudo zera a saída; pausar suspende e continuar retoma; o hot reload mantém o áudio funcionando; sem erros no console.
- **Medido offline** (`OfflineAudioContext`, sem depender de caixa de som): cada efeito foi renderizado sozinho e comparado com o som ambiente. A primeira versão tinha vários efeitos (whoosh, gemido, estalos de madeira, avanço, passos) **mais baixos que o ambiente**, porque os filtros estreitos tiram muita energia do ruído e das vozes. Corrigi com compensação de ganho nos filtros, queda do volume em dois estágios (mais "corpo") e ambiente mais baixo (pico de 0,11 para 0,07). Hoje: ambiente 0,07; whoosh 0,19; golpe leve 0,21; golpe forte 0,43; esmagar 0,47; aviso do fantasma 0,37; fase 2 0,68 (pico, em escala de 0 a 1).
- Erro meu de método: a medição pelo navegador em tempo real não é confiável no ambiente de teste (relógio de áudio irregular); por isso troquei para renderização offline.
- **Não testado** (depende de ouvir): se o mix está agradável, se o gemido assusta ou irrita, se os passos estão altos demais. Só dá para julgar com fone de ouvido; os números acima só garantem que nada some nem estoura. Tudo se ajusta nos ganhos de `src/audio.js`.

### Etapa 12: luzes piscando e sala maior
Pedidos do usuário: "adiciona as luzes piscando" e "uma expansão de cenário".
- **Luzes**: 4 lâmpadas no teto e o sistema `updateLights()`/`startLightEvent()` (tabela em "Luzes piscando"), ligado ao aviso, ao avanço, à fase 2 e aos golpes fortes, com estalinhos elétricos (`sfx.flicker`). Opção no menu para desligar, por segurança com sensibilidade à luz.
- **Cenário**: de 18 x 18 para **28 x 28** (2,4x a área), com quatro áreas temáticas, tapete, piso da cozinha, janelas, quadros, porta, vigas e **55 objetos** (eram 24). O mínimo de objetos pequenos para o teto soltar um novo subiu de 6 para 10.
- Ajustes por causa do tamanho: névoa de 14 a 32 para 16 a 40; texturas proporcionais; sombra da lua maior; 4 lâmpadas em vez de 2.
- Erro meu corrigido no meio: a decoração usava `boxGeo`, que só é criado mais abaixo no arquivo (erro "antes da inicialização" na hora de abrir). Passei a usar uma geometria própria (`decoBox`).
- Testado: valores de `lvl` frame a frame em cada situação (normal 1; aleatório mínimo 0,30; aviso até 0,08 ao virar avanço; fase 2 termina em 0,06; desligado fica em 1), opção salva no `localStorage`; as 55 peças não se sobrepõem nem saem da sala; screenshots das quatro áreas e dos dois lados; a luta continua igual (soco forte = 6 + 4 de parede, boss leva ~6 s para chegar); hot reload mantém tudo; sem erros no console.
- **Não testado** (depende de jogar): se 28 x 28 não ficou grande demais (o fantasma começa a 21 unidades de você e leva cerca de 6 s para chegar), se o piscar incomoda ou assusta na medida, e o desempenho em computadores mais fracos (o teste usa renderização por software e não serve para medir fps; são 4 luzes pontuais + lua + lanterna + luz do boss).

### Etapa 13: sons mais grotescos
Feedback do usuário: "os barulhos estão mais engraçados do que assustadores, poderia ser algo mais grotesco?"
- **Diagnóstico**: a voz era uma serra com vibrato certinho por filtros de vogal limpos ("aah", "ooh"): parecia desenho animado. O impacto era só uma pancada com um som de "carne" de serra filtrada.
- **Voz nova**: altura instável (jitter), rosnado uma oitava abaixo, distorção (`WaveShaper`) e estertor, mais sopro de ar. Dor, aviso, avanço, fase 2 e morte foram refeitos com ela.
- **Sons novos**: `gurgle` (gorgolejo), `squelch` (esguicho no impacto), `boneCrack` (osso, no impacto e a cada espasmo da cabeça), respiração e arrastar do fantasma (`api.presence`, 3D), sussurros mais roucos e gotas.
- Medido offline como antes: impacto forte pico 0,8 (a primeira versão chegou a 1,0, no limite, e foi reduzida), aviso 0,5, estalo de osso 0,3, sussurro 0,16, gota 0,12, ambiente 0,07. A primeira gota e o sussurro ficavam abaixo do ambiente e foram aumentados.
- Testado: áudio só após o clique, mudo, pausa e retomada, hot reload com o áudio ativo, sem erros no console.
- **Não testado** (depende de ouvir): se agora assusta ou só irrita; a voz e a respiração são o que mais influencia. Ajustes: `jitter`, `rattle`, `dist` e `growl` em cada chamada de `voice()`, e os ganhos de `api.presence`.

### Etapa 14: impactos realistas e fantasma audível
Feedback do usuário: "as batidas estão bem cartoonizadas, principalmente os socos e os impactos nos objetos, e o fantasma agora não faz mais nada de som comparado a antes".
- **Impactos "bonk"**: toda pancada era um seno cuja altura despencava (190 para 52 Hz). Um tom que cai de altura é o som clássico de desenho animado. Troquei por ruído de banda larga com decaimento rápido (o corpo), ressonâncias de **frequência fixa**, tapa e estalo agudos, e removi o tom que cai também de parede, esmagar, toque em objeto, quebra de madeira, barril, bola e dano no jogador. O tom que subia a cada golpe do combo virou só uma leve variação do tapa.
- **Fantasma sumido**: medi a voz antiga contra a nova a 4, 12 e 20 unidades. O volume da nova não era menor, mas era **mais grave** (60 a 170 Hz, que alto-falantes de notebook quase não tocam) e o som 3D caía rápido com a distância (a sala agora tem 28 unidades). Subi a altura da voz de dor (280 a 120 Hz, mais um grito de dor em 560 a 250 Hz), aumentei o ganho da voz e do avanço, e alarguei o alcance 3D.
- Medido offline, pico (antiga voz / nova): dor a 12 unidades 0,10 / 0,49; aviso a 12 unidades 0,30 / 0,54; avanço a 12 unidades 0,10 / 0,34. Impactos: soco leve 0,28, soco forte 0,55, parede 0,39, esmagar 0,46, madeira 0,23, barril 0,25. A primeira versão dos impactos de ruído estava fraca (soco leve 0,13, quase no nível do ambiente) e foi amplificada.
- Testado: sem erros no jogo nem no hot reload, mudo, pausa e retomada.
- **Não testado** (depende de ouvir): se ainda há som "de desenho" em algum golpe; me diga qual (soco leve? quebra de cadeira?) que eu ajusto. Ajustes: `noise(... gain)` do corpo em `api.hit`, `modes([...])` para as ressonâncias.

### Etapa 15: casa grande, escadas, fantasma como corpo rígido e jogador absurdamente forte
Pedido: "mapa maior, com paredes e escadas; inimigo com física mais legal, arremessado a cada golpe, saindo rolando, mais fluida; quebra de objetos mais legal; gritos do inimigo; sensação de que o player é bizarramente mais forte".
- **Mapa 40 x 40** com paredes internas, portas, painéis de gesso quebráveis e duas escadas com mezanino (ver "O cenário"). Todos os objetos foram redistribuídos (77) e as lâmpadas passaram para 6.
- **Fantasma como corpo rígido**: o golpe dá velocidade 3D e **velocidade angular** (`B.w`); a orientação é um quaternion (`B.q`) integrado a cada quadro. No ar faz **cambalhota**; no chão **rola** (a rotação passa a acompanhar a velocidade, como uma roda). O corpo gira em torno do **centro** (compensação do pivô em `bossVis.position`). O chão tem atrito constante + proporcional (desliza e pára de forma natural); no ar a resistência é pequena. **Quica** no chão (restituição vertical 0,25, horizontal 0,72) e nas paredes (0,28; depois do ajuste da Etapa 15b), dando dano por impacto. Bate no teto e leva poeira e dano. Depois de parar fica caído (`lieT`, depende do golpe) e **se levanta suavemente** (`B.tw` interpola o quaternion caído para o em pé). Rastro de poeira no chão e "eco" azul no ar.
- **Atravessa paredes**: arremessado com velocidade de impacto >= 9, **destrói a parede de gesso** e segue com 80% da velocidade; mais devagar, a parede racha (2 de vida) e ele quica. Parede externa, escada e plataforma só fazem ele quicar. Na perseguição o fantasma **atravessa as paredes internas** (é um fantasma, e assim nunca fica preso); no avanço (dash) ele as esmaga.
- **Quebra de objetos melhor**: as próprias peças do objeto (pés da cadeira, tampo da mesa, prateleiras etc.) viram destroços com o mesmo formato e material, voam para fora do centro com a direção do golpe, quicam em chão, degraus e paredes; mais lascas, nuvens de poeira e, em móveis grandes, tábuas arremessáveis. Limite de 320 destroços.
- **Gritos** (`sfx.scream`, `sfx.thud`, `sfx.wallBreak` em `audio.js`): ao ser lançado (golpe >= 30 u/s ou subida forte) ele grita durante o voo, com agudo rasgado que sobe, rugido grave e gorgolejo, com duração ligada ao tempo de voo; gritos curtos de dor a cada batida; pancada grave no chão e estrondo de parede desabando. Máximo de um grito a cada 0,5 s.
- **Jogador bizarramente mais forte**: velocidades de arremesso quase dobraram (soco forte 58 -> 78 u/s, esmagar 34 -> 52, cruzado 30 -> 38, objetos +20%) e o dano subiu (jab 3, forte 10, cruzado 8, uppercut 8, esmagar 9). Soco forte e cruzado **destroem painéis de parede** à frente, e o esmagar derruba as paredes num raio de 3,2 m. Golpes pesados dão **câmera lenta** (0,3x) depois do congelamento, **clarão branco**, onda de choque e nuvem no ponto do impacto, FOV e tranco de câmera maiores. O nocaute final tem câmera lenta de 1,2 s.
- **Andar de cima** (pedido: "a escada deve dar em algum lugar"): o mezanino norte virou um andar de verdade, com a largura do salão, 11 objetos, parapeitos e um vão de pulo; o do sudeste ganhou parapeitos. Testado: sobe a escada (y = 2,58), o parapeito bloqueia (z pára em -15,55) e pelo vão o jogador cai e volta a y = 0.
- **Testado** (Playwright, renderização por software): carrega sem erros; jogador sobe a escada até o mezanino (y = 2,58); para na parede (x = -8,25) e passa pela porta; soco forte no salão manda o fantasma pelo mapa, sobe a escada em arco, quica, rola, fica caído e se levanta (tw 1 -> 0) e volta a perseguir; soco forte contra uma divisória quebra o painel (102 destroços), ele atravessa e quica na parede externa; o console ficou sem erros.
- **Não testado / só dá para julgar jogando**: se a distância dos arremessos está boa ou exagerada (`attacks.*.speed`, `groundDecel`, `bounceWall`), se a câmera lenta incomoda, se os gritos soam bem (e se não cansam), o equilíbrio de dano (a vida do fantasma continua 120), a taxa de quadros em computador fraco e a hora em que o fantasma fica preso entre objetos. Ainda **não conferi o hot reload** com o mapa novo (as paredes quebradas voltam inteiras após uma recarga).
- Limitações conhecidas: nas escadas o fantasma flutua em vez de subir degrau por degrau; os destroços só colidem com paredes por um ponto; o texto de ajuda da tela não mudou.

### Etapa 15b: menos rebote, menos peso
Feedback: "reduz um pouco esse rebote depois de bater na parede, e acho que ficou pesado demais".
- Rebote menor: `bounceWall` 0,55 -> 0,28, `bounceFloor` 0,42 -> 0,25, perda de velocidade horizontal por quique 15% -> 28%, pulinho ao bater na parede de 0,12 para 0,05 da velocidade. O fantasma agora bate, escorrega e cai, em vez de voltar como bola.
- Como "pesado" pode ser o jogo (lento) ou a sensação, aliviei os dois: sombra da lua 4096 -> 2048, destroços 320 -> 160, nuvens 100 -> 60, câmera lenta só em batidas bem fortes. **Não medi o fps** (só tenho renderização por software); se continuar lento diga se é ao quebrar coisas ou o tempo todo.

### Etapa 15c: câmera lenta opcional, arremesso do andar de cima, menos sons empilhados
Feedback: "câmera lenta? deixe com um botão pra ligar e desligar; no segundo andar não dá pra acertar o fantasma com objetos lançados; o som está bugando".
- **Câmera lenta**: caixa no menu de pausa e **tecla T** (aparece um aviso na tela). Também há uma caixa separada para o **congelamento no impacto** (hitstop), que é outro efeito parecido. Ambas ficam salvas nas opções. Assim dá para saber qual dos dois causava a sensação de peso.
- **Arremesso do andar de cima (bug)**: o objeto era solto na altura 1,2 do chão (dentro do piso do andar de cima, quebrando na hora) e o voo forçava a altura 1,1. Agora solta a `player.y + 1,2`, e a altura do voo começa onde o objeto saiu e **desce 9 u/s** em direção ao nível do fantasma. O acerto também confere a altura (±2,6 em torno do centro do fantasma). Testado: soco forte em um barril no andar de cima acertou o fantasma no salão (vida 120 -> 100).
- **Som**: não consigo ouvir daqui, então ataquei as causas prováveis de "bug": gritos e gemidos se empilhavam em cada batida (agora o gemido de dor é ignorado enquanto há um grito em andamento), e vários painéis quebrando no mesmo instante disparavam vários estrondos (agora um a cada 0,25 s, e o som da parede tem intervalo de 0,12 s). **Não testado de ouvido**: se o defeito era estalo, corte, repetição ou silêncio, me diga qual.

### Etapa 15d: lentidão ao destruir o cenário
Feedback: "está lento quando o fantasma destrói o cenário".
- **Causa mais provável** (achei no código; **não consegui medir numa GPU real**, pois o teste roda em renderização por software, onde o quadro já leva ~600 ms com ou sem paredes quebrando): cada nuvem de poeira e cada onda de choque criava um material próprio e dava `dispose()` no fim. No three.js, descartar o último material que usa um programa de shader **destrói o programa**, e a nuvem seguinte obrigava a **recompilar o shader** (dezenas a centenas de ms, com 9 luzes na cena). Cada parede ou móvel quebrado disparava isso.
- Correção: materiais de nuvem e de onda de choque vêm de um **pool reaproveitado** (nunca descartados) e há uma nuvem invisível fixa para manter o shader sempre compilado. As nuvens passaram a `MeshBasicMaterial` (sem iluminação: bem mais barato com 9 luzes, e elas são grandes e translúcidas, então custam preenchimento de tela). Os destroços deixaram de projetar sombra (antes cada pedaço era redesenhado no mapa de sombra a cada quadro); parede quebrada solta 20 pedaços (eram 30) e 6 nuvens (eram 9); limite de destroços 120 e de nuvens 50.
- **Não testado**: o ganho de fps real. Se ainda travar ao destruir, diga se é o primeiro estrago da partida (compilação de shader) ou sempre.

### Etapa 15e: menos travado, casa com cara de casa, bug de atravessar parede
Feedback: "está meio travado no geral, e nem toda parede precisa ser quebrável, queria um estilo mais de casa".
- **Desempenho geral**: luzes pontuais de 7 para **5** (as outras 2 viraram só bulbo aceso; cada luz custa em todos os pixels), só **móveis grandes projetam sombra** (os 60+ objetos pequenos não), resolução limitada a 1,5x (era 2x em telas densas) e uma opção **"Sombras"** no menu de pausa. Medido em renderização por software (só serve de comparação, não de fps real): quadro com sombras 482 ms, sem sombras 298 ms (**-38%**). Se ainda travar, desligar as sombras é o primeiro teste.
- **Casa**: ver "O cenário" (paredes estruturais de cor lisa com batentes de porta; só o gesso fino, mais claro, quebra).
- **Bug achado nos testes**: a 78 u/s o fantasma andava ~4 u por quadro e **atravessava as paredes finas sem colidir** (um soco forte contra a divisória o deixava do outro lado). Agora o movimento é em passos de no máximo 0,4 u, e objetos arremessados também param no primeiro contato com a parede. Testado: soco forte contra a parede estrutural, o fantasma bate e volta para o salão (x = 7), sem painel quebrado.
- **Não testado**: fps real na sua máquina. (O papel de parede listrado e o lambril desta etapa foram removidos na 15f, junto com as outras texturas.)

### Etapa 15f: força no exagero (não no dano) e fim das texturas
Feedback: "o efeito de o personagem ser mais forte deve ser no exagero dos golpes, não no tanto de vida que o inimigo perde; e remova todas as texturas, porque ainda não decidimos isso".
- **Dano de volta ao normal**: jab 2, forte 6, cruzado 5, uppercut 5, esmagar 5 (os valores antes da Etapa 15). O dano dos impactos do arremesso também caiu: parede 3 + 0,02 por u/s (era 4 x 0,6 + 0,12 por u/s), chão 0,3 + 0,02 por u/s, teto 1. A vida do fantasma continua 120. O que **fica** exagerado: velocidade de arremesso (forte 78 u/s), cambalhota e rolagem, quebra de paredes e móveis, câmera lenta (opcional), clarão, onda de choque, gritos. Medido: um soco forte no meio do salão, com todas as batidas até parar, tirou 11 de 120 (109,1 restantes).
- **Texturas removidas**: apaguei as funções `makeFloorTexture`, `makeWallTexture`, `canvasTex` e as texturas do gesso, papel de parede, tapetes, piso da cozinha e rostos dos quadros. Piso, paredes, tapetes (vermelhos), piso da cozinha e quadros são **cores lisas** (`MeshStandardMaterial({ color })`). Para pôr as suas depois, basta usar `map:` nesses materiais (piso, `wallMat`, `plasterMat`, `wallpaperShared`, `floorPatch`, quadros). Os móveis e o fantasma já eram só geometria e cor.
- Testado: o jogo carrega sem erros e a captura mostra tudo em cor lisa.

### Etapa 16: 10x mais vida, cerveja, e objetos com efeito contido
Feedback: "fantasma com 10x mais vida para a luta durar e ser engraçada; garrafas de cerveja que o player bebe para recuperar vida, nascendo pelo mapa; jogar a garrafa no fantasma; o dano e o efeito no fantasma ao ser atingido por algo está muito exagerado".
- **Vida do fantasma**: `bossMaxHp` 120 -> **1200** (barra e fase 2 em 50% continuam proporcionais). Com o dano atual (jab 2, forte 6) a luta fica bem longa; se ficar longa demais, ajustar `bossMaxHp` no `CFG`.
- **Garrafas de cerveja** (`PROP_TYPES.beer`: vidro âmbar, rótulo creme, tampinha dourada): 12 espalhadas no começo (inclusive uma em cada andar de cima) e **nascem novas** do teto a cada 8 s (4 s se a vida estiver abaixo de 40), até 8 no mapa, nunca dentro de parede ou escada. **B** bebe a garrafa à frente (ou a que está na mão) e recupera **25 de vida** (`beerHeal`), com som de tampinha, goles e suspiro; o aviso na tela mostra "B = BEBER". **F** pega a garrafa; o clique arremessa no fantasma (dano 3 x 2 de objeto arremessado da mão), e ela estilhaça com som de vidro. Também dá para socar a garrafa como qualquer objeto pequeno.
- **Objetos acertando o fantasma, efeito contido**: velocidades quase pela metade (barril 46 -> 30, caixa 50 -> 30, cadeira 38 -> 24, bola 60 -> 38, TV 44 -> 28, vaso 24 -> 14), squash e tremor de câmera menores, congelamento no impacto 0,03 a 0,06 s. Como o squash dos objetos ficou abaixo de 0,9, eles **não disparam mais** clarão, luz tremendo nem grito de arremesso (o grito agora é só dos golpes do jogador, marcados com `big` em `CFG.attacks`). Os golpes do jogador continuam exagerados, como pedido.
- Testado: carrega sem erros; 12 garrafas no começo; beber com 50 de vida deixa 75; pegar com F e arremessar acerta o fantasma (1200 -> 1190,9).
- **Não testado**: o som de beber e do vidro de ouvido, o visual da garrafa, quanto tempo a luta dura jogando, e o clique do mouse (no teste chamei a função de arremesso diretamente).

### Etapa 17: mãos mais humanas (teste de modelagem por código)
Pergunta do usuário: dá para o personagem parecer humano e mexer no inimigo, móveis e cenário? Fiz as **mãos** como teste.
- Antes: cada punho era uma esfera. Agora (`makeHand`/`makeFinger` em `main.js`): palma achatada, **4 dedos de 3 falanges** (cápsulas) dobrados em punho, **polegar** dobrado por cima, punho fino de pele, aro e manga larga. Cada falange é filha da articulação anterior (hierarquia de transformações). As animações dos golpes não mudaram (a mão continua sendo o mesmo objeto `fist`).
- Verificado por captura de tela em guarda e em soco (cruzado). **Não testado**: o visual nos outros golpes (forte, uppercut, esmagar, segurando objeto) e se o estilo agrada.
- Próximos passos possíveis: mesma abordagem no fantasma (vestido ondulado, cabelo em mechas curvas) e nos móveis (quinas arredondadas com `RoundedBoxGeometry`, peças torneadas com `LatheGeometry`); ou modelos feitos no Blender, carregados como `.glb`.

### Etapa 18: o fantasma pisca (some e reaparece, quase sempre atrás do jogador)
Pedido: "movimentos tipo desaparecer e aparecer aleatoriamente, com alta chance de ser atrás do player; alguma outra ideia?".
- **Três modos novos** na máquina de estados do boss: `vanish` (0,45 s: pisca, encolhe e solta fumaça escura), `hidden` (0,6 a 1,3 s: invisível e intocável; um **sussurro 3D** toca no ponto onde ele vai surgir, é a dica) e `appear` (0,5 s: brilho branco, cresce e fica **vulnerável**), que termina em `windup` com aviso 25% mais curto e depois no avanço de sempre.
- **Quando**: ao terminar de perseguir, em vez de atacar direto ele pisca com 35% de chance (50% na fase 2), com intervalo mínimo de 7 s (`CFG.blinkChance`, `blinkCooldown`).
- **Onde reaparece** (`pickBlinkDest`): 70% das vezes a 2,8 a 4,4 m **atrás de onde o jogador olha** (`blinkBehind`), senão num ponto qualquer a 4 a 9 m. Rejeita pontos dentro de paredes, escadas ou fora da casa; respeita o andar de cima.
- **Intocável**: enquanto invisível o corpo fica a y = -40, então socos, esmagar e objetos arremessados não o acertam (todos conferem a altura). Sem física e sem luz própria.
- **Segurança de luz**: o piscar de visibilidade é de no máximo ~3 vezes por segundo e some por completo se a opção de luzes piscando estiver desligada (ele só encolhe e aparece de uma vez).
- **Testado** (14 piscadas seguidas): os três modos aparecem na ordem certa; reapareceu atrás do jogador em 10 de 14; distâncias entre 3,1 e 8,4 m; sem erros no console. **Não testado**: o visual do desaparecer/aparecer, o som do sussurro de ouvido, se a dificuldade ficou boa (reaparecer atrás e atacar rápido pode ser injusto) e o caso do jogador no andar de cima.
- Ideias para as próximas etapas: ver a lista na conversa (clones/iluscões, ataque de agarrar, apagar as luzes, teleporte de arremesso, arrastar objetos, ficar de costas, rastejar no teto etc.).

### Etapa 19 — Perseguição mais natural

Pedido: "ele tá bem previsível na movimentação, tem como ter mais naturalidade nisso?".

- Antes: o fantasma ia em linha reta até o jogador com velocidade constante. Agora, durante a perseguição, ele sorteia um **comportamento** (0,5–2 s cada), conforme a distância: *aproximar* (curva balançando de lado a lado, velocidade que oscila), *rodear* (órbita a ~5,5 m, sentido aleatório), *encarar* (quase parado), *avançar de repente* (2,3x) e *recuar*.
- **Inércia**: a velocidade desejada é suavizada (`B.mv`), então ele não muda de direção de uma vez.
- **Giro suave**: o corpo vira para o jogador com amortecimento (`B.yaw`), mais rápido no windup; ao reaparecer do blink já olha para o jogador.
- Se o tempo de perseguição acaba com o jogador a mais de 9 m, ele estende a perseguição com um avanço, para o ataque alcançar.
- **Testado**: sintaxe, 25 s de execução headless sem NaN nem erro de console; os comportamentos *avançar* e *aproximar* apareceram e a transição para windup ocorreu.
- **Não testável aqui**: a amostra foi pequena (renderização por software, ~85 quadros), então não deu para verificar a variedade de *rodear/encarar/recuar* nem se parece natural. Só jogando dá para julgar e ajustar as chances e velocidades em `updateBoss`.

### Etapa 20 — Novas habilidades do fantasma e menos dano

Pedido: teto, possessão de móveis e apagão; "reduza o dano recebido pelo personagem, tá mt apelão esse fantasma".

- **Rastejar no teto** (`ceil` → `drop`): sobe para o teto de cabeça para baixo (fora do alcance de socos e objetos), rasteja até o jogador por ~3 s, para em cima de um ponto marcado por uma **mancha escura no chão** (~0,9 s de aviso) e despenca. Quem estiver na área leva 12 de dano; se errar, ele fica **atordoado ~1,9 s** (janela para bater). Dá para esquivar com Shift ou saindo da mancha.
- **Possessão de móveis** (`possess`): ele fica parado com os braços erguidos; até 3 móveis perto do jogador levitam tremendo, soltando fumaça roxa, e são lançados um a um contra o jogador (6 de dano, 9 se for móvel grande). Os móveis lançados também quebram outros móveis e paredes de gesso. Enquanto isso o fantasma está parado e vulnerável.
- **Apagão**: as luzes apagam por 4–6 s (só o brilho do fantasma ilumina), ele fica 20% mais rápido e o ataque seguinte vem mais curto. Ao acabar, as luzes voltam piscando (se a opção de luz piscando estiver ligada).
- Ao fim da perseguição o fantasma escolhe: piscar (como antes), uma especial (50%, intervalo mínimo de 9 s; 6 s na fase 2) ou o ataque normal. Parâmetros em `CFG` (`specialCooldown`, `specialChance`, `ceil*`, `possess*`, `blackoutDur`).
- **Dano reduzido**: contato 6 → 3, avanço 18 → 9 (as novas já nascem moderadas).
- **Testado**: modos forçados pelo debug: teto→queda→dano→atordoamento, possessão→lançamento→dano, apagão (luz cai a 6%), sem erros de console.
- **Não testável aqui**: se a mancha de aviso é legível, se o apagão está escuro demais para jogar, a frequência das especiais, o equilíbrio do dano e o som (sem áudio no sandbox). Também não vi imagens do escuro (a captura pegou o menu).

### Etapa 21 — Controles de toque (celular) e publicação na Vercel

Pedido: jogar no celular; o jogo vai para a Vercel para um amigo testar.

- O modo toque liga sozinho em aparelhos com tela de toque (`(hover: none) and (pointer: coarse)`); em qualquer navegador dá para forçar com `?touch` na URL.
- **Controles**: joystick flutuante na metade esquerda da tela (vira WASD), arrastar o dedo em qualquer outro ponto para olhar, e botões SOCO, FORTE, UPPER, ESMAGAR, ESQUIVA, PEGAR, BEBER, mais ❚❚ para pausar. Cada dedo é seguido pelo seu `pointerId`, então anda, olha e soca ao mesmo tempo. Os botões dos golpes com recarga ficam esmaecidos. Toque na tela depois de ganhar/perder reinicia.
- Sem Pointer Lock no celular: `locked` passa a significar "jogando". O jogo pausa sozinho se a aba for para segundo plano. O Jogar pede tela cheia e paisagem (onde o navegador permite; no iPhone o Safari ignora a tela cheia). Em retrato aparece um aviso para girar o aparelho.
- No celular as **sombras começam desligadas** e a resolução é limitada (pixel ratio 1,25). Textos de dicas trocam "F/B/clique" por PEGAR/BEBER/SOCO.
- **Publicar**: o projeto é um site estático do Vite. Na Vercel: importar o repositório do GitHub (ela detecta Vite sozinha: build `npm run build`, saída `dist`), ou rodar `npx vercel` na pasta do projeto.
- **Testado**: emulação de celular em paisagem (667x375) com toques reais via CDP: joystick + olhar ao mesmo tempo (andou e girou a câmera), botão SOCO inicia golpe, pausa abre o menu, sem erros de console; captura de tela conferida.
- **Não testável aqui**: desempenho real em celular de verdade, conforto e posição dos botões, áudio no iOS (depende do toque em Jogar para liberar), tela cheia no iPhone, e se o joystick/olhar fica bom nas mãos. Se travar no aparelho do seu amigo, as sombras já estão desligadas; reduzir mais exigiria baixar a resolução.

## Próximas etapas (a decidir)

- Jogar e equilibrar: `bossMaxHp`, `punchDamage`, `heavyDamage`, `wallSlamDamage`, `heavyCooldown`, `propLaunch`, `throwSpeed` no `CFG` (o hot reload ajuda).
- Texturas autorais (piso, parede, rosto do boss, madeira dos móveis). Critério explícito de avaliação.
- Partículas. Sons: já feitos (Etapa 11); falta trocar por amostras gravadas por mim, se quiser mais realismo.
- Mais ideias: poder pegar móveis grandes (com mais dano e mais lento); arremesso carregado (segurar para dar mais força); medidor de medo (do jogo original); parry; boss reagindo ao esmagar (pulo para trás); golpe em corrida (dash punch).
- Ajustar `aimAssistDeg`, `heldThrowMul`, `grabRange` e `throwHeld` no `CFG` depois de jogar.
- Sensibilidade e FOV agora se ajustam no menu de pausa; falta só achar os valores bons jogando.
