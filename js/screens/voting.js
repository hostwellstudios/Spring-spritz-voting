const Voting = (() => {
  const CATEGORIES = ['taste', 'creativity', 'presentation'];

  // ballots[category] = { [drinkId]: rank (1-based integer) }
  const ballots = { taste: {}, creativity: {}, presentation: {} };

  function eligibleDrinks() {
    // Exclude the guest's own drink from their ballot
    return State.drinks.filter(d => d.id !== State.guestDrinkId);
  }

  // ----------------------------------------------------------------
  // Rank assignment with list-shift behaviour:
  //   Moving a drink from rank P to rank R shifts everything between
  //   P and R by ±1, like reordering items in a sorted list.
  // ----------------------------------------------------------------
  function assignRank(drinkId, newRank, category) {
    const drinks = eligibleDrinks();
    const ballot = ballots[category];
    const oldRank = ballot[drinkId];

    if (oldRank === newRank) return;

    if (oldRank === undefined) {
      // First-time assignment — just set it; no shifting needed
      ballot[drinkId] = newRank;
    } else if (oldRank < newRank) {
      // Moving down: shift drinks in (oldRank, newRank] up by 1
      drinks.forEach(d => {
        if (d.id === drinkId) return;
        const r = ballot[d.id];
        if (r !== undefined && r > oldRank && r <= newRank) ballot[d.id] = r - 1;
      });
      ballot[drinkId] = newRank;
    } else {
      // Moving up: shift drinks in [newRank, oldRank) down by 1
      drinks.forEach(d => {
        if (d.id === drinkId) return;
        const r = ballot[d.id];
        if (r !== undefined && r >= newRank && r < oldRank) ballot[d.id] = r + 1;
      });
      ballot[drinkId] = newRank;
    }
  }

  function isCategoryComplete(category) {
    const drinks = eligibleDrinks();
    if (drinks.length === 0) return true;
    const ballot = ballots[category];
    return drinks.every(d => ballot[d.id] !== undefined);
  }

  function allComplete() {
    return CATEGORIES.every(isCategoryComplete);
  }

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------

  function renderPanel(category) {
    const panel  = document.getElementById(`voting-panel-${category}`);
    if (!panel) return;

    const drinks = eligibleDrinks();
    const ballot = ballots[category];
    const n      = drinks.length;

    if (drinks.length === 0) {
      panel.innerHTML = '<p style="color:var(--color-text-muted);font-size:14px">No drinks to rank.</p>';
      return;
    }

    // Sort by current rank for display; unranked go to bottom
    const sorted = [...drinks].sort((a, b) => {
      const ra = ballot[a.id] ?? n + 1;
      const rb = ballot[b.id] ?? n + 1;
      return ra - rb;
    });

    panel.innerHTML = '';
    sorted.forEach(d => {
      const rank = ballot[d.id];
      const row  = document.createElement('div');
      row.className = 'vote-row';
      row.innerHTML = `
        <div class="vote-rank-badge">${rank !== undefined ? rank : '?'}</div>
        <div class="vote-row-info">
          <div class="vote-row-name">${escapeHtml(d.name)}</div>
          <div class="vote-row-team">${escapeHtml(d.team_members.join(', '))}</div>
        </div>
        <select class="vote-rank-select" data-drink-id="${d.id}" aria-label="Rank for ${escapeHtml(d.name)}">
          <option value="">—</option>
          ${Array.from({ length: n }, (_, i) => i + 1)
            .map(r => `<option value="${r}"${rank === r ? ' selected' : ''}>${r}</option>`)
            .join('')}
        </select>
      `;

      row.querySelector('.vote-rank-select').addEventListener('change', (e) => {
        const selected = parseInt(e.target.value, 10);
        if (isNaN(selected)) return;
        assignRank(d.id, selected, category);
        renderPanel(category);
        updateTabStates();
        updateSubmitButton();
      });

      panel.appendChild(row);
    });
  }

  function updateTabStates() {
    CATEGORIES.forEach(cat => {
      const btn = document.querySelector(`.tab-btn[data-category="${cat}"]`);
      if (btn) btn.classList.toggle('complete', isCategoryComplete(cat));
    });
  }

  function updateSubmitButton() {
    const btn    = document.getElementById('submit-votes-btn');
    const status = document.getElementById('voting-status');
    if (!btn || !status) return;

    const done  = CATEGORIES.filter(isCategoryComplete).length;
    btn.disabled = !allComplete();

    if (allComplete()) {
      status.textContent = 'All categories ranked — ready to submit!';
    } else {
      status.textContent = `${done} of 3 categories complete`;
    }
  }

  function init() {
    // Reset ballots
    CATEGORIES.forEach(cat => { ballots[cat] = {}; });

    // Pre-seed ballots with sequential ranks (1, 2, 3…) as a starting point
    const drinks = eligibleDrinks();
    CATEGORIES.forEach(cat => {
      drinks.forEach((d, i) => { ballots[cat][d.id] = i + 1; });
    });

    CATEGORIES.forEach(renderPanel);
    updateTabStates();
    updateSubmitButton();
    bindTabs();
    bindSubmit();
  }

  function bindTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      // Clone to remove any previous listeners
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', () => {
        const cat = fresh.dataset.category;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        fresh.classList.add('active');
        document.querySelectorAll('.voting-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(`voting-panel-${cat}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function bindSubmit() {
    const submitBtn  = document.getElementById('submit-votes-btn');
    const modal      = document.getElementById('vote-confirm-modal');
    const cancelBtn  = document.getElementById('vote-confirm-cancel');
    const confirmBtn = document.getElementById('vote-confirm-ok');

    if (!submitBtn || !modal) return;

    // Clone buttons to remove any stale listeners from a previous init
    const freshSubmit  = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(freshSubmit, submitBtn);
    const freshCancel  = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(freshCancel, cancelBtn);
    const freshConfirm = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(freshConfirm, confirmBtn);

    freshSubmit.disabled = !allComplete();
    freshSubmit.addEventListener('click', () => { modal.hidden = false; });
    freshCancel.addEventListener('click',  () => { modal.hidden = true; });

    freshConfirm.addEventListener('click', async () => {
      modal.hidden         = true;
      freshSubmit.disabled = true;
      freshSubmit.textContent = 'Submitting…';

      const drinks = eligibleDrinks();
      const voteRows = [];
      CATEGORIES.forEach(cat => {
        drinks.forEach(d => {
          voteRows.push({
            guest_id: State.guestId,
            drink_id: d.id,
            category: cat,
            rank:     ballots[cat][d.id],
          });
        });
      });

      try {
        await insertVotes(voteRows);
        State.votesSubmitted = true;
        localStorage.setItem('spritz_votes_submitted', '1');
        showToast('Votes submitted! 🎉', 'success');
        Router.render();
      } catch (err) {
        console.error(err);
        showToast('Could not submit votes — try again', 'error');
        freshSubmit.disabled    = false;
        freshSubmit.textContent = 'Submit Votes';
      }
    });
  }

  return { init };
})();
