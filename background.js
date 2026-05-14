// background.js — DocRefGen

// ─── OAuth Token ─────────────────────────────────────────────────────────────

async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!token) reject(new Error('No token returned'));
      else resolve(token);
    });
  });
}

async function removeCachedToken(token) {
  return new Promise((resolve) => chrome.identity.removeCachedAuthToken({ token }, resolve));
}

// ─── Fetch Helpers ────────────────────────────────────────────────────────────

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

// Adds Authorization header; on 401 removes stale cached token, gets fresh one, retries once.
async function fetchWithAuth(token, url, options = {}) {
  const { headers: extra = {}, ...rest } = options;
  const makeReq = (tok) =>
    timedFetch(url, { ...rest, headers: { ...extra, Authorization: `Bearer ${tok}` } });

  let res = await makeReq(token);
  if (res.status === 401) {
    await removeCachedToken(token);
    const fresh = await getAuthToken(true);
    res = await makeReq(fresh);
  }
  return res;
}

// ─── Sheet Logging ────────────────────────────────────────────────────────────

async function logToSheet({ refNumber, docTitle, docUrl, docType, userEmail, timestamp }) {
  const { sheetId } = await chrome.storage.sync.get(['sheetId']);
  if (!sheetId) return { success: false, reason: 'No audit sheet linked. Go to Settings.' };

  try {
    const token = await getAuthToken(true);
    const values = [[refNumber, docTitle, docUrl, docType || '—', userEmail || '—', timestamp]];

    const res = await fetchWithAuth(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:F:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch { /* ignore parse error */ }
      if (res.status === 401 || res.status === 403) {
        return { success: false, reason: 'Auth error — re-open the extension to sign in.' };
      }
      if (res.status === 404) {
        return { success: false, reason: 'Sheet not found — check Sheet ID in Settings.' };
      }
      return { success: false, reason: body?.error?.message || `Sheet API error (${res.status})` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message || 'Connection failed — check your network.' };
  }
}

// ─── Sheet Header Setup ───────────────────────────────────────────────────────

async function initSheetHeaders(sheetId) {
  try {
    const token = await getAuthToken(true);

    const checkRes = await fetchWithAuth(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1`
    );
    if (!checkRes.ok) {
      let body = {};
      try { body = await checkRes.json(); } catch { /* ignore */ }
      if (checkRes.status === 401 || checkRes.status === 403) {
        return { success: false, reason: 'Auth error — try signing in again.' };
      }
      if (checkRes.status === 404) {
        return { success: false, reason: 'Sheet not found — check the Sheet ID.' };
      }
      return { success: false, reason: body?.error?.message || `Sheet API error (${checkRes.status})` };
    }

    const checkData = await checkRes.json();
    if (checkData.values?.length > 0) return { success: true, reason: 'already_exists' };

    const headers = [['Ref Number', 'Doc Title', 'Doc Link', 'Doc Type', 'Created By', 'Date & Time']];
    const writeRes = await fetchWithAuth(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: headers }),
      }
    );

    if (!writeRes.ok) {
      let body = {};
      try { body = await writeRes.json(); } catch { /* ignore */ }
      return { success: false, reason: body?.error?.message || `Write failed (${writeRes.status})` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message || 'Connection failed — check your network.' };
  }
}

// ─── Get User Email ───────────────────────────────────────────────────────────

async function getUserEmail() {
  try {
    // Try silent first; escalate to interactive if no cached token exists.
    let token;
    try { token = await getAuthToken(false); } catch { token = await getAuthToken(true); }
    const res = await fetchWithAuth(token, 'https://www.googleapis.com/oauth2/v2/userinfo');
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'LOG_TO_SHEET') {
    logToSheet(message.payload).then(sendResponse);
    return true;
  }

  if (message.type === 'INIT_SHEET_HEADERS') {
    initSheetHeaders(message.sheetId).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_USER_EMAIL') {
    getUserEmail().then((email) => sendResponse({ email }));
    return true;
  }

  if (message.type === 'GET_AUTH_TOKEN') {
    const doGet = async () => {
      // content.js passes staleToken when it needs a force-refresh after a 401
      if (message.forceRefresh && message.staleToken) {
        await removeCachedToken(message.staleToken);
      }
      return getAuthToken(true);
    };
    doGet()
      .then((token) => sendResponse({ token }))
      .catch((err) => sendResponse({ token: null, error: err.message }));
    return true;
  }

});
