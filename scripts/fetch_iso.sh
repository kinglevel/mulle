#!/bin/bash
# Parallel range download of the game CD images from archive.org.
#
#   scripts/fetch_iso.sh            # every language in languages.json
#   scripts/fetch_iso.sh sv en      # just these
#
# archive.org throttles each connection to ~45 KB/s, so each file is split into
# CHUNK-sized ranges pulled PARALLEL at a time. Finished chunks are kept in
# .cache/iso_parts/<lang>/, so an interrupted run resumes where it stopped.
# Images land in vendor/mulle.js/iso/mullebil_<lang>.iso, where upstream's
# build.py looks for them. A zipped MODE1/2352 bin/cue (the English release)
# is unpacked and converted to a plain 2048-byte-sector ISO, and a UDF-only
# disc (also the English release) is remastered by tools/remaster_iso.py.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${MULLE_JS_DIR:-$ROOT/vendor/mulle.js}"
CACHE="$ROOT/.cache/iso_parts"
SRC="$ROOT/.cache/iso_src"
CHUNK=$((4 * 1024 * 1024))
PARALLEL="${PARALLEL:-16}"

# lang -> "item<TAB>file<TAB>size<TAB>format<TAB>reference"
iso_info() {
  node -e '
    const l = require(process.argv[1]).languages.find(l => l.code === process.argv[2])
    if (!l) process.exit(1)
    console.log([l.iso.item, l.iso.file, l.iso.size, l.iso.format, l.reference || "-"].join("\t"))
  ' "$ROOT/languages.json" "$1"
}

all_langs() {
  node -e 'console.log(require(process.argv[1]).languages.map(l => l.code).join(" "))' "$ROOT/languages.json"
}

# Strip the 16-byte sync/header and 288-byte EDC/ECC from every 2352-byte
# MODE1 sector, leaving the 2048 bytes of user data an ISO consists of.
bin_to_iso() {
  python3 - "$1" "$2" <<'EOF'
import sys
src, dst = sys.argv[1], sys.argv[2]
with open(src, 'rb') as i, open(dst, 'wb') as o:
    while True:
        sector = i.read(2352)
        if len(sector) < 2352:
            break
        o.write(sector[16:16 + 2048])
EOF
}

# Download one language's disc image to $2 (a plain 2048-byte-sector image).
download() {
  local lang=$1 dest=$2 item=$3 file=$4 size=$5 format=$6 parts url n i start end want have
  parts="$CACHE/$lang"
  mkdir -p "$parts"

  # Resolve the storage node once; ranges against archive.org/download each
  # cost an extra redirect.
  url="https://archive.org/download/$item/$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$file")"
  url=$(curl -sI "$url" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)
  [ -n "$url" ] || { echo "[$lang] could not resolve $item/$file"; return 1; }

  n=$(( (size + CHUNK - 1) / CHUNK ))
  echo "[$lang] $file: $size bytes in $n chunks"
  for (( i=0; i<n; i++ )); do
    start=$(( i * CHUNK )); end=$(( start + CHUNK - 1 ))
    [ $end -ge "$size" ] && end=$(( size - 1 ))
    want=$(( end - start + 1 ))
    have=0
    [ -f "$parts/$i" ] && have=$(wc -c < "$parts/$i" | tr -d ' ')
    [ "$have" -eq "$want" ] || printf '%s %s %s\n' "$i" "$start" "$end"
  done | xargs -P "$PARALLEL" -n 3 sh -c '
    # $0 = chunk dir, $1 = url; xargs appends $2 = index, $3 = start, $4 = end
    curl -s --retry 8 --retry-all-errors --retry-delay 2 --speed-time 30 --speed-limit 1000 \
         -r "$3-$4" -o "$0/$2" "$1"' "$parts" "$url"

  local total=0
  for (( i=0; i<n; i++ )); do
    [ -f "$parts/$i" ] || { echo "[$lang] missing chunk $i (re-run to resume)"; return 1; }
    total=$(( total + $(wc -c < "$parts/$i" | tr -d ' ') ))
  done
  if [ "$total" -ne "$size" ]; then
    echo "[$lang] size mismatch: got $total want $size (re-run to resume)"; return 1
  fi

  local joined="$parts/joined"
  for (( i=0; i<n; i++ )); do cat "$parts/$i"; done > "$joined"

  if [ "$format" = zip ]; then
    local tmp="$parts/unzip" bin
    rm -rf "$tmp"; mkdir -p "$tmp"
    unzip -q "$joined" -d "$tmp" || { echo "[$lang] unzip failed"; return 1; }
    bin=$(find "$tmp" -iname '*.bin' | head -1)
    if [ -n "$bin" ]; then
      bin_to_iso "$bin" "$dest.tmp"
    else
      mv "$(find "$tmp" -iname '*.iso' | head -1)" "$dest.tmp"
    fi
  else
    mv "$joined" "$dest.tmp"
  fi
  mv "$dest.tmp" "$dest"
  rm -rf "$parts"
}

fetch() {
  local lang=$1 info item file size format reference out src
  info=$(iso_info "$lang") || { echo "[$lang] not in languages.json"; return 1; }
  IFS=$'\t' read -r item file size format reference <<<"$info"
  out="$GAME/iso/mullebil_$lang.iso"
  if [ -f "$out" ]; then echo "[$lang] present: $out"; return 0; fi
  mkdir -p "$GAME/iso" "$SRC"

  # A disc that needs remastering keeps its original in .cache/iso_src, so a
  # later remaster (delete the ISO, re-run) doesn't download it again.
  src="$SRC/mullebil_$lang.iso"
  if [ ! -f "$src" ]; then
    download "$lang" "$out.download" "$item" "$file" "$size" "$format" || return 1
    if [ "$(dd if="$out.download" bs=1 skip=32769 count=5 2>/dev/null)" = CD001 ]; then
      mv "$out.download" "$out"
      echo "[$lang] OK $(wc -c < "$out" | tr -d ' ') bytes -> $out"
      return 0
    fi
    mv "$out.download" "$src"
  fi

  # The English re-release is a UDF-only CD-R with Shockwave-compressed
  # movies; remaster it as the ISO 9660 + /MOVIES/*.DXR layout build.py reads.
  local py="$GAME/.venv/bin/python"
  [ -x "$py" ] || { echo "[$lang] remastering needs the mulle.js venv: run scripts/install.sh"; return 1; }
  local ref_args=()
  if [ "$reference" != - ]; then
    # Names the Shockwave export stripped come back from the reference release.
    fetch "$reference" || { echo "[$lang] needs the $reference ISO as a reference"; return 1; }
    ref_args=(--reference "$GAME/iso/mullebil_$reference.iso")
  fi
  echo "[$lang] UDF disc: remastering as ISO 9660"
  "$py" "$ROOT/tools/remaster_iso.py" ${ref_args[@]+"${ref_args[@]}"} "$src" "$out.tmp" \
    || { echo "[$lang] remaster failed"; return 1; }
  mv "$out.tmp" "$out"
  echo "[$lang] OK $(wc -c < "$out" | tr -d ' ') bytes -> $out"
}

LANGS=("$@")
[ ${#LANGS[@]} -gt 0 ] || read -r -a LANGS <<<"$(all_langs)"

status=0
for lang in "${LANGS[@]}"; do fetch "$lang" || status=1; done
exit $status
