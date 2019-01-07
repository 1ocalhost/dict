/* global */
(() => {
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
})()
