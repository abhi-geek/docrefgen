// popup.js — DocRefGen

let lastGeneratedRef = null;
let alreadyLogged = false;

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setFeedback(msg, type = 'ok') {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = 'feedback' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : '');
  if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 5000);
}

function setPlaceholderStatus(type, text) {
  const el = document.getElementById('placeholder-status');
  const textEl = document.getElementById('placeholder-text');
  el.className = `placeholder-status status-${type}`;
  textEl.textContent = text;
}

function showRef(ref) {
  lastGeneratedRef = ref;
  alreadyLogged = false;
  const box = document.getElementById('ref-box');
  box.classList.remove('empty');
  document.getElementById('ref-value').textContent = ref;
  document.getElementById('btn-copy').disabled = false;
  // Reset log button to ready state
  const logBtn = document.getElementById('btn-log');
  logBtn.classList.remove('logged');
  logBtn.disabled = false;
  logBtn.innerHTML = '↗ Log to Audit Sheet';
}

function showOAuthWarning(visible) {
  document.getElementById('oauth-warning').classList.toggle('visible', visible);
}

async function init() {
  const tab = await getCurrentTab();
  const isGoogleDoc = tab?.url?.includes('docs.google.com/document');

  document.getElementById('not-doc-state').style.display = isGoogleDoc ? 'none' : 'block';
  document.getElementById('main-state').style.display = isGoogleDoc ? 'block' : 'none';
  if (!isGoogleDoc) return;

  // Get doc info
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'GET_DOC_INFO' });
    document.getElementById('doc-title').textContent = info?.title || 'Untitled';

    if (info?.error) {
      const isAuthErr = /token|oauth|permission|401|403/i.test(info.error);
      if (isAuthErr) showOAuthWarning(true);
      setPlaceholderStatus('error', 'API error — check OAuth setup');
      return;
    }

    if (info?.hasPlaceholder) {
      setPlaceholderStatus('found', '{{DOC-REF-NO}} found');
    } else if (info?.hasRef) {
      setPlaceholderStatus('found', `${info.existingRef}`);
      showRef(info.existingRef);
    } else if (info?.isCopy) {
      setPlaceholderStatus('copy', 'Copy detected — generate new ref?');
    } else {
      setPlaceholderStatus('missing', '{{DOC-REF-NO}} not found');
    }

  } catch {
    document.getElementById('doc-title').textContent = 'Could not read doc';
    setPlaceholderStatus('error', 'Reload the doc and try again');
  }

  // ── Generate & Insert ─────────────────────────────────────────────────────
  document.getElementById('btn-generate').addEventListener('click', async () => {
    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    btn.textContent = 'Working…';

    try {
      const result = await chrome.tabs.sendMessage(tab.id, { type: 'GENERATE_AND_INSERT' });

      if (result?.success) {
        showRef(result.refNumber);
        setPlaceholderStatus('found', result.refNumber);
        setFeedback('✅ Inserted into doc.');
      } else {
        const reason = result?.reason || 'Unknown error';
        const isAuthErr = /token|401|403/i.test(reason);
        if (isAuthErr) showOAuthWarning(true);
        if (reason === 'no_placeholder') {
          setPlaceholderStatus('missing', '{{DOC-REF-NO}} not found');
          setFeedback('Add {{DOC-REF-NO}} to your doc first.', 'warn');
        } else {
          setFeedback(reason, 'error');
        }
      }
    } catch {
      setFeedback('Could not reach doc. Reload and try again.', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '✦ Generate Ref &amp; Insert into Doc';
  });

  // ── Copy ──────────────────────────────────────────────────────────────────
  document.getElementById('btn-copy').addEventListener('click', async () => {
    if (!lastGeneratedRef) return;
    try {
      await navigator.clipboard.writeText(lastGeneratedRef);
      setFeedback('Copied to clipboard!');
      const btn = document.getElementById('btn-copy');
      const orig = btn.innerHTML;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    } catch {
      setFeedback('Copy failed — select and copy manually.', 'error');
    }
  });

  // ── Log to Sheet ──────────────────────────────────────────────────────────
  document.getElementById('btn-log').addEventListener('click', async () => {
    if (alreadyLogged) return;

    const settings = await chrome.storage.sync.get(['sheetId', 'docTypePrefix']);
    if (!settings.sheetId) {
      setFeedback('No audit sheet linked. Go to Settings first.', 'error');
      return;
    }

    const btn = document.getElementById('btn-log');
    btn.disabled = true;
    btn.textContent = 'Logging…';

    // Use lastGeneratedRef if available, else use whatever ref is showing
    const refToLog = lastGeneratedRef || document.getElementById('ref-value').textContent;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'LOG_TO_SHEET',
        payload: {
          refNumber: refToLog,
          docTitle: document.getElementById('doc-title').textContent,
          docUrl: tab.url?.split('?')[0] || '',
          docType: settings.docTypePrefix || '—',
          userEmail: '—',
          timestamp: new Date().toLocaleString(),
        }
      });

      if (result?.success) {
        alreadyLogged = true;
        setFeedback('✅ Logged to audit sheet.');
        btn.classList.add('logged');
        btn.innerHTML = '✓ Logged to Sheet';
        btn.disabled = true;
      } else {
        setFeedback(`Sheet error: ${result?.reason || 'unknown'}`, 'error');
        btn.disabled = false;
        btn.innerHTML = '↗ Log to Audit Sheet';
      }
    } catch {
      setFeedback('Could not log to sheet.', 'error');
      btn.disabled = false;
      btn.innerHTML = '↗ Log to Audit Sheet';
    }
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  ['open-settings', 'open-settings-footer'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  });
}

init();
