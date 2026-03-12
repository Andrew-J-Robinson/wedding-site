(() => {
  const loginSection = document.getElementById('admin-login');
  const panelsSection = document.getElementById('admin-panels');
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.getElementById('admin-login-btn');
  const loginStatus = document.getElementById('admin-login-status');

  let token = localStorage.getItem('adminToken') || '';
  let previewData = [];
  let households = [];
  let events = [];
  let guests = [];

  const handleUnauthorized = () => {
    token = '';
    localStorage.removeItem('adminToken');
    loginSection.classList.remove('hidden');
    panelsSection.classList.add('hidden');
    setLoginStatus('Session expired. Please log in again.');
  };

  const api = async (path, options = {}) => {
    const headers = { ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) handleUnauthorized();
    return res;
  };

  const setLoginStatus = (msg, tone = 'info') => {
    loginStatus.textContent = msg;
    loginStatus.className = `text-sm ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const setAuthed = (authed) => {
    if (authed) {
      loginSection.classList.add('hidden');
      panelsSection.classList.remove('hidden');
      loadTabData();
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
    } catch (err) {
      setLoginStatus('Incorrect password', 'error');
    }
  };

  // ----- Tabs -----
  const tabPanels = document.querySelectorAll('[data-tab-panel]');
  const tabButtons = document.querySelectorAll('.admin-tab');

  const showTab = (tabId) => {
    tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });
    tabButtons.forEach((btn) => {
      const on = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('border-magenta', on);
      btn.classList.toggle('bg-blush/40', on);
      btn.classList.toggle('text-magenta', on);
      btn.classList.toggle('border-blush/60', !on);
    });
    loadTabData(tabId);
  };

  const loadTabData = (activeTab) => {
    const current = activeTab || (document.querySelector('[data-tab-panel].active')?.id?.replace('panel-', '') || 'guests');
    if (current === 'guests') {
      loadHouseholds();
      loadEvents();
      loadGuests();
      loadRsvpSettingsForGuests();
      refreshRsvps();
    } else if (current === 'rsvp-controls') {
      loadRsvpControls();
    } else if (current === 'checklist') {
      loadChecklist();
    } else if (current === 'vendors') {
      loadVendors();
    }
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.getAttribute('data-tab')));
  });

  // ----- Guests -----
  const fileInput = document.getElementById('guests-file');
  const rawInput = document.getElementById('guests-raw');
  const previewEl = document.getElementById('guests-preview');
  const uploadBtn = document.getElementById('guests-save-import');
  const importStatus = document.getElementById('guests-import-status');
  const guestsTbody = document.getElementById('guests-tbody');
  const guestsListStatus = document.getElementById('guests-list-status');

  const setImportStatus = (msg, tone = 'info') => {
    importStatus.textContent = msg;
    importStatus.className = `text-sm ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const setListStatus = (msg, tone = 'info') => {
    guestsListStatus.textContent = msg;
    guestsListStatus.className = `text-sm ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    let headers = ['name', 'party', 'contact'];
    const first = lines[0].toLowerCase();
    if (first.includes('name')) {
      headers = lines.shift().split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
    }
    return lines.map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const entry = {};
      headers.forEach((h, idx) => { entry[h] = cols[idx]; });
      return {
        name: entry.name || '',
        contact: entry.contact || entry.email || '',
        dietaryRestrictions: entry.dietary || entry.dietaryrestrictions || '',
        notes: entry.notes || '',
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
        const arr = Array.isArray(parsed) ? parsed : parsed.guests;
        if (!Array.isArray(arr)) throw new Error('JSON must be an array or { guests: [] }');
        updatePreview(arr);
      } else {
        updatePreview(parseCsv(text));
      }
      setImportStatus('Preview loaded');
    } catch (err) {
      setImportStatus('Could not parse file', 'error');
    }
  });

  rawInput?.addEventListener('input', () => {
    try {
      if (!rawInput.value.trim()) { updatePreview([]); return; }
      const parsed = JSON.parse(rawInput.value);
      const arr = Array.isArray(parsed) ? parsed : parsed.guests;
      if (!Array.isArray(arr)) throw new Error('JSON must be an array');
      updatePreview(arr);
      setImportStatus('Preview from pasted JSON');
    } catch (err) {
      setImportStatus('Invalid JSON', 'error');
    }
  });

  uploadBtn?.addEventListener('click', async () => {
    if (!token) return setImportStatus('Please login first', 'error');
    if (!previewData.length) return setImportStatus('No data to upload', 'error');
    setImportStatus('Uploading...');
    try {
      const res = await api('/api/guests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewData),
      });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      setImportStatus(`Saved ${data.count} guest(s)`);
      loadGuests();
    } catch (err) {
      setImportStatus('Upload failed', 'error');
    }
  });

  const loadHouseholds = async () => {
    try {
      const res = await api('/api/households');
      if (res.ok) households = await res.json();
    } catch (_) { households = []; }
  };

  const loadEvents = async () => {
    try {
      const res = await api('/api/events');
      if (res.ok) events = await res.json();
    } catch (_) { events = []; }
  };

  const loadGuests = async () => {
    if (!token) return setListStatus('Login to view guests', 'error');
    setListStatus('Loading...');
    try {
      const res = await api('/api/guests');
      if (!res.ok) throw new Error('fetch failed');
      guests = await res.json();
      renderGuestsTable();
      setListStatus(`${guests.length} guest(s)`);
    } catch (err) {
      setListStatus('Could not load guests', 'error');
    }
  };

  const householdName = (id) => (households.find((h) => h.id === id)?.name) || '—';
  const eventNames = (ids) => (ids || []).map((id) => events.find((e) => e.id === id)?.name).filter(Boolean).join(', ') || '—';

  const renderGuestsTable = () => {
    guestsTbody.innerHTML = guests
      .map(
        (g) => `
          <tr class="hover:bg-blush/20">
            <td class="px-3 py-2 font-medium">${escapeHtml(g.name)}</td>
            <td class="px-3 py-2 text-charcoal/80">${escapeHtml(householdName(g.householdId))}</td>
            <td class="px-3 py-2 text-charcoal/80">${escapeHtml(eventNames(g.invitedEventIds))}</td>
            <td class="px-3 py-2 text-charcoal/80">${escapeHtml(g.contact || '')}</td>
            <td class="px-3 py-2 text-charcoal/80 max-w-[120px] truncate" title="${escapeHtml(g.dietaryRestrictions || '')}">${escapeHtml(g.dietaryRestrictions || '')}</td>
            <td class="px-3 py-2 text-charcoal/80 max-w-[100px] truncate" title="${escapeHtml(g.gift || '')}">${escapeHtml(g.gift || '')}</td>
            <td class="px-3 py-2">${g.thankYouSent ? '✓' : '—'}</td>
            <td class="px-3 py-2 text-charcoal/80 max-w-[120px] truncate" title="${escapeHtml(g.notes || '')}">${escapeHtml(g.notes || '')}</td>
            <td class="px-3 py-2">
              <button type="button" data-guest-edit="${g.id}" class="text-magenta hover:underline text-xs">Edit</button>
              <button type="button" data-guest-delete="${g.id}" class="text-magenta hover:underline text-xs ml-1">Delete</button>
            </td>
          </tr>
        `
      )
      .join('');
    guestsTbody.querySelectorAll('[data-guest-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openGuestModal(btn.getAttribute('data-guest-edit')));
    });
    guestsTbody.querySelectorAll('[data-guest-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteGuest(btn.getAttribute('data-guest-delete')));
    });
  };

  const escapeHtml = (s) => {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  };

  const deleteGuest = async (id) => {
    if (!confirm('Remove this guest?')) return;
    try {
      const res = await api(`/api/guests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      loadGuests();
    } catch (_) {}
  };

  document.getElementById('guests-refresh-list')?.addEventListener('click', () => { loadHouseholds(); loadEvents(); loadGuests(); });

  const loadRsvpSettingsForGuests = () => {
    const sel = document.getElementById('guests-rsvp-event');
    if (!sel) return;
    sel.innerHTML = '<option value="">All events</option>' + events.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  };

  const rsvpRows = document.getElementById('admin-rsvp-rows');
  const rsvpStatus = document.getElementById('admin-rsvp-status');
  const countYes = document.getElementById('count-yes');
  const countMaybe = document.getElementById('count-maybe');
  const countNo = document.getElementById('count-no');

  const setRsvpStatus = (msg, tone = 'info') => {
    rsvpStatus.textContent = msg;
    rsvpStatus.className = `text-sm ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const refreshRsvps = async () => {
    if (!token) return setRsvpStatus('Login to view RSVPs', 'error');
    setRsvpStatus('Loading...');
    const eventId = document.getElementById('guests-rsvp-event')?.value || '';
    try {
      const url = eventId ? `/api/rsvps?eventId=${encodeURIComponent(eventId)}` : '/api/rsvps';
      const res = await api(url);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const rows = data.results || [];
      rsvpRows.innerHTML = rows
        .map(
          (row) => `
            <tr>
              <td class="px-3 py-2">${escapeHtml(row.name)}</td>
              <td class="px-3 py-2 capitalize">${escapeHtml(row.rsvp)}</td>
              <td class="px-3 py-2">${row.headcount != null ? row.headcount : '—'}</td>
              <td class="px-3 py-2 text-slate-600">${escapeHtml(row.allergies || '')}</td>
              <td class="px-3 py-2 text-slate-600">${escapeHtml(row.note || '')}</td>
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

  document.getElementById('guests-refresh-rsvp')?.addEventListener('click', refreshRsvps);
  document.getElementById('guests-rsvp-event')?.addEventListener('change', refreshRsvps);

  // Guest modal
  const guestModal = document.getElementById('guest-modal');
  const openGuestModal = (guestId) => {
    document.getElementById('guest-modal-title').textContent = guestId ? 'Edit guest' : 'Add guest';
    document.getElementById('guest-modal-id').value = guestId || '';
    const g = guestId ? guests.find((x) => x.id === guestId) : null;
    document.getElementById('guest-modal-name').value = g?.name || '';
    document.getElementById('guest-modal-contact').value = g?.contact || '';
    document.getElementById('guest-modal-dietary').value = g?.dietaryRestrictions || '';
    document.getElementById('guest-modal-gift').value = g?.gift || '';
    document.getElementById('guest-modal-notes').value = g?.notes || '';
    document.getElementById('guest-modal-thankyou').checked = !!g?.thankYouSent;

    const householdSelect = document.getElementById('guest-modal-household');
    householdSelect.innerHTML = '<option value="">—</option>' + households.map((h) => `<option value="${h.id}" ${g?.householdId === h.id ? 'selected' : ''}>${escapeHtml(h.name)}</option>`).join('');

    const eventsContainer = document.getElementById('guest-modal-events');
    eventsContainer.innerHTML = events.map((e) => {
      const checked = (g?.invitedEventIds || []).includes(e.id);
      return `<label class="inline-flex items-center gap-1"><input type="checkbox" data-event-id="${e.id}" ${checked ? 'checked' : ''} class="rounded" /><span>${escapeHtml(e.name)}</span></label>`;
    }).join('');
    guestModal.classList.remove('hidden');
  };

  const closeGuestModal = () => guestModal.classList.add('hidden');

  document.getElementById('guest-modal-cancel')?.addEventListener('click', closeGuestModal);
  document.getElementById('guest-modal-save')?.addEventListener('click', async () => {
    const id = document.getElementById('guest-modal-id').value;
    const name = document.getElementById('guest-modal-name').value.trim();
    if (!name) return;
    const householdId = document.getElementById('guest-modal-household').value || null;
    const invitedEventIds = Array.from(document.getElementById('guest-modal-events').querySelectorAll('input:checked')).map((c) => c.getAttribute('data-event-id'));
    const payload = {
      name,
      householdId,
      contact: document.getElementById('guest-modal-contact').value.trim(),
      dietaryRestrictions: document.getElementById('guest-modal-dietary').value.trim(),
      gift: document.getElementById('guest-modal-gift').value.trim(),
      notes: document.getElementById('guest-modal-notes').value.trim(),
      thankYouSent: document.getElementById('guest-modal-thankyou').checked,
      invitedEventIds,
    };
    try {
      if (id) {
        const res = await api(`/api/guests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error();
      } else {
        const res = await api('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error();
      }
      closeGuestModal();
      loadGuests();
    } catch (_) {}
  });

  document.getElementById('guests-add-btn')?.addEventListener('click', () => openGuestModal(null));

  // Households modal
  const householdsModal = document.getElementById('households-modal');
  const householdsListEl = document.getElementById('households-list');
  const householdNewName = document.getElementById('household-new-name');

  const renderHouseholdsList = () => {
    householdsListEl.innerHTML = households
      .map(
        (h) => `
          <li class="flex items-center justify-between p-2 rounded-xl border border-blush/50">
            <span class="text-charcoal">${escapeHtml(h.name)}</span>
            <button type="button" data-household-delete="${h.id}" class="text-magenta hover:underline text-sm">Delete</button>
          </li>
        `
      )
      .join('');
    householdsListEl.querySelectorAll('[data-household-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this household? Guests will be unassigned.')) return;
        try {
          await api(`/api/households/${btn.getAttribute('data-household-delete')}`, { method: 'DELETE' });
          await loadHouseholds();
          renderHouseholdsList();
          loadGuests();
        } catch (_) {}
      });
    });
  };

  document.getElementById('households-open-btn')?.addEventListener('click', async () => {
    await loadHouseholds();
    renderHouseholdsList();
    householdNewName.value = '';
    householdsModal.classList.remove('hidden');
  });
  document.getElementById('households-modal-close')?.addEventListener('click', () => householdsModal.classList.add('hidden'));
  document.getElementById('household-add')?.addEventListener('click', async () => {
    const name = householdNewName?.value?.trim() || 'Unnamed household';
    try {
      const res = await api('/api/households', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error();
      await loadHouseholds();
      renderHouseholdsList();
      householdNewName.value = '';
    } catch (_) {}
  });

  // ----- RSVP Controls -----
  const rsvpGlobalToggle = document.getElementById('rsvp-global-toggle');
  const rsvpSettingsStatus = document.getElementById('rsvp-settings-status');
  const rsvpEventsList = document.getElementById('rsvp-events-list');
  const rsvpEventsStatus = document.getElementById('rsvp-events-status');

  const loadRsvpControls = async () => {
    try {
      const [setRes, evRes] = await Promise.all([api('/api/settings'), api('/api/events')]);
      if (!setRes.ok || !evRes.ok) throw new Error();
      const settings = await setRes.json();
      events = await evRes.json();
      rsvpGlobalToggle.checked = settings.rsvpOpenGlobal !== false;
      rsvpSettingsStatus.textContent = '';

      rsvpEventsList.innerHTML = events
        .map(
          (e) => `
            <li class="flex items-center justify-between p-3 rounded-xl border border-blush/50">
              <span class="font-medium text-charcoal">${escapeHtml(e.name)}</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" data-event-rsvp="${e.id}" class="sr-only peer" ${e.rsvpOpen !== false ? 'checked' : ''} />
                <div class="w-11 h-6 bg-blush/60 rounded-full peer peer-checked:bg-magenta"></div>
                <span class="ml-2 text-sm text-charcoal/70">RSVP on</span>
              </label>
            </li>
          `
        )
        .join('');
      rsvpEventsList.querySelectorAll('[data-event-rsvp]').forEach((cb) => {
        cb.addEventListener('change', async () => {
          const eventId = cb.getAttribute('data-event-rsvp');
          try {
            const res = await api(`/api/events/${eventId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rsvpOpen: cb.checked }) });
            if (!res.ok) throw new Error();
            rsvpEventsStatus.textContent = 'Saved.';
          } catch (_) {
            rsvpEventsStatus.textContent = 'Failed to save.';
          }
        });
      });
      rsvpEventsStatus.textContent = '';
    } catch (_) {
      rsvpSettingsStatus.textContent = 'Could not load settings.';
    }
  };

  rsvpGlobalToggle?.addEventListener('change', async () => {
    try {
      const res = await api('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpOpenGlobal: rsvpGlobalToggle.checked }),
      });
      if (!res.ok) throw new Error();
      rsvpSettingsStatus.textContent = rsvpGlobalToggle.checked ? 'RSVP collection is on.' : 'RSVP collection is off.';
    } catch (_) {
      rsvpSettingsStatus.textContent = 'Failed to save.';
    }
  });

  // ----- Checklist -----
  const checklistList = document.getElementById('checklist-list');
  const checklistNewTitle = document.getElementById('checklist-new-title');
  const checklistAddBtn = document.getElementById('checklist-add');
  const checklistStatus = document.getElementById('checklist-status');
  let checklistTasks = [];

  const loadChecklist = async () => {
    if (!token) return;
    checklistStatus.textContent = 'Loading...';
    try {
      const res = await api('/api/checklist');
      if (!res.ok) throw new Error();
      checklistTasks = await res.json();
      renderChecklist();
      checklistStatus.textContent = '';
    } catch (_) {
      checklistStatus.textContent = 'Could not load checklist.';
    }
  };

  const renderChecklist = () => {
    checklistList.innerHTML = checklistTasks
      .map(
        (t, i) => `
          <li data-task-id="${t.id}" class="flex items-center gap-2 p-3 rounded-xl border border-blush/50 hover:bg-blush/20">
            <span class="flex gap-1">
              <button type="button" data-move-up="${t.id}" class="px-2 py-1 rounded border border-blush/60 text-sm ${i === 0 ? 'opacity-50 pointer-events-none' : ''}">↑</button>
              <button type="button" data-move-down="${t.id}" class="px-2 py-1 rounded border border-blush/60 text-sm ${i === checklistTasks.length - 1 ? 'opacity-50 pointer-events-none' : ''}">↓</button>
            </span>
            <label class="flex-1 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" data-task-complete="${t.id}" ${t.completed ? 'checked' : ''} class="rounded" />
              <span class="${t.completed ? 'line-through text-charcoal/60' : ''}">${escapeHtml(t.title)}</span>
            </label>
            <button type="button" data-task-delete="${t.id}" class="text-magenta hover:underline text-sm">Delete</button>
          </li>
        `
      )
      .join('');

    checklistList.querySelectorAll('[data-task-complete]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const id = cb.getAttribute('data-task-complete');
        try {
          await api(`/api/checklist/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: cb.checked }) });
          loadChecklist();
        } catch (_) {}
      });
    });
    checklistList.querySelectorAll('[data-task-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this task?')) return;
        try {
          await api(`/api/checklist/${btn.getAttribute('data-task-delete')}`, { method: 'DELETE' });
          loadChecklist();
        } catch (_) {}
      });
    });
    checklistList.querySelectorAll('[data-move-up]').forEach((btn) => {
      btn.addEventListener('click', () => reorderChecklist(btn.getAttribute('data-move-up'), -1));
    });
    checklistList.querySelectorAll('[data-move-down]').forEach((btn) => {
      btn.addEventListener('click', () => reorderChecklist(btn.getAttribute('data-move-down'), 1));
    });
  };

  const reorderChecklist = async (id, delta) => {
    const i = checklistTasks.findIndex((t) => t.id === id);
    if (i === -1) return;
    const j = i + delta;
    if (j < 0 || j >= checklistTasks.length) return;
    const order = checklistTasks.map((t) => t.id);
    [order[i], order[j]] = [order[j], order[i]];
    try {
      const res = await api('/api/checklist/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
      if (!res.ok) throw new Error();
      loadChecklist();
    } catch (_) {}
  };

  checklistAddBtn?.addEventListener('click', async () => {
    const title = checklistNewTitle?.value?.trim();
    if (!title) return;
    try {
      const res = await api('/api/checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      if (!res.ok) throw new Error();
      checklistNewTitle.value = '';
      loadChecklist();
    } catch (_) {
      checklistStatus.textContent = 'Failed to add task.';
    }
  });

  // ----- Vendors -----
  const vendorsTbody = document.getElementById('vendors-tbody');
  const vendorsStatus = document.getElementById('vendors-status');
  const vendorModal = document.getElementById('vendor-modal');

  const loadVendors = async () => {
    if (!token) return;
    vendorsStatus.textContent = 'Loading...';
    try {
      const res = await api('/api/vendors');
      if (!res.ok) throw new Error();
      const list = await res.json();
      vendorsTbody.innerHTML = list
        .map(
          (v) => `
            <tr class="hover:bg-blush/20">
              <td class="px-3 py-2 font-medium">${escapeHtml(v.name)}</td>
              <td class="px-3 py-2 text-charcoal/80">${escapeHtml(v.category)}</td>
              <td class="px-3 py-2 text-charcoal/80">${escapeHtml(v.email)}</td>
              <td class="px-3 py-2 text-charcoal/80">${escapeHtml(v.phone)}</td>
              <td class="px-3 py-2 text-charcoal/80 max-w-[200px] truncate" title="${escapeHtml(v.notes || '')}">${escapeHtml(v.notes || '')}</td>
              <td class="px-3 py-2">
                <button type="button" data-vendor-edit="${v.id}" class="text-magenta hover:underline text-xs">Edit</button>
                <button type="button" data-vendor-delete="${v.id}" class="text-magenta hover:underline text-xs ml-1">Delete</button>
              </td>
            </tr>
          `
        )
        .join('');
      vendorsTbody.querySelectorAll('[data-vendor-edit]').forEach((btn) => {
        btn.addEventListener('click', () => openVendorModal(btn.getAttribute('data-vendor-edit'), list));
      });
      vendorsTbody.querySelectorAll('[data-vendor-delete]').forEach((btn) => {
        btn.addEventListener('click', () => deleteVendor(btn.getAttribute('data-vendor-delete')));
      });
      vendorsStatus.textContent = `${list.length} vendor(s)`;
    } catch (_) {
      vendorsStatus.textContent = 'Could not load vendors.';
    }
  };

  const openVendorModal = (vendorId, list) => {
    const v = list?.find((x) => x.id === vendorId) || null;
    document.getElementById('vendor-modal-title').textContent = vendorId ? 'Edit vendor' : 'Add vendor';
    document.getElementById('vendor-modal-id').value = vendorId || '';
    document.getElementById('vendor-modal-name').value = v?.name || '';
    document.getElementById('vendor-modal-category').value = v?.category || '';
    document.getElementById('vendor-modal-email').value = v?.email || '';
    document.getElementById('vendor-modal-phone').value = v?.phone || '';
    document.getElementById('vendor-modal-notes').value = v?.notes || '';
    vendorModal.classList.remove('hidden');
  };

  const deleteVendor = async (id) => {
    if (!confirm('Remove this vendor?')) return;
    try {
      await api(`/api/vendors/${id}`, { method: 'DELETE' });
      loadVendors();
    } catch (_) {}
  };

  document.getElementById('vendor-modal-cancel')?.addEventListener('click', () => vendorModal.classList.add('hidden'));
  document.getElementById('vendor-modal-save')?.addEventListener('click', async () => {
    const id = document.getElementById('vendor-modal-id').value;
    const name = document.getElementById('vendor-modal-name').value.trim();
    if (!name) return;
    const payload = {
      name,
      category: document.getElementById('vendor-modal-category').value.trim(),
      email: document.getElementById('vendor-modal-email').value.trim(),
      phone: document.getElementById('vendor-modal-phone').value.trim(),
      notes: document.getElementById('vendor-modal-notes').value.trim(),
    };
    try {
      if (id) {
        await api(`/api/vendors/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await api('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      vendorModal.classList.add('hidden');
      loadVendors();
    } catch (_) {}
  });

  document.getElementById('vendors-add-btn')?.addEventListener('click', () => openVendorModal(null, []));

  // ----- Init -----
  loginBtn?.addEventListener('click', login);
  passwordInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') login(); });

  if (token) {
    setAuthed(true);
    showTab('guests');
  }
})();
