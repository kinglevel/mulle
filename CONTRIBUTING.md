# Contributing

Thanks for wanting to help! Whether it's a bug report, a translation fix, a
new MULLE-HELL curse or a whole new edition, contributions of every size are
welcome. You don't need to be an expert; if you're unsure about something,
open an issue and ask.

## Ways to help

* **Report a bug**: open an issue with the language, edition, browser and
  device, what you did, and what happened. A screenshot or the browser
  console's errors help a lot.
* **Fix a translation**: shell text is in [`languages.json`](languages.json)
  (`ui`), MULLE-HELL's in `TEXT` at the top of
  [`server/public/editions/hardcore.js`](server/public/editions/hardcore.js).
  Native speakers especially welcome.
* **Name a part better**: part names are in
  [`tools/parts_catalogue.py`](tools/parts_catalogue.py) (`NAMES`).
* **Invent a curse, tool or edition**: see [docs/extending.md](docs/extending.md).
  Kids play this game: bizarre and funny is great, mean or scary isn't.
* **Improve the build**: see [docs/building.md](docs/building.md).

For anything big, open an issue first so we can agree on the idea before you
spend time on it.

## Setting up

Follow the quick start in the [README](README.md). You only need to build
one language to work on the shell, e.g. `scripts/build.sh sv`. Changes under
`server/public/` and `server/shell.html` only need a page reload. Changes to
`server.js` or `languages.json` need a server restart.

## Where things go

* **Our own code** (server, shell, editions, tools, scripts) lives in this repo.
* **Changes to the mulle.js engine** go in `patches/mulle.js/` as numbered
  patch files. Never commit changes inside `vendor/mulle.js`; the build
  applies the patches and reverts them afterwards. See
  [patches/mulle.js/README.md](patches/mulle.js/README.md). Fixes that make
  sense for everyone are best also offered upstream to
  [mulle.js](https://github.com/datagutten/mulle.js).
* **Game data must never be committed**: no CD images, extracted art, audio,
  spritesheets or build output. `.gitignore` covers the usual places; double
  check `git status` before committing.

## Style

* **JavaScript in the browser shell**: plain ES5-style scripts (no build
  step), each wrapped in an IIFE with `'use strict'`. Two-space indent, no
  semicolons, single quotes, like upstream mulle.js.
* **Python tools**: standard library where possible, PEP 8, and a docstring
  at the top saying what the tool is for and how to run it.
* **Shell scripts**: bash with `set -euo pipefail`. They have to run on macOS's
  bash 3.2 as well as Linux.
* **Comments** explain *why*, especially anything surprising about the game
  or the original files.
* **Text players see** goes into every language, not just English.

## Pull requests

1. Fork, and branch from `main`.
2. Keep a pull request to one change, with a message explaining what and why.
3. Check it in a browser: start a game in the edition and language you
   touched, and watch the console for errors. On a phone too, if it touches
   layout or input.
4. Fill in the pull request template.

## License

This repository is MIT-licensed (see [LICENSE](LICENSE)). By contributing,
you agree that your contribution is released under the MIT License. The
exception is patches to mulle.js in `patches/mulle.js/`, which are GPL-3.0
like mulle.js itself.
