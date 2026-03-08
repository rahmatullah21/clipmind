// ClipMind service-worker.js
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    chrome.storage.local.set({ apiKey: '', isPro: false, dailyCount: 0, lastDate: '', notebook: [] });
  }
});
chrome.alarms.create('dailyReset', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === 'dailyReset') {
    var today = new Date().toDateString();
    chrome.storage.local.get(['lastDate'], function (d) {
      if (d.lastDate !== today) chrome.storage.local.set({ dailyCount: 0, lastDate: today });
    });
  }
});
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === 'CALL_AI') {
    chrome.storage.local.get(['apiKey', 'isPro', 'dailyCount', 'lastDate'], function (d) {
      var today = new Date().toDateString();
      var count = (d.lastDate === today) ? (d.dailyCount || 0) : 0;
      if (!d.isPro && count >= 10) { sendResponse({ limitReached: true }); return; }
      chrome.storage.local.set({ dailyCount: count + 1, lastDate: today });
      callGroq(d.apiKey, msg.prompt, sendResponse);
    });
    return true;
  }
  if (msg.action === 'SAVE_NOTE') {
    chrome.storage.local.get(['notebook'], function (d) {
      var nb = d.notebook || [];
      nb.unshift({ id: Date.now(), title: msg.title, clip: msg.clip, summary: msg.summary, language: msg.language, date: new Date().toLocaleDateString() });
      if (nb.length > 100) nb = nb.slice(0, 100);
      chrome.storage.local.set({ notebook: nb });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.action === 'GET_NOTES') {
    chrome.storage.local.get(['notebook'], function (d) { sendResponse({ notes: d.notebook || [] }); });
    return true;
  }
  if (msg.action === 'DELETE_NOTE') {
    chrome.storage.local.get(['notebook'], function (d) {
      chrome.storage.local.set({ notebook: (d.notebook || []).filter(function(n){ return n.id !== msg.id; }) });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.action === 'GET_USAGE') {
    chrome.storage.local.get(['dailyCount', 'lastDate', 'isPro'], function (d) {
      var today = new Date().toDateString();
      sendResponse({ count: (d.lastDate === today) ? (d.dailyCount || 0) : 0, isPro: d.isPro || false });
    });
    return true;
  }
});
function callGroq(apiKey, prompt, cb) {
  fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 900, temperature: 0.4,
      messages: [{ role: 'system', content: 'You are an expert video summarizer.' }, { role: 'user', content: prompt }] })
  })
  .then(function(r) { var s=r.status; return r.json().then(function(d){ return {status:s,data:d}; }); })
  .then(function(result) {
    if (result.status===401) { cb({error:'Invalid API key.'}); return; }
    if (result.status===429) { cb({error:'Too many requests.'}); return; }
    if (result.status!==200) { cb({error:'Error '+result.status}); return; }
    cb({text: result.data.choices[0].message.content || ''});
  })
  .catch(function(err) { cb({error:'Network error: '+err.message}); });
}