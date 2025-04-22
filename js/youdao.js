/* global DOMParser */
(global => {
  'use strict'

  class YoudaoXmlParser {
    constructor (xml) {
      this.root = (new DOMParser())
        .parseFromString(xml, 'application/xml')
    }

    parse () {
      const result = {
        word: this.parseWord(),
        phonetic: this.parsePhonetic(),
        basicExplain: this.parseBasicExplain(),
        webExplain: this.parseWebExplain()
      }

      if (!result.basicExplain.length &&
        !result.webExplain.length) {
        return {
          word: 'Unknown word',
          phonetic: null,
          basicExplain: [],
          webExplain: null
        }
      }

      return result
    }

    fromCData (el) {
      return el.innerHTML.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '')
    }

    parseWord () {
      return this.fromCData(this.root.getElementsByTagName('return-phrase')[0])
    }

    parsePhonetic () {
      const elPhonetic = this.root.getElementsByTagName('phonetic-symbol')
      if (elPhonetic.length) {
        return elPhonetic[0].innerHTML
      }

      return null
    }

    parseBasicExplain () {
      const elCustomTrans = this.root.getElementsByTagName('custom-translation')
      if (elCustomTrans.length) {
        return [...elCustomTrans[0].getElementsByTagName('content')]
          .map(x => this.fromCData(x))
      }

      return []
    }

    parseWebExplain () {
      return [...this.root.getElementsByTagName('web-translation')].map(x => {
        return {
          en: this.fromCData(x.getElementsByTagName('key')[0]),
          cn: [...x.getElementsByTagName('value')].map(y => this.fromCData(y))
        }
      })
    }
  }

  class YoudaoDict {
    constructor () {
      this.meaningCache = {}
    }

    async lookup (word) {
      if (Object.hasOwn(this.meaningCache, word)) {
        global.util.log('Cache hit: ' + word)
        return this.meaningCache[word]
      }

      const url = 'https://dict.youdao.com/fsearch?xmlVersion=3.2&q=' +
          encodeURI(word.toLocaleLowerCase())
      global.util.log(`query: ${url}`)

      return global.util.fetchUrl(url, x => {
        const data = (new YoudaoXmlParser(x)).parse()
        this.meaningCache[word] = data
        return data
      })
    }
  }

  global.util.module.youdao = () => new YoudaoDict()
})(window)
