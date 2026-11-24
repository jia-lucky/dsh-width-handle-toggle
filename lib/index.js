import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const WIDGET_PATH = join(here, 'widget.js')
const DIAG_PATH = join(root, 'diag.log')
const REV_PATH = join(root, 'rev.txt')
const BASE = '/dsh-width-handle-toggle'
const ROUTE_WIDGET = BASE + '/widget.js'
const ROUTE_DIAG = BASE + '/diag'
const ROUTE_META = BASE + '/meta'

/** Developer-only diagnostics: diag sink and the reload revision poll. */
const DEBUG = process.env.DSH_WIDTH_HANDLE_DEBUG === '1'

/**
 * Inline bootstrap row. Runs on every page load and pulls widget.js from the
 * host route, so a widget edit only needs a page reload — never a host restart.
 * Inline (not script-src) on purpose: the desktop shell only applies
 * `webserver/index-inject` rows, and a failing script-src row would reject
 * `__DSH_BOOT_READY__` and take the whole app down with it.
 */
const LOADER =
  '(function(){try{' +
  'if(document.querySelector("script[data-dsh-width-handle-toggle]"))return;' +
  'var d=document.body||document.documentElement;if(!d)return;' +
  'var s=document.createElement("script");s.src="' + ROUTE_WIDGET + '";s.async=true;' +
  's.setAttribute("data-dsh-width-handle-toggle","");s.onerror=function(){};d.appendChild(s)' +
  '}catch(e){}})()'

/** Reject cross-site and foreign-origin readers of the plugin's routes. */
function rejectionOf(req) {
  const headers = req && req.headers ? req.headers : {}
  const site = headers['sec-fetch-site']
  if (typeof site === 'string' && site.toLowerCase() === 'cross-site') return true
  const origin = headers.origin
  if (typeof origin !== 'string' || origin === '') return false
  const host = headers.host
  if (typeof host !== 'string' || host === '') return true
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

function send(res, code, text, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(text)
}

function readRev() {
  try {
    const value = Number(readFileSync(REV_PATH, 'utf8').trim())
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function appendDiag(text) {
  try { return appendFileSync(DIAG_PATH, text + '\n') } catch { return undefined }
}

export default {
  name: 'dsh-width-handle-toggle',
  apply(ctx) {
    const disposers = []
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { dispose() } catch {}
      }
    })

    ctx.on('webserver/index-inject', (table) => {
      const rows = table || []
      for (const row of rows) {
        if (row && typeof row.text === 'string' && row.text.indexOf('dsh-width-handle-toggle') !== -1) return
      }
      rows.push({ kind: 'script', placement: 'body', text: LOADER })
    })

    ctx.inject(['webServer'], (web) => {
      const register = (path, handler) => {
        disposers.push(web.webServer.register({ kind: 'exact', path, handler }))
      }

      register(ROUTE_WIDGET, (req, res) => {
        if (rejectionOf(req)) return send(res, 403, 'forbidden')
        let js
        try { js = readFileSync(WIDGET_PATH, 'utf8') } catch { return send(res, 404, 'widget missing') }
        send(res, 200, js, 'application/javascript; charset=utf-8')
      })

      if (!DEBUG) return

      register(ROUTE_META, (req, res) => {
        if (rejectionOf(req)) return send(res, 403, 'forbidden')
        send(res, 200, JSON.stringify({ rev: readRev() }), 'application/json; charset=utf-8')
      })

      register(ROUTE_DIAG, (req, res) => {
        if (rejectionOf(req)) return send(res, 403, 'forbidden')
        const url = String(req.url || '')
        const at = url.indexOf('?d=')
        if (at !== -1) {
          let text = url.slice(at + 3)
          try { text = decodeURIComponent(text) } catch {}
          appendDiag(text)
          res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' })
          res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'))
          return
        }
        if (req.method !== 'POST') return send(res, 405, 'post only')
        const chunks = []
        req.on('data', (chunk) => { chunks.push(chunk) })
        req.on('end', () => {
          appendDiag(Buffer.concat(chunks).toString('utf8'))
          send(res, 204, '')
        })
        req.on('error', () => send(res, 400, 'bad request'))
      })
    })
  }
}
