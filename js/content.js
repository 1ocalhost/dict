/* global MouseEvent Vue */
(global => {
  'use strict'

  if (!this.runApp) {
    return
  }

  class JustNowChecker {
    constructor () {
      this.lastState = null
      this.lastTime = 0
    }

    isJustNow (state) {
      const now = (new Date()).getTime()
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
    async load () {
      this._injectRoot()
      await this._injectStyle()

      this.lookupBtn = await this._buildView('lookupBtn', 'lookup_btn')
      this.selectBoard = await this._buildView('selectBoard', 'select_board')
      this.wordMeaning = await this._buildView('wordMeaning', 'word_meaning')
    }

    _createRootHostNode () {
      const root = document.createElement('div')

      // Absolute positioning relies on the nearest non-static
      // ancestor as its reference point.
      root.style.position = 'static'

      // To prevent inheritance of properties, and the initial
      // position value is static.
      root.innerHTML = '<div style="all: initial;"></div>'

      return [root, root.firstChild]
    }

    _injectRoot () {
      const [rootNode, hostNode] = this._createRootHostNode()
      this.hostRoot = hostNode.attachShadow({ mode: 'open' })
      this.hostNode = hostNode

      function checkExists(times) {
        if (times <= 0) {
          return
        }

        const host = document.documentElement
        if (!Array.from(host.children).includes(rootNode)) {
          host.appendChild(rootNode)
        }

        setTimeout(() => checkExists(times - 1), 1000)
      }

      checkExists(5)
    }

    async _injectStyle () {
      const content = await global.util.fetchRes('css/index.css')
      const style = document.createElement('style')
      style.appendChild(document.createTextNode(content))
      this.hostRoot.appendChild(style)
    }

    async _buildView (cls, file) {
      const url = `html/${file}.html`
      const html = await global.util.fetchRes(url)
      const template = `
        <div class="${cls}"
          @mouseup="mouseup($event)"
          @mousedown="mousedown($event)"
          v-bind:class="{'hidden':!show}"
          v-bind:style="{left:left+'px', top:top+'px'}">${html}
        </div>`
      const el = document.createElement('div')
      this.hostRoot.appendChild(el)
      return { name: cls, el, template }
    }
  }

  class PopupView {
    constructor (param, res, onSend) {
      if (onSend === undefined) {
        onSend = () => {}
      }

      const that = this
      this.param = param
      this.view = new Vue({
        name: res.name,
        el: res.el,
        template: res.template,
        data: {
          show: false,
          obj: {},
          left: 0,
          top: 0,
          $delayedUpdate: false
        },
        methods: {
          send: onSend,
          // the following are used by isClicked()
          mouseup (ev) { that.mouseup = ev },
          mousedown (ev) { that.mousedown = ev }
        },
        updated: that._viewOnUpdated()
      })
    }

    _viewOnUpdated () {
      const that = this
      return function () {
        if (this.$data.$delayedUpdate) {
          this.$data.$delayedUpdate = false
          that._updateWidgetPos()
        }
      }
    }

    _viewPortSize () {
      const ele = (document.compatMode === 'BackCompat'
        ? 'body'
        : 'documentElement')

      return {
        width: document[ele].clientWidth,
        height: document[ele].clientHeight
      }
    }

    _widgetSize () {
      const kDecimalCompensator = 1
      const el = this.view.$el
      return {
        width: el.offsetWidth + kDecimalCompensator,
        height: el.offsetHeight + kDecimalCompensator
      }
    }

    _updateWidgetPos (pos) {
      const kMargin = 5
      const kGiveWayToPointer = 2
      const clickPos = pos || this.param.pos

      let left = clickPos.x + kGiveWayToPointer
      let top = clickPos.y + kGiveWayToPointer
      const widget = this._widgetSize()
      const viewPort = this._viewPortSize()

      let overflow = left + widget.width - viewPort.width
      if (overflow > 0) {
        left = left - overflow - kMargin
      }

      overflow = top + widget.height - viewPort.height
      if (overflow > 0) {
        top = top - overflow - kMargin
      }

      if (top < 0) {
        top = 0
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

    show (pos) {
      this._updateWidgetPos(pos)
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
      const word = (typeof msg === 'string')
        ? msg
        : msg.data.join(msg.separator)

      const board = this.selectBoard.view.$el
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
      this.youdao = global.util.module.youdao()
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

      const selectedText = this.validSelectedText()
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
        const o = extract(x)
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
      const phrase = []

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
      global.util.log(`selected text: ${text}`)
      const textGroup = this.spiltWords(text)
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
      const that = this
      const curFrameUid = Math.random()
      const eventType = 'mm.js.org/dict'

      function dispatchMessage (data) {
        document.querySelectorAll('iframe').forEach(x => {
          x.contentWindow.postMessage(data, '*')
        })
      }

      window.addEventListener('message', function (e) {
        const d = e.data
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
      document.addEventListener('keyup', ev => {
        this.view.lookupBtn.hide()
      }, true)

      document.addEventListener('mouseup', ev => {
        // for <h1>, selection will be cleared after mouse up
        setTimeout(() => {
          this.handleMouseUp(ev)
        }, 200)
      }, true)

      document.addEventListener('mousedown',
        this.handleMouseDown.bind(this), true)

      const hostRoot = this.resource.hostRoot
      hostRoot.addEventListener('mouseup',
        this.handleMouseUp.bind(this))

      hostRoot.addEventListener('mousedown',
        this.handleMouseDown.bind(this))
    }

    handleMouseUp (ev) {
      function isFromCurFrame (e) {
        return e instanceof MouseEvent
      }

      if (!isFromCurFrame(ev)) {
        return
      }

      const mainButton = 0
      if (ev.button !== mainButton) {
        return
      }

      const clicked = this.curClickedView(ev)
      if (clicked.ignored) {
        return
      }

      if (clicked.lookupBtn || clicked.selectBoard) {
        return
      }

      this.onMouseUp(ev, clicked)
    }

    curClickedView (ev) {
      const bubblingPhase = 3
      const fromBubbling = (ev.eventPhase === bubblingPhase)

      const hostNode = this.resource.hostNode
      if (!fromBubbling && hostNode.contains(ev.target)) {
        // During the capture phase, the event object only provides the shadow
        // container node, not the precise target element. In such cases, the
        // event is ignored, allowing the listener on the shadow root node to
        // handle it via bubbling.
        return { ignored: true }
      }

      function isClicked (view) {
        if (!fromBubbling) {
          return false
        }

        return ev === view[ev.type]
      }

      const lookupBtn = isClicked(this.view.lookupBtn)
      const wordMeaning = isClicked(this.view.wordMeaning)
      const selectBoard = isClicked(this.view.selectBoard)
      const anyOne = (lookupBtn || wordMeaning || selectBoard)

      return {
        lookupBtn,
        wordMeaning,
        selectBoard,
        anyOne
      }
    }

    onMouseUp (ev, clicked) {
      const selection = document.getSelection().toString()
      if (!selection) {
        return
      }

      if (this.doubleClickChecker.isJustNow(selection)) {
        return
      }

      if (!this.view.action.prepareToLookup()) {
        global.util.log('not english word')
        return
      }

      const curPos = {
        x: ev.clientX,
        y: ev.clientY
      }

      this.view.param.pos = curPos
      this.view.lookupBtn.show(curPos)
    }

    handleMouseDown (ev) {
      const clicked = this.curClickedView(ev)
      if (clicked.ignored) {
        return
      }

      if (!clicked.lookupBtn) {
        this.view.lookupBtn.hide()
      }

      if (!clicked.wordMeaning) {
        this.view.wordMeaning.hide()
      }

      if (!clicked.selectBoard && !clicked.wordMeaning) {
        this.view.selectBoard.hide()
      }

      if (!clicked.anyOne) {
        this.notifyOthers()
      }
    }
  }

  (new DictApp()).run()
})(window)
