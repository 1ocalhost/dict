/* global chrome XMLHttpRequest */
((global) => {
  'use strict'

  function isXmlDoc (type) {
    return [
      'application/xml',
      'application/rss+xml',
      'application/atom+xml'
    ].some(x => x === type)
  }

  if (isXmlDoc(document.contentType)) {
    document.createElement = function (tagName) {
      const ns = 'http://www.w3.org/1999/xhtml'
      return document.createElementNS(ns, tagName)
    }
  }

  class Util {
    constructor (obj) {
      this.param = obj
      this.module = {}
      this.shared = {}
    }

    log (x) {
      if (this.param.debug) {
        console.log(x)
      }
    }

    fetchRes (path) {
      return this.fetch(chrome.runtime.getURL(path))
    }

    fetch (url, hook) {
      return new Promise(function (resolve, reject) {
        var xhttp = new XMLHttpRequest()
        xhttp.onreadystatechange = onEnd.bind(xhttp, ...arguments)
        xhttp.open('GET', url, true)
        xhttp.send()
      })

      function onEnd (yes, no) {
        if (this.readyState === 4) {
          if (this.status === 200) {
            const text = this.responseText
            yes(hook !== undefined ? hook(text) : text)
            return
          }

          no()
        }
      }
    }
  }

  global.mmJsOrgUtil = new Util({ debug: true })
})(this)
