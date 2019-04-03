/* global chrome */
((global) => {
  'use strict'

  class Util {
    constructor (obj) {
      this.dependencyLoaded = {}
      this.param = { debug: this.isDevMode() }
      this.module = {}
      this.shared = {}
    }

    isDevMode () {
      return !('update_url' in chrome.runtime.getManifest())
    }

    log (x) {
      if (this.param.debug) {
        console.log(x)
      }
    }

    async fallbackLookup (word) {
      await this.tryLoadDependency('js/fallback.js')
      this.shared.fallback.lookup(word)
    }

    async tryLoadDependency (jsFile) {
      if (this.dependencyLoaded.hasOwnProperty(jsFile)) {
        return
      }

      await this.dynamicImport('js/youdao.js')
      await this.dynamicImport('js/third_party/vue??.js')
      await this.dynamicImport(jsFile)
      this.dependencyLoaded[jsFile] = true
    }

    async dynamicImport (path) {
      path = path.replace('??', this.param.debug ? '_d' : '')
      const code = await this.fetchRes(path);
      (function () {
        // eslint-disable-next-line no-eval
        eval(code)
      // eslint-disable-next-line no-extra-bind
      }).bind(global)()
    }

    fetchRes (path) {
      return this.fetchUrl(chrome.runtime.getURL(path))
    }

    fetchUrl (url, hook) {
      return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({
          contentScriptQuery: 'fetchUrl',
          url: url
        },
        onEnd.bind(null, ...arguments))
      })

      function onEnd (yes, no, text) {
        if (text === null) {
          no()
          return
        }

        yes(hook !== undefined ? hook(text) : text)
      }
    }

    isSelfOrDescendant (parent, child) {
      if (parent === child) {
        return true
      }

      let node = child.parentNode
      while (node !== null) {
        if (node === parent) {
          return true
        }
        node = node.parentNode
      }

      return false
    }

    arrayHas (array, item) {
      return array.some(x => x === item)
    }
  }

  const util = new Util()
  global.mmJsOrgUtil = util

  const blackList = [
    'application/pdf',
    'image/svg+xml'
  ]

  const pageType = document.contentType
  if (util.arrayHas(blackList, pageType)) {
    util.log(pageType)
    return
  }

  if (/(\/|\+)xml$/.test(pageType)) {
    document.createElement = function (tagName) {
      const ns = 'http://www.w3.org/1999/xhtml'
      return document.createElementNS(ns, tagName)
    }
  }

  util.tryLoadDependency('js/content.js')
})(this)
