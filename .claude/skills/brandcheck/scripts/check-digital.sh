#!/usr/bin/env bash
# check-digital.sh — Verificación de dominios (RDAP, autoritativo) y redes sociales
# Uso: check-digital.sh <nombre> [--quick]
#   <nombre>  Nombre de marca (se normaliza a minúsculas, sin espacios ni acentos)
#   --quick   Solo dominios .com y .co (para evaluar alternativas en lote)
#
# Interpretación:
#   RDAP 200 -> REGISTRADO (ocupado)   RDAP 404 -> DISPONIBLE   otro -> NO CONFIRMABLE
#   YouTube 404 -> handle disponible; 200 -> ocupado (fiable)
#   TikTok/GitHub/Instagram/etc. NO son fiables desde este entorno: no se prueban aquí.

set -u
NAME_RAW="${1:?Uso: check-digital.sh <nombre> [--quick]}"
QUICK="${2:-}"

# Normalizar: minúsculas, sin espacios, transliterar acentos y ñ.
# Sustituciones s/// con literales individuales: seguras con UTF-8 en cualquier locale
# (las clases [...] de sed y el comando y/// operan por bytes y corrompen multibyte).
NAME=$(echo "$NAME_RAW" | sed '
  s/á/a/g; s/à/a/g; s/ä/a/g; s/â/a/g; s/Á/a/g; s/À/a/g; s/Ä/a/g; s/Â/a/g
  s/é/e/g; s/è/e/g; s/ë/e/g; s/ê/e/g; s/É/e/g; s/È/e/g; s/Ë/e/g; s/Ê/e/g
  s/í/i/g; s/ì/i/g; s/ï/i/g; s/î/i/g; s/Í/i/g; s/Ì/i/g; s/Ï/i/g; s/Î/i/g
  s/ó/o/g; s/ò/o/g; s/ö/o/g; s/ô/o/g; s/Ó/o/g; s/Ò/o/g; s/Ö/o/g; s/Ô/o/g
  s/ú/u/g; s/ù/u/g; s/ü/u/g; s/û/u/g; s/Ú/u/g; s/Ù/u/g; s/Ü/u/g; s/Û/u/g
  s/ñ/n/g; s/Ñ/n/g' \
  | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]//g')
[ -z "$NAME" ] && { echo "ERROR: nombre vacío tras normalizar '$NAME_RAW'"; exit 1; }
echo "== Verificación digital para: $NAME_RAW (normalizado: $NAME) =="
echo "-- Dominios (RDAP via rdap.org; 200=REGISTRADO, 404=DISPONIBLE) --"

if [ "$QUICK" = "--quick" ]; then TLDS="com co"; else TLDS="com co ai io app dev"; fi

for tld in $TLDS; do
  d="$NAME.$tld"
  body=$(mktemp)
  st=$(curl -sL -o "$body" -w "%{http_code}" --max-time 15 "https://rdap.org/domain/$d" 2>/dev/null)
  if [ "$st" != "200" ] && [ "$st" != "404" ]; then
    sleep 2
    st=$(curl -sL -o "$body" -w "%{http_code}" --max-time 20 "https://rdap.org/domain/$d" 2>/dev/null)
  fi
  case "$st" in
    200)
      exp=$(grep -o '"eventAction":"expiration","eventDate":"[^"]*"' "$body" | head -1 | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}')
      echo "$d: REGISTRADO${exp:+ (expira $exp)}" ;;
    404) echo "$d: DISPONIBLE" ;;
    *)   echo "$d: NO CONFIRMABLE (HTTP $st)" ;;
  esac
  rm -f "$body"
done

if [ "$QUICK" != "--quick" ]; then
  echo "-- Redes sociales (solo métodos fiables) --"
  st=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 -A "Mozilla/5.0" "https://www.youtube.com/@$NAME" 2>/dev/null)
  case "$st" in
    404) echo "youtube.com/@$NAME: DISPONIBLE" ;;
    200) echo "youtube.com/@$NAME: OCUPADO" ;;
    *)   echo "youtube.com/@$NAME: NO CONFIRMABLE (HTTP $st)" ;;
  esac
  echo "Instagram/Facebook/LinkedIn/X/TikTok/GitHub: NO CONFIRMABLES desde este entorno -> verificar manualmente"
fi
