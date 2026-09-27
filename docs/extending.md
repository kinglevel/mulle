# Extending: editions, toolbar tools and curses

Everything here lives in `server/public/` and runs in the browser around the
unmodified mulle.js bundle. You don't need to rebuild the game to work on it:
edit, reload the page.

## How the page boots

`server.js` renders `server/shell.html` per language at `/<lang>/`, filling in
`window.MULLE_SHELL` (language, title, translated `ui` strings from
[`languages.json`](../languages.json), built languages). Then, in order:

| Script | Role |
|--------|------|
| `bundle.js` | upstream mulle.js; creates `window.game` but doesn't start it |
| `toolbar.js` | `window.MulleToolbar`: the bar above the game, tools, panels, toasts |
| `cheats.js` | the Cheats tool; groups the garage's part cheats by category |
| `editions.js` | `window.MulleEditions`: the list of editions |
| `editions/hardcore.js` | MULLE-HELL: fills in the hardcore edition's `setup` |
| `mobile.js` | scaling, audio unlock, fullscreen; `MulleShell.start(settings)` |
| `menu.js` | the start screen: edition → language and options → Play |

Play calls `MulleShell.start({ edition, cheats })` inside the tap (mobile
browsers only grant audio and fullscreen to a real gesture). That runs the
edition's `setup(game, settings)`, shows the toolbar, then `game.setup()`.

## Adding an edition

Add an entry to `server/public/editions.js`:

```js
{
  id: 'moon',
  nameKey: 'moon',            // or name: 'Moon mode' (untranslated)
  hintKey: 'moonHint',        // description on the start screen
  badgeKey: 'inDevelopment',  // optional badge
  saves: 'moon',              // own save slot (null = share vanilla's)
  setup: function (game, settings) {
    // runs before the game boots: patch scenes, audio, data, add tools
  }
}
```

and its strings to every language's `ui` in `languages.json`. For anything
bigger than a few lines, put the edition in its own file under
`server/public/editions/` and load it from `shell.html`, as MULLE-HELL does.

## Reaching the game

Webpack hides upstream's classes, so an edition patches what is reachable
from `window.game`:

| What | How |
|------|-----|
| Scene classes | `game.mulle.states.<scene>.prototype`; patch in `setup`, before `game.setup()` registers them |
| Every scene at once | `Object.getPrototypeOf(game.mulle.states.garage.prototype)` (the shared base; its `create` runs in every scene) |
| All sound, voices included | `game.mulle.playAudio(id)`; returns a `Phaser.Sound` |
| Game data | `PartsDB`, `MapsDB`, `MissionsDB`, … on `game.mulle`, after the `load` scene's `create` |
| Car stats | `game.mulle.user.Car` → `Object.getPrototypeOf(car).updateStats` (capture from the first live car) |
| Driving | `world.driveCar` → its prototype's `calculateSpeed` runs every 30 Hz tick, after steering input |
| Characters | `game.mulle.actors.{mulle, judge, figge, buffa, …}` while their scene runs |

`server/public/editions/hardcore.js` shows all of these, with a `wrap()`
helper that falls back to the original method if an edition hook throws, so a
broken curse can't break the game. Its header comment is the most detailed
map of the hook points.

**Don't use the URL hash** for shell state: upstream starts the scene the
hash names, and writes the current scene there so a reload resumes it.

## Adding a toolbar tool

```js
MulleToolbar.register({
  id: 'teleport',
  label: 'Teleport',                   // button text and tooltip
  icon: '⌖',                           // optional; small screens show only this
  order: 50,                           // lower sits further left
  available: function (ctx) { return true },  // optional
  onClick: function (ctx) { /* … */ }  // a plain button, or:
  // panel: function (el, ctx) { el.append(/* … */) },  a drop-down panel
  // onClose: function (el, ctx) {}
})
```

`ctx` is `{ game, settings, shell, toolbar }`. Tools registered after the game
started appear straight away. `MulleToolbar.toast('text')` shows a short
message under the bar.

## MULLE-HELL's curses

Each curse in `editions/hardcore.js` is `{ id, install(ctx) }`. `install`
runs once before boot and either wraps a scene method directly or pushes a
function onto one of the shared hook lists:

| `ctx.` list | Called |
|-------------|--------|
| `audio` | for every sound: return a playback rate, or null |
| `car` | after the car's stats are worked out: change `quickProperties`, `criteria` |
| `drive` | every driving tick, with the drive car |
| `world` | every frame on the road, with the world scene |
| `scene` | after any scene's `create` |

Hooks check `on(id)` when they fire, so the toolbar's Curses panel switches
them on and off live. To add a curse: add an entry to `CURSES`, a
`[name, description]` pair to each language in `TEXT`, and mention it in the
README's list.

### Useful facts from the game code

* Car stats are summed (weight, grip, fuel, comfort, funny factor…) or the
  maximum over parts (speed, durability, steering…); `cardata.js`
  `updateStats`. Comfort, load capacity, lamps, exhaust and pedals don't
  affect play upstream: free to give meaning to.
* Terrain comes from a topology bitmap: red ≥ 240 is a wall, 32 mud, 16 rocks,
  `r % 16` the height. Mud needs grip > 8, rocks durability > 3, hills
  strength > 2 / > 3.
* The car show rates only the funny factor; the medal needs more than 8.
* `MissionsDB` and the mailbox are unfinished upstream (the mailbox shows
  `alert('Mission')`): room for a mission layer.

## Localisation

Shell text lives in `languages.json` (`ui`), MULLE-HELL's in `TEXT` at the top
of `editions/hardcore.js`. Every language needs every key; English is the
fallback. Part names in the parts catalogue are English only for now.
