# Mulle Meck — in the browser, on your phone, in every language

Play the 1997 classic *Bygg bilar med Mulle Meck* (*Gary Gadget: Building
Cars*) in a browser: on a phone, a tablet or a desktop, in all seven languages
it was released in. Build a car from junk, drive it around the village and help
the neighbours, just like on the family PC in 1997. Or turn on **MULLE-HELL**
and watch everything go gloriously wrong.

This is a self-hosted Node.js server around
[mulle.js](https://github.com/datagutten/mulle.js), the open-source
reimplementation of the game's engine, with a mobile-first shell, a
language picker, game editions, a cheat panel and a toolbar for new tools.

> **You need the original game.** No artwork, audio or game data is included
> in this repository. The build extracts it from the game's CD images, which
> the install script downloads from archive.org. mulle.js requires that you
> own the original release.

## Features

* 🌍 **Every release**: Swedish, Danish, Norwegian, Finnish, Dutch, German and
  English, each built from its own CD. The English re-release is a
  Shockwave-compressed Director 7 disc, which this project unpacks and
  remasters so it builds like the rest.
* 📱 **Made for phones**: fills the screen, letterboxes the 4:3 picture, works
  with touch, and can go fullscreen in landscape. Scan the QR code the server
  prints and play on your phone over Wi-Fi.
* 🎬 **The original narrated intro**, which mulle.js never had, rebuilt from the
  game's own data.
* 🎮 **Editions**: *Vanilla* is the game as it was. *MULLE-HELL* adds 17
  switchable curses: squeaky helium voices, Buffa the dog burying your parts,
  a balloon garage, backwards steering, a judge who loves boring cars…
* ⭐ **Cheats**, if you want them: spawn any of the game's 159 parts (named and
  sorted into categories), jump to any place, drive to any map square.
* 🧰 **A toolbar above the game** that new tools can plug into.

## Quick start

You need Node.js 24+, Python 3 and ffmpeg with libvorbis;
`scripts/install.sh` checks and installs them (macOS with Homebrew, or
Debian/Ubuntu with apt).

```sh
git clone --recurse-submodules https://github.com/kinglevel/mulle.git
cd mulle
scripts/install.sh        # tools, packages and every language's CD image (~1.3 GB)
scripts/build.sh all      # builds every language (takes a while)
cd server && npm start
```

Open <http://localhost:8090/>. To play on a phone, scan the QR code the server
prints; the phone has to be on the same network.

Only want some languages? `scripts/install.sh sv da` then
`scripts/build.sh sv da`. See [docs/building.md](docs/building.md) for details
and troubleshooting.

## Languages

