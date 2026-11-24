/* dsh-width-handle-toggle: transcript / composer widths applied along the inherited var chain. */
;(function () {
  'use strict'
  var win = window
  if (win.__dshWht) return
  win.__dshWht = true
  win.__dshWidthHandleToggle = true

  var BEACON_PATH = '/dsh-width-handle-toggle/diag'
  var DEBUG = false
  function beacon(tag, extra) {
    if (!DEBUG && !win.__dshWhtDebug) return
    try {
      var payload = { tag: tag, at: Date.now(), iw: win.innerWidth, ih: win.innerHeight }
      if (extra) { for (var k in extra) { if (!(k in payload)) payload[k] = extra[k] } }
      var img = new Image()
      img.onerror = function () {}
      img.src = BEACON_PATH + '?d=' + encodeURIComponent(JSON.stringify(payload)) + '&n=' + Date.now()
    } catch (e) {}
  }
  win.__dshWhtBeacon = beacon
  win.addEventListener('error', function (ev) {
    try { beacon('winerr', { m: String(ev.message || '').slice(0, 240), ln: ev.lineno }) } catch (e) {}
  })

  var ON_KEY = 'dsh.conversation.widthHandles'
  var TRANSCRIPT_KEY = 'dsh.conversation.contentWidth'
  var COMPOSER_KEY = 'dsh.conversation.composerWidth'
  var MIGRATE_KEY = 'dsh.conversation.widthHandles.v8'
  var CONTENT_MIN = 560
  var CONTENT_EDGE_BUDGET = 96
  var GUTTER = 12
  var STRIP_W = 12
  var MIN_REGION = 40

  function readNumber(key) {
    try {
      var raw = localStorage.getItem(key)
      if (raw === null) return null
      var value = Number(raw)
      return isFinite(value) && value > 0 ? value : null
    } catch (e) { return null }
  }
  function writeNumber(key, value) {
    try { localStorage.setItem(key, String(Math.round(value))) } catch (e) {}
  }
  function enabled() {
    try { return localStorage.getItem(ON_KEY) === 'on' } catch (e) { return false }
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi) }
  function q(sel) { try { return document.querySelector(sel) } catch (e) { return null } }
  function r4(el) {
    if (!el || !el.getBoundingClientRect) return null
    var b = el.getBoundingClientRect()
    return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]
  }
  function cls(el) { return el ? String(el.className || '').slice(0, 50) : null }
  function numPx(value) {
    if (!value) return null
    var m = String(value).match(/(-?[0-9]+(?:\.[0-9]+)?)px/)
    if (!m) return null
    var n = parseFloat(m[1])
    return isFinite(n) && n > 0 ? n : null
  }
  function varPx(el, name) {
    if (!el) return null
    try { return numPx(getComputedStyle(el).getPropertyValue(name)) } catch (e) { return null }
  }

  /* Drop width prefs written by earlier broken builds so nothing starts distorted. */
  try {
    if (localStorage.getItem(MIGRATE_KEY) !== '1') {
      localStorage.removeItem(COMPOSER_KEY)
      localStorage.removeItem(TRANSCRIPT_KEY)
      localStorage.setItem(MIGRATE_KEY, '1')
    }
  } catch (e) {}

  var style = document.createElement('style')
  style.textContent = [
    'html[data-dsh-wh] [data-width-handle]{pointer-events:none!important}',
    '.dsh-wht-layer{position:fixed;inset:0;z-index:2147483000;pointer-events:none}',
    '.dsh-wht-strip{position:fixed;width:' + STRIP_W + 'px;pointer-events:auto;cursor:col-resize;touch-action:none;display:none}',
    '.dsh-wht-strip::after{content:"";position:absolute;top:0;bottom:0;left:50%;margin-left:-1px;width:2px;border-radius:2px;background:var(--dsw-alias-scrollbar-bg-l1,rgba(128,128,128,.5));opacity:.32;transition:opacity .12s ease}',
    '.dsh-wht-strip:hover::after,.dsh-wht-strip[data-dragging]::after{opacity:.88}'
  ].join('')
  ;(document.head || document.documentElement).appendChild(style)
  document.documentElement.setAttribute('data-dsh-wh', '')

  var layer = null
  var strips = {}

  function ensureLayer() {
    if (layer && layer.isConnected) return layer
    layer = document.createElement('div')
    layer.className = 'dsh-wht-layer'
    document.body.appendChild(layer)
    return layer
  }
  function makeStrip(region) {
    var el = document.createElement('div')
    el.className = 'dsh-wht-strip'
    el.setAttribute('data-region', region)
    el.addEventListener('pointerdown', function (ev) { startDrag(ev, el, region) })
    el.addEventListener('wheel', forwardWheel, { passive: false })
    ensureLayer().appendChild(el)
    return el
  }
  function strip(region) { return strips[region] || (strips[region] = makeStrip(region)) }
  function forwardWheel(ev) {
    if (ev.ctrlKey || ev.deltaY === 0) return
    var scrollport = q('[data-conversation-scroll]')
    if (!scrollport) return
    ev.preventDefault()
    scrollport.scrollBy({ top: ev.deltaY })
  }

  /* Ancestors that can carry the inherited width variables. */
  function chainOf(el) {
    var out = []
    var node = el
    var guard = 0
    while (node && node !== document.documentElement && guard < 40) {
      out.push(node)
      if (node === document.body) break
      node = node.parentElement
      guard++
    }
    return out
  }

  function varChain(content, seat, scroll) {
    var out = []
    var lists = [chainOf(content), chainOf(seat), chainOf(scroll)]
    for (var i = 0; i < lists.length; i++) {
      for (var j = 0; j < lists[i].length; j++) {
        var el = lists[i][j]
        if (el && out.indexOf(el) === -1) out.push(el)
      }
    }
    return out
  }

  /* Composer card: the wrapper whose max-width already tracks the composer variable. */
  function findCard(seat) {
    if (!seat) return null
    var seatRect = seat.getBoundingClientRect()
    if (seatRect.width < 120) return null
    var nodes = seat.querySelectorAll('div')
    var best = null
    var bestArea = 0
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      var rect = el.getBoundingClientRect()
      if (rect.width < 180 || rect.height < 28) continue
      var maxw = numPx(getComputedStyle(el).maxWidth)
      if (!maxw) continue
      var area = rect.width * rect.height
      if (area > bestArea) { bestArea = area; best = el }
    }
    return best
  }

  function measure() {
    var content = q('[data-conversation-content]')
    var seat = q('[data-composer-seat]')
    var scroll = q('[data-conversation-scroll]')
    if (!content && !seat) return null
    var host = content || seat
    var column = varPx(host, '--dsh-conversation-column-width')
    if (!column) column = document.body ? document.body.offsetWidth : win.innerWidth
    if (!column || column < 200) return null
    var max = Math.max(CONTENT_MIN, column - CONTENT_EDGE_BUDGET)
    var contentRect = content ? content.getBoundingClientRect() : null
    var card = findCard(seat)
    var cardRect = card ? card.getBoundingClientRect() : null
    var tBase = varPx(host, '--dsh-chat-content-width')
    if (!tBase) tBase = contentRect ? Math.min(contentRect.width, column) : column * 0.8
    var cBase = card ? numPx(getComputedStyle(card).maxWidth) : null
    if (!cBase && cardRect) cBase = cardRect.width
    if (!cBase) cBase = tBase
    var tPref = readNumber(TRANSCRIPT_KEY)
    var cPref = readNumber(COMPOSER_KEY)
    var tW = clamp(tPref === null ? tBase : tPref, CONTENT_MIN, max)
    var cW = clamp(cPref === null ? cBase : cPref, CONTENT_MIN, max)
    return {
      content: content, seat: seat, scroll: scroll, card: card, cardRect: cardRect, contentRect: contentRect,
      column: column, max: max, chain: varChain(content, seat, scroll),
      tBase: tBase, cBase: cBase, tW: tW, cW: cW, tPref: tPref, cPref: cPref
    }
  }

  function setVar(el, name, value) {
    try {
      if (value === null) { if (el.style.getPropertyValue(name) !== '') el.style.removeProperty(name) }
      else if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value)
    } catch (e) {}
  }

  function applyWidths(m) {
    var tVal = m.tPref === null ? null : Math.round(m.tW) + 'px'
    var cVal = m.cPref === null ? null : Math.round(m.cW) + 'px'
    for (var i = 0; i < m.chain.length; i++) {
      setVar(m.chain[i], '--dsh-chat-user-width', tVal)
      setVar(m.chain[i], '--dsh-composer-card-max-width', cVal)
    }
    if (m.card) {
      if (cVal === null) { if (m.card.style.maxWidth) m.card.style.removeProperty('max-width') }
      else m.card.style.setProperty('max-width', cVal, 'important')
    }
  }

  function hideAll() { for (var key in strips) strips[key].style.display = 'none' }

  var mutating = false
  var lastNote = ''
  var lastNoteKey = ''
  var lastNoteAt = 0
  function noteState(tag) {
    if (tag === lastNote) return
    var key = String(tag).split(':')[0]
    var now = Date.now()
    if (key === lastNoteKey && now - lastNoteAt < 400) return
    lastNote = tag
    lastNoteKey = key
    lastNoteAt = now
    beacon('state', { s: tag })
  }

  function layout() {
    mutating = true
    requestAnimationFrame(function () { mutating = false })
    var m = null
    try { m = measure() } catch (e) { m = null }
    if (!m) { hideAll(); noteState('hide-no-measure'); return }
    try { applyWidths(m) } catch (e) {}
    if (!enabled() || q('[data-conversation-composer-overlay]')) {
      hideAll()
      noteState(enabled() ? 'hide-overlay' : 'hide-off')
      return
    }
    var cardRect = m.cardRect
    var contentRect = m.contentRect
    var viewportH = win.innerHeight
    var rows = [];
    var nativeHandle = q('[data-width-handle][data-side="left"]')
    var nativeRect = nativeHandle ? nativeHandle.getBoundingClientRect() : null
    var tLeft = nativeRect && nativeRect.width > 0
      ? nativeRect.left + nativeRect.width / 2
      : (contentRect ? contentRect.left + Math.max(0, (contentRect.width - m.tW) / 2) - GUTTER : null)
    if (tLeft !== null) {
      var tTop = nativeRect && nativeRect.height > 20 ? nativeRect.top + 6 : (contentRect ? contentRect.top : 0)
      var tBottom = cardRect ? cardRect.top - 8 : (nativeRect ? nativeRect.bottom : viewportH)
      rows.push({ region: 'transcript', x: tLeft - STRIP_W / 2, top: tTop, height: tBottom - tTop });
    }
    if (cardRect) rows.push({ region: 'composer', x: cardRect.left - GUTTER - STRIP_W / 2, top: cardRect.top, height: cardRect.height });
    var seen = {}
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]
      var el = strip(row.region)
      seen[row.region] = true
      if (!(row.height > MIN_REGION) || row.top > viewportH) { el.style.display = 'none'; continue }
      el.style.display = 'block'
      el.style.left = Math.round(clamp(row.x, 0, win.innerWidth - STRIP_W)) + 'px'
      el.style.top = Math.round(clamp(row.top, 0, viewportH)) + 'px'
      el.style.height = Math.round(Math.min(row.height, viewportH - row.top)) + 'px'
    }
    for (var key in strips) if (!seen[key]) strips[key].style.display = 'none'
    noteState('show:' + rows.length + ':' + Math.round(m.tW) + ':' + Math.round(m.cW))
  }

  var drag = null
  function startDrag(ev, el, region) {
    if (ev.button !== 0) return
    var m = null
    try { m = measure() } catch (e) { return }
    if (!m) return
    if (region === 'transcript' && m.cPref === null && m.cardRect) writeNumber(COMPOSER_KEY, Math.round(m.cW))
    if (region === 'composer' && m.tPref === null) writeNumber(TRANSCRIPT_KEY, Math.round(m.tW))
    drag = {
      region: region,
      originX: ev.clientX,
      base: region === 'transcript' ? m.tW : m.cW,
      max: m.max
    }
    el.setAttribute('data-dragging', '')
    try { el.setPointerCapture(ev.pointerId) } catch (e) {}
    ev.preventDefault()
    beacon('drag-start', { r: region, base: Math.round(drag.base), max: Math.round(m.max) });
  }
  function endDrag() {
    if (!drag) return
    var ended = drag.region
    drag = null
    for (var key in strips) strips[key].removeAttribute('data-dragging')
    beacon('drag-end', { r: ended })
    schedule()
  }
  win.addEventListener('pointermove', function (ev) {
    if (!drag) return
    var width = clamp(Math.round(drag.base + (drag.originX - ev.clientX) * 2), CONTENT_MIN, drag.max)
    writeNumber(drag.region === 'transcript' ? TRANSCRIPT_KEY : COMPOSER_KEY, width)
    schedule()
  }, true)
  win.addEventListener('pointerup', endDrag, true)
  win.addEventListener('pointercancel', endDrag, true)
  win.addEventListener('blur', endDrag, false)

  var pending = 0
  function schedule() {
    if (pending) return
    pending = requestAnimationFrame(function () {
      pending = 0
      try { layout() } catch (e) { beacon('layerr', { m: String(e && e.message) }) }
    })
  }

  function diag(tag) {
    var out = { tag: tag }
    try {
      var m = measure()
      if (m) {
        out.column = Math.round(m.column)
        out.max = Math.round(m.max)
        out.tBase = Math.round(m.tBase)
        out.cBase = Math.round(m.cBase)
        out.tW = Math.round(m.tW)
        out.cW = Math.round(m.cW)
        out.prefs = { t: m.tPref, c: m.cPref }
        out.chainLen = m.chain.length;
        out.contentRect = r4(m.content);
        out.cardRect = r4(m.card);
        out.cardCls = cls(m.card);
        out.activeContent = m.content ? varPx(m.content, '--dsh-chat-content-width') : null;
        out.activeCardMax = m.card ? numPx(getComputedStyle(m.card).maxWidth) : null;
      } else out.measure = null;
      out.strips = {};
      for (var key in strips) out.strips[key] = { d: strips[key].style.display, r: r4(strips[key]) };
      out.on = enabled();
      out.overlay = !!q('[data-conversation-composer-overlay]');
    } catch (e) { out.err = String(e && e.message) }
    beacon(tag, out);
  }
  win.__dshWhtDiag = diag;

  var revBaseline = null;
  function pollRev() {
    fetch('/dsh-width-handle-toggle/meta', { cache: 'no-store' }).then(function (res) {
      return res.json()
    }).then(function (data) {
      var rev = data && typeof data.rev === 'number' ? data.rev : 0;
      if (revBaseline === null) { revBaseline = rev; return }
      if (rev > revBaseline) { revBaseline = rev; location.reload() }
    }).catch(function () {}).then(function () {
      setTimeout(pollRev, 1500)
    })
  }

  function boot() {
    try { bootInner() } catch (e) { beacon('booterr', { m: String(e && e.message) }) }
  }
  function bootInner() {
    layout()
    var lastOn = enabled()
    setInterval(function () {
      var now = enabled()
      if (now !== lastOn) { lastOn = now; schedule() }
    }, 400)
    win.addEventListener('dsh-width-handles-change', function () { schedule() })
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () { schedule() })
      var seat = q('[data-composer-seat]')
      if (seat) ro.observe(seat)
      var content = q('[data-conversation-content]')
      if (content) ro.observe(content)
    }
    new MutationObserver(function () { if (!mutating) schedule() }).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-phase']
    })
    win.addEventListener('resize', schedule)
    win.addEventListener('scroll', schedule, true)
    setTimeout(schedule, 200)
    setTimeout(schedule, 900)
    setTimeout(schedule, 2500)
    setTimeout(function () { diag('t5000') }, 5000)
    if (DEBUG || win.__dshWhtDebug) setTimeout(pollRev, 800)
    beacon('boot-ok')
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()