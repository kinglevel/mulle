# Mulle Meck — self-hosted, mobile-friendly, every language

A Node.js server that hosts [mulle.js](https://github.com/datagutten/mulle.js), the
browser reimplementation of *Bygg bilar med Mulle Meck* (Levande Böcker, 1997),
with a mobile-first shell so it plays properly on a phone — in every language the
game was released in. Players pick their language on the start screen.

| Code | Language   | Title                                | CD image on archive.org |
|------|------------|--------------------------------------|-------------------------|
| `sv` | Svenska    | Bygg bilar med Mulle Meck            | [byggbilarmedmullemeck](https://archive.org/details/byggbilarmedmullemeck) |
| `da` | Dansk      | Byg bil med Mulle Meck               | [byg-bil-med-mulle-meck](https://archive.org/details/byg-bil-med-mulle-meck) |
| `no` | Norsk      | Bygg biler med Mulle Mekk            | [bygg-biler-med-mulle-mekk](https://archive.org/details/bygg-biler-med-mulle-mekk) |
| `fi` | Suomi      | Rakenna autoja Masa Mainion kanssa   | [RakennaAutojaMasaMainionKanssa](https://archive.org/details/RakennaAutojaMasaMainionKanssa) |
| `nl` | Nederlands | Miel Monteur bouwt auto's            | [1.mielmonteurbouwtautosiso](https://archive.org/details/1.mielmonteurbouwtautosiso) |
| `de` | Deutsch    | Autos bauen mit Willy Werkel         | [autos-bauen](https://archive.org/details/autos-bauen) |
| `en` | English    | Gary Gadget: Building Cars           | [gary-gadget-building-cars](https://archive.org/details/gary-gadget-building-cars) |

`languages.json` is the single list of these: ISO locations for the scripts, and
titles and start-screen text for the server.

The game engine is mulle.js (GPL-3.0). The artwork, audio and game data are **not**
included here — they are extracted at build time from your own copy of the original
CD-ROM ISO. mulle.js requires that you own the original release.

## Layout

```
mulle/
├── languages.json          every release: code, name, title, ISO, start-screen text
├── server/                 this project — the Node.js host
│   ├── server.js           Express server
│   ├── shell.html          mobile shell template, rendered per language
│   └── public/             shared shell files: menu.js (start screen),
│                           editions.js, toolbar.js, mobile.js (boot, scaling,
│                           audio), mobile.css, manifest
├── scripts/
│   ├── install.sh          one-time prerequisites (tools, venv, npm, ISOs)
│   ├── build.sh            builds languages in vendor/mulle.js, stages into games/
│   └── fetch_iso.sh        parallel downloader for the archive.org ISOs
├── tools/                  Director 6 readers (score, labels, Lingo bytecode,
│                           chunk dump) and build_intro.py, which extracts the
│                           narrated intro from 10.DXR into dist/data/intro.json;
│                           udf_extract.py, unafterburn.py and remaster_iso.py,
│                           which turn the English disc into the usual layout
├── patches/mulle.js/       local fixes to upstream, applied by build.sh during
│                           the build and reverted after (submodule stays clean)
├── vendor/
│   └── mulle.js/           upstream mulle.js (git submodule, engine + build scripts)
│       ├── iso/            mullebil_<lang>.iso — the game CD image   (not committed)
│       ├── dist/           webpack build output                      (not committed)
│       └── assets_<lang>/  spritesheets extracted from the ISO       (not committed)
├── games/<lang>/           one servable build per language           (not committed)
└── .cache/                 download scratch space                    (not committed)
```

Nothing derived from the CD-ROM is ever committed: `*.iso`, `.cache/`, `games/`
and the build output are all git-ignored.

## Getting started

```sh
git clone --recurse-submodules git@github.com:kinglevel/mulle.git
cd mulle
# or, in an existing clone:
git submodule update --init
```

## Install (required once, before building/running)

```sh
scripts/install.sh
```

Installs/checks system tools (node, python3, and an ffmpeg with libvorbis — on
macOS that's Homebrew's `ffmpeg-full`, since plain `ffmpeg` lacks it), inits the
mulle.js submodule, creates the Python venv with the build dependencies, runs
`npm install` for both the engine and the server, and downloads every
language's ISO (about 1.3 GB; pass codes, e.g. `scripts/install.sh da sv`, for
fewer). Safe to re-run. Then build (below) and run.

## Running

```sh
cd server
npm install
npm start
```

Then open `http://localhost:8090/`. The server prints your LAN address and a QR
code — scan it with a phone on the same Wi-Fi.

Each built language is served at `/<code>/` (`/sv/`, `/en/`, …). `/` redirects
to the language the player last picked, else the best match for the browser's
language among the built ones, else `GAME_LANG`. The start screen lists every
built language; a language built while the server runs appears without a
restart. Save games are shared between languages.

Environment variables:

| Variable    | Default   | Meaning                                  |
|-------------|-----------|------------------------------------------|
| `PORT`      | `8090`    | listen port                              |
| `HOST`      | `0.0.0.0` | bind address                             |
| `GAME_LANG` | `da`      | fallback language for `/`                |
| `GAMES_DIR` | `games`   | where the per-language builds live       |
| `MULLE_JS_DIR` | `vendor/mulle.js` | path to the mulle.js checkout (also used by `scripts/`) |

`GET /languages` lists every language and whether it is built; `GET /healthz`
reports the build per language.

## Start screen, editions and the toolbar

The start screen has two steps: pick an **edition**, then the **language**
and **options**, then Play. Choices are remembered in `localStorage`.

* **Editions** live in `server/public/editions.js`. Each one is an entry with
  a `setup(game, settings)` hook that runs before the game boots, where it
  can change rules, patch scenes or register toolbar tools. Its name and
  description come from `languages.json` (`ui`). Every edition but *Vanilla*
  keeps its own save games (`saves`: stored under `mulle_SaveData:<saves>`),
  so progress under different rules never mixes.
* **MULLE-HELL** (`server/public/editions/hardcore.js`), the extreme hardcore
  edition: 17 curses patched onto upstream at runtime, none of them touching
  the submodule. Voices go squeaky as fuel runs low (helium tank) or play at
  random speeds (chewed-up tape); Buffa buries yard parts in the junk yard;
  the junk piles get "tidied"; parts leap onto the chassis from far away
  (super-magnet), float to the ceiling (balloon garage) and hop about; small
  tanks and heavy cars guzzle fuel; hills and rocks need a tougher car; the
  dog, mud car and fallen tree move every tile; steering reverses now and
  then; some tiles are dark unless you have lamps; bumpy roads shake parts
  off, and running dry costs a part to the tow truck; the car show judge
  loves boring cars; people come in the wrong sizes; walls shake the world.
  The toolbar's Curses panel switches each one on or off, and events are
  announced as toasts. The file's header explains how the (webpack-hidden)
  game classes are reached; every hook falls back to upstream's behaviour if
  a curse fails.
* **Options**: *Enable cheats* turns on upstream's cheat buttons (spawn any
  part in the garage, jump to any scene from the yard, any map square on the
  road), shown in the toolbar's Cheats panel. Upstream enables them by
  default; here they are off unless chosen.
* **Cheat parts** are grouped: the garage's flat list of ~160 part buttons is
  sorted into categories (engines, wheels, bodywork, …), given names and made
  searchable by `server/public/cheats.js`, from `parts-catalogue.json`. That
  catalogue is generated by `tools/parts_catalogue.py games/sv/data
  server/public/parts-catalogue.json`. The game data has no part names or
  categories: 67 parts were named by their sprites, the rest come from
  upstream's `part_names.json`, and each part's category follows from its
  stats (merged over its size/colour variants) and where it mounts.
* **Toolbar** (`server/public/toolbar.js`) sits above the game once it
  starts. Tools register with `MulleToolbar.register({ id, label, icon,
  order, available(ctx), onClick(ctx) | panel(el, ctx), onClose })`; a panel
  tool opens a drop-down under the bar. Built in: Cheats, Fullscreen, Menu.

Don't use the URL hash for shell state: upstream starts the scene the hash
names (and writes the current scene there, so a reload resumes it).

## Rebuilding the game from the ISO

```sh
scripts/fetch_iso.sh              # every ISO (or: scripts/fetch_iso.sh de en)
scripts/build.sh all              # every language whose ISO is present
scripts/build.sh sv en            # just these
scripts/build.sh                  # $GAME_LANG, default da
```

For each language, `build.sh` downloads the ISO if missing, extracts the
Director casts, builds scores, spritesheets and topography, runs webpack and
sass, and stages the result into `games/<lang>/`. Upstream's pipeline only
holds one language at a time, so languages build one after another, and a
failing language doesn't stop the others.

`fetch_iso.sh` splits each file into 4 MB ranges pulled 16 at a time
(archive.org throttles single connections), resumes an interrupted download,
and converts the English release's zipped MODE1/2352 bin/cue to a plain ISO.
Upstream's own build script only knows how to download `sv`, `no`, `da`, `fi`
and `nl`.

### English

The only English release on archive.org is Viva Media's 2006 re-release. It is
a UDF-only CD-R whose movies are Shockwave-compressed Director 7 files
(`.dcr`/`.cct`), where every other release is a plain ISO 9660 disc of
Director 6 `.DXR`/`.CXT` files. `fetch_iso.sh` remasters it into the usual
layout:

* `tools/udf_extract.py` reads the disc, including its virtual allocation table
* `tools/unafterburn.py` unpacks each movie into a plain PC Director file,
  smoothing over the Director 7 differences that upstream's extractors trip
  on (member info headers, 16-bit Mac sounds, 1-bit bitmaps, Xtra members),
  and restores member names from the Swedish disc (`reference` in
  `languages.json`), since the game looks sounds up by name
* `tools/remaster_iso.py` writes the result as an ISO 9660 image with `/MOVIES`

So the English build needs the Swedish ISO, and its scores and intro come from
the Swedish build (drxtract can't read a Director 7 score; they only refer to
members by number, and the English numbering follows the Swedish one).
`build.sh en` builds `sv` first if needed. The original disc image is kept in
`.cache/iso_src/`, so deleting `mullebil_en.iso` and re-running `fetch_iso.sh en`
remasters without downloading again. Patch `0004` corrects upstream's English
asset rules for this disc.

## Mobile notes

* The upstream page pins the canvas to a literal 640×480 box. `server/public/`
  replaces the HTML shell so the wrapper fills the viewport and Phaser's
  `SHOW_ALL` scale mode letterboxes the 4:3 canvas into it.
* The game starts from a **Play** button (*Spil*, *Spela*, …) rather than on page load. Mobile
  browsers only unlock audio, fullscreen and orientation lock from inside a real
  user gesture, so the tap has to come first.
* Multiplayer is **off** by default. Upstream defaults it on, and the boot state
  then blocks startup on a websocket to `mulle.datagutten.net:8765`, showing a
  blocking alert if it fails. Add `?mp=1` to the URL to re-enable it.
* On iOS there is no fullscreen API for the canvas; use Safari's *Add to Home
  Screen* instead — the web manifest requests fullscreen landscape.
* The narrated intro (Mulle bikes home, digs out a battery, fits it) plays
  after logging in on the name screen, as in the original. mulle.js never
  ported it: `tools/build_intro.py` rebuilds its score from `10.DXR` and
  `src/scenes/intro.js` (added by a patch) plays it. Click or press a key to
  skip.
* Subtitles follow the language. mulle.js only has subtitle text in English
  and Swedish and showed English over every language's voices; now `en` and
  `sv` get their own, the rest none.
* Useful query flags: `?mp=1` (multiplayer), `?debug=1` (upstream debug mode).

## Credits

* Game: ELD Interaktiv Produktion / Levande Böcker, 1997–98
* Browser engine: [datagutten/mulle.js](https://github.com/datagutten/mulle.js), GPL-3.0
* ISO source: [archive.org/details/byg-bil-med-mulle-meck](https://archive.org/details/byg-bil-med-mulle-meck)
