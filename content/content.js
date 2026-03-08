// ClipMind v3 — content.js
(function () {
  'use strict';
  var dragStart=null,dragEnd=null,isDragging=false,injected=false,currentApiKey='',lastSummaryText='',lastSummaryMeta={},conversationHistory=[];
  var prefs={style:'bullets',language:'english',length:'medium'};
  var _video,_overlay,_sumBtn,_fullBtn,_btnGroup,_panel;
  var LANGUAGES={english:'English',bengali:'Bengali (বাংলা)',arabic:'Arabic (العربية)',urdu:'Urdu (اردو)',spanish:'Spanish',french:'French',hindi:'Hindi (हिन्दी)',turkish:'Turkish'};

  function boot(){chrome.storage.local.get(['apiKey','summaryStyle','summaryLanguage','summaryLength'],function(d){currentApiKey=d.apiKey||'';prefs.style=d.summaryStyle||'bullets';prefs.language=d.summaryLanguage||'english';prefs.length=d.summaryLength||'medium';});chrome.storage.onChanged.addListener(function(c){if(c.apiKey)currentApiKey=c.apiKey.newValue||'';if(c.summaryStyle)prefs.style=c.summaryStyle.newValue;if(c.summaryLanguage)prefs.language=c.summaryLanguage.newValue;if(c.summaryLength)prefs.length=c.summaryLength.newValue;});tryInject(0);watchNavigation();}
  function tryInject(attempt){if(injected||attempt>60)return;var video=document.querySelector('video');var player=document.querySelector('#movie_player')||document.querySelector('.html5-video-player');if(video&&player)buildUI(player,video);else setTimeout(function(){tryInject(attempt+1);},600);}
  function buildUI(player,video){if(injected)return;cleanup();injected=true;_video=video;var pb=player.querySelector('.ytp-progress-bar')||player.querySelector('.ytp-chrome-bottom');_overlay=document.createElement('div');_overlay.id='ycs-overlay';_overlay.innerHTML='<div id="ycs-sel-fill"></div><div id="ycs-hl" class="ycs-h"></div><div id="ycs-hr" class="ycs-h"></div><div id="ycs-tl" class="ycs-lbl"></div><div id="ycs-tr" class="ycs-lbl"></div><div id="ycs-hov"></div>';if(pb&&pb!==player)pb.parentNode.insertBefore(_overlay,pb.nextSibling);else player.appendChild(_overlay);_btnGroup=document.createElement('div');_btnGroup.id='ycs-btn-group';_sumBtn=document.createElement('button');_sumBtn.id='ycs-sum-btn';_sumBtn.innerHTML='✨ Summarize Clip';_fullBtn=document.createElement('button');_fullBtn.id='ycs-full-btn';_fullBtn.innerHTML='📹';_fullBtn.title='Full Video Summary';_btnGroup.appendChild(_sumBtn);_btnGroup.appendChild(_fullBtn);player.appendChild(_btnGroup);_panel=document.createElement('div');_panel.id='ycs-panel';_panel.innerHTML=buildPanelHTML();document.body.appendChild(_panel);var mb=document.createElement('div');mb.id='ycs-modal-bg';mb.innerHTML='<div id="ycs-modal"><h3>🔑 Groq API Key</h3><p>Free key → <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a></p><input id="ycs-key-inp" type="password" placeholder="gsk_…"/><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="ycs-m-cancel">Cancel</button><button id="ycs-m-save">Save & Continue</button></div></div>';document.body.appendChild(mb);var um=document.createElement('div');um.id='ycs-upgrade-modal';um.innerHTML='<div id="ycs-upgrade-box"><div style="font-size:30px">⚡</div><h3>Daily limit reached!</h3><p>10 free summaries used today.</p><button id="ycs-upgrade-close">Maybe later</button></div>';document.body.appendChild(um);bindEvents();makePanelDraggable();updateUsageBar();}

  function buildPanelHTML(){var lo=Object.keys(LANGUAGES).map(function(k){return '<option value="'+k+'">'+LANGUAGES[k]+'</option>';}).join('');var so=[['bullets','• Bullets'],['paragraph','¶ Paragraphs'],['academic','📚 Academic']].map(function(s){return '<option value="'+s[0]+'">'+s[1]+'</option>';}).join('');var len=[['short','Short'],['medium','Medium'],['detailed','Detailed']].map(function(s){return '<option value="'+s[0]+'">'+s[1]+'</option>';}).join('');return '<div id="ycs-header"><div id="ycs-title-bar">✂️ ClipMind</div><div id="ycs-header-btns"><button id="ycs-minimize-btn">—</button></div></div><div id="ycs-tabs"><button class="ycs-tab active" data-tab="summary">✨ Key Points</button><button class="ycs-tab" data-tab="ask">💬 Ask</button></div><div class="ycs-tab-content active" id="ycs-tab-summary"><div id="ycs-ph"><div style="font-size:34px">✂️</div><p>Drag the <strong>progress bar</strong>,<br>then click <strong>✨ Summarize Clip</strong></p></div><div id="ycs-ld" class="ycs-hidden"><div class="ycs-spin"></div><p id="ycs-ld-msg">Generating…</p></div><div id="ycs-res" class="ycs-hidden"></div></div><div class="ycs-tab-content" id="ycs-tab-ask"><div id="ycs-chat-msgs"></div><div id="ycs-chat-empty">💬 Get a summary first.</div><div id="ycs-chat-input-row"><input id="ycs-ask-inp" type="text" placeholder="Ask about this clip…"/><button id="ycs-ask-btn">→</button></div></div><div id="ycs-settings-bar"><div class="ycs-set-group"><label>🌍</label><select id="ycs-lang-sel">'+lo+'</select></div><div class="ycs-set-group"><label>✏️</label><select id="ycs-style-sel">'+so+'</select></div><div class="ycs-set-group"><label>📏</label><select id="ycs-len-sel">'+len+'</select></div></div><div id="ycs-action-bar"><div id="ycs-meta-bar"></div><div id="ycs-action-btns"><button id="ycs-copy-btn">⧉</button><button id="ycs-save-btn">📓</button><button id="ycs-pdf-btn">📄</button><button id="ycs-share-btn">🔗</button><button id="ycs-close-btn">✕</button></div></div><div id="ycs-usage-bar"><span id="ycs-usage-text"></span><a href="#" id="ycs-upgrade-link">⚡ Upgrade</a></div>';}

  function bindEvents(){
    _overlay.addEventListener('mousedown',function(e){e.preventDefault();e.stopPropagation();isDragging=true;dragStart=frac(e,_overlay);dragEnd=dragStart;renderSel();_btnGroup.style.display='none';});
    document.addEventListener('mousemove',function(e){var hov=document.getElementById('ycs-hov');if(hov&&_overlay&&_overlay.matches(':hover')){var f=frac(e,_overlay);hov.textContent=fmtTime(f*(_video.duration||0));hov.style.cssText='display:block;left:'+(f*100)+'%';}else if(hov)hov.style.display='none';if(!isDragging)return;dragEnd=frac(e,_overlay);renderSel();});
    document.addEventListener('mouseup',function(e){if(!isDragging)return;isDragging=false;dragEnd=frac(e,_overlay);if(dragEnd<dragStart){var t=dragStart;dragStart=dragEnd;dragEnd=t;}var secs=(dragEnd-dragStart)*(_video.duration||0);if(secs<2){dragStart=dragEnd=null;renderSel();return;}renderSel();renderLabels();var mid=((dragStart+dragEnd)/2)*100;_btnGroup.style.cssText='display:flex;left:'+mid+'%;transform:translateX(-50%)';openPanel();switchTab('summary');setState('ph');});
    _sumBtn.addEventListener('click',function(e){e.stopPropagation();if(dragStart!==null)doSummarize();});
    _fullBtn.addEventListener('click',function(e){e.stopPropagation();doFullVideo();});
    _panel.addEventListener('click',function(e){e.stopPropagation();var tgt=e.target,id=tgt&&tgt.id,tabEl=tgt.closest?tgt.closest('.ycs-tab'):null;if(tabEl){switchTab(tabEl.getAttribute('data-tab'));return;}if(id==='ycs-minimize-btn'){toggleMinimize();return;}if(id==='ycs-close-btn'){closePanel();return;}if(id==='ycs-copy-btn'){doCopy();return;}if(id==='ycs-save-btn'){doSaveNote();return;}if(id==='ycs-pdf-btn'){doExportPDF();return;}if(id==='ycs-share-btn'){doShare();return;}if(id==='ycs-ask-btn'){doAsk();return;}if(id==='ycs-upgrade-link'){e.preventDefault();openUpgradeModal();return;}if(tgt.classList&&tgt.classList.contains('ycs-ts')){var t=parseFloat(tgt.getAttribute('data-t'));if(!isNaN(t))_video.currentTime=t;}});
    _panel.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.id==='ycs-ask-inp'){e.stopPropagation();doAsk();}});
    var mb=document.getElementById('ycs-modal-bg'),mc=document.getElementById('ycs-m-cancel'),ms=document.getElementById('ycs-m-save'),uc=document.getElementById('ycs-upgrade-close');
    if(mb)mb.addEventListener('click',function(e){if(e.target===this)closeApiModal();});
    if(mc)mc.addEventListener('click',function(e){e.stopPropagation();closeApiModal();});
    if(ms)ms.addEventListener('click',function(e){e.stopPropagation();saveApiKey();});
    if(uc)uc.addEventListener('click',function(e){e.stopPropagation();closeUpgradeModal();});
    var ls=document.getElementById('ycs-lang-sel'),ss=document.getElementById('ycs-style-sel'),ls2=document.getElementById('ycs-len-sel');
    if(ls){ls.value=prefs.language;ls.addEventListener('change',function(){prefs.language=this.value;chrome.storage.local.set({summaryLanguage:this.value});});}
    if(ss){ss.value=prefs.style;ss.addEventListener('change',function(){prefs.style=this.value;chrome.storage.local.set({summaryStyle:this.value});});}
    if(ls2){ls2.value=prefs.length;ls2.addEventListener('change',function(){prefs.length=this.value;chrome.storage.local.set({summaryLength:this.value});});}
  }

  function switchTab(n){if(!_panel)return;_panel.querySelectorAll('.ycs-tab').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-tab')===n);});_panel.querySelectorAll('.ycs-tab-content').forEach(function(c){c.classList.toggle('active',c.id==='ycs-tab-'+n);});}
  function renderSel(){var f=document.getElementById('ycs-sel-fill'),hl=document.getElementById('ycs-hl'),hr=document.getElementById('ycs-hr');if(!f)return;if(dragStart===null){f.style.display=hl.style.display=hr.style.display='none';return;}var l=Math.min(dragStart,dragEnd)*100,w=Math.abs(dragEnd-dragStart)*100;f.style.cssText='display:block;left:'+l+'%;width:'+w+'%';hl.style.cssText='display:block;left:'+(Math.min(dragStart,dragEnd)*100)+'%';hr.style.cssText='display:block;left:'+(Math.max(dragStart,dragEnd)*100)+'%';}
  function renderLabels(){var dur=_video.duration||0,tl=document.getElementById('ycs-tl'),tr=document.getElementById('ycs-tr'),meta=document.getElementById('ycs-meta-bar');if(!tl)return;tl.textContent=fmtTime(dragStart*dur);tr.textContent=fmtTime(dragEnd*dur);tl.style.cssText='display:block;left:'+(dragStart*100)+'%;transform:translateX(-50%)';tr.style.cssText='display:block;left:'+(dragEnd*100)+'%;transform:translateX(-50%)';var cs=Math.round((dragEnd-dragStart)*dur),cm2=Math.floor(cs/60),cs2=cs%60;if(meta)meta.textContent=fmtTime(dragStart*dur)+' → '+fmtTime(dragEnd*dur)+'  ('+(cm2>0?cm2+'m'+(cs2>0?' '+cs2+'s':''):cs2+'s')+')';}

  function doSummarize(){if(!currentApiKey){openApiModal();return;}var dur=_video.duration||0,s=dragStart*dur,e=dragEnd*dur,vid=new URLSearchParams(window.location.search).get('v');openPanel();switchTab('summary');renderLabels();setState('ld','Fetching transcript…');conversationHistory=[];lastSummaryMeta={title:getTitle(),clip:fmtTime(s)+'→'+fmtTime(e),startSec:s,endSec:e,language:prefs.language};fetchTranscript(vid,s,e,function(txt){setState('ld','Generating summary…');var p=buildPrompt(txt,lastSummaryMeta.title,s,e);conversationHistory=[{role:'user',content:p}];chrome.runtime.sendMessage({action:'CALL_AI',prompt:p,history:[]},function(r){if(!r||chrome.runtime.lastError){setState('err','Extension error. Reload page.');return;}if(r.limitReached){closePanel();openUpgradeModal();return;}if(r.error){setState('err',r.error);return;}lastSummaryText=r.text||'';conversationHistory.push({role:'assistant',content:lastSummaryText});setState('res',mdHtml(lastSummaryText,s));updateUsageBar();var ce=document.getElementById('ycs-chat-empty');if(ce)ce.style.display='none';var cm3=document.getElementById('ycs-chat-msgs');if(cm3)cm3.innerHTML='';});});}
  function doFullVideo(){if(!currentApiKey){openApiModal();return;}var dur=_video.duration||0,vid=new URLSearchParams(window.location.search).get('v');if(!vid)return;openPanel();switchTab('summary');setState('ld','Fetching transcript…');conversationHistory=[];lastSummaryMeta={title:getTitle(),clip:'Full Video',startSec:0,endSec:dur,language:prefs.language};var meta=document.getElementById('ycs-meta-bar');if(meta)meta.textContent='Full Video ('+fmtTime(dur)+')';fetchFullTranscript(vid,function(txt){setState('ld','Summarizing…');var words=txt.split(' ');if(words.length<=2800){sendSummary(buildFullPrompt(txt,lastSummaryMeta.title,dur));}else{var chunks=[];for(var i=0;i<words.length;i+=2800)chunks.push(words.slice(i,i+2800).join(' '));summarizeChunks(chunks,0,[],dur);}});}
  function sendSummary(p){chrome.runtime.sendMessage({action:'CALL_AI',prompt:p,history:[]},function(r){if(!r||chrome.runtime.lastError){setState('err','Extension error.');return;}if(r.limitReached){closePanel();openUpgradeModal();return;}if(r.error){setState('err',r.error);return;}lastSummaryText=r.text||'';conversationHistory=[{role:'user',content:p},{role:'assistant',content:lastSummaryText}];setState('res',mdHtml(lastSummaryText,0));updateUsageBar();});}
  function summarizeChunks(chunks,idx,parts,dur){if(idx>=chunks.length){setState('ld','Combining…');var lang=LANGUAGES[prefs.language]||'English';sendSummary('Combine these summaries of "'+getTitle()+'" into one in '+lang+':

'+parts.join('

---

')+'

**Key Points**
• [point] [m:ss]

**Key Takeaway**
> "[idea]"

Respond in '+lang+'.');return;}setState('ld','Part '+(idx+1)+'/'+chunks.length+'…');var lang2=LANGUAGES[prefs.language]||'English';chrome.runtime.sendMessage({action:'CALL_AI',prompt:'Summarize this section of "'+getTitle()+'" in '+lang2+' (3 sentences):

'+chunks[idx],history:[]},function(r){parts.push((r&&r.text)?r.text:'');setTimeout(function(){summarizeChunks(chunks,idx+1,parts,dur);},600);});}
  function doAsk(){if(!lastSummaryText)return;var inp=document.getElementById('ycs-ask-inp'),q=inp?inp.value.trim():'';if(!q)return;inp.value='';switchTab('ask');var msgs=document.getElementById('ycs-chat-msgs');msgs.innerHTML+='<div class="ycs-msg ycs-msg-user">'+escHtml(q)+'</div><div class="ycs-msg ycs-msg-ai" id="ycs-ask-loading"><div class="ycs-spin-sm"></div></div>';msgs.scrollTop=msgs.scrollHeight;var lang=LANGUAGES[prefs.language]||'English';chrome.runtime.sendMessage({action:'CALL_AI',prompt:'Based on "'+lastSummaryMeta.title+'" ('+lastSummaryMeta.clip+'):

'+lastSummaryText+'

Q: '+q+'

Answer in '+lang+'. Be concise.',history:[]},function(r){var ld=document.getElementById('ycs-ask-loading');if(ld)ld.remove();msgs.innerHTML+='<div class="ycs-msg ycs-msg-ai">'+mdHtml((r&&r.text)?r.text:'No answer.',0)+'</div>';msgs.scrollTop=msgs.scrollHeight;});}

  function fetchTranscript(vid,s,e,cb){getAvailableLangs(vid,function(langs){var urls=[];langs.forEach(function(l){urls.push('https://www.youtube.com/api/timedtext?lang='+l+'&v='+vid+'&fmt=json3');urls.push('https://www.youtube.com/api/timedtext?lang='+l+'&v='+vid+'&fmt=json3&kind=asr');});var i=0;function next(){if(i>=urls.length){cb('[No transcript]');return;}fetch(urls[i++]).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d||!d.events||!d.events.length){next();return;}var txt=d.events.filter(function(ev){var t=(ev.tStartMs||0)/1000;return t>=s&&t<=e&&ev.segs;}).map(function(ev){return ev.segs.map(function(sg){return sg.utf8||'';}).join('');}).join(' ').replace(/s+/g,' ').trim();if(!txt){next();return;}cb(txt);}).catch(next);}next();});}
  function fetchFullTranscript(vid,cb){getAvailableLangs(vid,function(langs){var urls=[];langs.forEach(function(l){urls.push('https://www.youtube.com/api/timedtext?lang='+l+'&v='+vid+'&fmt=json3');urls.push('https://www.youtube.com/api/timedtext?lang='+l+'&v='+vid+'&fmt=json3&kind=asr');});var i=0;function next(){if(i>=urls.length){cb('[No transcript]');return;}fetch(urls[i++]).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d||!d.events||!d.events.length){next();return;}var txt=d.events.filter(function(ev){return ev.segs;}).map(function(ev){return ev.segs.map(function(sg){return sg.utf8||'';}).join('');}).join(' ').replace(/s+/g,' ').trim();if(!txt){next();return;}cb(txt);}).catch(next);}next();});}
  function getAvailableLangs(vid,cb){var lm={bengali:'bn',arabic:'ar',hindi:'hi',urdu:'ur',spanish:'es',french:'fr',turkish:'tr'},base=['en','en-US','en-GB'],ul=lm[prefs.language];if(ul)base.unshift(ul);fetch('https://www.youtube.com/api/timedtext?type=list&v='+vid).then(function(r){return r.ok?r.text():'';}).then(function(xml){(xml.match(/lang_code="([^"]+)"/g)||[]).map(function(m){return m.replace(/lang_code="|"/g,'');}).forEach(function(l){if(base.indexOf(l)===-1)base.push(l);});cb(base);}).catch(function(){cb(base);});}

  function buildPrompt(t,title,s,e){var lang=LANGUAGES[prefs.language]||'English';return 'You are an expert video analyst. Extract ONLY what was said.

Video: "'+title+'"
Clip: '+fmtTime(s)+' – '+fmtTime(e)+' ('+Math.round(e-s)+'s)
Respond in: '+lang+'

Transcript:
"""
'+t+'
"""

Format:
**Key Points**
• [2-3 sentence point] [m:ss]
• [2-3 sentence point] [m:ss]
• [2-3 sentence point] [m:ss]

**Key Takeaway**
> "[Core idea]"

Rules: 4-5 points, timestamps required. Respond in '+lang;}
  function buildFullPrompt(t,title,dur){var lang=LANGUAGES[prefs.language]||'English';return 'Video: "'+title+'" ('+fmtTime(dur)+')
Respond in: '+lang+'

Transcript:
"""
'+t+'
"""

Format:
**Key Points**
• [point] [m:ss]

**Key Takeaway**
> "[idea]"

Respond in '+lang;}

  function doCopy(){var r=document.getElementById('ycs-res');if(!r)return;navigator.clipboard.writeText(r.innerText||'');var b=document.getElementById('ycs-copy-btn');if(b){b.textContent='✓';setTimeout(function(){b.textContent='⧉';},2000);}}
  function doShare(){if(!lastSummaryText)return;var vid=new URLSearchParams(window.location.search).get('v');navigator.clipboard.writeText(lastSummaryMeta.title+'
Clip: '+lastSummaryMeta.clip+'

'+lastSummaryText+'

https://youtube.com/watch?v='+vid+'&t='+Math.floor(lastSummaryMeta.startSec||0));var b=document.getElementById('ycs-share-btn');if(b){b.textContent='✓';setTimeout(function(){b.textContent='🔗';},2000);}}
  function doSaveNote(){if(!lastSummaryText)return;chrome.runtime.sendMessage({action:'SAVE_NOTE',title:lastSummaryMeta.title,clip:lastSummaryMeta.clip,summary:lastSummaryText,language:lastSummaryMeta.language},function(){var b=document.getElementById('ycs-save-btn');if(b){b.textContent='✅';setTimeout(function(){b.textContent='📓';},2000);}});}
  function doExportPDF(){if(!lastSummaryText)return;var vid=new URLSearchParams(window.location.search).get('v'),win=window.open('','_blank');win.document.write('<html><head><title>ClipMind</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#222;line-height:1.7}blockquote{border-left:3px solid #6366f1;padding-left:12px;font-style:italic}</style></head><body><h1>'+escHtml(lastSummaryMeta.title)+'</h1><p>'+escHtml(lastSummaryMeta.clip)+'</p><hr/>'+mdHtmlFull(lastSummaryText)+'<script>window.onload=function(){window.print()}</script></body></html>');win.document.close();}

  function mdHtml(md,startSec){var lines=(md||'').split('
'),html='',inUl=false,inBq=false;lines.forEach(function(ln){ln=ln.replace(/**(.*?)**/g,'<strong>$1</strong>').replace(/`(.*?)`/g,'<code>$1</code>');if(startSec!==undefined)ln=ln.replace(/[(d+):(d+)]/g,function(m,min,sec){var t=parseInt(min)*60+parseInt(sec);return '<span class="ycs-ts" data-t="'+t+'">🕐'+m+'</span>';});if(/^>s/.test(ln)){if(inUl){html+='</ul>';inUl=false;}if(!inBq){html+='<blockquote>';inBq=true;}html+=ln.replace(/^>s+/,'')+'<br>';}else if(/^[•-*]s/.test(ln)){if(inBq){html+='</blockquote>';inBq=false;}if(!inUl){html+='<ul>';inUl=true;}html+='<li>'+ln.replace(/^[•-*]s+/,'')+'</li>';}else{if(inUl){html+='</ul>';inUl=false;}if(inBq){html+='</blockquote>';inBq=false;}if(ln.trim())html+='<p>'+ln+'</p>';}});if(inUl)html+='</ul>';if(inBq)html+='</blockquote>';return html;}
  function mdHtmlFull(md){return mdHtml(md,0).replace(/<p><strong>([^<]+)</strong></p>/g,'<h2>$1</h2>');}
  function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function setState(s,extra){['ycs-ph','ycs-ld','ycs-res'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('ycs-hidden');});if(s==='ld'){var ld=document.getElementById('ycs-ld');if(ld)ld.classList.remove('ycs-hidden');var msg=document.getElementById('ycs-ld-msg');if(msg)msg.textContent=extra||'Generating…';}else if(s==='res'){var r=document.getElementById('ycs-res');if(r){r.innerHTML=extra;r.classList.remove('ycs-hidden');}}else if(s==='err'){var r2=document.getElementById('ycs-res');if(r2){r2.innerHTML='<div class="ycs-err">⚠️ '+extra+'</div>';r2.classList.remove('ycs-hidden');}}else{var ph=document.getElementById('ycs-ph');if(ph)ph.classList.remove('ycs-hidden');}}
  function updateUsageBar(){chrome.runtime.sendMessage({action:'GET_USAGE'},function(r){if(!r)return;var t=document.getElementById('ycs-usage-text'),l=document.getElementById('ycs-upgrade-link');if(!t)return;if(r.isPro){t.textContent='⚡ Pro — Unlimited';if(l)l.style.display='none';}else{var left=Math.max(0,10-r.count);t.textContent='🆓 '+left+'/10 free today';t.style.color=left<=2?'#ef4444':'#888';if(l)l.style.display=left===0?'inline':'none';}});}
  var _minimized=false;
  function toggleMinimize(){if(!_panel)return;_minimized=!_minimized;_panel.classList.toggle('ycs-minimized',_minimized);var b=document.getElementById('ycs-minimize-btn');if(b)b.textContent=_minimized?'□':'—';}
  function openPanel(){if(!_panel)return;if(_panel.style.left&&_panel.style.left!=='')_panel.style.display='flex';else _panel.classList.add('ycs-open');_minimized=false;_panel.classList.remove('ycs-minimized');}
  function closePanel(){if(_panel)_panel.classList.remove('ycs-open');}
  function openApiModal(){var m=document.getElementById('ycs-modal-bg');if(m)m.style.display='flex';}
  function closeApiModal(){var m=document.getElementById('ycs-modal-bg');if(m)m.style.display='none';}
  function openUpgradeModal(){var m=document.getElementById('ycs-upgrade-modal');if(m)m.style.display='flex';}
  function closeUpgradeModal(){var m=document.getElementById('ycs-upgrade-modal');if(m)m.style.display='none';}
  function saveApiKey(){var v=document.getElementById('ycs-key-inp');if(!v||!v.value.trim())return;currentApiKey=v.value.trim();chrome.storage.local.set({apiKey:currentApiKey});closeApiModal();if(dragStart!==null)doSummarize();}
  function frac(e,el){var r=el.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));}
  function fmtTime(s){s=Math.floor(s||0);var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return h?h+':'+p(m)+':'+p(ss):m+':'+p(ss);}
  function p(n){return n<10?'0'+n:''+n;}
  function getTitle(){var el=document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')||document.querySelector('#title h1 yt-formatted-string')||document.querySelector('h1.ytd-watch-metadata yt-formatted-string');return el?el.textContent.trim():document.title.replace(' - YouTube','');}
  function makePanelDraggable(){if(!_panel)return;var hdr=document.getElementById('ycs-header');if(!hdr)return;hdr.style.cursor='grab';var dx=0,dy=0,sl=0,st=0,dp=false;hdr.addEventListener('mousedown',function(e){if(e.target&&(e.target.id==='ycs-minimize-btn'))return;e.preventDefault();dp=true;var rect=_panel.getBoundingClientRect();_panel.style.transition='none';_panel.style.right='auto';_panel.style.left=rect.left+'px';_panel.style.top=rect.top+'px';sl=rect.left;st=rect.top;dx=e.clientX;dy=e.clientY;hdr.style.cursor='grabbing';});document.addEventListener('mousemove',function(e){if(!dp)return;var nl=sl+(e.clientX-dx),nt=st+(e.clientY-dy);nl=Math.max(0,Math.min(window.innerWidth-_panel.offsetWidth,nl));nt=Math.max(0,Math.min(window.innerHeight-_panel.offsetHeight,nt));_panel.style.left=nl+'px';_panel.style.top=nt+'px';});document.addEventListener('mouseup',function(){if(!dp)return;dp=false;hdr.style.cursor='grab';});}
  function cleanup(){['ycs-overlay','ycs-btn-group','ycs-panel','ycs-modal-bg','ycs-upgrade-modal'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});dragStart=dragEnd=null;injected=false;_video=_overlay=_sumBtn=_fullBtn=_btnGroup=_panel=null;}
  function watchNavigation(){var last=location.href;new MutationObserver(function(){if(location.href!==last){last=location.href;cleanup();if(location.href.includes('youtube.com/watch'))setTimeout(function(){tryInject(0);},1800);}}).observe(document.body,{childList:true,subtree:true});}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
}());
