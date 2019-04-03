/* global chrome fetch */
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
    const word = sel.selectionText.trim()
    const openTab = openNewTab.bind(null, word)
    const run = execute.bind(null, tab)

    try {
      const docType = await run({ code: 'document.contentType' })
      if (docType !== 'application/pdf') {
        openTab()
        return
      }

      const safeWord = word.replace('\'', '\\\'')
      await run({ code: `mmJsOrgUtil.fallbackLookup('${safeWord}')` })
    } catch (e) {
      openTab()
    }
  }

  function execute (tab, code) {
    function callback (resolve, reject, result) {
      if (result === undefined) {
        reject()
        return
      }

      resolve(result[0])
    }

    return new Promise(function (resolve, reject) {
      chrome.tabs.executeScript(tab.id, code,
        callback.bind(null, ...arguments))
    })
  }

  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.contentScriptQuery === 'fetchUrl') {
        fetch(request.url)
          .then(response => response.text())
          .then(text => sendResponse(text))
          // eslint-disable-next-line handle-callback-err
          .catch(error => sendResponse(null))
        return true
      }
    })
})()
