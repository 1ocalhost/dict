/* global Vue */
(global => {
  'use strict'

  class Fallback {
    constructor () {
      this.youdao = global.util.module.youdao()
      this.inited = false
    }

    async _init () {
      const res = await global.util.fetchRes('html/fallback.html')
      const el = this._injectHtml(res)
      this.view = new Vue({
        el,
        data: {
          obj: [],
          maxHeight: 0
        }
      })
    }

    _injectHtml (template) {
      const host = document.createElement('div')
      document.documentElement.appendChild(host)
      const root = host.attachShadow({ mode: 'open' })

      const el = document.createElement('div')
      el.innerHTML = template
      root.appendChild(el)
      return el
    }

    _show (text) {
      this.view.obj = text
      this.view.maxHeight = 500
    }

    async lookup (word) {
      if (!this.inited) {
        await this._init()
        this.inited = true
      }

      if (word.length > 66) {
        this._show(['Selection is too long :( '])
        return
      }

      const data = await this.youdao.lookup(word)
      this._show([`${data.word} [${data.phonetic}]`]
        .concat(data.basicExplain))
    }
  }

  global.util.module.fallback = new Fallback()
})(window)
