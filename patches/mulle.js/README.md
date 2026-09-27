# Patches to mulle.js

Local fixes and additions to [mulle.js](https://github.com/datagutten/mulle.js),
applied by `scripts/build.sh` for the duration of a build and reverted
afterwards, so the `vendor/mulle.js` submodule stays pristine.

| Patch | What it does |
|-------|--------------|
| `0001-menu-include-intro-speech-11d001v0.patch` | Includes Mulle's spoken intro and its lip-sync cues in the menu assets |
| `0002-narrated-intro.patch` | Adds the original narrated intro scene (`src/scenes/intro.js`), played after the name screen |
| `0003-build-use-local-iso-for-any-language.patch` | Lets `build.py` use an ISO fetched by `scripts/fetch_iso.sh`, for any language |
| `0004-assets-english-rules-for-archive-org-disc.patch` | Corrects the English asset rules for the archive.org English disc |

**License:** these patches modify mulle.js, which is GPL-3.0, so they are
licensed under the [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) —
unlike the rest of this repository, which is MIT (see `../../LICENSE`).

To add one: make the change in `vendor/mulle.js` with the existing patches
applied, then export just your change with `git diff` into the next numbered
file, starting with a short description. Check that the whole series still
applies: `cd vendor/mulle.js && for p in ../../patches/mulle.js/*.patch; do git apply --check "$p" && git apply "$p"; done`, then revert them in reverse order with `git apply -R`.