| Code | Language   | Title                                | Disc on archive.org |
|------|------------|--------------------------------------|---------------------|
| `sv` | Svenska    | Bygg bilar med Mulle Meck            | [byggbilarmedmullemeck](https://archive.org/details/byggbilarmedmullemeck) |
| `da` | Dansk      | Byg bil med Mulle Meck               | [byg-bil-med-mulle-meck](https://archive.org/details/byg-bil-med-mulle-meck) |
| `no` | Norsk      | Bygg biler med Mulle Mekk            | [bygg-biler-med-mulle-mekk](https://archive.org/details/bygg-biler-med-mulle-mekk) |
| `fi` | Suomi      | Rakenna autoja Masa Mainion kanssa   | [RakennaAutojaMasaMainionKanssa](https://archive.org/details/RakennaAutojaMasaMainionKanssa) |
| `nl` | Nederlands | Miel Monteur bouwt auto's            | [1.mielmonteurbouwtautosiso](https://archive.org/details/1.mielmonteurbouwtautosiso) |
| `de` | Deutsch    | Autos bauen mit Willy Werkel         | [autos-bauen](https://archive.org/details/autos-bauen) |
| `en` | English    | Gary Gadget: Building Cars           | [gary-gadget-building-cars](https://archive.org/details/gary-gadget-building-cars) |

Each built language is served at `/<code>/`. The start page sends players to
the language they picked last time, or the one their browser prefers. Save
games carry over between languages. Everything about a language lives in
[`languages.json`](languages.json), including all the start-screen text.

## Playing

The start screen has two steps:

1. **Pick an edition.**
   * **Vanilla** is the original game.
   * **MULLE-HELL** is the extreme hardcore edition. Its 17 curses include:
     voices that get squeakier as the fuel runs out, a chewed-up tape, Buffa
     burying yard parts in the junk yard, junk piles that keep getting
     "tidied", a super-magnetic chassis, a balloon garage where parts float to
     the ceiling, hopping junk, a hungry heavy car, steeper hills, wandering
     destinations, backwards-steering days, pitch-dark roads (lamps help!),
     parts rattling off on bumpy roads, a tow truck that takes a part as
     payment, a car show judge who loves boring cars, a shrink ray, and
     earthquake bumpers. The 🔥 Curses button in the toolbar switches each one
     on or off. MULLE-HELL keeps its own save games.
2. **Pick a language and options**, then **Play**. *Enable cheats* adds a
   Cheats panel to the toolbar.

In the game, the toolbar at the top has the Cheats and Curses panels,
Fullscreen and Menu (back to the start screen).

## Configuration

The server reads these environment variables:

| Variable       | Default           | Meaning |
|----------------|-------------------|---------|
| `PORT`         | `8090`            | Port to listen on |
| `HOST`         | `0.0.0.0`         | Address to bind (`127.0.0.1` for this machine only) |
| `GAME_LANG`    | `da`              | Language `/` falls back to, and the default for `build.sh` |
| `GAMES_DIR`    | `games`           | Where the per-language builds live |
| `MULLE_JS_DIR` | `vendor/mulle.js` | The mulle.js checkout (also used by `scripts/`) |

`GET /healthz` reports which languages are built, and `GET /languages` lists
them all.

## How it's put together

```
mulle/
├── languages.json      every release: disc location, titles, start-screen text
├── server/             the Node.js server
│   ├── server.js       serves each language at /<lang>/
│   ├── shell.html      the page around the game, rendered per language
│   └── public/         start screen, editions, MULLE-HELL, toolbar, cheats,
│                       mobile glue, the parts catalogue
├── scripts/            install.sh, build.sh, fetch_iso.sh
├── tools/              Director file tools: intro extraction, the English
│                       disc remaster, the parts catalogue generator
├── patches/mulle.js/   our fixes to mulle.js, applied during builds
├── docs/               building, extending, mobile notes
└── vendor/mulle.js/    upstream mulle.js (git submodule)
```

Nothing taken from the game discs is ever committed: the CD images, build
output (`games/`) and caches are git-ignored.

More reading:

* [docs/building.md](docs/building.md): the build pipeline, the English
  disc, troubleshooting
* [docs/extending.md](docs/extending.md): writing editions, toolbar tools
  and curses, and how to reach the game's internals
* [docs/mobile.md](docs/mobile.md): what the shell does for phones, and why

## Contributing

Contributions are very welcome: bug reports, translations, new curses, new
tools, a better way to do something. Start with
[CONTRIBUTING.md](CONTRIBUTING.md), and please follow the
[code of conduct](CODE_OF_CONDUCT.md).

## License

This repository's own code is released under the [MIT License](LICENSE): take
it, change it, share it. Two exceptions: the patches in `patches/mulle.js/`
modify mulle.js and are therefore GPL-3.0, like mulle.js itself, which is
included as a submodule. The original game — its art, voices, music and data —
belongs to its publishers and is not covered by any license here.

## Credits

* **The game**: *Bygg bilar med Mulle Meck*, by ELD Interaktiv Produktion /
  Levande Böcker, 1997, after the books by George Johansson and Jens Ahlbom.
  Published abroad as *Byg bil med Mulle Meck*, *Bygg biler med Mulle Mekk*,
  *Rakenna autoja Masa Mainion kanssa*, *Miel Monteur bouwt auto's*,
  *Autos bauen mit Willy Werkel* and *Gary Gadget: Building Cars*.
* **The engine**: [mulle.js](https://github.com/datagutten/mulle.js) by
  datagutten and contributors, GPL-3.0.
* **The discs**: preserved on [archive.org](https://archive.org/) by the people
  who uploaded them.
