(function () {
  'use strict';

  var WORKER_URL = window.CHATBOT_WORKER_URL;
  if (!WORKER_URL) return; // not configured — do nothing

  var MAX_HISTORY = 20; // message objects (10 turns)

  /* ── styles ──────────────────────────────────────────────────────── */
  var css = [
    '#chatbot-btn{',
      'position:fixed;bottom:24px;right:24px;',
      'width:52px;height:52px;border-radius:50%;',
      'background:#2c3e50;color:#fff;border:none;cursor:pointer;',
      'box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:22px;',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:9000;transition:transform .15s,box-shadow .15s;',
    '}',
    '#chatbot-btn:hover{transform:scale(1.08);box-shadow:0 6px 18px rgba(0,0,0,.32);}',
    '#chatbot-btn:focus-visible{outline:3px solid #6ab0de;outline-offset:2px;}',

    '#chatbot-panel{',
      'position:fixed;bottom:88px;right:24px;',
      'width:340px;max-height:500px;',
      'background:#fff;border-radius:14px;',
      'box-shadow:0 10px 36px rgba(0,0,0,.18);',
      'display:flex;flex-direction:column;',
      'z-index:8999;overflow:hidden;',
      "font-family:'Open Sans',sans-serif;font-size:13px;",
      'transition:opacity .18s,transform .18s;',
    '}',
    '#chatbot-panel.chatbot-hidden{opacity:0;pointer-events:none;transform:translateY(12px);}',

    '#chatbot-header{',
      'background:#2c3e50;color:#fff;',
      'padding:13px 16px;font-weight:600;font-size:13px;',
      'display:flex;align-items:center;justify-content:space-between;',
      'flex-shrink:0;',
    '}',
    '#chatbot-close{',
      'background:none;border:none;color:#fff;cursor:pointer;',
      'font-size:20px;line-height:1;opacity:.75;padding:0;',
    '}',
    '#chatbot-close:hover{opacity:1;}',

    '#chatbot-messages{',
      'flex:1;overflow-y:auto;padding:14px;',
      'display:flex;flex-direction:column;gap:10px;',
    '}',
    '.cb-msg{',
      'max-width:86%;padding:9px 13px;border-radius:10px;',
      'line-height:1.5;word-break:break-word;white-space:pre-wrap;',
    '}',
    '.cb-msg.cb-user{align-self:flex-end;background:#2c3e50;color:#fff;border-bottom-right-radius:3px;}',
    '.cb-msg.cb-bot{align-self:flex-start;background:#f2f3f4;color:#222;border-bottom-left-radius:3px;}',
    '.cb-msg.cb-err{',
      'align-self:center;max-width:95%;',
      'background:#fff3f3;color:#c0392b;border:1px solid #f5c6cb;',
      'font-size:12px;border-radius:8px;',
    '}',

    '#chatbot-typing{',
      'padding:0 14px 10px;color:#999;font-style:italic;',
      'font-size:12px;display:none;flex-shrink:0;',
    '}',

    '#chatbot-input-row{',
      'display:flex;gap:8px;padding:10px;',
      'border-top:1px solid #eee;flex-shrink:0;',
    '}',
    '#chatbot-input{',
      'flex:1;border:1px solid #ddd;border-radius:8px;',
      'padding:8px 11px;font-size:13px;font-family:inherit;',
      'outline:none;resize:none;min-height:36px;max-height:90px;',
      'line-height:1.4;',
    '}',
    '#chatbot-input:focus{border-color:#2c3e50;}',
    '#chatbot-send{',
      'background:#2c3e50;color:#fff;border:none;',
      'border-radius:8px;padding:8px 14px;cursor:pointer;',
      'font-size:13px;font-weight:600;white-space:nowrap;flex-shrink:0;',
    '}',
    '#chatbot-send:hover{background:#1a252f;}',
    '#chatbot-send:disabled{background:#aaa;cursor:default;}',
    '@media(max-width:400px){',
      '#chatbot-panel{width:calc(100vw - 32px);right:16px;}',
    '}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ── markup ──────────────────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.innerHTML = [
    '<button id="chatbot-btn" aria-label="Open chat" title="Ask about Kieran\'s work">',
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      '</svg>',
    '</button>',
    '<div id="chatbot-panel" class="chatbot-hidden" role="dialog" aria-label="Chat with Kieran\'s AI assistant" aria-modal="true">',
      '<div id="chatbot-header">',
        '<span>Ask about Kieran\'s work</span>',
        '<button id="chatbot-close" aria-label="Close chat">&times;</button>',
      '</div>',
      '<div id="chatbot-messages" aria-live="polite">',
        '<div class="cb-msg cb-bot">Hi! I\'m an AI assistant for this site. Ask me about Kieran\'s experience, projects, or skills.</div>',
      '</div>',
      '<div id="chatbot-typing">Thinking…</div>',
      '<div id="chatbot-input-row">',
        '<textarea id="chatbot-input" placeholder="Ask a question…" rows="1" maxlength="500" aria-label="Your message"></textarea>',
        '<button id="chatbot-send">Send</button>',
      '</div>',
    '</div>',
  ].join('');
  document.body.appendChild(wrap);

  /* ── refs ────────────────────────────────────────────────────────── */
  var btn     = document.getElementById('chatbot-btn');
  var panel   = document.getElementById('chatbot-panel');
  var closeEl = document.getElementById('chatbot-close');
  var msgsEl  = document.getElementById('chatbot-messages');
  var typingEl= document.getElementById('chatbot-typing');
  var inputEl = document.getElementById('chatbot-input');
  var sendEl  = document.getElementById('chatbot-send');

  var history  = [];
  var loading  = false;
  var isOpen   = false;

  /* ── helpers ─────────────────────────────────────────────────────── */
  function open() {
    isOpen = true;
    panel.classList.remove('chatbot-hidden');
    btn.setAttribute('aria-expanded', 'true');
    inputEl.focus();
  }

  function close() {
    isOpen = false;
    panel.classList.add('chatbot-hidden');
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  function addMsg(text, cls) {
    var div = document.createElement('div');
    div.className = 'cb-msg ' + cls;
    div.textContent = text;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function setLoading(on) {
    loading = on;
    sendEl.disabled = on;
    typingEl.style.display = on ? 'block' : 'none';
  }

  /* ── send ────────────────────────────────────────────────────────── */
  function send() {
    var text = inputEl.value.trim();
    if (!text || loading) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    setLoading(true);
    addMsg(text, 'cb-user');
    msgsEl.scrollTop = msgsEl.scrollHeight;

    var body = JSON.stringify({ message: text, history: history });

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        setLoading(false);
        if (result.ok && result.data.reply) {
          addMsg(result.data.reply, 'cb-bot');
          history.push({ role: 'user', content: text });
          history.push({ role: 'assistant', content: result.data.reply });
          if (history.length > MAX_HISTORY) {
            history = history.slice(-MAX_HISTORY);
          }
        } else {
          addMsg(result.data.error || 'Something went wrong. Please try again.', 'cb-err');
        }
      })
      .catch(function () {
        setLoading(false);
        addMsg('Network error — please check your connection and try again.', 'cb-err');
      });
  }

  /* ── events ──────────────────────────────────────────────────────── */
  btn.addEventListener('click', function () { isOpen ? close() : open(); });
  closeEl.addEventListener('click', close);

  sendEl.addEventListener('click', send);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // auto-grow textarea
  inputEl.addEventListener('input', function () {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px';
  });

  // close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });
}());
