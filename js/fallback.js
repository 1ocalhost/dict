/* global mmJsOrgUtil Vue */
(() => {
  'use strict'

  const util = mmJsOrgUtil

  class Fallback {
    constructor () {
      this.rootId = 'mmJsOrg-message'
      this.youdao = util.module.youdao()
      this._init()
    }

    async _init () {
      const res = await util.fetchRes('html/fallback.html')
      this._injectHtml(res)
      this.view = new Vue({
        el: `#${this.rootId}`,
        data: {
          obj: [],
          maxHeight: 0
        }
      })
    }

    _injectHtml (template) {
      let div = document.createElement('div')
      div.innerHTML = template.replace('$rootId', this.rootId)
      document.body.appendChild(div)
    }

    _show (text) {
      this.view.obj = text
      this.view.maxHeight = 500
    }

    async lookup (word) {
      if (word.length > 66) {
        this._show(['Selection is too long :( '])
        return
      }

      const data = await this.youdao.lookup(word)
      this._show([`${data.word} [${data.phonetic}]`]
        .concat(data.basicExplain))
    }
  }

  util.shared.fallback = new Fallback()
})()
