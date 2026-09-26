# Byg bil med Mulle Meck — self-hosted, mobile-friendly

A Node.js server that hosts [mulle.js](https://github.com/datagutten/mulle.js), the
browser reimplementation of *Mulle Meck bygger bilar* / *Byg bil med Mulle Meck*
(ELD Interaktiv Produktion, 1998), with a mobile-first shell so it plays properly
on a phone.

The game engine is mulle.js (GPL-3.0). The artwork, audio and game data are **not**
included here — they are extracted at build time from your own copy of the original
CD-ROM ISO. mulle.js requires that you own the original release.

## Layout

```
mulle/
├── server/                 this project — the Node.js host
│   ├── server.js           Express server
│   └── public/             mobile shell (index.html, mobile.css, mobile.js, manifest)
├── scripts/
│   ├── build.sh            one-shot build of everything in vendor/mulle.js
│   └── fetch_iso.sh        parallel downloader for the archive.org ISO
├── vendor/
│   └── mulle.js/           upstream mulle.js (git submodule, engine + build scripts)
│       ├── iso/            mullebil_<lang>.iso — the game CD image   (not committed)
│       ├── dist/           webpack build output                      (not committed)
│       └── assets_<lang>/  spritesheets extracted from the ISO       (not committed)
└── .cache/                 download scratch space                    (not committed)
```

Nothing derived from the CD-ROM is ever committed: `*.iso`, `.cache/` and the
build output are all git-ignored.

## Getting started

```sh
git clone --recurse-submodules git@github.com:kinglevel/mulle.git
cd mulle
# or, in an existing clone:
git submodule update --init
```

## Running

```sh
cd server
npm install
npm start
```

Then open `http://localhost:8090/`. The server prints your LAN address and a QR
code — scan it with a phone on the same Wi-Fi.

Environment variables:

| Variable    | Default   | Meaning                                  |
|-------------|-----------|------------------------------------------|
| `PORT`      | `8090`    | listen port                              |
| `HOST`      | `0.0.0.0` | bind address                             |
| `GAME_LANG` | `da`      | which `assets_<lang>` directory to serve |
| `MULLE_JS_DIR` | `vendor/mulle.js` | path to the mulle.js checkout (also used by `scripts/`) |

`GET /healthz` reports whether the build and assets are present.

## Rebuilding the game from the ISO

```sh
scripts/fetch_iso.sh              # optional: fast parallel download of the da ISO
scripts/build.sh                  # defaults to da (Danish)
GAME_LANG=sv scripts/build.sh
```

`build.sh` downloads the ISO if missing, extracts the Director casts, builds
scores, spritesheets and topography, then runs webpack and sass.

Supported languages in the upstream build script: `sv`, `no`, `da`, `fi`, `nl`.

## Mobile notes

* The upstream page pins the canvas to a literal 640×480 box. `server/public/`
  replaces the HTML shell so the wrapper fills the viewport and Phaser's
  `SHOW_ALL` scale mode letterboxes the 4:3 canvas into it.
* The game starts from a **Spil** button rather than on page load. Mobile
  browsers only unlock audio, fullscreen and orientation lock from inside a real
  user gesture, so the tap has to come first.
* Multiplayer is **off** by default. Upstream defaults it on, and the boot state
  then blocks startup on a websocket to `mulle.datagutten.net:8765`, showing a
  blocking alert if it fails. Add `?mp=1` to the URL to re-enable it.
* On iOS there is no fullscreen API for the canvas; use Safari's *Add to Home
  Screen* instead — the web manifest requests fullscreen landscape.
* Useful query flags: `?mp=1` (multiplayer), `?debug=1` (upstream debug mode).

## Credits

* Game: ELD Interaktiv Produktion / Levande Böcker, 1997–98
* Browser engine: [datagutten/mulle.js](https://github.com/datagutten/mulle.js), GPL-3.0
* ISO source: [archive.org/details/byg-bil-med-mulle-meck](https://archive.org/details/byg-bil-med-mulle-meck)
