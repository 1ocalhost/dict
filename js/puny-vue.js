// PunyVue: the minimal and CSP-compatible Vue2 implementation
// that satisfies this project.

/* global DOMParser Node */

// window.VUE_DEBUG = true

;(global => {
  'use strict'

  const ACTION_ASSIGN = 'assign'
  const ACTION_INVOKE = 'invoke'
  const TRIM = x => x.trim()

  function assert (condition, message) {
    if (!condition) {
      throw new Error(`[PunyVue] ${message}`)
    }
  }

  function getElementTopHTML (el) {
    const vNodes = new Set(['v-if', 'v-for'])
    const node = el.cloneNode()
    Array.from(node.attributes).forEach(attr => {
      const name = attr.name
      if (vNodes.has(name) ||
          name.startsWith('v-bind:') ||
          name.startsWith('@')) {
        node.removeAttribute(name)
      }
    })
    return node.outerHTML
  }

  function HTMLToElement (html) {
    let parent

    if (html.startsWith('<path ')) {
      const template = document.createElementNS(
        'http://www.w3.org/2000/svg', 'template')
      template.innerHTML = html
      parent = template
    } else {
      const template = document.createElement('template')
      template.innerHTML = html
      parent = template.content
    }

    assert(parent.childNodes.length === 1)
    return parent.firstChild
  }

  class FrequencyLimiter {
    constructor (frequence) {
      this.frequence = frequence
      this.timer = null
    }

    emit (func) {
      const that = this

      function run () {
        that.timer = null
        func()
      }

      if (this.timer == null) {
        this.timer = setTimeout(run, this.frequence)
      }
    }
  }

  function evaluateStatementBase (expression, evaluateVariable) {
    const SCOPE_NONE = 0
    const SCOPE_VALUE = 1
    const SCOPE_OPERATOR = 2
    const SCOPE_STRING = 3

    function * splitTokens () {
      let scope = SCOPE_NONE
      let token = ''
      let lastToken = null

      function isValueChar (ch) {
        return ch && /[a-zA-Z0-9._[\]]/.test(ch)
      }

      function isOperatorChar (ch) {
        return ch && '-+<=>&|!'.includes(ch)
      }

      function beginNewParse (ch) {
        if (scope !== SCOPE_NONE) {
          scope = SCOPE_NONE
        }

        if (ch === '(' || ch === ')') {
          lastToken = [SCOPE_OPERATOR, ch]
        } else if (isValueChar(ch)) {
          scope = SCOPE_VALUE
          token = ch
        } else if (isOperatorChar(ch)) {
          scope = SCOPE_OPERATOR
          token = ch
        } else if (ch === '"' || ch === "'") {
          scope = SCOPE_STRING
          token = ch
        }
      }

      for (let i = 0; i <= expression.length; i++) {
        const ch = expression[i]
        if (scope === SCOPE_NONE) {
          beginNewParse(ch)
        } else if (scope === SCOPE_VALUE) {
          if (isValueChar(ch)) {
            token += ch
          } else {
            yield [SCOPE_VALUE, token]
            beginNewParse(ch)
          }
        } else if (scope === SCOPE_OPERATOR) {
          if (isOperatorChar(ch)) {
            token += ch
          } else {
            yield [SCOPE_OPERATOR, token]
            beginNewParse(ch)
          }
        } else if (scope === SCOPE_STRING) {
          token += ch
          if (ch === token[0]) {
            yield [SCOPE_STRING, token]
            scope = SCOPE_NONE
          }
        }

        if (lastToken) {
          yield lastToken
          lastToken = null
        }
      }
    }

    function * convertTokens (context) {
      function makeLeftUnaryOperator (unary, mark) {
        function merge (level) {
          assert(level.length === 2)
          const right = level.at(-1)
          level.length -= 2
          level.push({ eval: () => unary(right) })
        }
        return { mark, merge }
      }

      function makeBinaryOperator (binary) {
        function merge (level) {
          assert(level.length === 3)
          const left = level.at(-3)
          const right = level.at(-1)
          level.length -= 3
          level.push({ eval: () => binary(left, right) })
        }
        return { merge }
      }

      function makeConstValue (value) {
        return { eval: () => value }
      }

      function makeVariableValue (value) {
        return { eval: () => evaluateVariable(context.scopes, value) }
      }

      function makeMark (mark) {
        return { mark }
      }

      const operatorMap = {
        '!': makeLeftUnaryOperator((a) => !a.eval(), '!'),
        '+': makeBinaryOperator((a, b) => a.eval() + b.eval()),
        '-': makeBinaryOperator((a, b) => a.eval() - b.eval()),
        '<': makeBinaryOperator((a, b) => a.eval() < b.eval()),
        '>': makeBinaryOperator((a, b) => a.eval() > b.eval()),
        '&&': makeBinaryOperator((a, b) => a.eval() && b.eval()),
        '||': makeBinaryOperator((a, b) => a.eval() || b.eval()),
        // eslint-disable-next-line eqeqeq
        '==': makeBinaryOperator((a, b) => a.eval() == b.eval()),
        '===': makeBinaryOperator((a, b) => a.eval() === b.eval()),
        '!==': makeBinaryOperator((a, b) => a.eval() !== b.eval())
      }

      function convert (scope, value) {
        if (scope === SCOPE_VALUE) {
          try {
            return makeConstValue(JSON.parse(value))
          } catch (e) {
            return makeVariableValue(value)
          }
        } else if (scope === SCOPE_OPERATOR) {
          if (value === '(' || value === ')') {
            return makeMark(value)
          } else {
            const operator = operatorMap[value]
            assert(operator, `unimplemented operator: ${value}`)
            return operator
          }
        } else if (scope === SCOPE_STRING) {
          return makeConstValue(value.substring(1, value.length - 1))
        }
      }

      for (const token of splitTokens()) {
        const [scope, value] = token
        const newToken = convert(scope, value)
        newToken.src = value
        yield newToken
      }
    }

    const levels = [[]]

    function popLevel () {
      const topLevel = levels.pop()
      const topNode = topLevel[0]
      assert(topLevel.length === 1,
        `Incomplete expression: ${topLevel.map(x => x.src).join(' ')}`)
      assert(!topNode.merge)
      return topNode
    }

    function resolveForward (token) {
      const level = levels.at(-1)
      const lastNode = level.at(-1)
      level.push(token)

      if (lastNode?.merge) {
        assert(!token.merge)
        lastNode.merge(level)
        if (lastNode.mark === '!') {
          resolveForward(popLevel())
        }
      }
    }

    const context = {}
    for (const token of convertTokens(context)) {
      if (token.mark === '(') {
        levels.push([])
      } else if (token.mark === '!') {
        levels.push([token])
      } else if (token.mark === ')') {
        resolveForward(popLevel())
      } else {
        resolveForward(token)
      }
    }

    const rootNode = levels[0][0]
    return {
      expression,
      eval (scopes) {
        context.scopes = scopes
        return rootNode.eval()
      }
    }
  }

  class Vue {
    constructor (args) {
      const allowedArgs = new Set([
        'name',
        'el',
        'template',
        'data',
        'methods',
        'computed',
        'updated'
      ])

      for (const [key, value] of Object.entries(args)) {
        assert(allowedArgs.has(key))
        if (key !== 'el') {
          this['$' + key] = value
        }
      }

      const el = args.el
      if (typeof el === 'string' || el instanceof String) {
        this.$el = document.querySelector(el)
      } else {
        this.$el = el
      }

      assert(this.$el, `node mounting is invalid: ${el}`)
      this._initTemplate()
      this._initTemplate = {}
      this._mapExpressionCache = {}
      this._render()
      this._renderLimiter = new FrequencyLimiter(10)
      this._initDataSetter()
    }

    _log (msg) {
      if (global.VUE_DEBUG) {
        const name = this.$name || 'unnamed'
        console.log(`[${name}] ${msg}`)
      }
    }

    _initTemplate () {
      const parser = new DOMParser()
      const templateHTML = this.$template || this.$el.outerHTML
      this._template = parser.parseFromString(templateHTML, 'text/html').body
    }

    _evaluateVariable (scopes, variable) {
      variable = variable.trim()
      for (const scope of scopes) {
        if (Object.hasOwn(scope, variable)) {
          return scope[variable]
        }
      }

      const data = this.$data
      if (Object.hasOwn(data, variable)) {
        return data[variable]
      }

      const computed = this.$computed
      if (computed && Object.hasOwn(computed, variable)) {
        return computed[variable]()
      }

      assert(false, `Variable is not defined: ${variable}`)
    }

    // evaluate "foo" instead of "foo.bar"
    _evaluateSingleValue (scopes, expression) {
      try {
        return JSON.parse(expression) // const value
      } catch (e) {
        return this._evaluateVariable(scopes, expression)
      }
    }

    _evaluateValue (scopes, expression) {
      // foo.bar[123].baz => ['foo', 'bar', 123, 'baz']
      const tokens = expression.split(/[.[\]]/).filter(x => x)
      const result = this._evaluateSingleValue(scopes, tokens.shift())

      return tokens.reduce((result, current) => {
        const index = Number(current)
        if (!isNaN(index)) {
          current = index
        }
        return result?.[current]
      }, result)
    }

    _preEvaluateStatement (expression) {
      let result = this._initTemplate[expression]
      if (result) {
        return result
      }

      result = evaluateStatementBase(expression,
        (scopes, expr) => this._evaluateValue(scopes, expr))

      this._initTemplate[expression] = result
      return result
    }

    _evaluateStatement (scopes, expression) {
      return this._preEvaluateStatement(expression).eval(scopes)
    }

    _updateData (target, value) {
      this[target] = this._evaluateStatement([], value)
    }

    _emitClick (action, event) {
      function bindArgs (args) {
        return args.map(item =>
          (item.bind === '$event') ? event : item.value)
      }

      for (const item of action) {
        if (item.type === ACTION_ASSIGN) {
          this._updateData(item.target, item.value)
        } else if (item.type === ACTION_INVOKE) {
          this.$methods[item.func](...bindArgs(item.args))
        }
      }
    }

    _parseEvent (event, el, scopes, domElement) {
      const expression = el.getAttribute('@' + event)
      if (!expression) {
        return
      }

      const that = this

      function makeAction (item) {
        if (item.includes('=')) {
          const [target, value] = item.split('=').map(TRIM)
          return { type: ACTION_ASSIGN, target, value }
        } else {
          const [func, argsText] = item.split('(').map(TRIM)
          let args = argsText.replace(')', '')
            .split(',').filter(x => x).map(TRIM)
          args = args.map(item => (item[0] === '$')
            ? { bind: item }
            : { value: that._evaluateValue(scopes, item) }
          )
          return { type: ACTION_INVOKE, func, args }
        }
      }

      const action = expression.split(';').filter(x => x).map(makeAction)
      domElement.addEventListener(event, ev => this._emitClick(action, ev))
    }

    _parseMapImpl (expression) {
      // { xxx } => xxx
      expression = expression.trim().slice(1, -1)

      return expression.split(',').map(item => {
        const tokens = item.split(':')
        let key = tokens.shift().trim()

        // 'foo' => foo
        if (key[0] === "'") {
          key = key.slice(1, -1)
        }

        const valueExpression = tokens.join(':').trim()
        const value = this._preEvaluateStatement(valueExpression)
        return [key, value]
      })
    }

    _parseMap (expression) {
      let result = this._mapExpressionCache[expression]
      if (result) {
        return result
      }

      result = this._parseMapImpl(expression)
      this._mapExpressionCache[expression] = result
      return result
    }

    _parseBindStyle (el, scopes, domElement) {
      const expression = el.getAttribute('v-bind:style')
      if (!expression) {
        return
      }

      const pairs = this._parseMap(expression)
      for (const [name, value] of pairs) {
        const styleValue = value.eval(scopes)
        domElement.style[name] = styleValue
      }
    }

    _parseBindClass (el, scopes, domElement) {
      const expression = el.getAttribute('v-bind:class')
      if (!expression) {
        return
      }

      const pairs = this._parseMap(expression)
      for (const [name, value] of pairs) {
        if (value.eval(scopes)) {
          domElement.classList.add(name)
        }
      }
    }

    // parse "<div>" instead of "<div v-for=...>"
    _parseBasic (el, scopes) {
      const html = getElementTopHTML(el)
      const parent = HTMLToElement(html)

      this._parseBindStyle(el, scopes, parent)
      this._parseBindClass(el, scopes, parent)

      ;['click', 'mouseup', 'mousedown'].forEach(event =>
        this._parseEvent(event, el, scopes, parent)
      )

      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const parsedText = child.data.replace(
            /{{(.*?)}}/g,
            (match, expression) =>
              this._evaluateStatement(scopes, expression))
          parent.appendChild(document.createTextNode(parsedText))
        } else {
          const parsed = this._parseElement(child, scopes)
          if (Array.isArray(parsed)) {
            parsed.forEach(item => parent.appendChild(item))
          } else if (parsed) {
            parent.appendChild(parsed)
          }
        }
      }

      return parent
    }

    _parseFor (el, scopes, expression) {
      const [left, right] = expression.split(' in ')
      const vars = left.replace(/[()]/g, '').split(',').map(TRIM)
      const set = this._evaluateValue(scopes, right)
      const elements = []
      const that = this

      function parseBasicScopes (scope) {
        scopes.unshift(scope)
        elements.push(that._parseBasic(el, scopes))
        scopes.shift()
      }

      if (Array.isArray(set)) {
        let index = 0
        const [itemName, indexName] = vars

        for (const item of set) {
          const scope = { [itemName]: item }
          if (indexName) {
            scope[indexName] = index
          }

          parseBasicScopes(scope)
          index++
        }
      } else {
        const [valueName, keyName] = vars
        for (const key in set) {
          const scope = { [valueName]: set[key] }
          if (keyName) {
            scope[keyName] = key
          }

          parseBasicScopes(scope)
        }
      }

      return elements
    }

    _parseElement (el, scopes) {
      scopes = scopes || []

      const vIf = el.getAttribute('v-if')
      if (vIf && !this._evaluateStatement(scopes, vIf)) {
        return null
      }

      const vFor = el.getAttribute('v-for')
      return vFor
        ? this._parseFor(el, scopes, vFor)
        : this._parseBasic(el, scopes)
    }

    _render () {
      this._log('rendering...')
      const topElements = []
      for (const el of this._template.children) {
        const parsed = this._parseElement(el)
        if (Array.isArray(parsed)) {
          topElements.push(...parsed)
        } else if (parsed) {
          topElements.push(parsed)
        }
      }

      assert(topElements.length === 1)
      const topNode = topElements[0]
      this.$el.replaceWith(topNode)
      this.$el = topNode

      const updated = this.$updated
      updated && updated.bind(this)()
    }

    _renderDelayed () {
      this._renderLimiter.emit(this._render.bind(this))
    }

    _initDataSetter () {
      const data = this.$data
      if (!data) {
        return
      }

      const that = this
      Object.keys(data).forEach(key => {
        if (key.startsWith('$') || key.startsWith('_')) {
          return
        }

        function get () {
          return data[key]
        }

        function set (value) {
          const oldValue = data[key]
          if (value === oldValue) {
            return
          }
          this._log(`set ${key} from ${oldValue} to ${value}`)
          data[key] = value
          that._renderDelayed()
        }

        Object.defineProperty(that, key, { get, set })
      })
    }
  }

  global.Vue = Vue
})(window)
