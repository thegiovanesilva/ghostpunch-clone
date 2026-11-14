#!/usr/bin/env bash
# Converte e ENXUGA modelos para o jogo. Uso:
#   bash tools/optimize_models.sh entrada.fbx|entrada.glb  public/models/ghost.glb  [tamanho_max_textura=1024]
# - .fbx (Mixamo, Blender) é convertido para .glb com fbx2gltf;
# - gltf-transform: remove dados duplicados/sem uso, reamostra animações, quantiza vértices (menos bytes por vértice),
#   reduz as texturas para no máximo N px e converte para WebP. Não usa Draco/Meshopt para não exigir decodificador no jogo.
# Para modelos com mais de ~40 mil triângulos, acrescente:  --simplify --simplify-ratio 0.5  na linha do optimize.
set -e
IN="$1"; OUT="$2"; TEX="${3:-1024}"
TMP="$(mktemp -d)"
if [[ "${IN,,}" == *.fbx ]]; then
  npx --yes fbx2gltf --binary --input "$IN" --output "$TMP/conv.glb"; IN="$TMP/conv.glb"
fi
npx --yes @gltf-transform/cli@4 optimize "$IN" "$OUT" --compress quantize --texture-compress webp --texture-size "$TEX"
ls -la "$OUT"
