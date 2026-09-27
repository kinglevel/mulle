/**
 * Node.js host for mulle.js — "Bygg bilar med Mulle Meck" in every language it
 * was released in.
 *
 * scripts/build.sh stages each language's build (webpack output plus the
 * assets extracted from that language's CD) into games/<lang>/. Each one is
 * served at /<lang>/, with the mobile shell from ./public rendered on top so
 * the 640x480 Phaser canvas fills a phone screen. The game loads everything
 * by relative URL, so it runs unchanged under a language prefix.
 *
 * / redirects to the player's language: the one they last picked (cookie),
 * else the best Accept-Language match among the built ones, else GAME_LANG.
 */

const express = require('express')
const compression = require('compression')
const path = require('path')
const fs = require('fs')
const os = require('os')
const qrcode = require('qrcode-terminal')

const PORT = parseInt(process.env.PORT || '8090', 10)
const HOST = process.env.HOST || '0.0.0.0'

const ROOT = path.resolve(__dirname, '..')
const GAMES = process.env.GAMES_DIR ? path.resolve(process.env.GAMES_DIR) : path.join(ROOT, 'games')
const PUBLIC = path.join(__dirname, 'public')

const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'))
const LANGUAGES = CONFIG.languages
const BY_CODE = new Map(LANGUAGES.map(l => [l.code, l]))
const DEFAULT_LANG = process.env.GAME_LANG || CONFIG.default

// Browser language tags that should land on one of ours.
const ALIASES = { nb: 'no', nn: 'no', sv: 'sv', da: 'da', fi: 'fi', nl: 'nl', de: 'de', en: 'en', no: 'no' }

// Checked per request rather than at startup, so a language built while the
// server runs shows up without a restart.
function isBuilt (code) {
  return fs.existsSync(path.join(GAMES, code, 'bundle.js'))
}

function builtLanguages () {
  return LANGUAGES.filter(l => isBuilt(l.code))
}

function preferredLanguage (req) {
  const built = builtLanguages().map(l => l.code)
  if (!built.length) return null

  const cookie = /(?:^|;\s*)mulle_lang=([a-z]{2})/.exec(req.headers.cookie || '')
  if (cookie && built.includes(cookie[1])) return cookie[1]

  const wanted = (req.headers['accept-language'] || '')
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map(p => /^q=([\d.]+)$/.exec(p.trim())).find(Boolean)
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q[1]) : 1 }
    })
    .filter(x => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of wanted) {
    const code = ALIASES[tag.split('-')[0]]
    if (code && built.includes(code)) return code
  }

  return built.includes(DEFAULT_LANG) ? DEFAULT_LANG : built[0]
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// The shell is tiny; re-reading it per request keeps edits live during development.
function renderShell (lang) {
  const shell = {
    lang: lang.code,
    title: lang.title,
    subtitles: lang.subtitles,
    ui: lang.ui,
    languages: builtLanguages().map(l => ({ code: l.code, name: l.name, title: l.title }))
  }
  const vars = {
    lang: escapeHtml(lang.code),
    title: escapeHtml(lang.title),
    rotate: escapeHtml(lang.ui.rotate),
    // Inside a <script>: JSON, with '<' escaped so no string can close the tag.
    shell: JSON.stringify(shell).replace(/</g, '\\u003c')
  }
  return fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8')
    .replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? vars[key] : m))
}

const app = express()
app.disable('x-powered-by')
app.set('strict routing', true)

// Atlas JSON and the bundle compress extremely well; PNGs are skipped
// automatically. This is the single biggest win over a mobile connection.
app.use(compression({ level: 6 }))

app.get('/', (req, res) => {
  const code = preferredLanguage(req)
  res.setHeader('Cache-Control', 'no-store')
  if (!code) {
    return res.status(503).type('txt').send('No language is built yet. Run scripts/build.sh (see README).')
  }
  res.setHeader('Vary', 'Accept-Language, Cookie')
  res.redirect(302, '/' + code + '/' + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''))
})

// The manifest's icon: the loading screen of whichever language is built.
app.get('/icon.png', (req, res) => {
  const code = preferredLanguage(req)
  if (!code) return res.status(404).end()
  res.sendFile(path.join(GAMES, code, 'loading.png'))
})

app.get('/languages', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    default: DEFAULT_LANG,
    languages: LANGUAGES.map(l => ({ code: l.code, name: l.name, title: l.title, built: isBuilt(l.code) }))
  })
})

app.get('/healthz', (req, res) => {
  const built = builtLanguages().map(l => l.code)
  res.status(built.length ? 200 : 503).json({
    ok: built.length > 0,
    default: DEFAULT_LANG,
    languages: Object.fromEntries(LANGUAGES.map(l => [l.code, {
      bundle: isBuilt(l.code),
      assets: fs.existsSync(path.join(GAMES, l.code, 'assets', 'ui.json'))
    }]))
  })
})

// Shared shell files (mobile.css, mobile.js, manifest) at the root.
app.use(express.static(PUBLIC, { index: false, setHeaders: res => res.setHeader('Cache-Control', 'no-store') }))

// Asset URLs aren't content-hashed, so a rebuild keeps the same names. Let
// browsers keep everything but revalidate by ETag: an unchanged file costs a
// 304, and a rebuilt one is picked up on the next load.
const revalidate = { index: false, setHeaders: res => res.setHeader('Cache-Control', 'no-cache') }

for (const lang of LANGUAGES) {
  const base = '/' + lang.code

  // Relative asset URLs only resolve under the language with a trailing slash.
  app.get(base, (req, res) => res.redirect(301, base + '/' + (req.originalUrl.slice(base.length) || '')))

  app.get(base + '/', (req, res) => {
    if (!isBuilt(lang.code)) {
      return res.redirect(302, '/')
    }
    res.setHeader('Cache-Control', 'no-store')
    res.type('html').send(renderShell(lang))
  })

  app.use(base, express.static(path.join(GAMES, lang.code), revalidate))
}

// Anything unmatched is a missing asset, not a route — a 404 is more useful
// than serving the shell, which would silently mask broken asset paths.
app.use((req, res) => res.status(404).type('txt').send('Not found: ' + req.path))

function lanAddresses () {
  const out = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address)
    }
  }
  return out
}

app.listen(PORT, HOST, () => {
  const built = builtLanguages()
  console.log('')
  console.log('  Mulle Meck — mulle.js host')
  console.log('  languages: ' + (built.length ? built.map(l => l.code).join(', ') : 'none built') +
    '  (default ' + DEFAULT_LANG + ')')
  console.log('')
  console.log('  local:   http://localhost:' + PORT + '/')
  const lan = lanAddresses()
  for (const ip of lan) console.log('  network: http://' + ip + ':' + PORT + '/')

  if (lan.length) {
    console.log('\n  Scan on your phone (same Wi-Fi):\n')
    qrcode.generate('http://' + lan[0] + ':' + PORT + '/', { small: true })
  }

  const missing = LANGUAGES.filter(l => !isBuilt(l.code)).map(l => l.code)
  if (!built.length) {
    console.log('\n  ⚠ nothing built yet — run scripts/build.sh')
  } else if (missing.length) {
    console.log('\n  not built: ' + missing.join(', ') + '  (scripts/build.sh ' + missing.join(' ') + ')')
  }
  console.log('')
})
