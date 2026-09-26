/*
 * Mobile boot glue for mulle.js.
 *
 * Upstream index.html calls game.setup() straight from DOMContentLoaded. On a
 * phone that is too early: audio stays locked until a user gesture, and
 * fullscreen/orientation-lock can only be requested from inside one. So the
 * boot overlay's button is what starts the game.
 */
(function () {
  'use strict'

  var game = window.game
  var overlay = document.getElementById('boot-overlay')
  var bootButton = document.getElementById('boot-button')
  var fsButton = document.getElementById('fs-button')
  var rotateHint = document.getElementById('rotate-hint')
  var player = document.getElementById('player')

  if (!game) {
    overlay.innerHTML = '<div class="boot-inner"><h1>Kunne ikke indlæse spillet</h1>' +
      '<p class="boot-hint">bundle.js blev ikke indlæst — er bygget færdigt?</p></div>'
    return
  }

  var params = new URLSearchParams(window.location.search)

  /*
   * Multiplayer is opt-in here. Upstream defaults networkEnabled to true, and
   * boot.js then refuses to start the game until a websocket to
   * mulle.datagutten.net:8765 either opens or fails — on failure it fires a
   * blocking alert() before continuing. For a self-hosted single-player
   * install that is a guaranteed stall on every load. Re-enable with ?mp=1.
   */
  game.mulle.networkEnabled = params.get('mp') === '1'

  // Hidden by default on mobile, but still reachable for debugging: ?debug=1
  if (params.get('debug') === '1') game.mulle.debug = true

  var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches

  function canFullscreen (el) {
    return !!(el.requestFullscreen || el.webkitRequestFullscreen)
  }

  function requestFullscreen (el) {
    var fn = el.requestFullscreen || el.webkitRequestFullscreen
    if (!fn) return Promise.reject(new Error('unsupported'))
    try {
      return Promise.resolve(fn.call(el))
    } catch (e) {
      return Promise.reject(e)
    }
  }

  function isFullscreen () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement)
  }

  function lockLandscape () {
    // Android/Chrome only, and only while fullscreen. iOS has no equivalent —
    // there the rotate hint and the PWA manifest do the job instead.
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function () {})
    }
  }

  function refreshScale () {
    if (game.scale) game.scale.refresh()
    layoutInputs()
  }

  function updateRotateHint () {
    var portrait = window.innerHeight > window.innerWidth
    rotateHint.classList.toggle('armed', isTouch && started && portrait)
  }

  /*
   * Audio unlock. Phaser boots on a setTimeout after game.setup(), so its
   * AudioContext is created outside the Spil tap and starts 'suspended' —
   * and Phaser CE only auto-unlocks it for touch devices. Chrome lets us
   * resume it once the page has had a gesture; Safari wants the resume inside
   * one, hence the listeners as well.
   */
  function resumeAudio () {
    var ctx = game.sound && game.sound.context
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () {})
  }

  ;['pointerdown', 'touchend', 'keydown'].forEach(function (type) {
    document.addEventListener(type, resumeAudio, true)
  })

  function resumeAudioWhenBooted () {
    var tries = 0
    var timer = setInterval(function () {
      var ctx = game.sound && game.sound.context
      if (ctx || ++tries > 200) {
        clearInterval(timer)
        resumeAudio()
      }
    }, 25)
  }

  /*
   * Upstream scenes append plain <input>s to #player positioned in 640x480
   * canvas pixels (the name sign on the menu, the car name in the album).
   * The canvas here is scaled and centred, so map each one onto it: keep its
   * original top/left, then offset by the canvas position and scale it.
   */
  function layoutInputs () {
    var canvas = player.querySelector('canvas')
    if (!canvas) return
    var s = canvas.clientWidth / game.width
    var cx = canvas.offsetLeft
    var cy = canvas.offsetTop
    var inputs = player.querySelectorAll('input')
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i]
      if (!el.dataset.gameX) {
        el.dataset.gameX = parseFloat(el.style.left) || 0
        el.dataset.gameY = parseFloat(el.style.top) || 0
      }
      el.style.left = (cx + el.dataset.gameX * s) + 'px'
      el.style.top = (cy + el.dataset.gameY * s) + 'px'
      el.style.transform = 'scale(' + s + ')'
    }
  }

  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      for (var j = 0; j < records[i].addedNodes.length; j++) {
        var node = records[i].addedNodes[j]
        if (node.tagName === 'INPUT') {
          layoutInputs()
          // Pop the on-screen keyboard straight onto the name sign; desktop
          // only, since phones refuse focus() outside a gesture anyway.
          if (!isTouch && node.type !== 'file') node.focus()
          return
        }
      }
    }
  }).observe(player, { childList: true })

  var started = false

  function start () {
    if (started) return
    started = true

    overlay.classList.add('hidden')

    // Centre the letterboxed canvas inside the full-viewport parent.
    game.scale.pageAlignHorizontally = true
    game.scale.pageAlignVertically = true

    game.setup()
    resumeAudioWhenBooted()

    // Phaser reads the parent size on boot; the overlay teardown and any
    // fullscreen transition can both change it a frame later.
    setTimeout(refreshScale, 50)
    setTimeout(refreshScale, 400)
    updateRotateHint()
  }

  bootButton.addEventListener('click', function () {
    if (isTouch && canFullscreen(document.documentElement)) {
      requestFullscreen(document.documentElement)
        .then(lockLandscape)
        .catch(function () {})
        .then(start, start)
    } else {
      start()
    }
  })

  // Manual fullscreen toggle for anyone who exits it mid-game.
  if (canFullscreen(document.documentElement)) {
    fsButton.hidden = false
    fsButton.addEventListener('click', function () {
      if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      } else {
        requestFullscreen(document.documentElement).then(lockLandscape).catch(function () {})
      }
    })
  }

  window.addEventListener('resize', function () {
    refreshScale()
    updateRotateHint()
  })

  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      refreshScale()
      updateRotateHint()
    }, 250)
  })

  document.addEventListener('fullscreenchange', function () { setTimeout(refreshScale, 100) })
  document.addEventListener('webkitfullscreenchange', function () { setTimeout(refreshScale, 100) })

  // iOS pinch-zoom ignores user-scalable=no; these are the events that matter.
  ;['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault() }, { passive: false })
  })

  // Long-press on a car part should drag it, not open the context menu.
  player.addEventListener('contextmenu', function (e) { e.preventDefault() })

  // Suppress the double-tap-to-zoom delay inside the canvas area.
  var lastTouchEnd = 0
  player.addEventListener('touchend', function (e) {
    if (e.target.tagName === 'INPUT') return
    var now = Date.now()
    if (now - lastTouchEnd < 300) e.preventDefault()
    lastTouchEnd = now
  }, { passive: false })
})()
