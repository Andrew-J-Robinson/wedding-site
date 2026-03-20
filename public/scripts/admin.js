(() => {
  const loginSection = document.getElementById('admin-login');
  const panelsSection = document.getElementById('admin-panels');
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.getElementById('admin-login-btn');
  const loginStatus = document.getElementById('admin-login-status');

  let token = localStorage.getItem('adminToken') || '';
  let previewData = [];
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
      loadGuests();
      refreshRsvps();
    } else if (current === 'rsvp-controls') {
      loadRsvpControls();
    } else if (current === 'vendors') {
      loadVendors();
    } else if (current === 'photos') {
      loadPhotos();
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

  const renderGuestsTable = () => {
    guestsTbody.innerHTML = guests
      .map(
        (g) => `
          <tr class="hover:bg-blush/20">
            <td class="px-3 py-2 font-medium">${escapeHtml(g.name)}</td>
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

  document.getElementById('guests-refresh-list')?.addEventListener('click', () => { loadGuests(); });

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
    try {
      const res = await api('/api/rsvps');
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

    guestModal.classList.remove('hidden');
  };

  const closeGuestModal = () => guestModal.classList.add('hidden');

  document.getElementById('guest-modal-cancel')?.addEventListener('click', closeGuestModal);
  document.getElementById('guest-modal-save')?.addEventListener('click', async () => {
    const id = document.getElementById('guest-modal-id').value;
    const name = document.getElementById('guest-modal-name').value.trim();
    if (!name) return;
    const payload = {
      name,
      contact: document.getElementById('guest-modal-contact').value.trim(),
      dietaryRestrictions: document.getElementById('guest-modal-dietary').value.trim(),
      gift: document.getElementById('guest-modal-gift').value.trim(),
      notes: document.getElementById('guest-modal-notes').value.trim(),
      thankYouSent: document.getElementById('guest-modal-thankyou').checked,
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

  // ----- RSVP Controls -----
  const rsvpGlobalToggle = document.getElementById('rsvp-global-toggle');
  const rsvpSettingsStatus = document.getElementById('rsvp-settings-status');

  const loadRsvpControls = async () => {
    try {
      const setRes = await api('/api/settings');
      if (!setRes.ok) throw new Error();
      const settings = await setRes.json();
      rsvpGlobalToggle.checked = settings.rsvpOpenGlobal !== false;
      rsvpSettingsStatus.textContent = '';
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

  // ----- Photos -----
  const PHOTO_GROUPS = [
    {
      group: 'Hero',
      description: 'Full-screen background image on the home page.',
      layout: 'hero',
      slots: [{ key: 'hero', label: 'Hero Photo' }],
    },
    {
      group: 'How We Met',
      description: 'Photo alongside the "How We Met" story.',
      layout: 'hero',
      slots: [{ key: 'how-we-met', label: 'How We Met Photo' }],
    },
    {
      group: 'Engagement Photos',
      description: '6 photos displayed in the engagement grid.',
      layout: 'grid',
      slots: [
        { key: 'engagement-1', label: 'Photo 1' },
        { key: 'engagement-2', label: 'Photo 2' },
        { key: 'engagement-3', label: 'Photo 3' },
        { key: 'engagement-4', label: 'Photo 4' },
        { key: 'engagement-5', label: 'Photo 5' },
        { key: 'engagement-6', label: 'Photo 6' },
      ],
    },
    {
      group: 'Bridesmaids',
      layout: 'party',
      slots: [
        { key: 'party-aliza', label: '[redacted]', sub: 'Maid of Honor' },
        { key: 'party-macy', label: '[redacted]', sub: 'Bridesmaid' },
        { key: 'party-shayleen', label: '[redacted]', sub: 'Bridesmaid' },
        { key: 'party-kristo', label: '[redacted]', sub: 'Bridesman' },
        { key: 'party-jasmine', label: '[redacted]', sub: 'Bridesmaid' },
      ],
    },
    {
      group: 'Groomsmen',
      layout: 'party',
      slots: [
        { key: 'party-ryan', label: '[redacted]', sub: 'Best Man' },
        { key: 'party-bobby', label: '[redacted]', sub: 'Groomsman' },
        { key: 'party-kodi', label: '[redacted]', sub: 'Groomsman' },
        { key: 'party-zack', label: '[redacted]', sub: 'Groomsman' },
        { key: 'party-matt', label: '[redacted]', sub: 'Groomsman' },
      ],
    },
  ];

  const photosPanel = document.getElementById('panel-photos');

  const renderSlotHtml = (slot, url, layout) => {
    const preview = url
      ? `<img src="${url}" class="w-full h-full object-cover" alt="" />`
      : '';

    if (layout === 'hero') {
      return `
        <div class="flex flex-col sm:flex-row gap-4 items-start">
          <div class="w-full sm:w-72 aspect-video rounded-xl overflow-hidden shrink-0 placeholder-img">${preview}</div>
          <div class="flex flex-col gap-2 pt-1">
            <label class="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-magenta text-white text-sm font-semibold cursor-pointer hover:bg-magenta/90 transition">
              <span>Upload photo</span>
              <input type="file" accept="image/*" data-slot-upload="${slot.key}" class="hidden" />
            </label>
            <button type="button" data-slot-remove="${slot.key}" class="px-4 py-2 rounded-xl border border-blush/60 text-sm hover:border-magenta/40 transition">Remove</button>
            <p data-slot-status="${slot.key}" class="text-xs text-charcoal/70 min-h-[1em]"></p>
          </div>
        </div>`;
    }

    if (layout === 'grid') {
      return `
        <div class="space-y-2">
          <div class="aspect-[4/5] rounded-xl overflow-hidden placeholder-img">${preview}</div>
          <p class="text-xs font-medium text-charcoal/80 text-center">${escapeHtml(slot.label)}</p>
          <div class="flex gap-2 flex-wrap justify-center">
            <label class="px-3 py-1 rounded-lg bg-magenta text-white text-xs font-semibold cursor-pointer hover:bg-magenta/90 transition">
              <span>Upload</span>
              <input type="file" accept="image/*" data-slot-upload="${slot.key}" class="hidden" />
            </label>
            <button type="button" data-slot-remove="${slot.key}" class="px-3 py-1 rounded-lg border border-blush/60 text-xs hover:border-magenta/40 transition">Remove</button>
          </div>
          <p data-slot-status="${slot.key}" class="text-xs text-charcoal/70 text-center min-h-[1em]"></p>
        </div>`;
    }

    const memberName = slot._memberName || slot.label;
    const memberRole = slot._memberRole || slot.sub || '';
    return `
      <div class="p-3 bg-subtle rounded-xl border border-blush/40 flex gap-3 items-start">
        <div class="w-16 h-16 rounded-lg overflow-hidden placeholder-img shrink-0">${preview}</div>
        <div class="flex-1 min-w-0 space-y-1.5">
          <input type="text" data-member-name="${slot.key}" value="${escapeHtml(memberName)}" placeholder="Name" class="w-full px-2 py-1 rounded-lg border border-blush/60 text-sm font-semibold text-charcoal" />
          <input type="text" data-member-role="${slot.key}" value="${escapeHtml(memberRole)}" placeholder="Role (e.g. Bridesmaid)" class="w-full px-2 py-1 rounded-lg border border-blush/60 text-xs text-charcoal/70" />
          <div class="flex gap-2 flex-wrap">
            <label class="px-2 py-1 rounded-lg bg-magenta text-white text-xs font-semibold cursor-pointer hover:bg-magenta/90 transition">
              <span>Upload</span>
              <input type="file" accept="image/*" data-slot-upload="${slot.key}" class="hidden" />
            </label>
            <button type="button" data-slot-remove="${slot.key}" class="px-2 py-1 rounded-lg border border-blush/60 text-xs hover:border-magenta/40 transition">Remove</button>
            <button type="button" data-member-save="${slot.key}" class="px-2 py-1 rounded-lg border border-magenta text-magenta text-xs font-semibold hover:bg-magenta/10 transition">Save name</button>
          </div>
          <p data-slot-status="${slot.key}" class="text-xs text-charcoal/70 min-h-[1em]"></p>
        </div>
      </div>`;
  };

  const loadPhotos = async () => {
    if (!token) return;
    try {
      const res = await api('/api/settings');
      if (!res.ok) throw new Error();
      const settings = await res.json();
      const photos = settings.photos || {};
      const partyMembers = settings.partyMembers || {};

      photosPanel.innerHTML = PHOTO_GROUPS.map(({ group, description, layout, slots }) => {
        const enrichedSlots = layout === 'party'
          ? slots.map((slot) => {
              const m = partyMembers[slot.key] || {};
              return { ...slot, _memberName: m.name || slot.label, _memberRole: m.role || slot.sub || '' };
            })
          : slots;
        const slotsHtml = enrichedSlots.map((slot) => renderSlotHtml(slot, photos[slot.key], layout)).join('');
        const inner = layout === 'grid'
          ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">${slotsHtml}</div>`
          : `<div class="space-y-3">${slotsHtml}</div>`;
        return `
          <section class="bg-surface border border-blush/50 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 class="text-lg font-semibold text-charcoal">${escapeHtml(group)}</h3>
            ${description ? `<p class="text-sm text-charcoal/70">${escapeHtml(description)}</p>` : ''}
            ${inner}
          </section>`;
      }).join('');
    } catch (_) {
      photosPanel.innerHTML = '<p class="text-sm text-magenta">Could not load photos.</p>';
    }
  };

  photosPanel?.addEventListener('change', (e) => {
    const input = e.target.closest('[data-slot-upload]');
    if (!input || !input.files?.[0]) return;
    const slot = input.getAttribute('data-slot-upload');
    const file = input.files[0];
    const statusEl = photosPanel.querySelector(`[data-slot-status="${slot}"]`);
    if (statusEl) statusEl.textContent = 'Uploading...';

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const commaIdx = dataUrl.indexOf(',');
      const base64 = dataUrl.slice(commaIdx + 1);
      const contentType = dataUrl.slice(5, commaIdx).replace(';base64', '');
      try {
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoUpload: { slot, data: base64, contentType } }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
        if (statusEl) statusEl.textContent = 'Uploaded!';
        loadPhotos();
      } catch (err) {
        if (statusEl) statusEl.textContent = err.message || 'Upload failed.';
      }
    };
    reader.readAsDataURL(file);
  });

  photosPanel?.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-slot-remove]');
    if (removeBtn) {
      const slot = removeBtn.getAttribute('data-slot-remove');
      const statusEl = photosPanel.querySelector(`[data-slot-status="${slot}"]`);
      if (statusEl) statusEl.textContent = 'Removing...';
      try {
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoDelete: { slot } }),
        });
        if (!res.ok) throw new Error();
        if (statusEl) statusEl.textContent = 'Removed.';
        loadPhotos();
      } catch (_) {
        if (statusEl) statusEl.textContent = 'Failed to remove.';
      }
      return;
    }

    const saveBtn = e.target.closest('[data-member-save]');
    if (saveBtn) {
      const slot = saveBtn.getAttribute('data-member-save');
      const nameInput = photosPanel.querySelector(`[data-member-name="${slot}"]`);
      const roleInput = photosPanel.querySelector(`[data-member-role="${slot}"]`);
      const statusEl = photosPanel.querySelector(`[data-slot-status="${slot}"]`);
      const name = nameInput?.value?.trim() || '';
      const role = roleInput?.value?.trim() || '';
      if (!name) { if (statusEl) statusEl.textContent = 'Name is required.'; return; }
      if (statusEl) statusEl.textContent = 'Saving...';
      try {
        const settingsRes = await api('/api/settings');
        if (!settingsRes.ok) throw new Error();
        const current = await settingsRes.json();
        const partyMembers = { ...(current.partyMembers || {}), [slot]: { name, role } };
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partyMembers }),
        });
        if (!res.ok) throw new Error();
        if (statusEl) statusEl.textContent = 'Saved!';
      } catch (_) {
        if (statusEl) statusEl.textContent = 'Failed to save.';
      }
    }
  });

  // ----- Init -----
  loginBtn?.addEventListener('click', login);
  passwordInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') login(); });

  if (token) {
    setAuthed(true);
    showTab('guests');
  }
})();
