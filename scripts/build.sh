#!/bin/bash
# Build the mulle.js game from the original CD-ROM ISO.
#
# Mirrors the upstream Dockerfile's pipeline, but runs locally against the
# repo checkout and skips the expensive custom Phaser grunt build (the
# prebuilt phaser.min.js from node_modules is equivalent for our purposes).
set -euo pipefail

GAME_LANG="${GAME_LANG:-da}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${MULLE_JS_DIR:-$ROOT/vendor/mulle.js}"
PY="$GAME/.venv/bin/python"

if [ ! -f "$GAME/package.json" ]; then
  echo "mulle.js not found at $GAME. Run: git submodule update --init"
  exit 1
fi

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

step "Extracting ISO + Director plugin ($GAME_LANG)"
"$PY" build_scripts/build.py "$GAME_LANG" download

# These three are order-sensitive, and the upstream Dockerfile hides it by
# pre-creating directories. html_css must come first because it creates dist/;
# scores writes to dist/score and copy_images() writes to dist/info/img, and
# neither creates its parent.
step "Copying HTML"
mkdir -p dist/info/img dist/score
"$PY" build_scripts/build.py "$GAME_LANG" html_css

step "Building scores"
"$PY" build_scripts/build.py "$GAME_LANG" scores

step "Copying data and UI images"
"$PY" build_scripts/build.py "$GAME_LANG" data

step "Building topography"
"$PY" build_scripts/build.py "$GAME_LANG" topography

step "Building spritesheets (slow)"
"$PY" build_scripts/build.py "$GAME_LANG" assets

step "Webpack bundle"
npx webpack-cli -c webpack.prod.js

step "Sass stylesheet"
npx sass src/style.scss dist/style.css --no-source-map

step "Phaser runtime"
cp node_modules/phaser-ce/build/phaser.min.js dist/phaser.min.js

echo ""
echo "Build complete. Start the server with: cd $ROOT/server && npm start"
