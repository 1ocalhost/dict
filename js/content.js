/* global mmJsOrgUtil MouseEvent Vue */
(() => {
  'use strict'

  const util = mmJsOrgUtil

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

  class DictRes {
    constructor () {
      this.scopePrefix = 'mmJsOrg-'
    }

    async load () {
      const resStyle = await util.fetchRes('css/index.css')
      const resLookupBtn = await util.fetchRes('html/lookup_btn.html')
      const resSelectBoard = await util.fetchRes('html/select_board.html')
      const resWordMeaning = await util.fetchRes('html/word_meaning.html')

      this.lookupBtn = this._buildViewTemplate('lookupBtn', resLookupBtn)
      this.selectBoard = this._buildViewTemplate('selectBoard', resSelectBoard)
      this.wordMeaning = this._buildViewTemplate('wordMeaning', resWordMeaning)
      this._inject(resStyle)
    }

    _inject (resStyle) {
      const resHtml = [
        this.lookupBtn,
        this.selectBoard,
        this.wordMeaning
      ].reduce((a, b) => `${a}<div id="${b.pureId}"></div>`, '')

      this._injectStyle(this._makeStyleScoped(resStyle))
      this._injectContent(this._makeContentScoped(resHtml))
    }

    addScopePrefix (sel) {
      const prefix = this.scopePrefix
      return sel.replace(/([.#])([^.#]+)/g, `$1${prefix}$2`)
    }

    _buildViewTemplate (id, res) {
      const that = this
      return {
        pureId: id,
        id: that.addScopePrefix('#' + id),
        template: this._makeContentScoped(`
<div id="${id}" v-bind:class="{'@@hidden':!show}"
    v-bind:style="{left:left+'px', top:top+'px'}">${res}
</div>`)
      }
    }

    _injectStyle (css) {
      let style = document.createElement('style')
      style.type = 'text/css'
      style.appendChild(document.createTextNode(css))
      document.documentElement.appendChild(style)
    }

    _injectContent (html) {
      let div = document.createElement('div')
      div.innerHTML = html
      document.documentElement.appendChild(div)
    }

    addImportant (prop) {
      return prop.split(';').filter(x => x.match(/:/))
        .map(x => x + ' !important').join(';')
    }

    _makeStyleScoped (css) {
      const that = this
      function addPrefix (sel) {
        return sel.split(',').map(
          that.addScopePrefix.bind(that)
        ).join(',')
      }

      return css.replace(/([^{]+)\{([^}]+)\}/g, ($0, $1, $2) => {
        return addPrefix($1) + '{' + this.addImportant($2) + '\n}'
      })
    }

    _makeContentScoped (html) {
      const prefix = this.scopePrefix
      html = html.replace(/@@/g, prefix)
        .replace(/([^:](id|class)=)"([^"]+)"/g, `$1"${prefix}$3"`)

      return html.replace(/([^:]style=)"([^"]+)"/g, ($0, $1, $2) => {
        return $1 + '"' + this.addImportant($2) + '"'
      })
    }
  }

  class PopupView {
    constructor (param, res, onSend) {
      if (onSend === undefined) {
        onSend = () => {}
      }

      let that = this
      this.param = param
      this.eleId = res.id
      this.view = new Vue({
        el: res.id,
        template: res.template,
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
    constructor (resource) {
      this.param = {}
      this.action = new LookupAction(this)
      this.lookupBtn = new PopupView(this.param, resource.lookupBtn,
        this.action.lookup.bind(this.action)
      )
      this.wordMeaning = new PopupView(this.param, resource.wordMeaning)
      this.selectBoard = new PopupView(this.param, resource.selectBoard,
        this.onSelectBoardSend.bind(this, this.action)
      )
    }

    onSelectBoardSend (action, ev, msg) {
      let word = (typeof msg === 'string')
        ? msg : msg.data.join(msg.separator)

      let board = document.querySelector(this.selectBoard.eleId)
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
      this.youdao = util.module.youdao()
      this.view = view
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
      util.log(`selected text: ${text}`)
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

    async lookupSpecifiedWord (word) {
      const data = await this.youdao.lookup(word)
      this.view.wordMeaning.update(data)
    }
  }

  class DictApp {
    run () {
      this.anyWidgetClicked = false
      this.doubleClickChecker = new JustNowChecker()
      this.init()
    }

    async init () {
      this.resource = new DictRes()
      await this.resource.load()
      this.view = new DictView(this.resource)
      this.connectAllFrames()
      this.registerEventHandler()
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
        util.log('not english word')
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
      function isClicked (view) {
        let el = document.querySelector(view.eleId)
        console.assert(el)
        return that.isSelfOrDescendant(el, ev.target)
      }

      let clickedBtn = isClicked(this.view.lookupBtn)
      let clickedMean = isClicked(this.view.wordMeaning)
      let clickedBoard = isClicked(this.view.selectBoard)
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

  const type = document.contentType
  if (type !== 'application/pdf') {
    (new DictApp()).run()
  }
})()
