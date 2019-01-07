/* global DOMParser XMLHttpRequest MouseEvent Vue */
(() => {
  'use strict'
  const kScopePrefix = 'mmJsOrg-'
  const kIsDebug = true

  function _log (x) {
    if (kIsDebug) {
      console.log(x)
    }
  }

  function addScopePrefix (sel, prefix) {
    return sel.replace(/([.#])([^.#]+)/g, `$1${prefix}$2`)
  }

  class JustNowChecker {
    constructor () {
      this.lastState = null
      this.lastTime = 0
    }

    isJustNow (state) {
      let now = (new Date()).getTime()
      if (this.lastState === state) {
        if (now - this.lastTime < 1000) {
          this.lastTime = now
          return true
        }
      }

      this.lastState = state
      this.lastTime = now
      return false
    }
  }

  class YoudaoXmlParser {
    constructor (xml) {
      this.root = (new DOMParser())
        .parseFromString(xml, 'application/xml')
    }

    parse () {
      let result = {
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
      let elPhonetic = this.root.getElementsByTagName('phonetic-symbol')
      if (elPhonetic.length) {
        return elPhonetic[0].innerHTML
      }

      return null
    }

    parseBasicExplain () {
      let elCustomTrans = this.root.getElementsByTagName('custom-translation')
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

  class DictRes {
    inject () {
      const prefix = kScopePrefix
      let css = this.makeStyleScoped(this.styleRes(), prefix)
      let html = this.makeContentScoped(this.contentRes(), prefix)
      this.injectStyle(css)
      this.injectContent(html)
    }

    injectStyle (css) {
      let style = document.createElement('style')
      style.type = 'text/css'
      style.appendChild(document.createTextNode(css))
      document.documentElement.appendChild(style)
    }

    injectContent (html) {
      let div = document.createElement('div')
      div.innerHTML = html
      document.documentElement.appendChild(div)
    }

    addImportant (prop) {
      return prop.split(';').filter(x => x.match(/:/))
        .map(x => x + ' !important').join(';')
    }

    makeStyleScoped (css, prefix) {
      function addPrefix (sel) {
        return sel.split(',').map(
          x => addScopePrefix(x, prefix)).join(',')
      }

      return css.replace(/([^{]+)\{([^}]+)\}/g, ($0, $1, $2) => {
        return addPrefix($1) + '{' + this.addImportant($2) + '\n}'
      })
    }

    makeContentScoped (html, prefix) {
      html = html.replace(/@@/g, prefix)
        .replace(/([^:](id|class)=)"([^"]+)"/g, `$1"${prefix}$3"`)

      return html.replace(/([^:]style=)"([^"]+)"/g, ($0, $1, $2) => {
        return $1 + '"' + this.addImportant($2) + '"'
      })
    }

    styleRes () {
      return `
.hidden {
  opacity: .0;
  pointer-events: none;
}

#lookupBtn {
  display: inline-flex;
  z-index: 2147483647;
}

#lookupBtn,
#selectBoard,
#wordMeaning {
  position: absolute;
}

#selectBoard {
  z-index: 2147483645;
}

#wordMeaning {
  z-index: 2147483646;
  min-width: 200px;
  max-width: 300px;
  background: rgba(16, 16, 16, 0.86);
  border-radius: 3px;
  transition: opacity 0.2s;
}

#wordMeaning a {
  cursor: unset;
  text-decoration: none;
}

#selectBoard p,
#selectBoard a,
#wordMeaning p,
#wordMeaning a {
  margin: 0;
  padding: 0;
  word-spacing: normal;
  font-size: 13px;
  font-family: consolas, 'Microsoft YaHei';
  border: none;
}

#wordMeaning p,
#wordMeaning a {
  line-height: 18px;
}

#selectBoard a {
  line-height: 15px;
}

#lookupLab,
.wordSelectLeft {
  font-size: 0;
  line-height: 0;
}

#lookupLab {
  cursor: pointer;
  padding: 7px;
  border-radius: 5px;
  transition: background-color .15s ease-in-out, opacity 0.3s ease-in-out;
  user-select: none;
  background-color: #c8ced3;
  border-color: #c8ced3;
  opacity: 0.3;
}

#lookupLab:hover {
  background-color: #b3bbc2;
  border-color: #acb5bc;
  opacity: 1;
}

#lookupLab:active {
  background-color: #acb5bc;
  border-color: #a5aeb7
}

.wordSelectGroup {
  display: inline-flex;
  flex-direction: row-reverse;
  margin: 2px;
}

.wordSelectLeft {
  background-color: #525252;
  padding: 2px 4px 2px 5px;
  border-top-left-radius: 3px;
  border-bottom-left-radius: 3px;
}

.wordSelectRight {
  width: 5px;
  background-color: #d455a2;
  padding: 2px 5px 2px 2px;
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
  cursor: pointer;
}

.wordSelectRightGrayed {
  background-color: #737373;
}

.wordSelectGroup a[word]:hover {
  text-decoration: underline;
  cursor: pointer;
}

.wordSelectRight:hover + span {
  text-decoration: underline;
}

.wordSelectGroup a {
  user-select: none;
  color: #d6d6d6;
  text-decoration: none;
}`
    }

    fuck (html, id) {
      return this.makeContentScoped(`<div id="${id}" ${this.argBindPos()}>${html}</div>`, kScopePrefix)
    }

    templateLookupBtn () {
      const html = `
<label id="lookupLab" @click="show = false; send();" style="display:block;">
    <svg role="img" style="width:15px; height:15px;" viewBox="0 0 512 512">
        <path fill="#23282c" d="M505 442.7L405.3 343c-4.5-4.5-10.6-7-17-7H372c27.6-35.3 44-79.7 44-128C416 93.1 322.9 0 208
            0S0 93.1 0 208s93.1 208 208 208c48.3 0 92.7-16.4 128-44v16.3c0 6.4 2.5 12.5 7 17l99.7 99.7c9.4 9.4 24.6 9.4 33.9
            0l28.3-28.3c9.4-9.4 9.4-24.6.1-34zM208 336c-70.7 0-128-57.2-128-128 0-70.7 57.2-128 128-128 70.7 0 128 57.2 128
            128 0 70.7-57.2 128-128 128z">
        </path>
    </svg>
</label>
      `

      return this.fuck(html, 'lookupBtn')
    }

    templateWordMeaning () {
      const html = `
<div style="margin:7px 10px;" comment="for the box-sizing issue">
    <p style="margin-bottom:5px;">
        <a style="color: #809bbd;">{{obj.word}} </a>
        <a style="color: #a786a2;" v-if="obj.phonetic">[{{obj.phonetic}}]</a>
    </p>
    <div style="text-indent: -10px; padding-left: 10px;">
        <p style="color: #96b38a;" v-for="item in obj.basicExplain">{{item}}</p>
        <p style="color: #ddca7e;" v-for="item in obj.webExplain">{{item.en + ': ' + item.cn[0]}}</p>
    </div>
</div>
`
      return this.fuck(html, 'wordMeaning')
    }

    templateSelectBoard () {
      const html = `
<div style="margin:0 20px;" comment="for the box-sizing issue">
    <span class="wordSelectGroup" v-for="item in obj">
        <span class="wordSelectRight" @click="send($event, item)"
            v-bind:class="{'@@wordSelectRightGrayed': item.data.length < 2}"></span>
        <span class="wordSelectLeft">
            <span v-for="(word, index) in item.data">
                <a word @click="send($event, word)">{{word}}</a><a v-if="(item.separator !== '')
                    && (index+1 < item.data.length)">{{item.separator}}</a>
            </span>
        </span>
    </span>
</div>
`
      return this.fuck(html, 'selectBoard')
    }

    argBindPos () {
      return `v-bind:class="{'@@hidden':!show}" v-bind:style="{left:left+'px', top:top+'px'}"`
    }

    contentRes () {
      return `
<div id="lookupBtn"></div>
<div id="wordMeaning"></div>
<div id="selectBoard"></div>
`
    }
  }

  class PopupView {
    constructor (param, eleId, template, onSend) {
      if (onSend === undefined) {
        onSend = () => {}
      }

      let that = this
      this.param = param
      this.eleId = eleId
      this.view = new Vue({
        el: eleId,
        template: template,
        data: {
          show: false,
          obj: {},
          left: 0,
          top: 0,
          $delayedUpdate: false
        },
        methods: {
          send: onSend
        },
        updated: that._viewOnUpdated()
      })
    }

    _viewOnUpdated () {
      let that = this
      return function () {
        if (this.$data.$delayedUpdate) {
          this.$data.$delayedUpdate = false
          that._updateWidgetPos()
        }
      }
    }

    _viewPortSize () {
      let ele = (document.compatMode === 'BackCompat'
        ? 'body' : 'documentElement')

      return {
        width: document[ele].clientWidth,
        height: document[ele].clientHeight
      }
    }

    _widgetSize () {
      const kDecimalCompensator = 1
      let el = document.querySelector(this.eleId)
      return {
        width: el.offsetWidth + kDecimalCompensator,
        height: el.offsetHeight + kDecimalCompensator
      }
    }

    _updateWidgetPos () {
      const kMargin = 5
      const kGiveWayToPointer = 2

      let left = this.param.pos.x + kGiveWayToPointer
      let top = this.param.pos.y + kGiveWayToPointer
      let widget = this._widgetSize()
      let viewPort = this._viewPortSize()

      let overflow = left + widget.width - viewPort.width
      if (overflow > 0) {
        left = left - overflow - kMargin
      }

      overflow = top + widget.height - viewPort.height
      if (overflow > 0) {
        top = top - overflow - kMargin
      }

      this._setViewPos(
        left + window.scrollX,
        top + window.scrollY)
      this.view.show = true
    }

    _setViewPos (x, y) {
      this.view.left = x
      this.view.top = y
    }

    update (data) {
      this.hide()
      this._setViewPos(0, 0)
      this.view.$data.$delayedUpdate = true
      this.view.obj = data
    }

    show () {
      this._updateWidgetPos()
      this.view.show = true
    }

    hide () {
      this.view.show = false
    }
  }

  class DictView {
    constructor (prefix) {
      this.param = {}
      this.lookupBtnId = addScopePrefix('#lookupBtn', prefix)
      this.wordMeaningId = addScopePrefix('#wordMeaning', prefix)
      this.selectBoardId = addScopePrefix('#selectBoard', prefix)
      this.action = new LookupAction(this)

      this.lookupBtn = new PopupView(this.param, this.lookupBtnId,
        (new DictRes).templateLookupBtn(), () => {
          this.action.lookup()
        }
      )

      this.wordMeaning = new PopupView(this.param, this.wordMeaningId, (new DictRes).templateWordMeaning())
      this.selectBoard = new PopupView(this.param, this.selectBoardId,
        (new DictRes).templateSelectBoard(),
        this.onSelectBoardSend.bind(this, this.action)
      )
    }

    onSelectBoardSend (action, ev, msg) {
      let word = (typeof msg === 'string')
        ? msg : msg.data.join(msg.separator)

      let board = document.querySelector(this.selectBoardId)
      this.param.pos = {
        x: ev.clientX,
        y: board.offsetTop + board.offsetHeight - window.scrollY
      }
      action.lookupSpecifiedWord(word)
    }

    hideAllWidget () {
      [
        this.lookupBtn,
        this.wordMeaning,
        this.selectBoard
      ].forEach(x => x.hide())
    }
  }

  class LookupAction {
    constructor (view) {
      this.view = view
      this.meaningCache = {}
      this.wordToLookup = ''
      this.wordGroupToLookup = []
    }

    validSelectedText () {
      return document.getSelection().toString().trim()
    }

    prepareToLookup () {
      this.wordToLookup = ''
      this.wordGroupToLookup = []

      let selectedText = this.validSelectedText()
      if (!selectedText) {
        return false
      }

      return this.filterSelectedText(selectedText)
    }

    lookup () {
      if (this.wordToLookup) {
        this.lookupSpecifiedWord(this.wordToLookup)
      } else if (this.wordGroupToLookup.length) {
        this.view.selectBoard.update(this.wordGroupToLookup)
      }
    }

    spiltWords (sel) {
      const kSign = '*'

      function extract (x) {
        if (/-/.test(x)) {
          return {
            separator: '-',
            data: x
          }
        }

        return {
          separator: kSign,
          // aaBBcc => aaB*Bcc => aa*B*Bcc
          data: x.replace(/([A-Z][a-z])/g, `${kSign}$1`)
            .replace(/([a-z])([A-Z])/g, `$1${kSign}$2`)
        }
      }

      return sel.split(/[^a-z-]/i).filter(x => x).map((x) => {
        let o = extract(x)
        o.data = o.data.split(o.separator).filter(x => x.length > 1)
        if (o.separator === kSign) {
          o.separator = ''
        }
        return o
      }).filter(x => x.data.length)
    }

    filterPhrase (group) {
      if (group.length > 5) {
        return group
      }

      let isAllSingle = true
      let phrase = []

      group.forEach(x => {
        phrase.push(x.data[0])
        if (x.data.length > 1) {
          isAllSingle = false
        }
      })

      if (isAllSingle) {
        return [{
          separator: ' ',
          data: phrase
        }]
      }

      return group
    }

    filterSelectedText (text) {
      _log(`selected text: ${text}`)
      let textGroup = this.spiltWords(text)
      if (!textGroup.length) {
        return false
      }

      if (textGroup.length === 1 && textGroup[0].data.length === 1) {
        this.wordToLookup = textGroup[0].data[0]
      } else {
        this.wordGroupToLookup = this.filterPhrase(
          textGroup.slice(0, 100))
      }

      return true
    }

    lookupSpecifiedWord (word) {
      if (this.meaningCache.hasOwnProperty(word)) {
        _log('Cache hit: ' + word)
        this.view.wordMeaning.update(this.meaningCache[word])
        return
      }

      let url = 'https://dict.youdao.com/fsearch?xmlVersion=3.2&q=' +
          encodeURI(word.toLocaleLowerCase())
      _log(`query: ${url}`)

      let tryParseData = (response) => {
        let data = (new YoudaoXmlParser(response)).parse()
        this.meaningCache[word] = data
        this.view.wordMeaning.update(data)
      }

      let xhttp = new XMLHttpRequest()
      xhttp.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
          tryParseData(this.responseText)
        }
      }
      xhttp.open('GET', url, true)
      xhttp.send()
    }
  }

  class DictApp {
    run () {
      this.anyWidgetClicked = false
      this.doubleClickChecker = new JustNowChecker()
      this.injectHtml()
      this.initView()
      this.connectAllFrames()
      this.registerEventHandler()
    }

    injectHtml () {
      (new DictRes()).inject()
    }

    initView () {
      this.view = new DictView(kScopePrefix)
    }

    connectAllFrames () {
      let that = this
      let curFrameUid = Math.random()
      const eventType = 'mm.js.org/dict'

      function dispatchMessage (data) {
        document.querySelectorAll('iframe').forEach((x) => {
          x.contentWindow.postMessage(data, '*')
        })
      }

      window.addEventListener('message', function (e) {
        let d = e.data
        if (d.type === eventType) {
          if (d.from !== curFrameUid) {
            that.view.hideAllWidget()
          }

          dispatchMessage(e.data)
        }
      })

      this.notifyOthers = function () {
        window.top.postMessage({
          type: eventType,
          from: curFrameUid
        }, '*')
      }
    }

    registerEventHandler () {
      document.addEventListener('keyup', (ev) => {
        this.view.lookupBtn.hide()
      })

      document.addEventListener('mouseup', (ev) => {
        // for <h1>, selection will be lost after mouse up
        setTimeout(() => {
          this.handleMouseUp(ev)
        }, 200)
      })

      document.addEventListener('mousedown',
        this.handleMouseDown.bind(this))
    }

    handleMouseUp (ev) {
      function isFromCurFrame (e) {
        return e instanceof MouseEvent
      }

      if (!isFromCurFrame(ev)) {
        return
      }

      const kMoustLeftBtn = 1
      if (ev.which !== kMoustLeftBtn) {
        return
      }

      if (this.anyWidgetClicked) {
        return
      }

      let selection = document.getSelection().toString()
      if (!selection) {
        return
      }

      if (this.doubleClickChecker.isJustNow(selection)) {
        return
      }

      if (!this.view.action.prepareToLookup()) {
        _log('not english word')
        return
      }

      this.view.param.pos = {
        x: ev.clientX,
        y: ev.clientY
      }

      this.view.lookupBtn.show()
    }

    handleMouseDown (ev) {
      let that = this
      function isClicked (id) {
        let el = document.querySelector(id)
        console.assert(el)
        return that.isSelfOrDescendant(el, ev.target)
      }

      let clickedBtn = isClicked(this.view.lookupBtnId)
      let clickedMean = isClicked(this.view.wordMeaningId)
      let clickedBoard = isClicked(this.view.selectBoardId)
      this.anyWidgetClicked = clickedBtn || clickedMean || clickedBoard

      if (!clickedBtn) {
        this.view.lookupBtn.hide()
      }

      if (!clickedMean) {
        this.view.wordMeaning.hide()
      }

      if (!clickedBoard && !clickedMean) {
        this.view.selectBoard.hide()
      }

      if (!this.anyWidgetClicked) {
        this.notifyOthers()
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
  }

  (new DictApp()).run()
  return

  let type = document.contentType
  if (/^text\//.test(type) ||
    /^application\/(javascript|json)$/.test(type)) {
    (new DictApp()).run()
  } else {
    _log(`MIME: ${type}`);
  }
})()
