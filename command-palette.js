// command-palette.js — Cmd/Ctrl+K quick navigation
(function () {
  'use strict';

  var dialog = document.getElementById('cmdk-dialog');
  if (!dialog) return;

  var langUrl     = dialog.getAttribute('data-lang-url') || '';
  var currentLang = dialog.getAttribute('data-lang') || 'en';
  var pathPrefix  = currentLang === 'ja' ? '/ja' : '';

  var input    = dialog.querySelector('.cmdk-input');
  var listEl   = dialog.querySelector('.cmdk-list');
  var emptyEl  = dialog.querySelector('.cmdk-empty');

  var EMAIL = 'kieranmaynard@gmail.com';

  var COMMANDS = [
    { label: 'Home',                        hint: 'Overview & featured work',         url: pathPrefix + '/',                      keywords: 'index landing' },
    { label: 'Work',                        hint: 'Portfolio projects',               url: pathPrefix + '/work.html',             keywords: 'projects portfolio' },
    { label: 'Publications & Awards',       hint: 'Recognition',                      url: pathPrefix + '/#publications',         keywords: 'awards papers transparency report' },
    { label: 'Transparency Report dashboard', hint: 'Google gov removals — interactive', url: pathPrefix + '/transparency.html',   keywords: 'google government removals data analysis dashboard charts' },
    { label: 'Filter projects: AI / LLM',   hint: 'RAG, Gemini, prompt engineering',  url: '/work.html?filter=ai-llm',            keywords: 'rag gemini llm prompt' },
    { label: 'Filter projects: Compliance', hint: 'CMA, EU DSA, transparency',        url: '/work.html?filter=compliance',        keywords: 'cma dsa regulatory' },
    { label: 'Filter projects: Data & SQL', hint: 'SQL, ETL, pipelines',              url: '/work.html?filter=data',              keywords: 'sql etl bigquery' },
    { label: 'Filter projects: Automation', hint: 'Chrome ext, AppsScript',           url: '/work.html?filter=automation',        keywords: 'chrome browser appsscript' },
    { label: 'Copy email address',          hint: EMAIL,                              action: 'copy-email',                       keywords: 'contact mail' },
    { label: 'Email Kieran',                hint: 'Compose new message',              url: 'mailto:' + EMAIL,                     keywords: 'contact mail' },
    { label: 'LinkedIn',                    hint: 'Open profile',                     url: 'https://linkedin.com/in/KieranMaynard', external: true, keywords: 'social' },
    { label: 'GitHub',                      hint: '@krmaynard',                       url: 'https://github.com/krmaynard',          external: true, keywords: 'code repos' }
  ];

  if (langUrl) {
    COMMANDS.push({
      label: currentLang === 'ja' ? 'Switch to English' : '日本語で読む',
      hint: 'Language switch',
      url: langUrl,
      keywords: 'language japanese english nihongo'
    });
  }

  var filtered = COMMANDS.slice();
  var cursor = 0;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    listEl.innerHTML = '';
    if (filtered.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    var frag = document.createDocumentFragment();
    filtered.forEach(function (cmd, i) {
      var li = document.createElement('li');
      li.className = 'cmdk-item' + (i === cursor ? ' is-active' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === cursor ? 'true' : 'false');
      li.setAttribute('data-index', String(i));
      li.innerHTML =
        '<span class="cmdk-label">' + escapeHtml(cmd.label) + '</span>' +
        '<span class="cmdk-hint">' + escapeHtml(cmd.hint || '') + '</span>';
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
  }

  function applyFilter(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) {
      filtered = COMMANDS.slice();
    } else {
      var terms = q.split(/\s+/);
      filtered = COMMANDS.filter(function (cmd) {
        var hay = (cmd.label + ' ' + (cmd.hint || '') + ' ' + (cmd.keywords || '')).toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    cursor = 0;
    render();
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'cmdk-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 1600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2200);
  }

  function activate(cmd) {
    if (!cmd) return;
    closeDialog();
    if (cmd.action === 'copy-email') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(EMAIL).then(
          function () { toast('Email copied to clipboard'); },
          function () { window.location.href = 'mailto:' + EMAIL; }
        );
      } else {
        window.location.href = 'mailto:' + EMAIL;
      }
      return;
    }
    if (cmd.url) {
      if (cmd.external) window.open(cmd.url, '_blank', 'noopener');
      else              window.location.href = cmd.url;
    }
  }

  function openDialog() {
    if (dialog.open) return;
    input.value = '';
    applyFilter('');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setTimeout(function () { input.focus(); }, 0);
  }

  function closeDialog() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function scrollCursorIntoView() {
    var el = listEl.querySelector('.cmdk-item.is-active');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (dialog.open) closeDialog(); else openDialog();
    }
  });

  input.addEventListener('keydown', function (e) {
    if (filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = (cursor + 1) % filtered.length;
      render();
      scrollCursorIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = (cursor - 1 + filtered.length) % filtered.length;
      render();
      scrollCursorIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(filtered[cursor]);
    }
  });

  input.addEventListener('input', function () { applyFilter(input.value); });

  listEl.addEventListener('click', function (e) {
    var li = e.target.closest('.cmdk-item');
    if (!li) return;
    activate(filtered[+li.getAttribute('data-index')]);
  });

  listEl.addEventListener('mousemove', function (e) {
    var li = e.target.closest('.cmdk-item');
    if (!li) return;
    var i = +li.getAttribute('data-index');
    if (i !== cursor) {
      cursor = i;
      listEl.querySelectorAll('.cmdk-item').forEach(function (n, idx) {
        var active = idx === cursor;
        n.classList.toggle('is-active', active);
        n.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-open-cmdk]'), function (btn) {
    btn.addEventListener('click', openDialog);
  });

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  Array.prototype.forEach.call(document.querySelectorAll('.cmdk-shortcut'), function (el) {
    el.textContent = isMac ? '⌘K' : 'Ctrl K';
  });

  render();
})();
