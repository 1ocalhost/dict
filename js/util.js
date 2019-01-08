/* global chrome XMLHttpRequest */
((global) => {
  'use strict'

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

    isXmlDoc (type) {
      return [
        'application/xml',
        'application/rss+xml',
        'application/atom+xml'
      ].some(x => x === type)
    }
  }

  const util = new Util({ debug: true })
  global.mmJsOrgUtil = util

  if (util.isXmlDoc(document.contentType)) {
    document.createElement = function (tagName) {
      const ns = 'http://www.w3.org/1999/xhtml'
      return document.createElementNS(ns, tagName)
    }
  }
})(this)
