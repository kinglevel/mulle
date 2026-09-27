/*
 * The start screen, in two steps:
 *
 *   1. edition   Vanilla, Extreme hardcore mode, … (editions.js)
 *   2. setup     language, options (enable cheats, …), Play
 *
 * Each language is its own build under /<lang>/, so picking one is a
 * navigation; sessionStorage carries "stay on step 2" across it. (Not the
 * URL hash: upstream starts the scene the hash names, and writes the current
 * scene there.) The edition and options are remembered in localStorage, the
 * language in a cookie (the server's / reads it to send a returning player
 * back).
 */
(function () {
  'use strict'

  var shell = window.MULLE_SHELL || { lang: '', languages: [], ui: {} }
  var ui = shell.ui || {}
  var editions = window.MulleEditions
  var inner = document.querySelector('#boot-overlay .boot-inner')
  var title = inner.querySelector('h1')

  var STORE = 'mulle_shell'
  var STEP = 'mulle_shell_step'
  var DEFAULTS = { edition: 'vanilla', cheats: false }

  function load () {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE) || '{}')
      return Object.assign({}, DEFAULTS, saved)
    } catch (e) {
      return Object.assign({}, DEFAULTS)
    }
  }

  function save () {
    try { window.localStorage.setItem(STORE, JSON.stringify(settings)) } catch (e) {}
  }

  function rememberLanguage (code) {
    document.cookie = 'mulle_lang=' + code + '; path=/; max-age=31536000; SameSite=Lax'
  }

  function editionById (id) {
    return editions.filter(function (e) { return e.id === id })[0] || editions[0]
  }

  function editionName (e) { return e.name || ui[e.nameKey] || e.id }

  function el (tag, attrs, children) {
    var node = document.createElement(tag)
    for (var k in attrs || {}) {
      if (k === 'text') node.textContent = attrs[k]
      else if (k === 'className') node.className = attrs[k]
      else node.setAttribute(k, attrs[k])
    }
    ;(children || []).forEach(function (c) { if (c) node.appendChild(c) })
    return node
  }

  var settings = load()
  var step = document.createElement('div')
  step.className = 'boot-step'
  inner.appendChild(step)

  /* ---- step 1: edition ---------------------------------------------- */

  function showEditions () {
    step.replaceChildren()
    step.appendChild(el('h2', { className: 'boot-subtitle', text: ui.chooseEdition || 'Choose game' }))
    var list = el('div', { className: 'edition-list' })
    editions.forEach(function (e) {
      var card = el('button', { type: 'button', className: 'edition-card', 'data-edition': e.id }, [
        el('span', { className: 'edition-name', text: editionName(e) }),
        el('span', { className: 'edition-hint', text: ui[e.hintKey] || '' }),
        e.badgeKey ? el('span', { className: 'edition-badge', text: ui[e.badgeKey] || '' }) : null
      ])
      if (e.id === settings.edition) card.setAttribute('aria-current', 'true')
      card.addEventListener('click', function () {
        settings.edition = e.id
        save()
        showSetup()
      })
      list.appendChild(card)
    })
    step.appendChild(list)
  }

  /* ---- step 2: language, options, play ------------------------------ */

  function showSetup () {
    var edition = editionById(settings.edition)
    step.replaceChildren()

    var back = el('button', { type: 'button', className: 'boot-back', text: '← ' + (ui.back || 'Back') })
    back.addEventListener('click', showEditions)
    step.appendChild(el('div', { className: 'setup-head' }, [
      back,
      el('span', { className: 'setup-edition', text: editionName(edition) })
    ]))

    if (shell.languages.length > 1) {
      var langs = el('nav', { className: 'lang-picker', 'aria-label': ui.language || 'Language' })
      shell.languages.forEach(function (l) {
        var a = el('a', { href: '/' + l.code + '/' + window.location.search, lang: l.code, title: l.title, text: l.name })
        if (l.code === shell.lang) a.setAttribute('aria-current', 'true')
        a.addEventListener('click', function () {
          rememberLanguage(l.code)
          try { window.sessionStorage.setItem(STEP, 'setup') } catch (e) {}
        })
        langs.appendChild(a)
      })
      step.appendChild(el('section', { className: 'setup-section' }, [
        el('h2', { className: 'setup-label', text: ui.language || 'Language' }), langs
      ]))
    }

    var cheats = el('input', { type: 'checkbox', id: 'opt-cheats' })
    cheats.checked = !!settings.cheats
    cheats.addEventListener('change', function () {
      settings.cheats = cheats.checked
      save()
    })
    step.appendChild(el('section', { className: 'setup-section' }, [
      el('h2', { className: 'setup-label', text: ui.options || 'Options' }),
      el('label', { className: 'option', for: 'opt-cheats' }, [
        cheats,
        el('span', { className: 'option-text' }, [
          el('span', { className: 'option-name', text: ui.cheats || 'Enable cheats' }),
          el('span', { className: 'option-hint', text: ui.cheatsHint || '' })
        ])
      ])
    ]))

    var play = el('button', { type: 'button', id: 'boot-button', text: ui.play || 'Play' })
    if (!window.MulleShell || !window.MulleShell.ready) {
      play.disabled = true
      step.appendChild(el('p', { className: 'boot-hint', text: 'bundle.js failed to load — is the build complete?' }))
    }
    // Synchronously inside the tap: fullscreen needs the gesture.
    play.addEventListener('click', function () { window.MulleShell.start(settings) })
    step.appendChild(play)
    step.appendChild(el('p', { className: 'boot-hint', text: ui.hint || '' }))

    play.focus()
  }

  if (shell.lang) rememberLanguage(shell.lang)
  title.textContent = shell.title || title.textContent

  var resume = null
  try {
    resume = window.sessionStorage.getItem(STEP)
    window.sessionStorage.removeItem(STEP)
  } catch (e) {}
  if (resume === 'setup') showSetup()
  else showEditions()
})()
