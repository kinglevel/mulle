#!/bin/bash
# Build the mulle.js game from the original CD-ROM ISOs, one per language.
#
#   scripts/build.sh              # $GAME_LANG, default da
#   scripts/build.sh sv en de     # these languages
#   scripts/build.sh all          # every language whose ISO is in vendor/mulle.js/iso
#
# Each language is built in the mulle.js checkout (upstream's pipeline only
# knows one language at a time: dist/, cst_out_new/ and build_data/Movies are
# shared) and then staged into games/<lang>/, a self-contained web root the
# server mounts at /<lang>/.
#
# Mirrors the upstream Dockerfile's pipeline, but runs locally against the
# repo checkout and skips the expensive custom Phaser grunt build (the
# prebuilt phaser.min.js from node_modules is equivalent for our purposes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${MULLE_JS_DIR:-$ROOT/vendor/mulle.js}"
GAMES="$ROOT/games"
PY="$GAME/.venv/bin/python"

if [ ! -f "$GAME/package.json" ]; then
  echo "mulle.js not found at $GAME. Run: git submodule update --init"
  exit 1
fi

KNOWN=$(node -e 'console.log(require(process.argv[1]).languages.map(l => l.code).join(" "))' "$ROOT/languages.json")
LANGS=("$@")
[ ${#LANGS[@]} -gt 0 ] || LANGS=("${GAME_LANG:-da}")
if [ "${LANGS[0]}" = all ]; then
  LANGS=()
  for l in $KNOWN; do [ -f "$GAME/iso/mullebil_$l.iso" ] && LANGS+=("$l"); done
  [ ${#LANGS[@]} -gt 0 ] || { echo "No ISOs in $GAME/iso. Run scripts/fetch_iso.sh"; exit 1; }
fi
for l in "${LANGS[@]}"; do
  [[ " $KNOWN " == *" $l "* ]] || { echo "Unknown language '$l' (known: $KNOWN)"; exit 1; }
done

# Homebrew's ffmpeg-full is keg-only; it's the one with libvorbis (see install.sh).
if command -v brew >/dev/null 2>&1 && [ -d "$(brew --prefix)/opt/ffmpeg-full/bin" ]; then
  export PATH="$(brew --prefix)/opt/ffmpeg-full/bin:$PATH"
fi

cd "$GAME"
export PYTHONPATH="$GAME"

step() { echo ""; echo "==> $*"; }

if [ ! -x "$PY" ]; then
  echo "Python venv missing. Run scripts/install.sh, or create it with:"
  echo "  python3 -m venv $GAME/.venv"
  echo "  $GAME/.venv/bin/pip install pillow 'pytexturepacker>=1.2.1,<2' 'pydub>=0.25.1,<0.26' \\"
  echo "      'audioop-lts>=0.2.1,<0.3' 'pycdlib>=1.10.0,<2' 'gitpython>=3.1.44,<4' \\"
  echo "      'requests>=2.32.4,<3' 'pyyaml>=6.0.3,<7' 'lxml>=6.1.1,<7' \\"
  echo "      'git+https://github.com/datagutten/ShockwaveParser.git'"
  exit 1
fi

[ -d node_modules ] || { step "npm install"; npm install; }

# Local fixes to upstream, kept as patches so the submodule stays pristine:
# applied for the duration of the build, reverted on exit.
PATCHES=("$ROOT"/patches/mulle.js/*.patch)
APPLIED=()
revert_patches() {
  local i
  for (( i=${#APPLIED[@]}-1; i>=0; i-- )); do
    git apply --reverse "${APPLIED[$i]}" || echo "warning: could not revert ${APPLIED[$i]}"
  done
}
trap revert_patches EXIT
for p in "${PATCHES[@]}"; do
  [ -f "$p" ] || continue
  if git apply --check "$p" 2>/dev/null; then
    step "Applying $(basename "$p")"
    git apply "$p"
    APPLIED+=("$p")
  elif git apply --reverse --check "$p" 2>/dev/null; then
    echo "already applied: $(basename "$p")"
  else
    echo "patch no longer applies (upstream changed?): $p"; exit 1
  fi
done

# The language whose build supplies this one's scores and intro, or empty.
reference_of() {
  node -e '
    const l = require(process.argv[1]).languages.find(l => l.code === process.argv[2])
    console.log((l && l.reference) || "")
  ' "$ROOT/languages.json" "$1"
}

build_lang() {
  local lang=$1 ref
  ref=$(reference_of "$lang")
  if [ -n "$ref" ] && [ ! -f "$GAMES/$ref/bundle.js" ]; then
    echo "[$lang] needs games/$ref first (its scores and intro); building $ref"
    [ -f "iso/mullebil_$ref.iso" ] || "$ROOT/scripts/fetch_iso.sh" "$ref"
    build_lang "$ref"
  fi

  step "[$lang] Cleaning the previous language's intermediates"
  # Each ISO is extracted over the same folders; leftovers from another
  # language would silently leak its movies into this build.
  rm -rf build_data/Movies cst_out_new dist "assets_$lang"

  step "[$lang] Extracting ISO + Director plugin"
  "$PY" build_scripts/build.py "$lang" download

  # These three are order-sensitive, and the upstream Dockerfile hides it by
  # pre-creating directories. html_css must come first because it creates dist/;
  # scores writes to dist/score and copy_images() writes to dist/info/img, and
  # neither creates its parent.
  step "[$lang] Copying HTML"
  mkdir -p dist/info/img dist/score
  "$PY" build_scripts/build.py "$lang" html_css

  # The English re-release's movies are Director 7, whose score drxtract
  # can't read. Scores and the intro only name members by number, and its
  # numbering follows the reference release's, so take them from that build.
  if [ -n "$ref" ]; then
    step "[$lang] Scores from games/$ref"
    cp -R "$GAMES/$ref/score/." dist/score/
  else
    step "[$lang] Building scores"
    "$PY" build_scripts/build.py "$lang" scores
  fi

  step "[$lang] Copying data and UI images"
  "$PY" build_scripts/build.py "$lang" data

  step "[$lang] Building topography"
  "$PY" build_scripts/build.py "$lang" topography

  step "[$lang] Building spritesheets (slow)"
  "$PY" build_scripts/build.py "$lang" assets

  if [ -n "$ref" ]; then
    step "[$lang] Narrated intro score from games/$ref"
    cp "$GAMES/$ref/data/intro.json" dist/data/intro.json
  else
    step "[$lang] Extracting the narrated intro score (10.DXR)"
    "$PY" "$ROOT/tools/build_intro.py" build_data/Movies/10.DXR \
      cst_out_new/10.DXR/metadata.json dist/data/intro.json
  fi

  step "[$lang] Webpack bundle"
  npx webpack-cli -c webpack.prod.js

  step "[$lang] Sass stylesheet"
  npx sass src/style.scss dist/style.css --no-source-map

  step "[$lang] Phaser runtime"
  cp node_modules/phaser-ce/build/phaser.min.js dist/phaser.min.js

  step "[$lang] Staging into games/$lang"
  # Built into a sibling and swapped in, so a running server never sees a
  # half-copied language. The ISO's spritesheets merge into dist/assets
  # (which already holds the topography), as the upstream Docker image does.
  rm -rf "$GAMES/.$lang.new"
  mkdir -p "$GAMES/.$lang.new"
  cp -R dist/. "$GAMES/.$lang.new/"
  mkdir -p "$GAMES/.$lang.new/assets"
  cp -R "assets_$lang/." "$GAMES/.$lang.new/assets/"
  rm -rf "$GAMES/$lang"
  mv "$GAMES/.$lang.new" "$GAMES/$lang"
}

FAILED=()
for lang in "${LANGS[@]}"; do
  # Faster than upstream's single-connection download, and knows every language.
  [ -f "iso/mullebil_$lang.iso" ] || "$ROOT/scripts/fetch_iso.sh" "$lang"
  # A subshell so one language failing doesn't stop the rest under `all`. Not
  # `if ( ... )`: errexit is ignored anywhere inside an if condition.
  set +e
  ( set -e; build_lang "$lang" )
  rc=$?
  set -e
  if [ $rc -eq 0 ]; then
    echo "[$lang] built -> games/$lang"
  else
    echo "[$lang] BUILD FAILED"
    FAILED+=("$lang")
  fi
done

echo ""
[ ${#FAILED[@]} -eq 0 ] || { echo "Failed: ${FAILED[*]}"; exit 1; }
echo "Build complete (${LANGS[*]}). Start the server with: cd $ROOT/server && npm start"
