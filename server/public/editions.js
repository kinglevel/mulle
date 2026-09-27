/*
 * Game editions, picked on the start screen before the language.
 *
 * An edition is a set of changes made to the game before it boots: setup()
 * gets the Phaser game (window.game, with upstream's game.mulle state) and
 * the start-screen settings, and can change rules, patch scenes or register
 * toolbar tools. Its name and description come from languages.json's `ui`
 * (the `nameKey`/`hintKey` strings) so they follow the language.
 *
 * Every edition but vanilla keeps its own save games (`saves`), so progress
 * made under different rules never mixes.
 */
(function () {
  'use strict'

  window.MulleEditions = [
    {
      id: 'vanilla',
      name: 'Vanilla',
      hintKey: 'vanillaHint',
      saves: null,
      setup: function () {}
    },
    {
      id: 'hardcore',
      nameKey: 'hardcore',
      hintKey: 'hardcoreHint',
      saves: 'hardcore',
      // editions/hardcore.js fills this in: MULLE-HELL's curses.
      setup: function () {}
    }
  ]
})()
