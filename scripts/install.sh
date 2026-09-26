#!/bin/bash
# One-time setup: everything that has to exist before scripts/build.sh and
# `npm start` will work. Safe to re-run; each step skips if already done.
#
#   scripts/install.sh            # then: scripts/build.sh && (cd server && npm start)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${MULLE_JS_DIR:-$ROOT/vendor/mulle.js}"
GAME_LANG="${GAME_LANG:-da}"
VENV="$GAME/.venv"

step() { echo ""; echo "==> $*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# Install a system package with whatever package manager is available.
sys_install() {
  if have brew; then
    brew install "$@"
  elif have apt-get; then
    sudo apt-get update && sudo apt-get install -y "$@"
  else
    echo "Please install manually: $*"; exit 1
  fi
}

step "System tools"
have git     || { echo "git is required"; exit 1; }
have node    || sys_install node
have npm     || { echo "npm is required (comes with node)"; exit 1; }
have python3 || sys_install python3
# pydub shells out to ffmpeg to encode the audio sprites as Ogg Vorbis. Homebrew's
# plain `ffmpeg` formula ships without libvorbis, so use the keg-only ffmpeg-full
# there (build.sh puts it on PATH).
if have brew; then
  brew list ffmpeg-full >/dev/null 2>&1 || brew install ffmpeg-full
  export PATH="$(brew --prefix ffmpeg-full)/bin:$PATH"
else
  have ffmpeg || sys_install ffmpeg
fi
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libvorbis \
  || { echo "ffmpeg lacks the libvorbis encoder; install an ffmpeg build with it"; exit 1; }
echo "git $(git --version | cut -d' ' -f3), node $(node --version), $(python3 --version), ffmpeg+libvorbis ok"

step "mulle.js submodule"
cd "$ROOT"
[ -f "$GAME/package.json" ] || git submodule update --init

step "Python venv ($VENV)"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q \
  pillow 'pytexturepacker>=1.2.1,<2' 'pydub>=0.25.1,<0.26' \
  'audioop-lts>=0.2.1,<0.3' 'pycdlib>=1.10.0,<2' 'gitpython>=3.1.44,<4' \
  'requests>=2.32.4,<3' 'pyyaml>=6.0.3,<7' 'lxml>=6.1.1,<7' \
  'git+https://github.com/datagutten/ShockwaveParser.git'

step "npm packages"
(cd "$GAME" && npm install)
(cd "$ROOT/server" && npm install)

step "Game ISO ($GAME_LANG)"
if [ -f "$GAME/iso/mullebil_$GAME_LANG.iso" ]; then
  echo "present: $GAME/iso/mullebil_$GAME_LANG.iso"
elif [ "$GAME_LANG" = da ]; then
  "$ROOT/scripts/fetch_iso.sh"
else
  echo "not present; scripts/build.sh will download it"
fi

echo ""
echo "Install complete. Next: scripts/build.sh && (cd server && npm start)"
