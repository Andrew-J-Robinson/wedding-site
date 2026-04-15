(() => {
  if (!document.getElementById('rsvp-app')) return;

  const steps = [
    'Enter Full Name',
    'Search Guest List',
    'Confirm Guest',
    'RSVP Choice',
    'Plus One',
    'Food Allergies',
    'Optional Note'
  ];

  const state = {
    step: 0,
    name: '',
    matches: [],
    householdMembers: [],
    selectedGuest: null,
    rsvp: 'yes',
    memberRsvps: {},
    plusOneAllowed: false,
    bringingPlusOne: false,
    plusOneName: '',
    plusOneAllergies: '',
    allergies: '',
    memberAllergies: {},
    note: '',
    submitting: false,
    rsvpOpen: true,
  };

  const loadingEl = document.getElementById('rsvp-loading');
  const interactiveEl = document.getElementById('rsvp-interactive');
  const stepperEl = document.getElementById('rsvp-stepper');
  const bodyEl = document.getElementById('rsvp-body');
  const prevBtn = document.getElementById('rsvp-prev');
  const nextBtn = document.getElementById('rsvp-next');
  const navEl = document.getElementById('rsvp-nav');
  const statusEl = document.getElementById('rsvp-status');

  const escapeHtml = (s) => {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  };

  const checkRsvpOpen = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      state.rsvpOpen = data.rsvpOpenGlobal !== false;
    } catch (_) {}
  };

  const getAllMembers = () => {
    if (!state.selectedGuest) return [];
    if (state.householdMembers.length) {
      return [state.selectedGuest, ...state.householdMembers];
    }
    return [state.selectedGuest];
  };

  const isHousehold = () => state.householdMembers.length > 0;

  const visibleSteps = () => {
    return steps.filter((_, idx) => {
      if (idx === 4) return state.plusOneAllowed;
      return true;
    });
  };

  const mapStepIndex = (visIdx) => {
    const vis = visibleSteps();
    return steps.indexOf(vis[visIdx]);
  };

  const visibleStepIndex = () => {
    const vis = visibleSteps();
    const label = steps[state.step];
    const idx = vis.indexOf(label);
    return idx >= 0 ? idx : 0;
  };

  const renderStepper = () => {
    const vis = visibleSteps();
    const currentVisIdx = visibleStepIndex();
    stepperEl.innerHTML = vis
      .map((label, idx) => {
        const active = idx === currentVisIdx;
        return `<div class="px-3 py-1 rounded-full border ${active ? 'border-magenta text-magenta bg-blush/40' : 'border-blush/60 text-charcoal/70'}">${idx + 1}. ${label}</div>`;
      })
      .join('');
  };

  const setStatus = (message, tone = 'info') => {
    const color = tone === 'error' ? 'text-magenta' : tone === 'success' ? 'text-emerald-600' : 'text-charcoal/70';
    statusEl.className = `text-sm ${color}`;
    statusEl.textContent = message;
  };

  const showConfirmation = () => {
    stepperEl.innerHTML = '';
    navEl?.classList.add('hidden');
    statusEl.textContent = '';

    const members = getAllMembers();
    const isMulti = members.length > 1;
    let summaryHtml = '';

    if (isMulti) {
      summaryHtml = `
        <ul class="text-left inline-block space-y-1">
          ${members.map((m) => {
            const r = state.memberRsvps[m.id] || state.rsvp;
            const label = r === 'yes' ? 'Yes' : r === 'no' ? 'No' : 'Maybe';
            return `<li class="text-charcoal/80">${escapeHtml(m.name)} &mdash; <strong class="text-magenta">${label}</strong></li>`;
          }).join('')}
        </ul>`;
    } else {
      const rsvpLabel = state.rsvp === 'yes' ? 'Yes' : state.rsvp === 'no' ? 'No' : 'Maybe';
      summaryHtml = `<p class="text-charcoal/80">We've recorded your RSVP as <strong class="text-magenta">${rsvpLabel}</strong>.</p>`;
    }

    if (state.bringingPlusOne && state.plusOneName) {
      summaryHtml += `<p class="text-charcoal/70 text-sm mt-2">+1: ${escapeHtml(state.plusOneName)}</p>`;
    }

    bodyEl.innerHTML = `
      <div class="text-center space-y-4 py-6">
        <h2 class="text-2xl sm:text-3xl font-display text-charcoal">Thank you, ${escapeHtml(state.name)}!</h2>
        ${summaryHtml}
        <p class="text-sm text-charcoal/60">If you need to make changes, simply RSVP again.</p>
        <a href="/" class="inline-block mt-4 px-5 py-2 rounded-full border border-blush/60 text-charcoal hover:border-magenta/40 transition">Back to site</a>
      </div>
    `;
  };

  const rsvpButton = (val, current) =>
    `<button data-rsvp="${val}" class="px-4 py-2 rounded-xl border ${current === val ? 'border-magenta bg-blush/40 text-magenta' : 'border-blush/60'} hover:border-magenta/40 capitalize text-sm">${val}</button>`;

  const renderStep = () => {
    if (!state.rsvpOpen) {
      bodyEl.innerHTML = '<div class="p-4 rounded-xl bg-blush/40 text-charcoal">RSVP collection is currently closed. Please check back later.</div>';
      stepperEl.innerHTML = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      navEl?.classList.add('hidden');
      return;
    }
    navEl?.classList.remove('hidden');
    renderStepper();
    prevBtn.disabled = state.step === 0 || state.submitting;

    const lastStep = 6;
    const hideNext = state.step === 0 || (state.step === 1 && !state.selectedGuest);
    nextBtn.classList.toggle('invisible', hideNext);
    nextBtn.disabled = state.submitting || hideNext;
    nextBtn.textContent = state.step === lastStep ? 'Submit RSVP' : 'Next';

    switch (state.step) {
      case 0:
        bodyEl.innerHTML = `
          <div class="space-y-3">
            <label class="block text-sm font-medium text-charcoal">Full Name</label>
            <input id="rsvp-name" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Enter the name on your invite" value="${escapeHtml(state.name)}" />
            <p class="text-xs text-charcoal/70">We'll use this to find your invitation.</p>
            <button id="rsvp-search-btn" class="w-full px-5 py-3 rounded-xl bg-magenta text-white font-semibold hover:bg-magenta/90 transition">Search</button>
          </div>
        `;
        document.getElementById('rsvp-search-btn')?.addEventListener('click', () => {
          const input = document.getElementById('rsvp-name');
          state.name = input ? input.value.trim() : '';
          if (!state.name) {
            setStatus('Please enter your full name to continue.', 'error');
            return;
          }
          searchGuests();
        });
        document.getElementById('rsvp-name')?.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') document.getElementById('rsvp-search-btn')?.click();
        });
        break;

      case 1:
        if (state.matches.length === 0) {
          bodyEl.innerHTML = `<div class="p-4 rounded-xl bg-amber-50 text-amber-800">No matches found. Go back to edit your name or try a different spelling.</div>`;
          break;
        }
        bodyEl.innerHTML = `
          <div class="space-y-3">
            <p class="text-sm text-charcoal/70">Select your name from the list below.</p>
            <div class="space-y-2">
              ${state.matches
                .map(
                  (m) => `
                    <button data-id="${m.id}" class="w-full flex items-center justify-between px-4 py-3 border rounded-xl hover:border-magenta/40 ${state.selectedGuest && state.selectedGuest.id === m.id ? 'border-magenta bg-blush/40' : 'border-blush/60'}">
                      <span class="text-left">
                        <span class="font-semibold text-charcoal block">${escapeHtml(m.name)}</span>
                      </span>
                      <span class="text-sm text-magenta">Select</span>
                    </button>
                  `
                )
                .join('')}
            </div>
          </div>
        `;
        bodyEl.querySelectorAll('button[data-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const match = state.matches.find((m) => m.id === id);
            state.selectedGuest = match || null;
            if (match) {
              state.plusOneAllowed = !!match.plusOneAllowed;
              const hid = match.householdId;
              state.householdMembers = hid
                ? state.allSearchMembers.filter((g) => g.householdId === hid && g.id !== match.id)
                : [];
              getAllMembers().forEach((m) => {
                if (!state.memberRsvps[m.id]) state.memberRsvps[m.id] = 'yes';
              });
            }
            renderStep();
          });
        });
        break;

      case 2: {
        const members = getAllMembers();
        const multi = members.length > 1;
        bodyEl.innerHTML = `
          <div class="space-y-2">
            <p class="text-sm text-charcoal/70">${multi ? 'Confirm your household:' : 'Confirm this is you:'}</p>
            <div class="p-4 rounded-xl border border-blush/60 bg-blush/20 space-y-1">
              ${members.map((m) => `<p class="${m.id === state.selectedGuest?.id ? 'font-semibold' : ''} text-charcoal">${escapeHtml(m.name)}</p>`).join('')}
            </div>
            ${multi ? '<p class="text-xs text-charcoal/60">You\'ll RSVP for everyone listed above.</p>' : ''}
          </div>
        `;
        break;
      }

      case 3: {
        const members = getAllMembers();
        if (members.length > 1) {
          bodyEl.innerHTML = `
            <div class="space-y-4">
              <p class="text-sm text-charcoal/70">Will each person be joining us?</p>
              ${members.map((m) => `
                <div class="p-3 rounded-xl border border-blush/60 space-y-2">
                  <p class="font-semibold text-charcoal text-sm">${escapeHtml(m.name)}</p>
                  <div class="flex gap-2">
                    ${['yes', 'no', 'maybe'].map((val) => rsvpButton(val, state.memberRsvps[m.id] || 'yes')).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `;
          bodyEl.querySelectorAll('[data-rsvp]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              const card = e.target.closest('.p-3');
              const idx = [...bodyEl.querySelectorAll('.p-3')].indexOf(card);
              if (idx >= 0 && members[idx]) {
                state.memberRsvps[members[idx].id] = btn.getAttribute('data-rsvp');
                renderStep();
              }
            });
          });
        } else {
          bodyEl.innerHTML = `
            <div class="space-y-3">
              <p class="text-sm text-charcoal/70">Will you be joining us?</p>
              <div class="grid sm:grid-cols-3 gap-3">
                ${['yes', 'no', 'maybe']
                  .map(
                    (val) => `
                      <button data-rsvp="${val}" class="px-4 py-3 rounded-xl border ${state.rsvp === val ? 'border-magenta bg-blush/40 text-magenta' : 'border-blush/60'} hover:border-magenta/40 capitalize">${val}</button>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `;
          bodyEl.querySelectorAll('button[data-rsvp]').forEach((btn) => {
            btn.addEventListener('click', () => {
              state.rsvp = btn.getAttribute('data-rsvp');
              renderStep();
            });
          });
        }
        break;
      }

      case 4:
        bodyEl.innerHTML = `
          <div class="space-y-4">
            <p class="text-sm text-charcoal/70">Will you be bringing a guest?</p>
            <div class="flex gap-3">
              <button data-plusone="yes" class="px-4 py-3 rounded-xl border ${state.bringingPlusOne ? 'border-magenta bg-blush/40 text-magenta' : 'border-blush/60'} hover:border-magenta/40">Yes</button>
              <button data-plusone="no" class="px-4 py-3 rounded-xl border ${!state.bringingPlusOne ? 'border-magenta bg-blush/40 text-magenta' : 'border-blush/60'} hover:border-magenta/40">No</button>
            </div>
            <div id="plusone-fields" class="${state.bringingPlusOne ? '' : 'hidden'} space-y-3">
              <label class="block text-sm font-medium text-charcoal">Guest's name</label>
              <input id="plusone-name" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Their full name" value="${escapeHtml(state.plusOneName)}" />
              <label class="block text-sm font-medium text-charcoal">Their dietary needs (optional)</label>
              <input id="plusone-allergies" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Any allergies or preferences" value="${escapeHtml(state.plusOneAllergies)}" />
            </div>
          </div>
        `;
        bodyEl.querySelectorAll('[data-plusone]').forEach((btn) => {
          btn.addEventListener('click', () => {
            state.bringingPlusOne = btn.getAttribute('data-plusone') === 'yes';
            renderStep();
          });
        });
        break;

      case 5: {
        const members = getAllMembers();
        if (members.length > 1) {
          bodyEl.innerHTML = `
            <div class="space-y-4">
              <p class="text-sm text-charcoal/70">Any food allergies or dietary needs?</p>
              ${members.map((m) => `
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-charcoal">${escapeHtml(m.name)}</label>
                  <input data-allergy-id="${m.id}" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Allergies or dietary preferences" value="${escapeHtml(state.memberAllergies[m.id] || '')}" />
                </div>
              `).join('')}
            </div>
          `;
        } else {
          bodyEl.innerHTML = `
            <div class="space-y-2">
              <label class="block text-sm font-medium text-charcoal">Food allergies or dietary needs</label>
              <textarea id="rsvp-allergies" rows="3" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Let us know any allergies or dietary preferences">${escapeHtml(state.allergies)}</textarea>
            </div>
          `;
        }
        break;
      }

      case 6:
        bodyEl.innerHTML = `
          <div class="space-y-2">
            <label class="block text-sm font-medium text-charcoal">Note to the couple (optional)</label>
            <textarea id="rsvp-note" rows="3" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Share a message or song request">${escapeHtml(state.note)}</textarea>
          </div>
        `;
        break;

      default:
        bodyEl.innerHTML = '';
    }
  };

  const searchGuests = async () => {
    setStatus('Searching guest list...');
    try {
      const res = await fetch(`/api/guests?name=${encodeURIComponent(state.name)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      state.matches = data.results || [];
      state.allSearchMembers = [...(data.results || []), ...(data.householdMembers || [])];
      state.selectedGuest = null;
      state.householdMembers = [];
      state.plusOneAllowed = false;
      setStatus(state.matches.length ? '' : 'No matches found. Try adjusting the spelling.', state.matches.length ? 'info' : 'error');
      state.step = 1;
      renderStep();
    } catch (err) {
      setStatus('Could not search right now. Please try again.', 'error');
    }
  };

  const collectAllergies = () => {
    const members = getAllMembers();
    if (members.length > 1) {
      bodyEl.querySelectorAll('[data-allergy-id]').forEach((input) => {
        state.memberAllergies[input.getAttribute('data-allergy-id')] = input.value.trim();
      });
    } else {
      const textarea = document.getElementById('rsvp-allergies');
      state.allergies = textarea ? textarea.value.trim() : '';
    }
  };

  const collectPlusOne = () => {
    if (state.bringingPlusOne) {
      const nameInput = document.getElementById('plusone-name');
      const allergyInput = document.getElementById('plusone-allergies');
      state.plusOneName = nameInput ? nameInput.value.trim() : '';
      state.plusOneAllergies = allergyInput ? allergyInput.value.trim() : '';
    }
  };

  const submitRsvp = async () => {
    state.submitting = true;
    renderStep();
    setStatus('Submitting your RSVP...');
    try {
      const members = getAllMembers();
      const entries = members.map((m) => ({
        name: m.name,
        guestId: m.id,
        rsvp: members.length > 1 ? (state.memberRsvps[m.id] || 'yes') : state.rsvp,
        allergies: members.length > 1 ? (state.memberAllergies[m.id] || '') : state.allergies,
        note: m.id === state.selectedGuest?.id ? state.note : '',
      }));

      if (state.bringingPlusOne && state.plusOneName) {
        entries.push({
          name: state.plusOneName,
          guestId: state.selectedGuest?.id,
          rsvp: 'yes',
          allergies: state.plusOneAllergies,
          note: '',
        });
      }

      const res = await fetch('/api/rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Submit failed');
      }
      showConfirmation();
    } catch (err) {
      setStatus(err.message || 'Could not submit right now. Please try again.', 'error');
      state.submitting = false;
      renderStep();
    }
  };

  const nextRealStep = (from) => {
    let next = from + 1;
    if (next === 4 && !state.plusOneAllowed) next = 5;
    return next;
  };

  const prevRealStep = (from) => {
    let prev = from - 1;
    if (prev === 4 && !state.plusOneAllowed) prev = 3;
    return prev;
  };

  nextBtn.addEventListener('click', async () => {
    if (state.submitting) return;

    if (state.step === 1) {
      if (!state.selectedGuest) {
        setStatus('Select your name to continue.', 'error');
        return;
      }
      state.step = 2;
      renderStep();
      return;
    }

    if (state.step === 2) {
      if (!state.selectedGuest) {
        setStatus('Please confirm your guest record.', 'error');
        return;
      }
      state.step = 3;
      renderStep();
      return;
    }

    if (state.step === 3) {
      state.step = nextRealStep(3);
      renderStep();
      return;
    }

    if (state.step === 4) {
      collectPlusOne();
      if (state.bringingPlusOne && !state.plusOneName) {
        setStatus('Please enter your guest\'s name.', 'error');
        return;
      }
      state.step = 5;
      renderStep();
      return;
    }

    if (state.step === 5) {
      collectAllergies();
      state.step = 6;
      renderStep();
      return;
    }

    if (state.step === 6) {
      const textarea = document.getElementById('rsvp-note');
      state.note = textarea ? textarea.value.trim() : '';
      await submitRsvp();
      return;
    }
  });

  prevBtn.addEventListener('click', () => {
    if (state.submitting) return;
    if (state.step === 0) return;
    state.step = prevRealStep(state.step);
    setStatus('');
    renderStep();
  });

  (async () => {
    await checkRsvpOpen();
    if (loadingEl) {
      loadingEl.classList.add('hidden');
      loadingEl.removeAttribute('aria-busy');
    }
    if (interactiveEl) interactiveEl.classList.remove('hidden');
    renderStep();
  })();
})();
