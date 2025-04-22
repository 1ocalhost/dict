/* global chrome fetch */
(() => {
  'use strict'

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'lookupWord',
      title: 'Lookup "%s"',
      contexts: ['selection']
    })
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
    chrome.tabs.create({ url })
  }

  async function lookup (tab, sel) {
    const word = sel.selectionText.trim()
    const openTab = openNewTab.bind(null, word)
    const run = execute.bind(null, tab)

    try {
      const docType = await run(() => document.contentType)
      if (docType !== 'application/pdf') {
        openTab()
        return
      }

      await run((w) => window.util.fallbackLookup(w), [word])
    } catch (e) {
      openTab()
    }
  }

  function execute (tab, func, args) {
    function callback (resolve, reject, result) {
      if (result === undefined) {
        reject()
        return
      }

      resolve(result[0].result)
    }

    return new Promise(function (resolve, reject) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func,
          args
        },
        callback.bind(null, ...arguments))
    })
  }

  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.contentScriptQuery === 'fetchUrl') {
        fetch(request.url)
          .then(response => response.text())
          .then(text => sendResponse(text))
          .catch(_error => sendResponse(null))
        return true
      }
    })
})()
