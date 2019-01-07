(() => {
  'use strict'

  const kMsgId = 'mmJsOrg-message'
  const kHtmlRes = `
<div id="${kMsgId}" style="position:fixed; bottom:0; width:100%; background:#181818de;
  text-align:center; transition:max-height 1s; overflow:hidden; max-height:0;">
  <div style="padding:5px; color:white; font-family:consolas,'Microsoft YaHei';">
    <a></a>
    <span style="border-radius:3px; background:#9c144c; cursor:pointer; padding:0 8px; font-weight:bold;">X</span>
  </div>
</div>`.replace(/\n/g, ' ')

  function injectHtml () {
    let div = document.createElement('div')
    div.innerHTML = kHtmlRes
    document.body.appendChild(div)
  }

  function init () {
    document.querySelector(`#${kMsgId} span`).onclick = () => {
      document.querySelector(`#${kMsgId}`).style.maxHeight = 0
    }
  }

  if (!document.querySelector(`#${kMsgId}`)) {
    injectHtml()
    init()
  }

  const word = window.mmJsOrgWordToLookUp || ':('
  document.querySelector(`#${kMsgId} a`).textContent = word
  document.querySelector(`#${kMsgId}`).style.maxHeight = 500
})()
