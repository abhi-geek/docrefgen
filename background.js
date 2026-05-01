// background.js — DocRefGen
// Handles OAuth token management and Google Sheets logging

// ─── OAuth Token ─────────────────────────────────────────────────────────────

async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// ─── Sheet Logging ────────────────────────────────────────────────────────────

async function logToSheet({ refNumber, docTitle, docUrl, docType, userEmail, timestamp }) {
  const settings = await chrome.storage.sync.get(['sheetId']);
  if (!settings.sheetId) return { success: false, reason: 'no_sheet' };

  try {
    const token = await getAuthToken(true);
    const sheetId = settings.sheetId;
    const range = 'Sheet1!A:F';
    const values = [[refNumber, docTitle, docUrl, docType || '—', userEmail || '—', timestamp]];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error('Sheet log error:', err);
      return { success: false, reason: 'api_error', detail: err };
    }

    return { success: true };
  } catch (err) {
    console.error('Sheet log failed:', err);
    return { success: false, reason: 'exception', detail: err.message };
  }
}

// ─── Sheet Header Setup ───────────────────────────────────────────────────────
// Called once when user verifies sheet — writes column headers if not present

async function initSheetHeaders(sheetId) {
  try {
    // interactive=true so Chrome prompts for Google login if needed
    const token = await getAuthToken(true);
    if (!token) return { success: false, reason: 'no_token' };

    const headers = [['Ref Number', 'Doc Title', 'Doc Link', 'Doc Type', 'Created By', 'Date & Time']];

    // Check if A1 already has content — skip writing if headers exist
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const checkData = await checkRes.json();
    if (checkData.values && checkData.values.length > 0) {
      return { success: true, reason: 'already_exists' };
    }

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: headers }),
      }
    );

    if (!writeRes.ok) {
      const err = await writeRes.json();
      return { success: false, reason: 'write_failed', detail: JSON.stringify(err) };
    }

    return { success: true };
  } catch (err) {
    return { success: false, reason: 'exception', detail: err.message };
  }
}

// ─── Get User Email ───────────────────────────────────────────────────────────

async function getUserEmail() {
  try {
    const token = await getAuthToken(false);
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    // interactive=true so user gets Google login prompt when needed
    getAuthToken(true)
      .then((token) => sendResponse({ token }))
      .catch((err) => sendResponse({ token: null, error: err.message }));
    return true;
  }

});
