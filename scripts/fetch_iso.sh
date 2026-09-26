#!/bin/bash
# Parallel range download of the Mulle Meck ISO from archive.org storage nodes.
# archive.org throttles each connection to ~45 KB/s, so we split the file into
# N chunks and pull them concurrently, alternating between the two nodes.
set -u
SIZE=108992512
N=12
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${MULLE_JS_DIR:-$ROOT/vendor/mulle.js}"
OUT="$GAME/iso/mullebil_da.iso"
PART_DIR="$ROOT/.cache/iso_parts"
PATH_ON_NODE="/28/items/byg-bil-med-mulle-meck/Byg-bil-med-Mulle-Meck.iso"
HOSTS=(ia601901.us.archive.org ia801901.us.archive.org)

mkdir -p "$PART_DIR" "$(dirname "$OUT")"
CHUNK=$(( (SIZE + N - 1) / N ))

for i in $(seq 0 $((N-1))); do
  START=$(( i * CHUNK ))
  END=$(( START + CHUNK - 1 ))
  [ $END -ge $SIZE ] && END=$((SIZE-1))
  HOST=${HOSTS[$(( i % 2 ))]}
  PART="$PART_DIR/part.$i"
  # resume-aware: skip chunks already complete
  WANT=$(( END - START + 1 ))
  HAVE=0
  [ -f "$PART" ] && HAVE=$(stat -c%s "$PART")
  if [ "$HAVE" -eq "$WANT" ]; then continue; fi
  curl -s --retry 8 --retry-all-errors --retry-delay 2 --speed-time 30 --speed-limit 1000 \
       -r "$START-$END" -o "$PART" "https://$HOST$PATH_ON_NODE" &
done
wait

# verify and concatenate
TOTAL=0
for i in $(seq 0 $((N-1))); do
  PART="$PART_DIR/part.$i"
  [ -f "$PART" ] || { echo "MISSING part $i"; exit 1; }
  TOTAL=$(( TOTAL + $(stat -c%s "$PART") ))
done
if [ "$TOTAL" -ne "$SIZE" ]; then
  echo "SIZE MISMATCH: got $TOTAL want $SIZE (re-run to resume)"; exit 1
fi

cat "$PART_DIR"/part.{0..11} > "$OUT"
echo "OK $(stat -c%s "$OUT") bytes -> $OUT"
