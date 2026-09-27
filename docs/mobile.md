# Mobile and browser notes

Why the shell does what it does on phones, and the differences from upstream
mulle.js's own page.

* **Full-screen canvas.** Upstream pins the canvas to a literal 640×480 box.
  The shell makes the wrapper fill the viewport (minus the toolbar) and
  Phaser's `SHOW_ALL` scale mode letterboxes the 4:3 canvas into it. Pixel art
  stays crisp (`image-rendering: pixelated`).
* **Play button first.** Mobile browsers only unlock audio, fullscreen and
  orientation lock from inside a real user gesture, so the game boots from the
  Play tap rather than on page load. The AudioContext is also resumed on later
  taps, for Safari.
* **Fullscreen.** On Android the Play tap requests fullscreen and locks
  landscape. iOS has no fullscreen API for a canvas: use Safari's *Add to Home
  Screen*; the web manifest asks for fullscreen landscape. The toolbar has a
  Fullscreen button for anyone who leaves it.
* **Rotate hint.** Small portrait screens get a "turn your phone sideways"
  overlay once the game runs.
* **Text inputs.** Upstream scenes place plain `<input>`s (the name sign, the
  car name) in 640×480 canvas pixels; the shell re-anchors and scales them onto
  the scaled canvas, and re-enables text selection for them.
* **Touch.** Long-press doesn't open the context menu (so parts can be dragged),
  double-tap doesn't zoom, and pinch zoom is blocked.
* **Multiplayer is off.** Upstream turns it on by default and then blocks
  startup on a websocket to `mulle.datagutten.net:8765`, with a blocking alert
  if it fails. Add `?mp=1` to the URL to turn it back on.
* **Subtitles follow the language.** mulle.js only has subtitle text in English
  and Swedish, and showed English over every language's voices. Now `en` and
  `sv` get their own and the rest none.
* **Dark Reader** and similar extensions are opted out (they recoloured the
  name sign's text white-on-white).
* **Background tabs.** Browsers pause `requestAnimationFrame` in hidden tabs,
  so the game (loading included) only advances while its tab is visible.
* **Query flags:** `?mp=1` (multiplayer), `?debug=1` (upstream debug mode).
