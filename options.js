// options.js — DocRefGen

function extractSheetId(input) {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

function updatePreview() {
  const company = (document.getElementById('company-prefix').value || 'AMZ').toUpperCase().slice(0, 5);
  const docType = (document.getElementById('doc-type-prefix').value || '').toUpperCase().slice(0, 6);
  const year = new Date().getFullYear();
  const shortTs = String(Date.now()).slice(-6);
  const preview = docType ? `${company}-${docType}-${year}-${shortTs}` : `${company}-${year}-${shortTs}`;
  document.getElementById('live-preview').textContent = preview;
}

async function loadSettings() {
  const s = await chrome.storage.sync.get(['companyPrefix', 'docTypePrefix', 'sheetId', 'auditEnabled']);
  if (s.companyPrefix) document.getElementById('company-prefix').value = s.companyPrefix;
  if (s.docTypePrefix) document.getElementById('doc-type-prefix').value = s.docTypePrefix;
  if (s.sheetId) document.getElementById('sheet-id').value = s.sheetId;

  const auditEnabled = s.auditEnabled || false;
  document.getElementById('audit-toggle').checked = auditEnabled;
  document.getElementById('sheet-section').style.display = auditEnabled ? 'block' : 'none';
  updatePreview();
}

async function saveSettings() {
  const companyPrefix = document.getElementById('company-prefix').value.trim().toUpperCase();
  if (!companyPrefix) return showStatus('Company prefix is required.', true);

  const docTypePrefix = document.getElementById('doc-type-prefix').value.trim().toUpperCase();
  const sheetRaw = document.getElementById('sheet-id').value.trim();
  const sheetId = sheetRaw ? extractSheetId(sheetRaw) : '';
  const auditEnabled = document.getElementById('audit-toggle').checked;

  await chrome.storage.sync.set({ companyPrefix, docTypePrefix, sheetId, auditEnabled, enabled: true });
  showStatus('✅ Settings saved!');
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = 'save-status' + (isError ? ' error' : '');
  setTimeout(() => { el.textContent = ''; }, 3000);
}

async function verifySheet() {
  const raw = document.getElementById('sheet-id').value.trim();
  if (!raw) return;
  const sheetId = extractSheetId(raw);
  const statusEl = document.getElementById('sheet-status');
  statusEl.textContent = 'Connecting…';
  statusEl.style.color = 'var(--muted)';

  try {
    const result = await chrome.runtime.sendMessage({ type: 'INIT_SHEET_HEADERS', sheetId });
    if (result?.success) {
      statusEl.textContent = '✅ Connected! Column headers written.';
      statusEl.style.color = 'var(--green)';
      document.getElementById('sheet-id').value = sheetId;
    } else {
      statusEl.textContent = `❌ Failed: ${result?.reason || 'Check sheet ID and permissions.'}`;
      statusEl.style.color = 'var(--danger)';
    }
  } catch {
    statusEl.textContent = '❌ Could not connect. Check sheet ID.';
    statusEl.style.color = 'var(--danger)';
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
document.getElementById('company-prefix').addEventListener('input', updatePreview);
document.getElementById('doc-type-prefix').addEventListener('input', updatePreview);

document.getElementById('audit-toggle').addEventListener('change', (e) => {
  document.getElementById('sheet-section').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('verify-btn').addEventListener('click', verifySheet);
document.getElementById('save-btn').addEventListener('click', saveSettings);

document.getElementById('reset-btn').addEventListener('click', async () => {
  await chrome.storage.sync.clear();
  document.getElementById('company-prefix').value = '';
  document.getElementById('doc-type-prefix').value = '';
  document.getElementById('sheet-id').value = '';
  document.getElementById('audit-toggle').checked = false;
  document.getElementById('sheet-section').style.display = 'none';
  updatePreview();
  showStatus('Settings reset.');
});

loadSettings();
