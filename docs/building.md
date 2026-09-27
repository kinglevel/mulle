# Building the game

The game data never lives in this repository. It is extracted at build time
from the original CD images, one build per language, into `games/<lang>/`.

## Prerequisites

`scripts/install.sh` checks and installs these for you:

* **Node.js 24+** and npm
* **Python 3** (a virtualenv is created in `vendor/mulle.js/.venv`)
* **ffmpeg with the libvorbis encoder** (audio is encoded as Ogg Vorbis). On
  macOS that is Homebrew's `ffmpeg-full`, because plain `ffmpeg` lacks it; on
  Debian/Ubuntu the regular `ffmpeg` package works.
* git, curl and unzip

```sh
scripts/install.sh            # tools, venv, npm packages and every ISO (~1.3 GB)
scripts/install.sh da sv      # …or only these languages' ISOs
```

It is safe to re-run; every step skips what is already done.

## Building

```sh
scripts/build.sh all          # every language whose ISO is present
scripts/build.sh sv en        # just these
scripts/build.sh              # $GAME_LANG, default da
```

For each language `build.sh`:

1. downloads the ISO if it is missing (`fetch_iso.sh`)
2. applies `patches/mulle.js/*.patch` to the submodule (reverted on exit)
3. extracts the Director casts from the ISO and the Shockwave plugin
4. builds scores, UI images, data, topography and the spritesheets (slow)
5. extracts the narrated intro's score from `10.DXR` (`tools/build_intro.py`)
6. runs webpack and sass, and copies the Phaser runtime
7. stages everything into `games/<lang>/`, swapping it in only once complete so a
   running server never sees a half-built language

Upstream's pipeline only holds one language at a time (it extracts into shared
folders), so languages build one after another. A language that fails to
build doesn't stop the others; the summary at the end lists failures.

A running server picks up newly built languages without a restart.

## Downloading the ISOs

```sh
scripts/fetch_iso.sh          # every language
scripts/fetch_iso.sh de en    # just these
```

Disc locations are listed in [`languages.json`](../languages.json).
archive.org throttles each connection, so files are split into 4 MB ranges
pulled 16 at a time (`PARALLEL=8 scripts/fetch_iso.sh` to change that).
Interrupted downloads resume. Images land in
`vendor/mulle.js/iso/mullebil_<lang>.iso`, where upstream's build expects them.

## The English disc

The only English release on archive.org is Viva Media's 2006 re-release, and
it differs from every other release: it is a UDF-only CD-R (no ISO 9660
volume), zipped as a MODE1/2352 bin/cue, and its movies are
Shockwave-compressed Director 7 files (`.dcr`/`.cct`) instead of Director 6
`.DXR`/`.CXT`. `fetch_iso.sh` remasters it into the usual layout:

* `tools/udf_extract.py` reads the disc, including its virtual allocation
  table (VAT), in pure Python
* `tools/unafterburn.py` unpacks each Afterburner movie into a plain PC
  Director file, smoothing over the Director 7 differences upstream's
  extractors trip on: member info headers, 16-bit Mac sounds, 1-bit bitmaps,
  Xtra members and extra key-table entries
* `tools/remaster_iso.py` writes an ISO 9660 image with a `/MOVIES` folder,
  restoring member names the export stripped from the Swedish disc (the game
  looks sounds up by name)

So the English build needs the Swedish ISO (`reference` in `languages.json`),
and takes its scores and intro from the Swedish build: drxtract can't read a
Director 7 score, and both only refer to members by number, which the English
disc shares with the Swedish one. The original disc image is kept in
`.cache/iso_src/`, so deleting `mullebil_en.iso` and re-running
`scripts/fetch_iso.sh en` remasters it again without a download. Patch `0004`
corrects upstream's English asset rules for this disc.

## The parts catalogue

`server/public/parts-catalogue.json` names and categorises every part a player
can own (used by the cheat panel and MULLE-HELL). The game data has neither:
67 parts were named from their sprites, the rest come from upstream's
`part_names.json`, and categories follow from each part's stats and where it
mounts. Regenerate it after a build with:

```sh
python3 tools/parts_catalogue.py games/sv/data server/public/parts-catalogue.json
```

## Troubleshooting

* **`ffmpeg lacks the libvorbis encoder`**: install an ffmpeg build with
  libvorbis (Homebrew: `brew install ffmpeg-full`).
* **`patch no longer applies (upstream changed?)`**: the submodule moved past
  what a patch expects. Check out the pinned commit with
  `git submodule update`, or update the patch.
* **A language builds but looks wrong**: open `/healthz` to see which
  languages have a bundle and assets, and check the build log for that
  language's `==> [lang]` steps.
* **Disk space**: each language needs ~40 MB in `games/`, plus a few hundred
  MB of intermediates in `vendor/mulle.js` while building.
