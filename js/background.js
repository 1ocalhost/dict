/* global chrome */
(() => {
  'use strict'

  chrome.contextMenus.create({
    id: 'lookupWord',
    title: 'Lookup "%s"',
    contexts: ['selection']
  })

  chrome.contextMenus.onClicked.addListener(sel => {
    chrome.tabs.query({
      currentWindow: true,
      active: true
    },
    tabArray => {
      lookup(tabArray[0], sel)
    }
    )
  })

  function openNewTab (word) {
    const url = 'http://youdao.com/w/eng/' + word
    chrome.tabs.create({ url: url })
  }

  async function lookup (tab, sel) {
    const word = sel.selectionText.trim().replace('\'', '\\\'')
    const openTab = openNewTab.bind(null, word)
    const run = execute.bind(null, tab)

    try {
      const docType = await run({ code: 'document.contentType' })
      if (docType[0] !== 'application/pdf') {
        openTab()
        return
      }

      const statement = `window.mmJsOrgWordToLookUp = '${word}'`
      await run({ code: statement })
      run({ file: 'js/fallback.js' })
    } catch (e) {
      openTab()
    }
  }

  function execute (tab, code) {
    function callback (resolve, reject, result) {
      if (result === undefined) {
        reject(result)
        return
      }

      resolve(result)
    }

    return new Promise(function (resolve, reject) {
      chrome.tabs.executeScript(tab.id, code,
        callback.bind(null, ...arguments))
    })
  }
})()
