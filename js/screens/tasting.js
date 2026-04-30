const Tasting = (() => {
  let activeDrinkId = null;

  function render() {
    const list = document.getElementById('tasting-drinks-list');
    if (!list) return;

    list.innerHTML = '';
    State.drinks.forEach(d => {
      const hasNote = !!State.myNotes[d.id]?.text;
      const li = document.createElement('li');
      li.className = 'drink-card' + (hasNote ? ' has-note' : '');
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.innerHTML = `
        <div class="drink-card-info">
          <div class="drink-card-name">${escapeHtml(d.name)}</div>
          <div class="drink-card-team">${escapeHtml(d.team_members.join(', '))}</div>
        </div>
        <div class="drink-card-note-indicator">${hasNote ? '✅' : '📝'}</div>
      `;

      const open = () => openSheet(d.id, d.name);
      li.addEventListener('click', open);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
      list.appendChild(li);
    });
  }

  function openSheet(drinkId, drinkName) {
    activeDrinkId = drinkId;

    const sheet    = document.getElementById('note-sheet');
    const title    = document.getElementById('note-sheet-title');
    const textarea = document.getElementById('note-text');
    const shareBox = document.getElementById('note-share');

    title.textContent    = drinkName;
    const saved          = State.myNotes[drinkId] || { text: '', share: false };
    textarea.value       = saved.text;
    shareBox.checked     = saved.share;
    sheet.hidden         = false;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Autofocus textarea after animation
    setTimeout(() => textarea.focus(), 240);
  }

  function closeSheet() {
    const sheet = document.getElementById('note-sheet');
    sheet.hidden = true;
    activeDrinkId = null;
    document.body.style.overflow = '';
  }

  function bindSheet() {
    const backdrop = document.querySelector('#note-sheet .bottom-sheet-backdrop');
    const closeBtn = document.getElementById('note-sheet-close');
    const saveBtn  = document.getElementById('note-save-btn');
    const textarea = document.getElementById('note-text');
    const shareBox = document.getElementById('note-share');

    // Live-save note text to state (but not yet to Supabase)
    textarea.addEventListener('input', () => {
      if (!activeDrinkId) return;
      if (!State.myNotes[activeDrinkId]) State.myNotes[activeDrinkId] = { text: '', share: false };
      State.myNotes[activeDrinkId].text = textarea.value;
    });

    backdrop.addEventListener('click', closeSheet);
    closeBtn.addEventListener('click', closeSheet);

    saveBtn.addEventListener('click', async () => {
      if (!activeDrinkId || !State.guestId) return;

      const text  = textarea.value.trim();
      const share = shareBox.checked;

      saveBtn.disabled     = true;
      saveBtn.textContent  = 'Saving…';

      try {
        await upsertTastingNote(State.guestId, activeDrinkId, text, share);
        State.myNotes[activeDrinkId] = { text, share };
        closeSheet();
        render();  // refresh note indicators
        showToast('Note saved ✓', 'success');
      } catch (err) {
        console.error(err);
        showToast('Could not save note — try again', 'error');
      } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Note';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindSheet();
  });

  // Called by router when tasting phase becomes active
  function init() {
    render();
  }

  return { init, render };
})();
