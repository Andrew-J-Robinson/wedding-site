(() => {
  if (!document.getElementById('rsvp-app')) return;

  const steps = [
    'Enter Full Name',
    'Search Guest List',
    'Confirm Guest',
    'RSVP Choice',
    'Food Allergies',
    'Optional Note'
  ];

  const state = {
    step: 0,
    name: '',
    matches: [],
    selectedGuest: null,
    rsvp: 'yes',
    allergies: '',
    note: '',
    submitting: false,
    rsvpOpen: true,
  };

  const stepperEl = document.getElementById('rsvp-stepper');
  const bodyEl = document.getElementById('rsvp-body');
  const prevBtn = document.getElementById('rsvp-prev');
  const nextBtn = document.getElementById('rsvp-next');
  const statusEl = document.getElementById('rsvp-status');

  const checkRsvpOpen = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      state.rsvpOpen = data.rsvpOpenGlobal !== false;
    } catch (_) {}
  };

  const renderStepper = () => {
    stepperEl.innerHTML = steps
      .map((label, idx) => {
        const active = idx === state.step;
        return `<div class="px-3 py-1 rounded-full border ${active ? 'border-magenta text-magenta bg-blush/40' : 'border-blush/60 text-charcoal/70'}">${idx + 1}. ${label}</div>`;
      })
      .join('');
  };

  const setStatus = (message, tone = 'info') => {
    const color = tone === 'error' ? 'text-magenta' : tone === 'success' ? 'text-emerald-600' : 'text-charcoal/70';
    statusEl.className = `text-sm ${color}`;
    statusEl.textContent = message;
  };

  const renderStep = () => {
    if (!state.rsvpOpen) {
      bodyEl.innerHTML = '<div class="p-4 rounded-xl bg-blush/40 text-charcoal">RSVP collection is currently closed. Please check back later.</div>';
      stepperEl.innerHTML = '';
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }
    renderStepper();
    prevBtn.disabled = state.step === 0 || state.submitting;
    nextBtn.disabled = state.submitting;
    nextBtn.textContent = state.step === steps.length - 1 ? 'Submit RSVP' : 'Next';

    switch (state.step) {
      case 0:
        bodyEl.innerHTML = `
          <div class="space-y-2">
            <label class="block text-sm font-medium text-charcoal">Full Name</label>
            <input id="rsvp-name" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Enter the name on your invite" value="${state.name}" />
            <p class="text-xs text-charcoal/70">We'll use this to find your invitation.</p>
          </div>
        `;
        break;
      case 1:
        if (state.matches.length === 0) {
          bodyEl.innerHTML = `<div class="p-4 rounded-xl bg-amber-50 text-amber-800">No matches yet. Go back to edit your name or try a broader search.</div>`;
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
                        <span class="font-semibold text-charcoal block">${m.name}</span>
                        ${m.party ? `<span class="text-xs text-charcoal/70">Party size: ${m.party}</span>` : ''}
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
            renderStep();
          });
        });
        break;
      case 2:
        bodyEl.innerHTML = `
          <div class="space-y-2">
            <p class="text-sm text-charcoal/70">Confirm this is you:</p>
            <div class="p-4 rounded-xl border border-blush/60 bg-blush/20">
              <p class="font-semibold text-charcoal">${state.selectedGuest ? state.selectedGuest.name : 'No guest selected'}</p>
              ${state.selectedGuest?.party ? `<p class="text-sm text-charcoal/70">Party size on file: ${state.selectedGuest.party}</p>` : ''}
            </div>
          </div>
        `;
        break;
      case 3:
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
        break;
      case 4:
        bodyEl.innerHTML = `
          <div class="space-y-2">
            <label class="block text-sm font-medium text-charcoal">Food allergies or dietary needs</label>
            <textarea id="rsvp-allergies" rows="3" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Let us know any allergies or dietary preferences">${state.allergies}</textarea>
          </div>
        `;
        break;
      case 5:
        bodyEl.innerHTML = `
          <div class="space-y-2">
            <label class="block text-sm font-medium text-charcoal">Note to the couple (optional)</label>
            <textarea id="rsvp-note" rows="3" class="w-full px-4 py-3 rounded-xl border border-blush/60 focus:border-magenta focus:ring-2 focus:ring-blush/60" placeholder="Share a message or song request">${state.note}</textarea>
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
      state.selectedGuest = state.matches[0] || null;
      setStatus(state.matches.length ? '' : 'No matches found. Try adjusting the spelling.', state.matches.length ? 'info' : 'error');
      state.step = 1;
      renderStep();
    } catch (err) {
      setStatus('Could not search right now. Please try again.', 'error');
    }
  };

  const submitRsvp = async () => {
    state.submitting = true;
    renderStep();
    setStatus('Submitting your RSVP...');
    try {
      const res = await fetch('/api/rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          guestId: state.selectedGuest?.id,
          rsvp: state.rsvp,
          allergies: state.allergies,
          note: state.note,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Submit failed');
      }
      setStatus('Thank you! Your response has been recorded.', 'success');
      nextBtn.disabled = true;
      prevBtn.disabled = true;
    } catch (err) {
      setStatus(err.message || 'Could not submit right now. Please try again.', 'error');
    } finally {
      state.submitting = false;
      renderStep();
    }
  };

  nextBtn.addEventListener('click', async () => {
    if (state.submitting) return;

    if (state.step === 0) {
      const input = document.getElementById('rsvp-name');
      state.name = input ? input.value.trim() : '';
      if (!state.name) {
        setStatus('Please enter your full name to continue.', 'error');
        return;
      }
      await searchGuests();
      return;
    }

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
      state.step = 4;
      renderStep();
      return;
    }

    if (state.step === 4) {
      const textarea = document.getElementById('rsvp-allergies');
      state.allergies = textarea ? textarea.value.trim() : '';
      state.step = 5;
      renderStep();
      return;
    }

    if (state.step === 5) {
      const textarea = document.getElementById('rsvp-note');
      state.note = textarea ? textarea.value.trim() : '';
      await submitRsvp();
      return;
    }
  });

  prevBtn.addEventListener('click', () => {
    if (state.submitting) return;
    if (state.step === 0) return;
    state.step -= 1;
    setStatus('');
    renderStep();
  });

  (async () => {
    await checkRsvpOpen();
    renderStep();
  })();
})();
