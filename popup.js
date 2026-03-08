// popup.js — ClipMind

var screenSetup = document.getElementById('screenSetup');
var screenMain  = document.getElementById('screenMain');
var keyInput    = document.getElementById('keyInput');
var saveBtn     = document.getElementById('saveBtn');
var keyStatus   = document.getElementById('keyStatus');
var keyMasked   = document.getElementById('keyMasked');
var changeKeyBtn= document.getElementById('changeKeyBtn');
var usageBadge  = document.getElementById('usageBadge');
var onYT        = document.getElementById('onYT');
var notYT       = document.getElementById('notYT');
var notebookList= document.getElementById('notebookList');
var setLang     = document.getElementById('setLang');
var setStyle    = document.getElementById('setStyle');

document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.local.get(['apiKey','summaryLanguage','summaryStyle'], function (d) {
    if (d.apiKey && d.apiKey.length > 10) {
      showMain(d.apiKey);
    } else {
      showSetup();
    }
  });
});

function showSetup() { screenSetup.style.display='flex'; screenMain.style.display='none'; }
function showMain(apiKey) { screenSetup.style.display='none'; screenMain.style.display='flex'; checkYouTube(); loadUsage(); }
function checkYouTube() { chrome.tabs.query({active:true,currentWindow:true},function(tabs){var isYT=tabs[0]&&tabs[0].url&&tabs[0].url.includes('youtube.com/watch'); if(onYT)onYT.classList.toggle('hidden',!isYT); if(notYT)notYT.classList.toggle('hidden',isYT);}); }
function loadUsage() { chrome.runtime.sendMessage({action:'GET_USAGE'},function(resp){ if(!resp||!usageBadge)return; var left=Math.max(0,10-(resp.count||0)); usageBadge.textContent=resp.isPro?'⚡ Pro':left+'/10 free'; }); }
function setStatus(msg,type){keyStatus.textContent=msg;keyStatus.className='key-status '+(type||'');}
function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
