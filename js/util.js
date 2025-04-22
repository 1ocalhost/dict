/* global chrome */
((global) => {
  'use strict'

  class Util {
    constructor (obj) {
      this.param = { debug: this.isDevMode() }
      this.module = {}
      this.runApp = false
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
      this.module.fallback.lookup(word)
    }

    fetchRes (path) {
      return this.fetchUrl(chrome.runtime.getURL(path))
    }

    fetchUrl (url, hook) {
      return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({
          contentScriptQuery: 'fetchUrl',
          url
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

    arrayHas (array, item) {
      return array.some(x => x === item)
    }
  }

  const util = new Util()
  global.util = util

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

  this.runApp = true
})(this)
