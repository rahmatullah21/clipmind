// ClipMind v3 — content.js (clean rewrite)
(function () {
  'use strict';

  var dragStart = null, dragEnd = null, isDragging = false, injected = false;
  var currentApiKey = '';
  var lastSummaryText = '', lastSummaryMeta = {}, conversationHistory = [];
  var prefs = { style: 'bullets', language: 'english', length: 'medium' };
  var _video, _overlay, _sumBtn, _fullBtn, _btnGroup, _panel;

  var LANGUAGES = {
    english:'English', bengali:'Bengali (বাংলা)', arabic:'Arabic (العربية)',
    urdu:'Urdu (اردو)', spanish:'Spanish', french:'French',
    hindi:'Hindi (हिन्दी)', turkish:'Turkish'
  };

  function boot() {
    chrome.storage.local.get(['apiKey','summaryStyle','summaryLanguage','summaryLength'], function(d) {
      currentApiKey = d.apiKey || '';
      prefs.style = d.summaryStyle || 'bullets';
      prefs.language = d.summaryLanguage || 'english';
      prefs.length = d.summaryLength || 'medium';
    });
    chrome.storage.onChanged.addListener(function(c) {
      if (c.apiKey) currentApiKey = c.apiKey.newValue || '';
      if (c.summaryStyle) prefs.style = c.summaryStyle.newValue;
      if (c.summaryLanguage) prefs.language = c.summaryLanguage.newValue;
      if (c.summaryLength) prefs.length = c.summaryLength.newValue;
    });
    tryInject(0);
    watchNavigation();
  }

  function tryInject(attempt) {
    if (injected || attempt > 60) return;
    var video = document.querySelector('video');
    var player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (video && player) buildUI(player, video);
    else setTimeout(function() { tryInject(attempt + 1); }, 600);
  }

  function frac(e, el) { var r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
  function fmtTime(s) { s = Math.floor(s || 0); var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60; return h ? h+':'+p(m)+':'+p(ss) : m+':'+p(ss); }
  function p(n) { return n < 10 ? '0' + n : '' + n; }
  function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function getTitle() {
    var el = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') || document.querySelector('#title h1 yt-formatted-string') || document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
    return el ? el.textContent.trim() : document.title.replace(' - YouTube', '');
  }

  function cleanup() {
    ['ycs-overlay','ycs-btn-group','ycs-panel','ycs-modal-bg','ycs-upgrade-modal'].forEach(function(id) { var el = document.getElementById(id); if (el) el.remove(); });
    dragStart = dragEnd = null; injected = false;
    _video = _overlay = _sumBtn = _fullBtn = _btnGroup = _panel = null;
  }

  function watchNavigation() {
    var last = location.href;
    new MutationObserver(function() {
      if (location.href !== last) {
        last = location.href; cleanup();
        if (location.href.includes('youtube.com/watch')) setTimeout(function() { tryInject(0); }, 1800);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function buildUI(player, video) {
    if (injected) return;
    cleanup(); injected = true; _video = video;
    var progressBar = player.querySelector('.ytp-progress-bar') || player.querySelector('.ytp-chrome-bottom');
    _overlay = document.createElement('div'); _overlay.id = 'ycs-overlay';
    _overlay.innerHTML = '<div id="ycs-sel-fill"></div><div id="ycs-hl" class="ycs-h"></div><div id="ycs-hr" class="ycs-h"></div><div id="ycs-tl" class="ycs-lbl"></div><div id="ycs-tr" class="ycs-lbl"></div><div id="ycs-hov"></div>';
    if (progressBar && progressBar !== player) progressBar.parentNode.insertBefore(_overlay, progressBar.nextSibling);
    else player.appendChild(_overlay);
    _btnGroup = document.createElement('div'); _btnGroup.id = 'ycs-btn-group';
    _sumBtn = document.createElement('button'); _sumBtn.id = 'ycs-sum-btn'; _sumBtn.innerHTML = '✨ Summarize Clip';
    _fullBtn = document.createElement('button'); _fullBtn.id = 'ycs-full-btn'; _fullBtn.innerHTML = '📹'; _fullBtn.title = 'Full Video Summary';
    _btnGroup.appendChild(_sumBtn); _btnGroup.appendChild(_fullBtn); player.appendChild(_btnGroup);
    _panel = document.createElement('div'); _panel.id = 'ycs-panel'; _panel.innerHTML = buildPanelHTML(); document.body.appendChild(_panel);
    var modalBg = document.createElement('div'); modalBg.id = 'ycs-modal-bg';
    modalBg.innerHTML = '<div id="ycs-modal"><h3>🔑 Groq API Key</h3><p>Free key → <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a></p><input id="ycs-key-inp" type="password" placeholder="gsk_…"/><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="ycs-m-cancel">Cancel</button><button id="ycs-m-save">Save & Continue</button></div></div>';
    document.body.appendChild(modalBg);
    var upgradeModal = document.createElement('div'); upgradeModal.id = 'ycs-upgrade-modal'; upgradeModal.innerHTML = buildUpgradeHTML(); document.body.appendChild(upgradeModal);
    bindEvents(); makePanelDraggable(); updateUsageBar();
  }

  function buildPanelHTML() {
    var langOpts = Object.keys(LANGUAGES).map(function(k){return '<option value="'+k+'">'+LANGUAGES[k]+'</option>';}).join('');
    return '<div id="ycs-header"><div id="ycs-title-bar">✂️ ClipMind</div><div id="ycs-header-btns"><button id="ycs-minimize-btn" title="Minimize">—</button></div></div>' +
      '<div id="ycs-tabs"><button class="ycs-tab active" data-tab="summary">✨ Key Points</button><button class="ycs-tab" data-tab="ask">💬 Ask</button></div>' +
      '<div class="ycs-tab-content active" id="ycs-tab-summary"><div id="ycs-ph"><div style="font-size:34px;margin-bottom:10px">✂️</div><p>Drag the <strong>progress bar</strong> to select a clip,<br>then click <strong>✨ Summarize Clip</strong></p></div>' +
      '<div id="ycs-ld" class="ycs-hidden"><div class="ycs-spin"></div><p id="ycs-ld-msg">Generating…</p></div><div id="ycs-res" class="ycs-hidden"></div></div>' +
      '<div class="ycs-tab-content" id="ycs-tab-ask"><div id="ycs-chat-msgs"></div><div id="ycs-chat-empty" class="ycs-empty-tab">💬 Get a summary first,<br>then ask questions.</div><div id="ycs-chat-input-row"><input id="ycs-ask-inp" type="text" placeholder="Ask about this clip…" /><button id="ycs-ask-btn">→</button></div></div>' +
      '<div id="ycs-settings-bar"><div class="ycs-set-group"><label>🌍</label><select id="ycs-lang-sel">'+langOpts+'</select></div><div class="ycs-set-group"><label>✏️</label><select id="ycs-style-sel"><option value="bullets">• Bullets</option><option value="paragraph">¶ Paragraphs</option></select></div><div class="ycs-set-group"><label>📏</label><select id="ycs-len-sel"><option value="short">Short</option><option value="medium">Medium</option><option value="detailed">Detailed</option></select></div></div>' +
      '<div id="ycs-action-bar"><div id="ycs-meta-bar"></div><div id="ycs-action-btns"><button id="ycs-copy-btn" title="Copy">⧉</button><button id="ycs-save-btn" title="Save to Notebook">📓</button><button id="ycs-pdf-btn" title="Export PDF">📄</button><button id="ycs-share-btn" title="Share">🔗</button><button id="ycs-close-btn" title="Close">✕</button></div></div>' +
      '<div id="ycs-usage-bar"><span id="ycs-usage-text"></span><a href="#" id="ycs-upgrade-link">⚡ Upgrade</a></div>';
  }

  function buildUpgradeHTML() {
    return '<div id="ycs-upgrade-box"><div style="font-size:30px;margin-bottom:8px">⚡</div><h3>Daily limit reached!</h3><p>You\'ve used all 10 free summaries today.</p><div class="ycs-plans"><div class="ycs-plan"><div class="ycs-plan-name">Free</div><div class="ycs-plan-price">$0</div><div class="ycs-plan-feat">10/day</div></div><div class="ycs-plan ycs-plan-pro"><div class="ycs-plan-badge">BEST</div><div class="ycs-plan-name">Pro</div><div class="ycs-plan-price">$5<span>/mo</span></div><div class="ycs-plan-feat">✅ Unlimited</div><button class="ycs-upgrade-btn" onclick="window.open(\'https://clipmind.vercel.app/upgrade\')">Upgrade Now →</button></div></div><button id="ycs-upgrade-close">Maybe later</button></div>';
  }

  function bindEvents() {
    _overlay.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); isDragging=true; dragStart=frac(e,_overlay); dragEnd=dragStart; renderSel(); _btnGroup.style.display='none'; });
    document.addEventListener('mousemove', function(e) { if(!isDragging)return; dragEnd=frac(e,_overlay); renderSel(); });
    document.addEventListener('mouseup', function(e) {
      if(!isDragging)return; isDragging=false; dragEnd=frac(e,_overlay);
      if(dragEnd<dragStart){var t=dragStart;dragStart=dragEnd;dragEnd=t;}
      var secs=(dragEnd-dragStart)*(_video.duration||0);
      if(secs<2){dragStart=dragEnd=null;renderSel();return;}
      renderSel(); renderLabels();
      var mid=((dragStart+dragEnd)/2)*100;
      _btnGroup.style.cssText='display:flex;left:'+mid+'%;transform:translateX(-50%)';
      openPanel(); switchTab('summary'); setState('ph');
    });
    _sumBtn.addEventListener('click',function(e){e.stopPropagation();if(dragStart!==null)doSummarize();});
    _fullBtn.addEventListener('click',function(e){e.stopPropagation();doFullVideo();});
    _panel.addEventListener('click',function(e){
      e.stopPropagation(); var tgt=e.target; var id=tgt&&tgt.id;
      var tabEl=tgt.closest?tgt.closest('.ycs-tab'):null;
      if(tabEl){switchTab(tabEl.getAttribute('data-tab'));return;}
      if(id==='ycs-minimize-btn'){toggleMinimize();return;}
      if(id==='ycs-close-btn'){closePanel();return;}
      if(id==='ycs-copy-btn'){doCopy();return;}
      if(id==='ycs-save-btn'){doSaveNote();return;}
      if(id==='ycs-pdf-btn'){doExportPDF();return;}
      if(id==='ycs-share-btn'){doShare();return;}
      if(id==='ycs-ask-btn'){doAsk();return;}
      if(id==='ycs-upgrade-link'){e.preventDefault();openUpgradeModal();return;}
      if(tgt.classList&&tgt.classList.contains('ycs-ts')){var t=parseFloat(tgt.getAttribute('data-t'));if(!isNaN(t))_video.currentTime=t;}
    });
    _panel.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.id==='ycs-ask-inp'){e.stopPropagation();doAsk();}});
    var modalBg=document.getElementById('ycs-modal-bg'); var upModal=document.getElementById('ycs-upgrade-modal');
    var mCancel=document.getElementById('ycs-m-cancel'); var mSave=document.getElementById('ycs-m-save'); var upClose=document.getElementById('ycs-upgrade-close');
    if(modalBg)modalBg.addEventListener('click',function(e){if(e.target===this)closeApiModal();});
    if(upModal)upModal.addEventListener('click',function(e){if(e.target===this)closeUpgradeModal();});
    if(mCancel)mCancel.addEventListener('click',function(e){e.stopPropagation();closeApiModal();});
    if(mSave)mSave.addEventListener('click',function(e){e.stopPropagation();saveApiKey();});
    if(upClose)upClose.addEventListener('click',function(e){e.stopPropagation();closeUpgradeModal();});
    var langSel=document.getElementById('ycs-lang-sel'); var styleSel=document.getElementById('ycs-style-sel'); var lenSel=document.getElementById('ycs-len-sel');
    if(langSel){langSel.value=prefs.language;langSel.addEventListener('change',function(){prefs.language=this.value;chrome.storage.local.set({summaryLanguage:this.value});});}
    if(styleSel){styleSel.value=prefs.style;styleSel.addEventListener('change',function(){prefs.style=this.value;chrome.storage.local.set({summaryStyle:this.value});});}
    if(lenSel){lenSel.value=prefs.length;lenSel.addEventListener('change',function(){prefs.length=this.value;chrome.storage.local.set({summaryLength:this.value});});}
  }

  function switchTab(name) { if(!_panel)return; _panel.querySelectorAll('.ycs-tab').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-tab')===name);}); _panel.querySelectorAll('.ycs-tab-content').forEach(function(c){c.classList.toggle('active',c.id==='ycs-tab-'+name);}); }
  function renderSel() { var fill=document.getElementById('ycs-sel-fill');var hl=document.getElementById('ycs-hl');var hr=document.getElementById('ycs-hr');if(!fill)return;if(dragStart===null){fill.style.display=hl.style.display=hr.style.display='none';return;}var l=Math.min(dragStart,dragEnd)*100;var w=Math.abs(dragEnd-dragStart)*100;fill.style.cssText='display:block;left:'+l+'%;width:'+w+'%';hl.style.cssText='display:block;left:'+(Math.min(dragStart,dragEnd)*100)+'%';hr.style.cssText='display:block;left:'+(Math.max(dragStart,dragEnd)*100)+'%'; }
  function renderLabels() { var dur=_video.duration||0;var tl=document.getElementById('ycs-tl');var tr=document.getElementById('ycs-tr');var meta=document.getElementById('ycs-meta-bar');if(!tl)return;tl.textContent=fmtTime(dragStart*dur);tr.textContent=fmtTime(dragEnd*dur);tl.style.cssText='display:block;left:'+(dragStart*100)+'%;transform:translateX(-50%)';tr.style.cssText='display:block;left:'+(dragEnd*100)+'%;transform:translateX(-50%)';var clipSecs=Math.round((dragEnd-dragStart)*dur);if(meta)meta.textContent=fmtTime(dragStart*dur)+' → '+fmtTime(dragEnd*dur)+'  ('+Math.floor(clipSecs/60)+'m'+clipSecs%60+'s)'; }

  function doSummarize() {
    if(!currentApiKey){openApiModal();return;}
    var dur=_video.duration||0; var s=dragStart*dur; var e=dragEnd*dur;
    var vid=new URLSearchParams(window.location.search).get('v');
    openPanel(); switchTab('summary'); renderLabels(); setState('ld','Fetching transcript…');
    conversationHistory=[]; lastSummaryMeta={title:getTitle(),clip:fmtTime(s)+'→'+fmtTime(e),startSec:s,endSec:e,language:prefs.language,style:prefs.style};
    fetchTranscript(vid,s,e,function(txt){
      setState('ld','Generating summary…');
      var prompt=buildPrompt(txt,lastSummaryMeta.title,s,e);
      conversationHistory=[{role:'user',content:prompt}];
      chrome.runtime.sendMessage({action:'CALL_AI',prompt:prompt,history:[]},function(resp){
        if(!resp||chrome.runtime.lastError){setState('err','Extension error. Reload page.');return;}
        if(resp.limitReached){closePanel();openUpgradeModal();return;}
        if(resp.error){setState('err',resp.error);return;}
        lastSummaryText=resp.text||'';
        conversationHistory.push({role:'assistant',content:lastSummaryText});
        setState('res',mdHtml(lastSummaryText,s)); updateUsageBar();
        var ce=document.getElementById('ycs-chat-empty');if(ce)ce.style.display='none';
        var cm=document.getElementById('ycs-chat-msgs');if(cm)cm.innerHTML='';
      });
    });
  }

  function doFullVideo() {
    if(!currentApiKey){openApiModal();return;}
    var dur=_video.duration||0; var vid=new URLSearchParams(window.location.search).get('v'); if(!vid)return;
    openPanel(); switchTab('summary'); setState('ld','Fetching transcript…');
    conversationHistory=[]; lastSummaryMeta={title:getTitle(),clip:'Full Video',startSec:0,endSec:dur,language:prefs.language,style:prefs.style};
    var meta=document.getElementById('ycs-meta-bar'); if(meta)meta.textContent='Full Video ('+fmtTime(dur)+')';
    fetchFullTranscript(vid,function(txt){
      setState('ld','Summarizing…');
      var words=txt.split(' ');
      if(words.length<=2800){sendSummary(buildFullPrompt(txt,lastSummaryMeta.title,dur));}
      else{var chunks=[];for(var i=0;i<words.length;i+=2800)chunks.push(words.slice(i,i+2800).join(' '));summarizeChunks(chunks,0,[],dur);}
    });
  }

  function sendSummary(prompt) {
    chrome.runtime.sendMessage({action:'CALL_AI',prompt:prompt,history:[]},function(resp){
      if(!resp||chrome.runtime.lastError){setState('err','Extension error.');return;}
      if(resp.limitReached){closePanel();openUpgradeModal();return;}
      if(resp.error){setState('err',resp.error);return;}
      lastSummaryText=resp.text||'';
      conversationHistory=[{role:'user',content:prompt},{role:'assistant',content:lastSummaryText}];
      setState('res',mdHtml(lastSummaryText,0)); updateUsageBar();
      var ce=document.getElementById('ycs-chat-empty');if(ce)ce.style.display='none';
      var cm=document.getElementById('ycs-chat-msgs');if(cm)cm.innerHTML='';
    });
  }

  function summarizeChunks(chunks,idx,parts,dur) {
    if(idx>=chunks.length){setState('ld','Combining parts…');var lang=LANGUAGES[prefs.language]||'English';sendSummary('Combine these summaries of "'+getTitle()+'" into one in '+lang+':\n\n'+parts.join('\n\n---\n\n'));return;}
    setState('ld','Part '+(idx+1)+' of '+chunks.length+'…');
    chrome.runtime.sendMessage({action:'CALL_AI',prompt:'Summarize in 3 sentences:\n\n'+chunks[idx],history:[]},function(resp){
      parts.push((resp&&resp.text)?resp.text:'');
      setTimeout(function(){summarizeChunks(chunks,idx+1,parts,dur);},600);
    });
  }

  function doAsk() {
    if(!lastSummaryText)return;
    var inp=document.getElementById('ycs-ask-inp'); var question=inp?inp.value.trim():''; if(!question)return; inp.value='';
    switchTab('ask');
    var msgs=document.getElementById('ycs-chat-msgs');
    msgs.innerHTML+='<div class="ycs-msg ycs-msg-user">'+escHtml(question)+'</div>';
    msgs.innerHTML+='<div class="ycs-msg ycs-msg-ai" id="ycs-ask-loading"><div class="ycs-spin-sm"></div></div>';
    msgs.scrollTop=msgs.scrollHeight;
    var lang=LANGUAGES[prefs.language]||'English';
    var followUp='Based on "'+lastSummaryMeta.title+'" summary:\n\n'+lastSummaryText+'\n\nQuestion: '+question+'\n\nAnswer in '+lang+'. Be concise.';
    chrome.runtime.sendMessage({action:'CALL_AI',prompt:followUp,history:[]},function(resp){
      var loading=document.getElementById('ycs-ask-loading');if(loading)loading.remove();
      var answer=(resp&&resp.text)?resp.text:'Could not get answer.';
      msgs.innerHTML+='<div class="ycs-msg ycs-msg-ai">'+mdHtml(answer,0)+'</div>';
      msgs.scrollTop=msgs.scrollHeight;
    });
  }

  function fetchTranscript(vid,s,e,cb) {
    getAvailableLangs(vid,function(langs){
      var urls=[]; langs.forEach(function(lang){urls.push('https://www.youtube.com/api/timedtext?lang='+lang+'&v='+vid+'&fmt=json3');urls.push('https://www.youtube.com/api/timedtext?lang='+lang+'&v='+vid+'&fmt=json3&kind=asr');});
      var i=0;
      function next(){if(i>=urls.length){cb('[No transcript available]');return;}fetch(urls[i++]).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d||!d.events||!d.events.length){next();return;}var txt=d.events.filter(function(ev){var t=(ev.tStartMs||0)/1000;return t>=s&&t<=e&&ev.segs;}).map(function(ev){return ev.segs.map(function(sg){return sg.utf8||'';}).join('');}).join(' ').replace(/\s+/g,' ').trim();if(!txt){next();return;}cb(txt);}).catch(next);}
      next();
    });
  }

  function fetchFullTranscript(vid,cb) {
    getAvailableLangs(vid,function(langs){
      var urls=[]; langs.forEach(function(lang){urls.push('https://www.youtube.com/api/timedtext?lang='+lang+'&v='+vid+'&fmt=json3');});
      var i=0;
      function next(){if(i>=urls.length){cb('[No transcript available]');return;}fetch(urls[i++]).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d||!d.events||!d.events.length){next();return;}var txt=d.events.filter(function(ev){return ev.segs;}).map(function(ev){return ev.segs.map(function(sg){return sg.utf8||'';}).join('');}).join(' ').replace(/\s+/g,' ').trim();if(!txt){next();return;}cb(txt);}).catch(next);}
      next();
    });
  }

  function getAvailableLangs(vid,cb) {
    var langMap={bengali:'bn',arabic:'ar',hindi:'hi',urdu:'ur',spanish:'es',french:'fr',turkish:'tr'};
    var base=['en','en-US','en-GB']; var ul=langMap[prefs.language];if(ul)base.unshift(ul);
    fetch('https://www.youtube.com/api/timedtext?type=list&v='+vid).then(function(r){return r.ok?r.text():'';}).then(function(xml){(xml.match(/lang_code="([^"]+)"/g)||[]).map(function(m){return m.replace(/lang_code="|"/g,'');}).forEach(function(l){if(base.indexOf(l)===-1)base.push(l);});cb(base);}).catch(function(){cb(base);});
  }

  function buildPrompt(transcript,title,s,e) {
    var lang=LANGUAGES[prefs.language]||'English';
    return 'You are an expert video analyst. Extract ONLY what was said.\n\nVideo: "'+title+'"\nClip: '+fmtTime(s)+' – '+fmtTime(e)+'\nRespond in: '+lang+'\n\nTranscript:\n"""\n'+transcript+'\n"""\n\nRespond with EXACTLY:\n\n**Key Points**\n• [2-3 sentence point 1] [m:ss]\n• [2-3 sentence point 2] [m:ss]\n• [2-3 sentence point 3] [m:ss]\n• [2-3 sentence point 4] [m:ss]\n\n**Key Takeaway**\n> "[Core idea in speaker\'s voice]"\n\nRespond entirely in '+lang;
  }

  function buildFullPrompt(transcript,title,dur) {
    var lang=LANGUAGES[prefs.language]||'English';
    return 'Summarize this video "'+title+'" ('+fmtTime(dur)+') in '+lang+':\n\n'+transcript+'\n\nFormat:\n**Key Points**\n• point 1 [m:ss]\n• point 2 [m:ss]\n• point 3 [m:ss]\n\n**Key Takeaway**\n> "core idea"\n\nRespond in '+lang;
  }

  function doCopy(){var r=document.getElementById('ycs-res');if(!r)return;navigator.clipboard.writeText(r.innerText||'');var btn=document.getElementById('ycs-copy-btn');if(btn){btn.textContent='✓';setTimeout(function(){btn.textContent='⧉';},2000);}}
  function doShare(){if(!lastSummaryText)return;var vid=new URLSearchParams(window.location.search).get('v');navigator.clipboard.writeText(lastSummaryMeta.title+'\nClip: '+lastSummaryMeta.clip+'\n\n'+lastSummaryText+'\n\nhttps://youtube.com/watch?v='+vid);var btn=document.getElementById('ycs-share-btn');if(btn){btn.textContent='✓';setTimeout(function(){btn.textContent='🔗';},2000);}}
  function doSaveNote(){if(!lastSummaryText)return;chrome.runtime.sendMessage({action:'SAVE_NOTE',title:lastSummaryMeta.title,clip:lastSummaryMeta.clip,summary:lastSummaryText,language:lastSummaryMeta.language},function(){var btn=document.getElementById('ycs-save-btn');if(btn){btn.textContent='✅';setTimeout(function(){btn.textContent='📓';},2000);}});}
  function doExportPDF(){if(!lastSummaryText)return;var vid=new URLSearchParams(window.location.search).get('v');var win=window.open('','_blank');win.document.write('<html><head><title>ClipMind Summary</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#222;line-height:1.7}blockquote{border-left:3px solid #6366f1;padding-left:12px;color:#555;font-style:italic}</style></head><body><h1>'+escHtml(lastSummaryMeta.title)+'</h1><p>Clip: '+escHtml(lastSummaryMeta.clip)+'</p><hr/>'+mdHtml(lastSummaryText,0)+'<script>window.onload=function(){window.print()}<\/script></body></html>');win.document.close();}

  function mdHtml(md,startSec){var lines=(md||'').split('\n');var html='',inUl=false,inOl=false,inBq=false;lines.forEach(function(ln){ln=ln.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`(.*?)`/g,'<code>$1</code>');if(startSec!==undefined){ln=ln.replace(/\[(\d+):(\d+)\]/g,function(match,m,s2){var t=parseInt(m)*60+parseInt(s2);return '<span class="ycs-ts" data-t="'+t+'" title="Jump to '+match+'">🕐'+match+'</span>';});} if(/^>\s/.test(ln)){if(inUl){html+='</ul>';inUl=false;}if(inOl){html+='</ol>';inOl=false;}if(!inBq){html+='<blockquote>';inBq=true;}html+=ln.replace(/^>\s+/,'')+'<br>'; }else if(/^[•\-\*]\s/.test(ln)){if(inBq){html+='</blockquote>';inBq=false;}if(inOl){html+='</ol>';inOl=false;}if(!inUl){html+='<ul>';inUl=true;}html+='<li>'+ln.replace(/^[•\-\*]\s+/,'')+'</li>';}else if(/^\d+\.\s/.test(ln)){if(inBq){html+='</blockquote>';inBq=false;}if(inUl){html+='</ul>';inUl=false;}if(!inOl){html+='<ol>';inOl=true;}html+='<li>'+ln.replace(/^\d+\.\s+/,'')+'</li>';}else{if(inUl){html+='</ul>';inUl=false;}if(inOl){html+='</ol>';inOl=false;}if(inBq){html+='</blockquote>';inBq=false;}if(ln.trim())html+='<p>'+ln+'</p>';} });if(inUl)html+='</ul>';if(inOl)html+='</ol>';if(inBq)html+='</blockquote>';return html;}

  function setState(s,extra){['ycs-ph','ycs-ld','ycs-res'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('ycs-hidden');});if(s==='ld'){var ld=document.getElementById('ycs-ld');if(ld)ld.classList.remove('ycs-hidden');var msg=document.getElementById('ycs-ld-msg');if(msg)msg.textContent=extra||'Generating…';}else if(s==='res'){var r=document.getElementById('ycs-res');if(r){r.innerHTML=extra;r.classList.remove('ycs-hidden');}}else if(s==='err'){var r2=document.getElementById('ycs-res');if(r2){r2.innerHTML='<div class="ycs-err">⚠️ '+extra+'</div>';r2.classList.remove('ycs-hidden');}}else{var ph=document.getElementById('ycs-ph');if(ph)ph.classList.remove('ycs-hidden');}}
  function updateUsageBar(){chrome.runtime.sendMessage({action:'GET_USAGE'},function(resp){if(!resp)return;var txt=document.getElementById('ycs-usage-text');var link=document.getElementById('ycs-upgrade-link');if(!txt)return;if(resp.isPro){txt.textContent='⚡ Pro — Unlimited';txt.style.color='#a5b4fc';if(link)link.style.display='none';}else{var left=Math.max(0,10-resp.count);txt.textContent='🆓 '+left+'/10 free today';txt.style.color=left<=2?'#ef4444':'#888';if(link)link.style.display=left===0?'inline':'none';}});}
  var _minimized=false;
  function toggleMinimize(){if(!_panel)return;_minimized=!_minimized;_panel.classList.toggle('ycs-minimized',_minimized);var btn=document.getElementById('ycs-minimize-btn');if(btn)btn.textContent=_minimized?'□':'—';}
  function openPanel(){if(!_panel)return;if(_panel.style.left&&_panel.style.left!==''){_panel.style.display='flex';}else{_panel.classList.add('ycs-open');}_minimized=false;_panel.classList.remove('ycs-minimized');var btn=document.getElementById('ycs-minimize-btn');if(btn)btn.textContent='—';}
  function closePanel(){if(_panel)_panel.classList.remove('ycs-open');}
  function openApiModal(){var m=document.getElementById('ycs-modal-bg');if(m)m.style.display='flex';}
  function closeApiModal(){var m=document.getElementById('ycs-modal-bg');if(m)m.style.display='none';}
  function openUpgradeModal(){var m=document.getElementById('ycs-upgrade-modal');if(m)m.style.display='flex';}
  function closeUpgradeModal(){var m=document.getElementById('ycs-upgrade-modal');if(m)m.style.display='none';}
  function saveApiKey(){var v=document.getElementById('ycs-key-inp');if(!v||!v.value.trim())return;currentApiKey=v.value.trim();chrome.storage.local.set({apiKey:currentApiKey});closeApiModal();if(dragStart!==null)doSummarize();}
  function makePanelDraggable(){if(!_panel)return;var header=document.getElementById('ycs-header');if(!header)return;header.style.cursor='grab';var dragX=0,dragY=0,startLeft=0,startTop=0,draggingPanel=false;header.addEventListener('mousedown',function(e){if(e.target&&(e.target.id==='ycs-minimize-btn'||e.target.id==='ycs-close-btn'))return;e.preventDefault();draggingPanel=true;var rect=_panel.getBoundingClientRect();_panel.style.transition='none';_panel.style.right='auto';_panel.style.left=rect.left+'px';_panel.style.top=rect.top+'px';startLeft=rect.left;startTop=rect.top;dragX=e.clientX;dragY=e.clientY;header.style.cursor='grabbing';});document.addEventListener('mousemove',function(e){if(!draggingPanel)return;var dx=e.clientX-dragX;var dy=e.clientY-dragY;_panel.style.left=Math.max(0,Math.min(window.innerWidth-_panel.offsetWidth,startLeft+dx))+'px';_panel.style.top=Math.max(0,Math.min(window.innerHeight-_panel.offsetHeight,startTop+dy))+'px';});document.addEventListener('mouseup',function(){if(!draggingPanel)return;draggingPanel=false;header.style.cursor='grab';});}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();

}());
