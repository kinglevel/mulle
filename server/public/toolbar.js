/*
 * The toolbar above the game.
 *
 * Tools register themselves; the bar renders them once the game starts.
 *
 *   MulleToolbar.register({
 *     id: 'teleport',                 // unique
 *     label: 'Teleport',              // text on the button (and its tooltip)
 *     icon: '⌖',                      // optional, shown before the label
 *     order: 50,                      // optional, lower sits further left
 *     available: function (ctx) {},   // optional, false hides the tool
 *     onClick: function (ctx) {},     // a plain button, or…
 *     panel: function (el, ctx) {},   // …a panel that opens under the bar,
 *                                     // built into the (emptied) el each time
 *     onClose: function (el, ctx) {}  // optional, when the panel closes
 *   })
 *
 * ctx is { game, settings, shell, toolbar }. Tools registered after the game
 * has started appear straight away.
 */
(function () {
  'use strict'

  var bar = document.getElementById('toolbar')
  var toolsEl = bar.querySelector('.toolbar-tools')
  var titleEl = bar.querySelector('.toolbar-title')
  var panel = document.getElementById('toolbar-panel')
  var panelBody = panel.querySelector('.panel-body')

  var tools = []
  var ctx = null
  var openTool = null

  function sorted () {
    return tools.slice().sort(function (a, b) { return (a.order || 100) - (b.order || 100) })
  }

  function closePanel () {
    if (!openTool) return
    if (openTool.onClose) openTool.onClose(panelBody, ctx)
    openTool = null
    panel.hidden = true
    render()
  }

  function openPanel (tool) {
    if (openTool === tool) return closePanel()
    closePanel()
    openTool = tool
    panelBody.replaceChildren()
    tool.panel(panelBody, ctx)
    panel.hidden = false
    render()
  }

  function render () {
    if (!ctx) return
    toolsEl.replaceChildren()
    sorted().forEach(function (tool) {
      if (tool.available && !tool.available(ctx)) return
      var b = document.createElement('button')
      b.type = 'button'
      b.className = 'tool'
      b.dataset.tool = tool.id
      b.title = tool.label
      if (tool.icon) {
        var i = document.createElement('span')
        i.className = 'tool-icon'
        i.setAttribute('aria-hidden', 'true')
        i.textContent = tool.icon
        b.appendChild(i)
      }
      var l = document.createElement('span')
      l.className = 'tool-label'
      l.textContent = tool.label
      b.appendChild(l)
      if (tool.panel) {
        b.setAttribute('aria-expanded', String(openTool === tool))
        b.addEventListener('click', function () { openPanel(tool) })
      } else {
        b.addEventListener('click', function () { tool.onClick(ctx) })
      }
      toolsEl.appendChild(b)
    })
  }

  window.MulleToolbar = {
    register: function (tool) {
      tools = tools.filter(function (t) { return t.id !== tool.id })
      tools.push(tool)
      render()
    },

    unregister: function (id) {
      if (openTool && openTool.id === id) closePanel()
      tools = tools.filter(function (t) { return t.id !== id })
      render()
    },

    /** Re-evaluate `available` and labels, e.g. after a setting changes. */
    refresh: render,

    closePanel: closePanel,

    /** A short message under the toolbar, e.g. from an edition's events. */
    toast: function (message) {
      var box = document.getElementById('toasts')
      if (!box) {
        box = document.createElement('div')
        box.id = 'toasts'
        box.setAttribute('role', 'status')
        document.body.appendChild(box)
      }
      var item = document.createElement('div')
      item.className = 'toast'
      item.textContent = message
      box.appendChild(item)
      setTimeout(function () { item.classList.add('leaving') }, 4200)
      setTimeout(function () { item.remove() }, 4700)
    },

    /** Called by mobile.js when the game starts. */
    show: function (context, title) {
      ctx = context
      ctx.toolbar = this
      titleEl.textContent = title || ''
      bar.hidden = false
      document.body.classList.add('in-game')
      render()
    }
  }

  // Tapping the game closes an open panel, so it never hides play for long.
  document.getElementById('wrapper').addEventListener('pointerdown', closePanel)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePanel()
  })
})()
