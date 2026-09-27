/*
 * The Cheats tool.
 *
 * Upstream scenes fill #cheats with their own buttons when cheats are on:
 * every car part in the garage, every scene from the yard, every map square
 * on the road. The panel shows them. The garage's ~160 part buttons come as
 * one flat list labelled "(id) name" or just "id", so they are sorted into
 * categories from parts-catalogue.json (tools/parts_catalogue.py), given
 * names, and made searchable. The buttons themselves are moved, not copied,
 * so upstream's click handlers (spawn the part) keep working.
 */
(function () {
  'use strict'

  var shell = window.MULLE_SHELL || { ui: {} }
  var ui = shell.ui || {}
  var labels = ui.partCategories || {}
  var cheats = document.getElementById('cheats')

  var ORDER = ['chassis', 'engines', 'batteries', 'tanks', 'wheels', 'brakes', 'steering',
    'gearboxes', 'bodywork', 'seats', 'horns', 'lights', 'exhaust', 'accessories']
  var SECTIONS = { front: 0, middle: 1, back: 2 }

  var catalogue = null
  fetch('/parts-catalogue.json')
    .then(function (r) { return r.json() })
    .then(function (data) {
      catalogue = {}
      data.parts.forEach(function (p) { catalogue[p.id] = p })
      group()
    })
    .catch(function () {})

  function partId (button) {
    var m = /^\((\d+)\)/.exec(button.textContent) || /^(\d+)$/.exec(button.textContent.trim())
    return m ? parseInt(m[1], 10) : null
  }

  function el (tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text) node.textContent = text
    return node
  }

  var grouping = false

  function group () {
    if (!catalogue || grouping || cheats.dataset.grouped) return
    var buttons = Array.prototype.slice.call(cheats.querySelectorAll(':scope > .button'))
    var parts = buttons.filter(function (b) { return partId(b) !== null && catalogue[partId(b)] })
    if (parts.length < 10) return // not the garage's part list

    grouping = true
    var byCategory = {}
    parts.forEach(function (b) {
      var p = catalogue[partId(b)]
      b.textContent = p.name
      b.title = '#' + p.id + (p.section ? ' · ' + p.section : '')
      b.dataset.search = (p.name + ' ' + p.id + ' ' + (labels[p.category] || p.category)).toLowerCase()
      // Upstream darkens the parts you already own with an inline style.
      if (b.getAttribute('style')) {
        b.removeAttribute('style')
        b.classList.add('owned')
        b.title += ' · ' + (labels.owned || 'owned')
      }
      ;(byCategory[p.category] = byCategory[p.category] || []).push({ button: b, part: p })
    })

    var search = el('input', 'cheat-search')
    search.type = 'search'
    search.placeholder = labels.search || 'Search parts'
    search.setAttribute('aria-label', search.placeholder)

    var sections = []
    var others = buttons.filter(function (b) { return parts.indexOf(b) < 0 })
    var frag = document.createDocumentFragment()
    frag.appendChild(search)
    if (others.length) {
      var actions = el('div', 'cheat-actions')
      others.forEach(function (b) { actions.appendChild(b) })
      frag.appendChild(actions)
    }

    ORDER.concat(Object.keys(byCategory).filter(function (c) { return ORDER.indexOf(c) < 0 }))
      .forEach(function (cat) {
        var items = byCategory[cat]
        if (!items) return
        items.sort(function (a, b) {
          return ((SECTIONS[a.part.section] || 0) - (SECTIONS[b.part.section] || 0)) ||
            a.part.name.localeCompare(b.part.name)
        })
        var details = el('details', 'cheat-group')
        var summary = el('summary', null, labels[cat] || cat)
        var count = el('span', 'cheat-count', String(items.length))
        summary.appendChild(count)
        details.appendChild(summary)
        var list = el('div', 'cheat-list')
        items.forEach(function (it) { list.appendChild(it.button) })
        details.appendChild(list)
        frag.appendChild(details)
        sections.push({ details: details, count: count, items: items })
      })

    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase()
      sections.forEach(function (s) {
        var shown = 0
        s.items.forEach(function (it) {
          var hit = !q || it.button.dataset.search.indexOf(q) >= 0
          it.button.hidden = !hit
          if (hit) shown++
        })
        s.count.textContent = String(shown)
        s.details.hidden = shown === 0
        s.details.open = !!q && shown > 0
      })
    })

    cheats.replaceChildren(frag)
    cheats.dataset.grouped = '1'
    grouping = false
  }

  // Scenes rebuild #cheats (innerHTML = '') when they start; regroup then.
  new MutationObserver(function () {
    if (grouping) return
    if (cheats.dataset.grouped && !cheats.querySelector('.cheat-search')) delete cheats.dataset.grouped
    group()
  }).observe(cheats, { childList: true })

  window.MulleToolbar.register({
    id: 'cheats',
    label: ui.cheatsTool || 'Cheats',
    icon: '★',
    order: 10,
    available: function (ctx) { return !!ctx.settings.cheats },
    panel: function (el) {
      var empty = document.createElement('p')
      empty.className = 'panel-empty'
      empty.textContent = ui.noCheats || 'No cheats here'
      el.appendChild(empty)
      var sync = function () { empty.hidden = cheats.children.length > 0 }
      sync()
      this.observer = new MutationObserver(sync)
      this.observer.observe(cheats, { childList: true })
      cheats.hidden = false
    },
    onClose: function () {
      if (this.observer) this.observer.disconnect()
      cheats.hidden = true
    }
  })
})()
