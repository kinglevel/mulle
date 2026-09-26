/**
 * Node.js host for mulle.js — "Byg bil med Mulle Meck".
 *
 * Serves the webpack build in ../vendor/mulle.js/dist plus the extracted game
 * assets in ../vendor/mulle.js/assets_<lang>, with a mobile-first HTML shell
 * from ./public layered on top so the 640x480 Phaser canvas fills a phone screen.
 */

const express = require('express')
const compression = require('compression')
const path = require('path')
const fs = require('fs')
const os = require('os')
const qrcode = require('qrcode-terminal')

const PORT = parseInt(process.env.PORT || '8090', 10)
const HOST = process.env.HOST || '0.0.0.0'
const GAME_LANG = process.env.GAME_LANG || 'da'

const ROOT = path.resolve(__dirname, '..')
const GAME = process.env.MULLE_JS_DIR
  ? path.resolve(process.env.MULLE_JS_DIR)
  : path.join(ROOT, 'vendor', 'mulle.js')
const DIST = path.join(GAME, 'dist')
const ASSETS = path.join(GAME, `assets_${GAME_LANG}`)
const PUBLIC = path.join(__dirname, 'public')

const app = express()
app.disable('x-powered-by')

// Atlas JSON and the bundle compress extremely well; PNGs are skipped
// automatically. This is the single biggest win over a mobile connection.
app.use(compression({ level: 6 }))

// Game data never changes once built, so let phones cache it hard. The HTML
// shell must not be cached, otherwise edits to it never reach the device.
const immutable = {
  maxAge: '30d',
  immutable: true,
  setHeaders (res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store')
    }
  }
}

// 1. Our mobile shell wins over anything with the same name in dist/.
app.use(express.static(PUBLIC, { maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') }))

// 2. The webpack build: bundle.js, phaser.min.js, style.css, loading.png,
//    ui/, data/, info/, progress/ and assets/topography.
app.use(express.static(DIST, immutable))

// 3. Spritesheets extracted from the ISO. The Docker image merges these into
//    the same /assets path as dist/assets, so mount both — first match wins.
app.use('/assets', express.static(ASSETS, immutable))
app.use('/assets', express.static(path.join(DIST, 'assets'), immutable))

app.get('/healthz', (req, res) => {
  const built = fs.existsSync(path.join(DIST, 'bundle.js'))
  const assets = fs.existsSync(ASSETS)
  res.status(built && assets ? 200 : 503).json({
    ok: built && assets,
    lang: GAME_LANG,
    bundle: built,
    assets
  })
})

// Anything unmatched is a missing asset, not a route — a 404 is more useful
// than serving index.html, which would silently mask broken asset paths.
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

function preflight () {
  const problems = []
  if (!fs.existsSync(path.join(DIST, 'bundle.js'))) problems.push('missing dist/bundle.js — run the build (npm run build in mulle.js)')
  if (!fs.existsSync(path.join(DIST, 'phaser.min.js'))) problems.push('missing dist/phaser.min.js')
  if (!fs.existsSync(path.join(DIST, 'style.css'))) problems.push('missing dist/style.css — run: npx sass src/style.scss dist/style.css')
  if (!fs.existsSync(ASSETS)) problems.push(`missing assets_${GAME_LANG}/ — run the asset extraction step`)
  return problems
}

app.listen(PORT, HOST, () => {
  const problems = preflight()
  console.log('')
  console.log('  Byg bil med Mulle Meck — mulle.js host')
  console.log('  language: ' + GAME_LANG)
  console.log('')
  console.log('  local:   http://localhost:' + PORT + '/')
  const lan = lanAddresses()
  for (const ip of lan) console.log('  network: http://' + ip + ':' + PORT + '/')

  if (lan.length) {
    console.log('\n  Scan on your phone (same Wi-Fi):\n')
    qrcode.generate('http://' + lan[0] + ':' + PORT + '/', { small: true })
  }

  if (problems.length) {
    console.log('\n  ⚠ build incomplete:')
    for (const p of problems) console.log('    - ' + p)
  }
  console.log('')
})
