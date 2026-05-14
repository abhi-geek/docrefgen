// content.js — DocRefGen
// No auto-trigger. Responds only to explicit messages from popup.

const PLACEHOLDER = '{{DOC-REF-NO}}';
const REF_PATTERN = /[A-Z]{2,5}-(?:[A-Z]{2,6}-)?20\d{2}-\d{6}/;

// ── Utilities ─────────────────────────────────────────────────────────────────

function getDocId() {
  const match = window.location.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function getDocTitle() {
  const el = document.querySelector('.docs-title-input');
  return el ? (el.value || el.innerText || '').trim() : document.title;
}

function isCopyDoc() {
  return getDocTitle().toLowerCase().startsWith('copy of');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

// staleToken: when provided, background removes it from cache before issuing a fresh one.
function getAuthToken(staleToken = null) {
  return new Promise((resolve, reject) => {
    const msg = { type: 'GET_AUTH_TOKEN' };
    if (staleToken) { msg.forceRefresh = true; msg.staleToken = staleToken; }
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        const err = chrome.runtime.lastError.message || '';
        // Extension was updated while page was open — content script context is severed.
        if (/context invalidated/i.test(err)) return reject(new Error('CONTEXT_INVALIDATED'));
        return reject(new Error(err));
      }
      if (!res?.token) return reject(new Error(res?.error || 'No token returned'));
      resolve(res.token);
    });
  });
}

// ── Fetch Helpers ─────────────────────────────────────────────────────────────

// Wraps fetch with a 10s AbortController timeout.
function timedFetch(url, options) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 10_000);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(id))
    .catch((err) => {
      if (err.name === 'AbortError') throw new Error('Connection timed out — try again.');
      throw err;
    });
}

// Adds Authorization header; on 401 forces a token refresh via background and retries once.
async function fetchDocApi(token, url, options = {}) {
  const { headers: extra = {}, ...rest } = options;
  const makeReq = (tok) =>
    timedFetch(url, { ...rest, headers: { ...extra, Authorization: `Bearer ${tok}` } });

  let res = await makeReq(token);
  if (res.status === 401) {
    const fresh = await getAuthToken(token); // pass stale token to force cache removal
    res = await makeReq(fresh);
  }
  return res;
}

// ── Extract text from a list of structural elements ───────────────────────────

function extractTextFromElements(elements = []) {
  let text = '';
  for (const el of elements) {
    text += el.textRun?.content || '';
    if (el.table) {
      for (const row of (el.table.tableRows || [])) {
        for (const cell of (row.tableCells || [])) {
          text += extractTextFromContent(cell.content || []);
        }
      }
    }
  }
  return text;
}

function extractTextFromContent(content = []) {
  let text = '';
  for (const block of content) {
    text += extractTextFromElements(block.paragraph?.elements || []);
  }
  return text;
}

// ── Read ALL doc text via Docs API — body + headers + footers ─────────────────
// Critical: Google Docs renders in canvas so DOM reads don't work.
// Headers/footers are stored separately in doc.headers and doc.footers objects.

async function getDocData() {
  const docId = getDocId();
  if (!docId) return { text: '', docData: null, error: 'Could not get document ID from URL.' };

  try {
    const token = await getAuthToken();
    const res = await fetchDocApi(token, `https://docs.googleapis.com/v1/documents/${docId}`);

    if (res.status === 401 || res.status === 403) {
      return { text: '', docData: null, error: 'Permission denied. Check OAuth scopes.' };
    }
    if (!res.ok) {
      return { text: '', docData: null, error: `Docs API error: ${res.status}` };
    }

    const data = await res.json();
    let text = '';
    text += extractTextFromContent(data?.body?.content || []);
    for (const header of Object.values(data?.headers || {})) {
      text += extractTextFromContent(header.content || []);
    }
    for (const footer of Object.values(data?.footers || {})) {
      text += extractTextFromContent(footer.content || []);
    }

    return { text, docData: data, error: null };
  } catch (err) {
    return { text: '', docData: null, error: err.message };
  }
}

// ── Replace in doc — replaceAllText covers body + headers + footers ───────────
// Google's replaceAllText request searches the entire document including headers/footers.

async function replaceInDoc(searchText, replaceText) {
  const docId = getDocId();
  if (!docId) throw new Error('No document ID found in URL.');

  const token = await getAuthToken();
  const res = await fetchDocApi(token, `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        replaceAllText: {
          containsText: { text: searchText, matchCase: true },
          replaceText: replaceText,
        }
      }]
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Docs API error: ${res.status}`);
  return data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
}

// ── Generate ref number ────────────────────────────────────────────────────────

async function generateRefNumber() {
  const s = await chrome.storage.sync.get(['companyPrefix', 'docTypePrefix']);
  const company = (s.companyPrefix || 'DOC').toUpperCase().slice(0, 5);
  const docType = (s.docTypePrefix || '').toUpperCase().slice(0, 6);
  const year = new Date().getFullYear();
  const shortTs = String(Date.now()).slice(-6);
  return docType ? `${company}-${docType}-${year}-${shortTs}` : `${company}-${year}-${shortTs}`;
}

// ── Message handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'GET_DOC_INFO') {
    (async () => {
      const { text, error } = await getDocData();
      if (error && !text) {
        return sendResponse({ title: getDocTitle(), hasPlaceholder: false, hasRef: false, existingRef: null, isCopy: isCopyDoc(), error });
      }
      const hasPlaceholder = text.includes(PLACEHOLDER);
      const refMatch = text.match(REF_PATTERN);
      sendResponse({
        title: getDocTitle(),
        hasPlaceholder,
        hasRef: !!refMatch,
        existingRef: refMatch ? refMatch[0] : null,
        isCopy: isCopyDoc(),
        error: null,
      });
    })();
    return true;
  }

  if (message.type === 'GENERATE_AND_INSERT') {
    (async () => {
      try {
        const { text, error } = await getDocData();
        if (error && !text) return sendResponse({ success: false, reason: error });

        const hasPlaceholder = text.includes(PLACEHOLDER);
        const refMatch = text.match(REF_PATTERN);
        const isCopy = isCopyDoc();

        let searchText = null;
        if (hasPlaceholder) {
          searchText = PLACEHOLDER;
        } else if (isCopy && refMatch) {
          searchText = refMatch[0];
        }

        if (!searchText) return sendResponse({ success: false, reason: 'no_placeholder' });

        const refNumber = await generateRefNumber();
        const replaced = await replaceInDoc(searchText, refNumber);

        if (replaced > 0) {
          sendResponse({ success: true, refNumber });
        } else {
          sendResponse({ success: false, reason: 'Placeholder found but 0 replacements made.' });
        }
      } catch (err) {
        sendResponse({ success: false, reason: err.message });
      }
    })();
    return true;
  }

});
