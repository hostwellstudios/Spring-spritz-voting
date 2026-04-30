const Onboarding = (() => {
  function refreshDrinkSelect() {
    const select = document.getElementById('guest-drink');
    if (!select) return;

    // Preserve current selection
    const current = select.value;

    // Rebuild options
    select.innerHTML = '<option value="">Just here to taste</option>';
    State.drinks.forEach(d => {
      const opt = document.createElement('option');
      opt.value       = d.id;
      opt.textContent = d.name + (d.team_members.length ? ` — ${d.team_members.join(', ')}` : '');
      select.appendChild(opt);
    });

    if (current) select.value = current;
  }

  function init() {
    const form = document.getElementById('onboarding-form');
    if (!form) return;

    refreshDrinkSelect();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput  = document.getElementById('guest-name');
      const drinkSelect = document.getElementById('guest-drink');

      const name    = nameInput.value.trim();
      const drinkId = drinkSelect.value || null;

      if (!name) {
        showToast('Please enter your name', 'error');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled  = true;
      submitBtn.textContent = 'Joining…';

      try {
        const guest = await insertGuest(name, drinkId);

        State.guestId      = guest.id;
        State.guestName    = guest.name;
        State.guestDrinkId = guest.drink_id;

        localStorage.setItem('spritz_guest_id',       guest.id);
        localStorage.setItem('spritz_guest_name',     guest.name);
        localStorage.setItem('spritz_guest_drink_id', guest.drink_id || '');

        showToast('Welcome, ' + guest.name + '! 🍹', 'success');
        Router.render();
      } catch (err) {
        console.error(err);
        showToast('Could not join — please try again', 'error');
        submitBtn.disabled  = false;
        submitBtn.textContent = 'Join the Party';
      }
    });
  }

  return { init, refreshDrinkSelect };
})();
