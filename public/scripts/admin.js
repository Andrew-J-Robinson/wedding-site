(() => {
  const loginSection = document.getElementById('admin-login');
  const panelsSection = document.getElementById('admin-panels');
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.getElementById('admin-login-btn');
  const loginStatus = document.getElementById('admin-login-status');

  const fileInput = document.getElementById('admin-file');
  const rawInput = document.getElementById('admin-raw');
  const previewEl = document.getElementById('admin-preview');
  const uploadBtn = document.getElementById('admin-save-invitees');
  const uploadStatus = document.getElementById('admin-upload-status');

  const refreshBtn = document.getElementById('admin-refresh');
  const rsvpRows = document.getElementById('admin-rsvp-rows');
  const rsvpStatus = document.getElementById('admin-rsvp-status');
  const countYes = document.getElementById('count-yes');
  const countMaybe = document.getElementById('count-maybe');
  const countNo = document.getElementById('count-no');

  let token = localStorage.getItem('adminToken') || '';
  let previewData = [];

  const setLoginStatus = (msg, tone = 'info') => {
    loginStatus.textContent = msg;
    loginStatus.className = `text-sm ${tone === 'error' ? 'text-rose-600' : 'text-slate-600'}`;
  };

  const setUploadStatus = (msg, tone = 'info') => {
    uploadStatus.textContent = msg;
    uploadStatus.className = `text-sm ${tone === 'error' ? 'text-rose-600' : 'text-slate-600'}`;
  };

  const setRsvpStatus = (msg, tone = 'info') => {
    rsvpStatus.textContent = msg;
    rsvpStatus.className = `text-sm ${tone === 'error' ? 'text-rose-600' : 'text-slate-600'}`;
  };

  const setAuthed = (authed) => {
    if (authed) {
      loginSection.classList.add('hidden');
      panelsSection.classList.remove('hidden');
    }
  };

  const login = async () => {
    const password = passwordInput.value.trim();
    if (!password) return setLoginStatus('Enter password to continue', 'error');
    setLoginStatus('Signing in...');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('bad');
      const data = await res.json();
      token = data.token;
      localStorage.setItem('adminToken', token);
      setLoginStatus('Signed in');
      setAuthed(true);
      await refreshRsvps();
    } catch (err) {
      setLoginStatus('Incorrect password', 'error');
    }
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    let headers = ['name', 'party', 'contact'];
    const maybeHeaders = lines[0].toLowerCase();
    if (maybeHeaders.includes('name') && maybeHeaders.includes('party')) {
      headers = lines.shift().split(',').map((h) => h.trim().toLowerCase());
    }
    return lines.map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const entry = {};
      headers.forEach((h, idx) => {
        entry[h] = cols[idx];
      });
      return {
        name: entry.name || '',
        party: Number(entry.party) || 1,
        contact: entry.contact || '',
      };
    }).filter((e) => e.name);
  };

  const updatePreview = (data) => {
    previewData = data;
    previewEl.textContent = JSON.stringify(data, null, 2);
  };

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
        updatePreview(parsed);
      } else {
        updatePreview(parseCsv(text));
      }
      setUploadStatus('Preview loaded');
    } catch (err) {
      setUploadStatus('Could not parse file', 'error');
    }
  });

  rawInput?.addEventListener('input', () => {
    try {
      if (!rawInput.value.trim()) return updatePreview([]);
      const parsed = JSON.parse(rawInput.value);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
      updatePreview(parsed);
      setUploadStatus('Preview from pasted JSON');
    } catch (err) {
      setUploadStatus('Invalid JSON', 'error');
    }
  });

  uploadBtn?.addEventListener('click', async () => {
    if (!token) return setUploadStatus('Please login first', 'error');
    if (!previewData.length) return setUploadStatus('No data to upload', 'error');
    setUploadStatus('Uploading...');
    try {
      const res = await fetch('/api/invitees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(previewData),
      });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      setUploadStatus(`Saved invitees (${data.count})`);
    } catch (err) {
      setUploadStatus('Upload failed', 'error');
    }
  });

  const refreshRsvps = async () => {
    if (!token) return setRsvpStatus('Login to view RSVPs', 'error');
    setRsvpStatus('Loading RSVPs...');
    try {
      const res = await fetch('/api/rsvps', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const rows = data.results || [];
      rsvpRows.innerHTML = rows
        .map(
          (row) => `
            <tr>
              <td class="px-3 py-2">${row.name}</td>
              <td class="px-3 py-2 capitalize">${row.rsvp}</td>
              <td class="px-3 py-2 text-slate-600">${row.allergies || ''}</td>
              <td class="px-3 py-2 text-slate-600">${row.note || ''}</td>
              <td class="px-3 py-2 text-xs text-slate-500">${new Date(row.createdAt).toLocaleString()}</td>
            </tr>
          `
        )
        .join('');
      const yes = rows.filter((r) => r.rsvp === 'yes').length;
      const maybe = rows.filter((r) => r.rsvp === 'maybe').length;
      const no = rows.filter((r) => r.rsvp === 'no').length;
      countYes.textContent = yes;
      countMaybe.textContent = maybe;
      countNo.textContent = no;
      setRsvpStatus(`Loaded ${rows.length} response(s)`);
    } catch (err) {
      setRsvpStatus('Could not load RSVPs', 'error');
    }
  };

  loginBtn?.addEventListener('click', login);
  passwordInput?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') login();
  });
  refreshBtn?.addEventListener('click', refreshRsvps);

  // Auto-enable if token exists
  if (token) {
    setAuthed(true);
    refreshRsvps();
  }
})();
