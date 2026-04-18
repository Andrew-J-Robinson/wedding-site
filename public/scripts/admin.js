(() => {
  const loginSection = document.getElementById('admin-login');
  const panelsSection = document.getElementById('admin-panels');
  const passwordInput = document.getElementById('admin-password');
  const loginBtn = document.getElementById('admin-login-btn');
  const loginStatus = document.getElementById('admin-login-status');

  let token = localStorage.getItem('adminToken') || '';
  let previewData = [];
  let guests = [];
  let partyData = [];

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
    } else if (current === 'rsvp-controls') {
      loadRsvpControls();
    } else if (current === 'site-content') {
      loadSiteContent();
    } else if (current === 'registry') {
      loadRegistry();
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
  const importStatus = document.getElementById('guests-import-status');
  const guestsTbody = document.getElementById('guests-tbody');
  const guestsEmpty = document.getElementById('guests-empty');
  const guestsListStatus = document.getElementById('guests-list-status');
  const selectAllCheckbox = document.getElementById('guests-select-all');
  const bulkDeleteBtn = document.getElementById('guests-bulk-delete');
  const searchInput = document.getElementById('guests-search');
  const filterSelect = document.getElementById('guests-filter');
  const sortSelect = document.getElementById('guests-sort');
  const groupToggle = document.getElementById('guests-group-household');
  const selectedIds = new Set();

  let rsvps = [];
  const viewState = { q: '', filter: 'all', sort: 'name', groupByHousehold: false };

  const escapeHtml = (s) => {
    if (s === undefined || s === null || s === '') return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  };

  const setImportStatus = (msg, tone = 'info') => {
    if (!importStatus) return;
    importStatus.textContent = msg;
    importStatus.className = `text-sm min-h-[1.25rem] ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const setListStatus = (msg, tone = 'info') => {
    guestsListStatus.textContent = msg;
    guestsListStatus.className = `text-sm ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    let headers = ['name', 'party'];
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
        dietaryRestrictions: entry.dietary || entry.dietaryrestrictions || '',
        notes: entry.notes || '',
        householdId: entry.householdid || entry.household || '',
        plusOneAllowed: ['true', '1', 'yes'].includes((entry.plusoneallowed || entry.plusone || '').toLowerCase()),
        hasKids: ['true', '1', 'yes'].includes((entry.haskids || entry.kids || '').toLowerCase()),
        thankYouSent: ['true', '1', 'yes'].includes((entry.thankyousent || entry.thanked || '').toLowerCase()),
      };
    }).filter((e) => e.name);
  };

  // Build { byGuestId, byNameLower } maps, latest RSVP wins by createdAt.
  const buildRsvpIndex = (list) => {
    const byGuestId = new Map();
    const byNameLower = new Map();
    const latest = (prev, next) => {
      if (!prev) return next;
      return new Date(next.createdAt || 0) > new Date(prev.createdAt || 0) ? next : prev;
    };
    (list || []).forEach((r) => {
      if (r.guestId) byGuestId.set(r.guestId, latest(byGuestId.get(r.guestId), r));
      const key = String(r.name || '').trim().toLowerCase();
      if (key) byNameLower.set(key, latest(byNameLower.get(key), r));
    });
    return { byGuestId, byNameLower };
  };

  const getRsvpForGuest = (g, index) => {
    if (!g) return null;
    const byId = g.id && index.byGuestId.get(g.id);
    if (byId) return byId;
    const byName = index.byNameLower.get(String(g.name || '').trim().toLowerCase());
    return byName || null;
  };

  const annotateGuestsWithRsvps = () => {
    const idx = buildRsvpIndex(rsvps);
    guests.forEach((g) => {
      const r = getRsvpForGuest(g, idx);
      g.rsvpStatus = r ? String(r.rsvp || '').toLowerCase() : '';
      g.rsvpAt = r ? r.createdAt : null;
    });
  };

  const rsvpPill = (status) => {
    const map = {
      yes: 'bg-magenta/15 text-magenta border-magenta/30',
      maybe: 'bg-blush/60 text-charcoal border-blush',
      no: 'bg-charcoal/10 text-charcoal/70 border-charcoal/20',
    };
    if (!status) {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-dashed border-charcoal/25 text-charcoal/50">Pending</span>`;
    }
    const cls = map[status] || 'bg-blush/40 text-charcoal border-blush/60';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls} capitalize">${label}</span>`;
  };

  const getVisibleGuests = () => {
    const q = viewState.q.trim().toLowerCase();
    let list = guests.filter((g) => {
      if (q) {
        const hay = `${g.name} ${g.notes || ''} ${g.householdId || ''} ${g.dietaryRestrictions || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (viewState.filter) {
        case 'responded': return !!g.rsvpStatus;
        case 'pending': return !g.rsvpStatus;
        case 'yes':
        case 'maybe':
        case 'no': return g.rsvpStatus === viewState.filter;
        case 'plusone': return !!g.plusOneAllowed;
        case 'kids': return !!g.hasKids;
        case 'thanked': return !!g.thankYouSent;
        case 'unthanked': return !g.thankYouSent;
        default: return true;
      }
    });
    const rsvpOrder = { yes: 0, maybe: 1, no: 2, '': 3 };
    list.sort((a, b) => {
      switch (viewState.sort) {
        case 'rsvp': {
          const d = (rsvpOrder[a.rsvpStatus || ''] ?? 3) - (rsvpOrder[b.rsvpStatus || ''] ?? 3);
          if (d !== 0) return d;
          return a.name.localeCompare(b.name);
        }
        case 'household': {
          const ah = (a.householdId || '\uffff').toLowerCase();
          const bh = (b.householdId || '\uffff').toLowerCase();
          if (ah !== bh) return ah < bh ? -1 : 1;
          return a.name.localeCompare(b.name);
        }
        case 'created':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  };

  const updateBulkDeleteBtn = () => {
    if (!bulkDeleteBtn) return;
    if (selectedIds.size > 0) {
      bulkDeleteBtn.innerHTML = `
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
        Delete selected (${selectedIds.size})`;
      bulkDeleteBtn.classList.remove('hidden');
      bulkDeleteBtn.classList.add('inline-flex');
    } else {
      bulkDeleteBtn.classList.add('hidden');
      bulkDeleteBtn.classList.remove('inline-flex');
    }
    if (selectAllCheckbox) {
      const visible = getVisibleGuests();
      const visibleIds = visible.map((g) => g.id);
      const selectedInView = visibleIds.filter((id) => selectedIds.has(id)).length;
      selectAllCheckbox.checked = visible.length > 0 && selectedInView === visible.length;
      selectAllCheckbox.indeterminate = selectedInView > 0 && selectedInView < visible.length;
    }
  };

  const checkCell = (val, label) => `
    <td class="px-3 py-2" data-label="${label}">
      ${val
        ? '<svg class="w-4 h-4 text-magenta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>'
        : '<span class="text-charcoal/30">—</span>'}
    </td>`;

  const guestRowHtml = (g) => `
    <tr class="hover:bg-blush/20 align-top">
      <td class="px-3 py-2 guests-row-select"><input type="checkbox" data-guest-select="${g.id}" class="rounded" ${selectedIds.has(g.id) ? 'checked' : ''} /></td>
      <td class="px-3 py-2 font-medium guests-row-name">${escapeHtml(g.name)}</td>
      <td class="px-3 py-2" data-label="RSVP" title="${g.rsvpAt ? 'Responded ' + new Date(g.rsvpAt).toLocaleString() : ''}">${rsvpPill(g.rsvpStatus)}</td>
      <td class="px-3 py-2 text-charcoal/80 max-w-[140px] truncate" data-label="Household" title="${escapeHtml(g.householdId || '')}">${g.householdId ? escapeHtml(g.householdId) : '<span class="text-charcoal/30">—</span>'}</td>
      <td class="px-3 py-2 text-charcoal/80 max-w-[140px] truncate" data-label="Dietary" title="${escapeHtml(g.dietaryRestrictions || '')}">${g.dietaryRestrictions ? escapeHtml(g.dietaryRestrictions) : '<span class="text-charcoal/30">—</span>'}</td>
      ${checkCell(g.plusOneAllowed, '+1')}
      ${checkCell(g.hasKids, 'Kids')}
      ${checkCell(g.thankYouSent, 'Thank you')}
      <td class="px-3 py-2 text-charcoal/80 max-w-[180px] truncate" data-label="Notes" title="${escapeHtml(g.notes || '')}">${g.notes ? escapeHtml(g.notes) : '<span class="text-charcoal/30">—</span>'}</td>
      <td class="px-3 py-2 guests-row-actions" data-label="">
        <div class="flex gap-1 justify-end md:justify-start">
          <button type="button" data-guest-edit="${g.id}" class="p-1.5 rounded-lg border border-blush/60 text-charcoal/70 hover:text-magenta hover:border-magenta/40 transition" aria-label="Edit ${escapeHtml(g.name)}" title="Edit">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" data-guest-delete="${g.id}" class="p-1.5 rounded-lg border border-blush/60 text-charcoal/70 hover:text-magenta hover:border-magenta/40 transition" aria-label="Delete ${escapeHtml(g.name)}" title="Delete">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>
          </button>
        </div>
      </td>
    </tr>`;

  const householdHeaderHtml = (hh, members) => {
    const plus = members.filter((m) => m.plusOneAllowed).length;
    const kids = members.filter((m) => m.hasKids).length;
    const responded = members.filter((m) => m.rsvpStatus).length;
    const label = hh ? escapeHtml(hh) : '(No household)';
    const bits = [`${members.length} member${members.length === 1 ? '' : 's'}`];
    if (plus) bits.push(`${plus} +1`);
    if (kids) bits.push(`${kids} w/ kids`);
    bits.push(`${responded}/${members.length} responded`);
    return `
      <tr class="guests-group-row bg-blush/30 border-y border-blush/50">
        <td colspan="10" class="px-3 py-2 text-xs uppercase tracking-wider text-charcoal/80 font-semibold">
          <span class="text-charcoal">${label}</span>
          <span class="ml-2 font-normal normal-case tracking-normal text-charcoal/60">${bits.join(' · ')}</span>
        </td>
      </tr>`;
  };

  const renderGuestsTable = () => {
    const visible = getVisibleGuests();

    if (!guests.length) {
      guestsTbody.innerHTML = '';
      if (guestsEmpty) guestsEmpty.classList.remove('hidden');
    } else if (guestsEmpty) {
      guestsEmpty.classList.add('hidden');
    }

    if (viewState.groupByHousehold && visible.length) {
      const groups = new Map();
      visible.forEach((g) => {
        const key = g.householdId || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(g);
      });
      // Sort: named households first alpha, then "(No household)"
      const entries = [...groups.entries()].sort(([a], [b]) => {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return a.localeCompare(b);
      });
      guestsTbody.innerHTML = entries
        .map(([hh, members]) => householdHeaderHtml(hh, members) + members.map(guestRowHtml).join(''))
        .join('');
    } else {
      guestsTbody.innerHTML = visible.map(guestRowHtml).join('');
    }

    guestsTbody.querySelectorAll('[data-guest-select]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-guest-select');
        if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
        updateBulkDeleteBtn();
      });
    });
    guestsTbody.querySelectorAll('[data-guest-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openGuestModal(btn.getAttribute('data-guest-edit')));
    });
    guestsTbody.querySelectorAll('[data-guest-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteGuest(btn.getAttribute('data-guest-delete')));
    });
    updateBulkDeleteBtn();
    setListStatus(
      visible.length === guests.length
        ? `${guests.length} guest${guests.length === 1 ? '' : 's'}`
        : `${visible.length} of ${guests.length} guest${guests.length === 1 ? '' : 's'}`
    );
  };

  const renderStats = () => {
    const total = guests.length;
    const households = new Set(guests.map((g) => g.householdId).filter(Boolean)).size;
    const plusOnes = guests.filter((g) => g.plusOneAllowed).length;
    const kids = guests.filter((g) => g.hasKids).length;
    const yes = guests.filter((g) => g.rsvpStatus === 'yes').length;
    const maybe = guests.filter((g) => g.rsvpStatus === 'maybe').length;
    const no = guests.filter((g) => g.rsvpStatus === 'no').length;
    const pending = guests.filter((g) => !g.rsvpStatus).length;

    const setText = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(n);
    };
    setText('stat-total', total);
    setText('stat-households', households);
    setText('stat-plusones', plusOnes);
    setText('stat-kids', kids);
    setText('count-yes', yes);
    setText('count-maybe', maybe);
    setText('count-no', no);
    setText('stat-pending', pending);
  };

  const loadGuests = async () => {
    if (!token) return setListStatus('Login to view guests', 'error');
    setListStatus('Loading...');
    try {
      const [gRes, rRes] = await Promise.all([
        api('/api/guests'),
        api('/api/rsvps'),
      ]);
      if (!gRes.ok) throw new Error('fetch failed');
      guests = await gRes.json();
      if (rRes.ok) {
        const data = await rRes.json();
        rsvps = data.results || [];
      }
      selectedIds.clear();
      annotateGuestsWithRsvps();
      renderStats();
      renderGuestsTable();
      renderRsvpTable();
      setRsvpStatus(`${rsvps.length} response${rsvps.length === 1 ? '' : 's'}`);
    } catch (err) {
      setListStatus('Could not load guests', 'error');
    }
  };


  // ----- Site copy (home page) -----
  const siteContentPanel = document.getElementById('panel-site-content');
  const registryPanel = document.getElementById('panel-registry');

  function splitParagraphs(text) {
    return String(text || '')
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function joinParagraphs(arr) {
    return (arr || []).map((p) => String(p).trim()).filter(Boolean).join('\n\n');
  }

  function addScheduleRow(container, item = {}) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-sc-schedule-row', '');
    wrap.className = 'flex flex-col gap-2 p-3 bg-subtle rounded-xl border border-blush/40';
    wrap.innerHTML = `
      <div class="flex flex-wrap gap-2 items-end">
        <label class="flex-1 min-w-[100px]"><span class="text-xs text-charcoal/70">Time</span>
          <input type="text" data-sc-sch-time class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" />
        </label>
        <label class="flex-[2] min-w-[140px]"><span class="text-xs text-charcoal/70">Title</span>
          <input type="text" data-sc-sch-title class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" />
        </label>
      </div>
      <label class="block"><span class="text-xs text-charcoal/70">Detail (<code>[text](url)</code> for links)</span>
        <input type="text" data-sc-sch-detail class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" />
      </label>
      <button type="button" data-sc-schedule-remove class="self-start px-2 py-1 text-xs text-magenta border border-blush/60 rounded-lg">Remove</button>
    `;
    wrap.querySelector('[data-sc-sch-time]').value = item.time || '';
    wrap.querySelector('[data-sc-sch-title]').value = item.title || '';
    wrap.querySelector('[data-sc-sch-detail]').value = item.detail || '';
    container.appendChild(wrap);
  }

  function addQaRow(container, item = {}) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-sc-qa-row', '');
    wrap.className = 'space-y-2 p-3 bg-subtle rounded-xl border border-blush/40';
    wrap.innerHTML = `
      <label class="block"><span class="text-xs text-charcoal/70">Question</span>
        <input type="text" data-sc-qa-q class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" />
      </label>
      <label class="block"><span class="text-xs text-charcoal/70">Answer (<code>[text](url)</code> for links)</span>
        <textarea data-sc-qa-a rows="3" class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm"></textarea>
      </label>
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" data-sc-qa-open />
        <span>Open by default</span>
      </label>
      <button type="button" data-sc-qa-remove class="px-2 py-1 text-xs text-magenta border border-blush/60 rounded-lg">Remove</button>
    `;
    wrap.querySelector('[data-sc-qa-q]').value = item.question || '';
    wrap.querySelector('[data-sc-qa-a]').value = item.answer || '';
    wrap.querySelector('[data-sc-qa-open]').checked = !!item.open;
    container.appendChild(wrap);
  }

  function addTravelBlock(container, block = {}) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-sc-travel-block', '');
    wrap.className = 'space-y-2 p-3 bg-subtle rounded-xl border border-blush/40';
    wrap.innerHTML = `
      <label class="block"><span class="text-xs text-charcoal/70">Heading</span>
        <input type="text" data-sc-travel-heading class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" />
      </label>
      <label class="block"><span class="text-xs text-charcoal/70">Paragraphs (blank line between, <code>[text](url)</code> for links)</span>
        <textarea data-sc-travel-paras rows="4" class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm font-mono"></textarea>
      </label>
      <button type="button" data-sc-travel-remove class="px-2 py-1 text-xs text-magenta border border-blush/60 rounded-lg">Remove block</button>
    `;
    wrap.querySelector('[data-sc-travel-heading]').value = block.heading || '';
    wrap.querySelector('[data-sc-travel-paras]').value = joinParagraphs(block.paragraphs || []);
    container.appendChild(wrap);
  }

  function addRegistryLinkRow(container, item = {}) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-sc-registry-link-row', '');
    wrap.className = 'flex flex-col sm:flex-row gap-2 p-3 bg-subtle rounded-xl border border-blush/40 sm:items-end';
    wrap.innerHTML = `
      <label class="flex-1 min-w-0"><span class="text-xs text-charcoal/70">Button label</span>
        <input type="text" data-sc-reg-label class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" placeholder="e.g. Zola" />
      </label>
      <label class="flex-[2] min-w-0"><span class="text-xs text-charcoal/70">URL</span>
        <input type="url" data-sc-reg-url class="w-full px-2 py-2 rounded-lg border border-blush/60 text-sm" placeholder="https://…" />
      </label>
      <button type="button" data-sc-registry-remove class="self-start sm:self-center px-2 py-1 text-xs text-magenta border border-blush/60 rounded-lg shrink-0">Remove</button>
    `;
    wrap.querySelector('[data-sc-reg-label]').value = item.label || '';
    wrap.querySelector('[data-sc-reg-url]').value = item.url || '';
    container.appendChild(wrap);
  }

  function readRegistryFromForm() {
    const links = [...document.querySelectorAll('[data-sc-registry-link-row]')]
      .map((row) => ({
        label: row.querySelector('[data-sc-reg-label]')?.value?.trim() || '',
        url: row.querySelector('[data-sc-reg-url]')?.value?.trim() || '',
      }))
      .filter((it) => it.label || it.url);
    return {
      eyebrow: document.getElementById('sc-registry-eyebrow')?.value?.trim() || '',
      title: document.getElementById('sc-registry-title')?.value?.trim() || '',
      intro: document.getElementById('sc-registry-intro')?.value?.trim() || '',
      links,
    };
  }

  function readSiteContentFromForm() {
    const scheduleItems = [...document.querySelectorAll('[data-sc-schedule-row]')]
      .map((row) => ({
        time: row.querySelector('[data-sc-sch-time]')?.value?.trim() || '',
        title: row.querySelector('[data-sc-sch-title]')?.value?.trim() || '',
        detail: row.querySelector('[data-sc-sch-detail]')?.value?.trim() || '',
      }))
      .filter((it) => it.time || it.title || it.detail);

    const travelCol = (container) =>
      [...container.querySelectorAll('[data-sc-travel-block]')]
        .map((block) => ({
          heading: block.querySelector('[data-sc-travel-heading]')?.value?.trim() || '',
          paragraphs: splitParagraphs(block.querySelector('[data-sc-travel-paras]')?.value || ''),
        }))
        .filter((b) => b.heading || b.paragraphs.length);

    const col0El = document.getElementById('sc-travel-col-0-blocks');
    const col1El = document.getElementById('sc-travel-col-1-blocks');

    const qaItems = [...document.querySelectorAll('[data-sc-qa-row]')]
      .map((row) => ({
        question: row.querySelector('[data-sc-qa-q]')?.value?.trim() || '',
        answer: row.querySelector('[data-sc-qa-a]')?.value?.trim() || '',
        open: !!row.querySelector('[data-sc-qa-open]')?.checked,
      }))
      .filter((it) => it.question || it.answer);

    return {
      hero: {
        kicker: document.getElementById('sc-hero-kicker')?.value?.trim() || '',
        names: document.getElementById('sc-hero-names')?.value?.trim() || '',
        dateLine: document.getElementById('sc-hero-date-line')?.value?.trim() || '',
        blurb: document.getElementById('sc-hero-blurb')?.value?.trim() || '',
        ctaRsvp: document.getElementById('sc-hero-cta-rsvp')?.value?.trim() || '',
        ctaStory: document.getElementById('sc-hero-cta-story')?.value?.trim() || '',
      },
      howWeMet: {
        eyebrow: document.getElementById('sc-how-eyebrow')?.value?.trim() || '',
        title: document.getElementById('sc-how-title')?.value?.trim() || '',
        paragraphs: splitParagraphs(document.getElementById('sc-how-paragraphs')?.value || ''),
      },
      schedule: {
        eyebrow: document.getElementById('sc-schedule-eyebrow')?.value?.trim() || '',
        title: document.getElementById('sc-schedule-title')?.value?.trim() || '',
        items: scheduleItems,
      },
      travel: {
        eyebrow: document.getElementById('sc-travel-eyebrow')?.value?.trim() || '',
        title: document.getElementById('sc-travel-title')?.value?.trim() || '',
        columns: [travelCol(col0El), travelCol(col1El)],
      },
      qa: {
        eyebrow: document.getElementById('sc-qa-eyebrow')?.value?.trim() || '',
        title: document.getElementById('sc-qa-title')?.value?.trim() || '',
        items: qaItems,
      },
      footnote: {
        text: document.getElementById('sc-footnote-text')?.value?.trim() || '',
      },
    };
  }

  async function loadSiteContent() {
    if (!token) return;
    const statusEl = document.getElementById('sc-status');
    if (statusEl) statusEl.textContent = 'Loading...';
    try {
      const res = await api('/api/settings');
      if (!res.ok) throw new Error();
      const settings = await res.json();
      const c = typeof mergeSiteContent === 'function' ? mergeSiteContent(settings.siteContent) : {};

      document.getElementById('sc-hero-kicker').value = c.hero.kicker || '';
      document.getElementById('sc-hero-names').value = c.hero.names || '';
      document.getElementById('sc-hero-date-line').value = c.hero.dateLine || '';
      document.getElementById('sc-hero-blurb').value = c.hero.blurb || '';
      document.getElementById('sc-hero-cta-rsvp').value = c.hero.ctaRsvp || '';
      document.getElementById('sc-hero-cta-story').value = c.hero.ctaStory || '';

      document.getElementById('sc-how-eyebrow').value = c.howWeMet.eyebrow || '';
      document.getElementById('sc-how-title').value = c.howWeMet.title || '';
      document.getElementById('sc-how-paragraphs').value = joinParagraphs(c.howWeMet.paragraphs);

      document.getElementById('sc-schedule-eyebrow').value = c.schedule.eyebrow || '';
      document.getElementById('sc-schedule-title').value = c.schedule.title || '';
      const schedRows = document.getElementById('sc-schedule-rows');
      schedRows.innerHTML = '';
      (c.schedule.items || []).forEach((item) => addScheduleRow(schedRows, item));
      if (!(c.schedule.items || []).length) addScheduleRow(schedRows, {});

      document.getElementById('sc-travel-eyebrow').value = c.travel.eyebrow || '';
      document.getElementById('sc-travel-title').value = c.travel.title || '';
      const col0 = document.getElementById('sc-travel-col-0-blocks');
      const col1 = document.getElementById('sc-travel-col-1-blocks');
      col0.innerHTML = '';
      col1.innerHTML = '';
      const cols = c.travel.columns || [[], []];
      (cols[0] || []).forEach((b) => addTravelBlock(col0, b));
      (cols[1] || []).forEach((b) => addTravelBlock(col1, b));
      if (!(cols[0] || []).length) addTravelBlock(col0, {});
      if (!(cols[1] || []).length) addTravelBlock(col1, {});

      document.getElementById('sc-qa-eyebrow').value = c.qa.eyebrow || '';
      document.getElementById('sc-qa-title').value = c.qa.title || '';
      const qaRows = document.getElementById('sc-qa-rows');
      qaRows.innerHTML = '';
      (c.qa.items || []).forEach((item) => addQaRow(qaRows, item));
      if (!(c.qa.items || []).length) addQaRow(qaRows, {});

      document.getElementById('sc-footnote-text').value = c.footnote.text || '';

      if (statusEl) statusEl.textContent = '';
    } catch (_) {
      if (statusEl) statusEl.textContent = 'Could not load site copy.';
    }
  }

  async function loadRegistry() {
    if (!token) return;
    const statusEl = document.getElementById('registry-status');
    if (statusEl) statusEl.textContent = 'Loading...';
    try {
      const res = await api('/api/settings');
      if (!res.ok) throw new Error();
      const settings = await res.json();
      const c = typeof mergeSiteContent === 'function' ? mergeSiteContent(settings.siteContent) : {};

      document.getElementById('sc-registry-eyebrow').value = c.registry.eyebrow || '';
      document.getElementById('sc-registry-title').value = c.registry.title || '';
      document.getElementById('sc-registry-intro').value = c.registry.intro || '';
      const regRows = document.getElementById('sc-registry-link-rows');
      regRows.innerHTML = '';
      (c.registry.links || []).forEach((item) => addRegistryLinkRow(regRows, item));
      if (!(c.registry.links || []).length) addRegistryLinkRow(regRows, {});

      if (statusEl) statusEl.textContent = '';
    } catch (_) {
      if (statusEl) statusEl.textContent = 'Could not load registry.';
    }
  }

  siteContentPanel?.addEventListener('click', (e) => {
    if (e.target.closest('[data-sc-schedule-remove]')) {
      e.target.closest('[data-sc-schedule-row]')?.remove();
      return;
    }
    if (e.target.closest('[data-sc-qa-remove]')) {
      e.target.closest('[data-sc-qa-row]')?.remove();
      return;
    }
    if (e.target.closest('[data-sc-travel-remove]')) {
      e.target.closest('[data-sc-travel-block]')?.remove();
    }
  });

  registryPanel?.addEventListener('click', (e) => {
    if (e.target.closest('[data-sc-registry-remove]')) {
      e.target.closest('[data-sc-registry-link-row]')?.remove();
    }
  });

  document.getElementById('sc-schedule-add')?.addEventListener('click', () => {
    addScheduleRow(document.getElementById('sc-schedule-rows'), {});
  });
  document.getElementById('sc-qa-add')?.addEventListener('click', () => {
    addQaRow(document.getElementById('sc-qa-rows'), {});
  });
  document.getElementById('sc-travel-col-0-add')?.addEventListener('click', () => {
    addTravelBlock(document.getElementById('sc-travel-col-0-blocks'), {});
  });
  document.getElementById('sc-travel-col-1-add')?.addEventListener('click', () => {
    addTravelBlock(document.getElementById('sc-travel-col-1-blocks'), {});
  });
  document.getElementById('sc-registry-link-add')?.addEventListener('click', () => {
    addRegistryLinkRow(document.getElementById('sc-registry-link-rows'), {});
  });

  document.getElementById('sc-save')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('sc-status');
    if (!token) return;
    if (statusEl) statusEl.textContent = 'Saving...';
    try {
      const getRes = await api('/api/settings');
      if (!getRes.ok) throw new Error();
      const settings = await getRes.json();
      const prev = settings.siteContent && typeof settings.siteContent === 'object' ? settings.siteContent : {};
      const siteContent = { ...prev, ...readSiteContentFromForm() };
      const res = await api('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteContent }),
      });
      if (!res.ok) throw new Error();
      if (statusEl) statusEl.textContent = 'Saved.';
    } catch (_) {
      if (statusEl) statusEl.textContent = 'Save failed.';
    }
  });

  document.getElementById('registry-save')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('registry-status');
    if (!token) return;
    if (statusEl) statusEl.textContent = 'Saving...';
    try {
      const getRes = await api('/api/settings');
      if (!getRes.ok) throw new Error();
      const settings = await getRes.json();
      const prev = settings.siteContent && typeof settings.siteContent === 'object' ? settings.siteContent : {};
      const siteContent = { ...prev, registry: readRegistryFromForm() };
      const res = await api('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteContent }),
      });
      if (!res.ok) throw new Error();
      if (statusEl) statusEl.textContent = 'Saved.';
    } catch (_) {
      if (statusEl) statusEl.textContent = 'Save failed.';
    }
  });

  const deleteGuest = async (id) => {
    const g = guests.find((x) => x.id === id);
    const label = g ? `"${g.name}"` : 'this guest';
    if (!confirm(`Remove ${label}? This cannot be undone.`)) return;
    try {
      const res = await api(`/api/guests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      selectedIds.delete(id);
      loadGuests();
    } catch (_) {
      setListStatus('Could not delete guest', 'error');
    }
  };

  selectAllCheckbox?.addEventListener('change', () => {
    const visible = getVisibleGuests();
    if (selectAllCheckbox.checked) {
      visible.forEach((g) => selectedIds.add(g.id));
    } else {
      visible.forEach((g) => selectedIds.delete(g.id));
    }
    renderGuestsTable();
  });

  bulkDeleteBtn?.addEventListener('click', async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} guest${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setListStatus('Deleting...');
    try {
      const res = await api('/api/guests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) throw new Error('delete failed');
      selectedIds.clear();
      loadGuests();
    } catch (_) {
      setListStatus('Could not delete guests', 'error');
    }
  });

  document.getElementById('guests-refresh-list')?.addEventListener('click', () => { loadGuests(); });

  // Toolbar controls
  searchInput?.addEventListener('input', () => {
    viewState.q = searchInput.value;
    renderGuestsTable();
  });
  filterSelect?.addEventListener('change', () => {
    viewState.filter = filterSelect.value;
    renderGuestsTable();
  });
  sortSelect?.addEventListener('change', () => {
    viewState.sort = sortSelect.value;
    renderGuestsTable();
  });
  groupToggle?.addEventListener('change', () => {
    viewState.groupByHousehold = groupToggle.checked;
    renderGuestsTable();
  });

  // Export CSV
  const csvCell = (val) => {
    const s = val === undefined || val === null ? '' : String(val);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  document.getElementById('guests-export-btn')?.addEventListener('click', () => {
    const list = getVisibleGuests();
    const source = list.length ? list : guests;
    const header = ['name', 'householdId', 'plusOneAllowed', 'hasKids', 'thankYouSent', 'dietaryRestrictions', 'notes', 'rsvp', 'rsvpAt'];
    const rows = source.map((g) => [
      g.name,
      g.householdId || '',
      g.plusOneAllowed ? 'true' : 'false',
      g.hasKids ? 'true' : 'false',
      g.thankYouSent ? 'true' : 'false',
      g.dietaryRestrictions || '',
      g.notes || '',
      g.rsvpStatus || '',
      g.rsvpAt || '',
    ].map(csvCell).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `guests-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // RSVP overview table (recent responses)
  const rsvpRows = document.getElementById('admin-rsvp-rows');
  const rsvpStatusEl = document.getElementById('admin-rsvp-status');

  const setRsvpStatus = (msg, tone = 'info') => {
    if (!rsvpStatusEl) return;
    rsvpStatusEl.textContent = msg;
    rsvpStatusEl.className = `text-sm ${tone === 'error' ? 'text-magenta' : 'text-charcoal/70'}`;
  };

  const renderRsvpTable = () => {
    if (!rsvpRows) return;
    if (!rsvps.length) {
      rsvpRows.innerHTML = `<tr><td colspan="5" class="px-3 py-6 text-center text-charcoal/50 text-sm">No responses yet.</td></tr>`;
      return;
    }
    const sorted = [...rsvps].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    rsvpRows.innerHTML = sorted
      .map((row) => `
        <tr>
          <td class="px-3 py-2 font-medium">${escapeHtml(row.name)}</td>
          <td class="px-3 py-2">${rsvpPill(String(row.rsvp || '').toLowerCase())}</td>
          <td class="px-3 py-2 text-charcoal/80">${escapeHtml(row.allergies || '')}</td>
          <td class="px-3 py-2 text-charcoal/80">${escapeHtml(row.note || '')}</td>
          <td class="px-3 py-2 text-xs text-charcoal/60 whitespace-nowrap">${row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</td>
        </tr>
      `)
      .join('');
  };

  const refreshRsvps = async () => {
    if (!token) return setRsvpStatus('Login to view RSVPs', 'error');
    setRsvpStatus('Loading...');
    try {
      const res = await api('/api/rsvps');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      rsvps = data.results || [];
      annotateGuestsWithRsvps();
      renderStats();
      renderGuestsTable();
      renderRsvpTable();
      setRsvpStatus(`${rsvps.length} response${rsvps.length === 1 ? '' : 's'}`);
    } catch (err) {
      setRsvpStatus('Could not load RSVPs', 'error');
    }
  };

  document.getElementById('guests-refresh-rsvp')?.addEventListener('click', refreshRsvps);

  // ----- Import modal -----
  const importModal = document.getElementById('import-modal');
  const importOpenBtn = document.getElementById('guests-import-btn');
  const importCancelBtn = document.getElementById('import-modal-cancel');
  const importCloseBtn = document.getElementById('import-modal-close');
  const importSaveBtn = document.getElementById('guests-save-import');
  const importPreviewTable = document.getElementById('import-preview-table');
  const importPreviewTbody = document.getElementById('import-preview-tbody');
  const importPreviewEmpty = document.getElementById('import-preview-empty');
  const importPreviewCount = document.getElementById('import-preview-count');
  const importReplaceConfirm = document.getElementById('import-replace-confirm');
  const importReplaceConfirmInput = document.getElementById('import-replace-confirm-input');
  const importFileName = document.getElementById('guests-file-name');

  const getImportMode = () => (document.querySelector('input[name="import-mode"]:checked')?.value || 'merge');

  const updateImportPreview = (data) => {
    previewData = Array.isArray(data) ? data : [];
    if (!previewData.length) {
      importPreviewTable?.classList.add('hidden');
      importPreviewEmpty?.classList.remove('hidden');
      if (importPreviewCount) importPreviewCount.textContent = '';
    } else {
      importPreviewEmpty?.classList.add('hidden');
      importPreviewTable?.classList.remove('hidden');
      importPreviewTbody.innerHTML = previewData
        .slice(0, 100)
        .map((g) => `
          <tr>
            <td class="px-2 py-1 font-medium">${escapeHtml(g.name || '')}</td>
            <td class="px-2 py-1 text-charcoal/70">${escapeHtml(g.householdId || '')}</td>
            <td class="px-2 py-1 text-charcoal/70">${escapeHtml(g.dietaryRestrictions || '')}</td>
            <td class="px-2 py-1">${g.plusOneAllowed ? '✓' : ''}</td>
            <td class="px-2 py-1">${g.hasKids ? '✓' : ''}</td>
            <td class="px-2 py-1">${g.thankYouSent ? '✓' : ''}</td>
          </tr>`)
        .join('');
      if (importPreviewCount) {
        const extra = previewData.length > 100 ? ` (showing first 100)` : '';
        importPreviewCount.textContent = `· ${previewData.length} row${previewData.length === 1 ? '' : 's'}${extra}`;
      }
    }
    updateImportSaveState();
  };

  const updateImportSaveState = () => {
    const mode = getImportMode();
    const hasData = previewData.length > 0;
    if (mode === 'replace') {
      importReplaceConfirm?.classList.remove('hidden');
      const ok = hasData && importReplaceConfirmInput?.value.trim() === 'REPLACE';
      if (importSaveBtn) importSaveBtn.disabled = !ok;
    } else {
      importReplaceConfirm?.classList.add('hidden');
      if (importSaveBtn) importSaveBtn.disabled = !hasData;
    }
  };

  const openImportModal = () => {
    if (!importModal) return;
    // Reset
    previewData = [];
    if (fileInput) fileInput.value = '';
    if (rawInput) rawInput.value = '';
    if (importFileName) importFileName.textContent = '';
    const mergeRadio = document.querySelector('input[name="import-mode"][value="merge"]');
    if (mergeRadio) mergeRadio.checked = true;
    if (importReplaceConfirmInput) importReplaceConfirmInput.value = '';
    setImportStatus('');
    updateImportPreview([]);
    importModal.classList.remove('hidden');
  };
  const closeImportModal = () => importModal?.classList.add('hidden');

  importOpenBtn?.addEventListener('click', openImportModal);
  importCancelBtn?.addEventListener('click', closeImportModal);
  importCloseBtn?.addEventListener('click', closeImportModal);
  importModal?.addEventListener('click', (e) => {
    if (e.target === importModal) closeImportModal();
  });

  document.querySelectorAll('input[name="import-mode"]').forEach((r) => {
    r.addEventListener('change', updateImportSaveState);
  });
  importReplaceConfirmInput?.addEventListener('input', updateImportSaveState);

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (importFileName) importFileName.textContent = file.name;
    const text = await file.text();
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : parsed.guests;
        if (!Array.isArray(arr)) throw new Error('JSON must be an array or { guests: [] }');
        updateImportPreview(arr);
      } else {
        updateImportPreview(parseCsv(text));
      }
      setImportStatus(`Previewed ${previewData.length} row${previewData.length === 1 ? '' : 's'}`);
    } catch (err) {
      setImportStatus('Could not parse file', 'error');
    }
  });

  rawInput?.addEventListener('input', () => {
    try {
      if (!rawInput.value.trim()) { updateImportPreview([]); return; }
      const parsed = JSON.parse(rawInput.value);
      const arr = Array.isArray(parsed) ? parsed : parsed.guests;
      if (!Array.isArray(arr)) throw new Error('JSON must be an array');
      updateImportPreview(arr);
      setImportStatus(`Previewed ${previewData.length} row${previewData.length === 1 ? '' : 's'} from pasted JSON`);
    } catch (err) {
      setImportStatus('Invalid JSON', 'error');
    }
  });

  importSaveBtn?.addEventListener('click', async () => {
    if (!token) return setImportStatus('Please login first', 'error');
    if (!previewData.length) return setImportStatus('No data to import', 'error');
    const mode = getImportMode();
    if (mode === 'replace' && importReplaceConfirmInput?.value.trim() !== 'REPLACE') {
      return setImportStatus('Type REPLACE to confirm', 'error');
    }
    setImportStatus('Importing...');
    try {
      const res = await api('/api/guests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, guests: previewData }),
      });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      const bits = [];
      if (typeof data.inserted === 'number') bits.push(`${data.inserted} added`);
      if (typeof data.updated === 'number') bits.push(`${data.updated} updated`);
      setImportStatus(`Imported ${data.count} guest${data.count === 1 ? '' : 's'}${bits.length ? ` (${bits.join(', ')})` : ''}`);
      loadGuests();
      setTimeout(closeImportModal, 800);
    } catch (err) {
      setImportStatus('Import failed', 'error');
    }
  });

  // Guest modal
  const guestModal = document.getElementById('guest-modal');
  const openGuestModal = (guestId) => {
    document.getElementById('guest-modal-title').textContent = guestId ? 'Edit guest' : 'Add guest';
    document.getElementById('guest-modal-id').value = guestId || '';
    const g = guestId ? guests.find((x) => x.id === guestId) : null;
    document.getElementById('guest-modal-name').value = g?.name || '';
    document.getElementById('guest-modal-dietary').value = g?.dietaryRestrictions || '';
    document.getElementById('guest-modal-notes').value = g?.notes || '';
    document.getElementById('guest-modal-thankyou').checked = !!g?.thankYouSent;
    document.getElementById('guest-modal-household').value = g?.householdId || '';
    document.getElementById('guest-modal-plusone').checked = !!g?.plusOneAllowed;
    document.getElementById('guest-modal-haskids').checked = !!g?.hasKids;

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
      dietaryRestrictions: document.getElementById('guest-modal-dietary').value.trim(),
      notes: document.getElementById('guest-modal-notes').value.trim(),
      thankYouSent: document.getElementById('guest-modal-thankyou').checked,
      householdId: document.getElementById('guest-modal-household').value.trim() || null,
      plusOneAllowed: document.getElementById('guest-modal-plusone').checked,
      hasKids: document.getElementById('guest-modal-haskids').checked,
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
      group: 'Day of timeline',
      description: 'Photo alongside the schedule / day-of timeline section.',
      layout: 'hero',
      slots: [{ key: 'day-of-timeline', label: 'Timeline photo' }],
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

  const renderPartyAdminSection = (party, photos) => {
    const sorted = [...party].sort((a, b) => (a.order || 0) - (b.order || 0));
    const bridesmaids = sorted.filter((m) => m.side === 'bridesmaids');
    const groomsmen = sorted.filter((m) => m.side === 'groomsmen');

    const memberHtml = (m) => {
      const url = photos[m.key] || '';
      const preview = url ? `<img src="${url}" class="w-full h-full object-cover" alt="" />` : '';
      return `
        <div class="p-3 bg-subtle rounded-xl border border-blush/40 flex gap-3 items-start" data-party-key="${m.key}">
          <div class="w-16 h-16 rounded-lg overflow-hidden placeholder-img shrink-0">${preview}</div>
          <div class="flex-1 min-w-0 space-y-1.5">
            <input type="text" data-member-name="${m.key}" value="${escapeHtml(m.name)}" placeholder="Name" class="w-full px-2 py-1 rounded-lg border border-blush/60 text-sm font-semibold text-charcoal" />
            <input type="text" data-member-role="${m.key}" value="${escapeHtml(m.role)}" placeholder="Role (e.g. Bridesmaid)" class="w-full px-2 py-1 rounded-lg border border-blush/60 text-xs text-charcoal/70" />
            <div class="flex gap-2 flex-wrap">
              <label class="px-2 py-1 rounded-lg bg-magenta text-white text-xs font-semibold cursor-pointer hover:bg-magenta/90 transition">
                <span>Upload photo</span>
                <input type="file" accept="image/*" data-slot-upload="${m.key}" class="hidden" />
              </label>
              <button type="button" data-slot-remove="${m.key}" class="px-2 py-1 rounded-lg border border-blush/60 text-xs hover:border-magenta/40 transition">Remove photo</button>
              <button type="button" data-member-save="${m.key}" class="px-2 py-1 rounded-lg border border-magenta text-magenta text-xs font-semibold hover:bg-magenta/10 transition">Save</button>
              <button type="button" data-party-remove="${m.key}" class="px-2 py-1 rounded-lg border border-blush/60 text-xs text-charcoal/50 hover:border-magenta/40 hover:text-magenta transition">Remove member</button>
            </div>
            <p data-slot-status="${m.key}" class="text-xs text-charcoal/70 min-h-[1em]"></p>
          </div>
        </div>`;
    };

    const sideSection = (title, members, addSide) => `
      <div class="space-y-3">
        <h4 class="text-sm font-semibold uppercase tracking-wider text-charcoal/60">${title}</h4>
        <div class="space-y-3">${members.map(memberHtml).join('')}</div>
        <button type="button" data-party-add="${addSide}" class="px-3 py-1.5 rounded-xl border border-blush/60 text-sm text-charcoal/70 hover:border-magenta/40 hover:text-magenta transition">+ Add member</button>
      </div>`;

    return `
      <section class="bg-surface border border-blush/50 rounded-2xl shadow-sm p-6 space-y-4">
        <h3 class="text-lg font-semibold text-charcoal">Wedding Party</h3>
        <p class="text-sm text-charcoal/70">Manage bridesmaids and groomsmen shown on the home page.</p>
        <div class="space-y-6">
          ${sideSection('Bridesmaids', bridesmaids, 'bridesmaids')}
          ${sideSection('Groomsmen', groomsmen, 'groomsmen')}
        </div>
      </section>`;
  };

  const loadPhotos = async () => {
    if (!token) return;
    try {
      const res = await api('/api/settings');
      if (!res.ok) throw new Error();
      const settings = await res.json();
      const photos = settings.photos || {};
      partyData = settings.party || [];

      const staticHtml = PHOTO_GROUPS.map(({ group, description, layout, slots }) => {
        const slotsHtml = slots.map((slot) => renderSlotHtml(slot, photos[slot.key], layout)).join('');
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

      photosPanel.innerHTML = staticHtml + renderPartyAdminSection(partyData, photos);
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
        input.value = '';
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
      const key = saveBtn.getAttribute('data-member-save');
      const nameInput = photosPanel.querySelector(`[data-member-name="${key}"]`);
      const roleInput = photosPanel.querySelector(`[data-member-role="${key}"]`);
      const statusEl = photosPanel.querySelector(`[data-slot-status="${key}"]`);
      const name = nameInput?.value?.trim() || '';
      const role = roleInput?.value?.trim() || '';
      if (!name) { if (statusEl) statusEl.textContent = 'Name is required.'; return; }
      if (statusEl) statusEl.textContent = 'Saving...';
      partyData = partyData.map((m) => (m.key === key ? { ...m, name, role } : m));
      try {
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ party: partyData }),
        });
        if (!res.ok) throw new Error();
        if (statusEl) statusEl.textContent = 'Saved!';
      } catch (_) {
        if (statusEl) statusEl.textContent = 'Failed to save.';
      }
      return;
    }

    const addBtn = e.target.closest('[data-party-add]');
    if (addBtn) {
      const side = addBtn.getAttribute('data-party-add');
      const sideMembers = partyData.filter((m) => m.side === side);
      const order = sideMembers.length ? Math.max(...sideMembers.map((m) => m.order || 0)) + 1 : 0;
      const key = `party-${Date.now().toString(36)}`;
      partyData = [...partyData, { key, name: '', role: '', side, order }];
      try {
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ party: partyData }),
        });
        if (!res.ok) throw new Error();
        loadPhotos();
      } catch (_) {}
      return;
    }

    const partyRemoveBtn = e.target.closest('[data-party-remove]');
    if (partyRemoveBtn) {
      const key = partyRemoveBtn.getAttribute('data-party-remove');
      if (!confirm('Remove this party member?')) return;
      partyData = partyData.filter((m) => m.key !== key);
      try {
        await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoDelete: { slot: key } }),
        });
        const res = await api('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ party: partyData }),
        });
        if (!res.ok) throw new Error();
        loadPhotos();
      } catch (_) {}
      return;
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
