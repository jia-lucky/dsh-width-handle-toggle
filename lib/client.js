window.__ModuleLoader__.load({
  id: 'dsh-width-handle-toggle',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var NAME = 'dsh-width-handle-toggle'
    var STORE_KEY = 'dsh.conversation.widthHandles'
    var CHANGE_EVENT = 'dsh-width-handles-change'
    var SLOT_NAME = 'settings.section'
    var SLOT_ORDER = 52
    var inject = ['slots']

    function readOn() {
      try { return window.localStorage.getItem(STORE_KEY) === 'on' } catch (e) { return false }
    }
    function writeOn(on) {
      try { window.localStorage.setItem(STORE_KEY, on ? 'on' : 'off') } catch (e) {}
      try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)) } catch (e) {}
    }

    var h = react.createElement
    var ZH = (function () { try { return String(navigator.language || '').toLowerCase().indexOf('zh') === 0 } catch (e) { return true } })()
    function T(zh, en) { return ZH ? zh : en }

    function ToggleRow() {
      var state = react.useState(readOn())
      var on = state[0]
      var setOn = state[1]
      react.useEffect(function () {
        function sync() { setOn(readOn()) }
        window.addEventListener(CHANGE_EVENT, sync)
        window.addEventListener('storage', sync)
        return function () {
          window.removeEventListener(CHANGE_EVENT, sync)
          window.removeEventListener('storage', sync)
        }
      }, [])
      var track = {
        position: 'relative', flex: 'none', width: '38px', height: '22px', padding: '0',
        borderRadius: '11px', cursor: 'pointer', transition: 'background .15s ease',
        border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
        background: on
          ? 'var(--dsw-alias-brand-primary, var(--dsw-alias-accent-primary, #4d6bfe))'
          : 'var(--dsw-alias-bg-l3, rgba(128,128,128,.2))'
      }
      var knob = {
        position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px',
        borderRadius: '50%', background: '#fff', pointerEvents: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,.28)', transition: 'left .15s ease'
      }
      return h('div', {
        style: {
          display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '14px 0',
          borderTop: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.16))'
        }
      },
        h('div', { style: { flex: '1 1 auto', minWidth: '0' } },
          h('div', { style: { fontSize: '13px', fontWeight: 500, lineHeight: '20px' } }, T('对话宽度手柄', 'Chat width handles')),
          h('div', {
            style: {
              marginTop: '4px', fontSize: '12px', lineHeight: '18px',
              color: 'var(--dsw-alias-label-secondary, rgba(128,128,128,.95))'
            }
          }, T('打开后，聊天区和输入框左侧各出现一条竖线，可分别拖动调整两者宽度；关闭时完全隐藏。', 'Shows one drag rail beside the transcript and one beside the composer so each width can be adjusted independently. Hidden while off.'))
        ),
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': on ? 'true' : 'false',
          title: on ? T('关闭', 'Turn off') : T('打开', 'Turn on'),
          onClick: function () {
            var next = !readOn()
            writeOn(next)
            setOn(next)
          },
          style: track
        }, h('span', { style: knob }))
      )
    }

    function apply(context) {
      var slots = context.get('slots')
      if (slots === undefined) return
      try {
        slots.inject(SLOT_NAME, function () {
          return slots.register({
            name: SLOT_NAME,
            id: NAME,
            order: SLOT_ORDER,
            label: function () { return T('对话宽度', 'Chat width') }
          }, function () { return h(ToggleRow) })
        })
      } catch (error) {
        try { console.warn('dsh-width-handle-toggle: register settings.section failed:', error) } catch (e) {}
      }
    }

    exports.name = NAME
    exports.inject = inject
    exports.apply = apply
    return module.exports
  }
})