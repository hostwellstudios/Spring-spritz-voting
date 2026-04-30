const Admin = (() => {
  const PHASES = ['onboarding', 'tasting', 'voting', 'results'];
  const PHASE_LABELS = {
    onboarding:  'Onboarding',
    tasting:     'Tasting',
    voting:      'Voting',
    results:     'Results',
  };
  const PHASE_NEXT_LABEL = {
    onboarding: '▶ Open Tasting Phase',
    tasting:    '▶ Open Voting Phase',
    voting:     '▶ Show Results',
    results:    null,
  };

  function renderDrinks() {
    const list = document.getElementById('admin-drinks-list');
    if (!list) return;

    list.innerHTML = '';
    if (State.drinks.length === 0) {
      list.innerHTML = '<li style="font-size:12px;color:#a08060;padding:4px 0">No drinks yet.</li>';
      return;
    }

    State.drinks.forEach(d => {
      const li = document.createElement('li');
      li.className = 'admin-drink-row';
      li.innerHTML = `
        <div class="admin-drink-row-info">
          <div class="admin-drink-row-name">${escapeHtml(d.name)}</div>
          <div class="admin-drink-row-team">${escapeHtml(d.team_members.join(', '))}</div>
        </div>
        <button class="btn btn-sm btn-danger" data-id="${d.id}">✕</button>
      `;
      li.querySelector('button').addEventListener('click', async () => {
        if (!confirm(`Delete "${d.name}"?`)) return;
        try {
          await adminDeleteDrink(d.id);
          State.drinks = await fetchDrinks();
          renderDrinks();
          Onboarding.refreshDrinkSelect();
          showToast('Drink deleted');
        } catch (err) {
          console.error(err);
          showToast('Could not delete drink', 'error');
        }
      });
      list.appendChild(li);
    });
  }

  function renderPhaseControls() {
    const label = document.getElementById('admin-phase-label');
    const btn   = document.getElementById('admin-advance-btn');
    if (!label || !btn) return;

    label.textContent = 'Phase: ' + PHASE_LABELS[State.phase];

    const nextLabel = PHASE_NEXT_LABEL[State.phase];
    if (nextLabel) {
      btn.textContent = nextLabel;
      btn.disabled    = false;
    } else {
      btn.textContent = 'Results are live';
      btn.disabled    = true;
    }
  }

  function init() {
    if (!State.isAdmin) return;

    renderDrinks();
    renderPhaseControls();

    // Add drink form
    const form = document.getElementById('admin-add-drink-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput    = document.getElementById('admin-drink-name');
      const membersInput = document.getElementById('admin-team-members');

      const name        = nameInput.value.trim();
      const teamMembers = membersInput.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (!name) {
        showToast('Drink name is required', 'error');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        await adminInsertDrink(name, teamMembers);
        State.drinks = await fetchDrinks();
        nameInput.value    = '';
        membersInput.value = '';
        renderDrinks();
        Onboarding.refreshDrinkSelect();
        showToast('Drink added ✓', 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not add drink', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });

    // Advance phase button
    const advanceBtn = document.getElementById('admin-advance-btn');
    advanceBtn.addEventListener('click', async () => {
      const idx  = PHASES.indexOf(State.phase);
      if (idx < 0 || idx >= PHASES.length - 1) return;

      const nextPhase = PHASES[idx + 1];
      if (!confirm(`Advance to ${PHASE_LABELS[nextPhase]} phase? This cannot be undone.`)) return;

      advanceBtn.disabled = true;
      try {
        await adminAdvancePhase(nextPhase);
        // The realtime subscription will update State.phase and re-render for everyone
        showToast('Phase advanced to ' + PHASE_LABELS[nextPhase], 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not advance phase', 'error');
        advanceBtn.disabled = false;
      }
    });
  }

  // Re-render admin controls whenever phase changes (called from router.js)
  function onPhaseChange() {
    if (State.isAdmin) renderPhaseControls();
  }

  return { init, onPhaseChange, renderDrinks };
})();

// ----------------------------------------------------------------
// Utility: HTML escape for user-supplied strings in innerHTML
// ----------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
