// Router maps (state.phase + state.guestId) → which screen section is visible.
// Admin panel visibility is handled separately (always shown when isAdmin).

const Router = (() => {
  const SCREENS = [
    'screen-onboarding',
    'screen-waiting',
    'screen-tasting',
    'screen-voting',
    'screen-results',
  ];

  function showScreen(id) {
    SCREENS.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.hidden = (s !== id);
    });
  }

  function render() {
    const { phase, guestId, votesSubmitted, isAdmin } = State;

    // Admin panel visibility
    const adminPanel = document.getElementById('screen-admin');
    if (adminPanel) adminPanel.hidden = !isAdmin;

    // No guest registered yet — always show onboarding regardless of phase
    if (!guestId) {
      showScreen('screen-onboarding');
      return;
    }

    switch (phase) {
      case 'onboarding':
        document.getElementById('waiting-title').textContent    = 'Party starts soon…';
        document.getElementById('waiting-subtitle').textContent = 'Hang tight — the host will kick things off shortly.';
        showScreen('screen-waiting');
        break;

      case 'tasting':
        showScreen('screen-tasting');
        break;

      case 'voting':
        if (votesSubmitted) {
          document.getElementById('waiting-title').textContent    = 'Votes submitted! 🎉';
          document.getElementById('waiting-subtitle').textContent = 'Waiting for everyone to finish…';
          showScreen('screen-waiting');
        } else {
          showScreen('screen-voting');
        }
        break;

      case 'results':
        showScreen('screen-results');
        break;

      default:
        showScreen('screen-onboarding');
    }
  }

  return { render };
})();

// ----------------------------------------------------------------
// Global app bootstrap
// ----------------------------------------------------------------

const App = (() => {
  let drinksChannel = null;

  async function init() {
    // Detect admin via URL query param ?admin=password
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === CONFIG.adminPassword) {
      State.isAdmin = true;
    }

    // Restore guest session from localStorage
    const savedId   = localStorage.getItem('spritz_guest_id');
    const savedName = localStorage.getItem('spritz_guest_name');
    const savedDrink = localStorage.getItem('spritz_guest_drink_id');

    if (savedId) {
      // Verify the guest still exists in the DB (handles DB resets)
      const guest = await fetchGuest(savedId);
      if (guest) {
        State.guestId      = guest.id;
        State.guestName    = guest.name;
        State.guestDrinkId = guest.drink_id;

        // Check if they already submitted votes this session
        const savedVoted = localStorage.getItem('spritz_votes_submitted');
        if (savedVoted === '1') State.votesSubmitted = true;

        // Reload their tasting notes into state
        const notes = await fetchMyTastingNotes(State.guestId);
        notes.forEach(n => {
          State.myNotes[n.drink_id] = { text: n.note_text, share: n.share_anonymous };
        });
      } else {
        // Guest not found — clear stale localStorage
        clearGuestStorage();
      }
    }

    // Load initial phase and drinks
    try {
      State.phase  = await fetchPhase();
      State.drinks = await fetchDrinks();
    } catch (err) {
      showToast('Could not connect to database', 'error');
      console.error(err);
    }

    // Subscribe to phase changes (every client)
    subscribeToPhaseChanges((newPhase) => {
      State.phase = newPhase;
      Router.render();
      // Stop watching drinks once we're past onboarding
      if (newPhase !== 'onboarding' && drinksChannel) {
        drinksChannel.unsubscribe();
        drinksChannel = null;
      }
      // Initialise the screen that just became active
      if (newPhase === 'tasting')  Tasting.init();
      if (newPhase === 'voting')   Voting.init();
      if (newPhase === 'results')  Results.load();
      if (State.isAdmin)           Admin.onPhaseChange();
    });

    // Subscribe to drink changes (keep onboarding dropdown live)
    drinksChannel = subscribeToDrinksChanges(async () => {
      State.drinks = await fetchDrinks();
      Onboarding.refreshDrinkSelect();
    });

    // Admin subscribes to votes for live results
    if (State.isAdmin) {
      subscribeToVotesChanges(() => {
        if (State.phase === 'results') Results.load();
      });
    }

    // iOS Safari: re-sync phase when tab resumes from background
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        try {
          const currentPhase = await fetchPhase();
          if (currentPhase !== State.phase) {
            State.phase = currentPhase;
            Router.render();
          }
        } catch (_) { /* silent */ }
      }
    });

    // Initial render
    Router.render();

    // Initialise screens
    Onboarding.init();  // always bind the form (it's hidden by router when not needed)
    if (State.phase === 'tasting')  Tasting.init();
    if (State.guestId && State.phase === 'voting' && !State.votesSubmitted) Voting.init();
    if (State.phase === 'results')  Results.load();
    if (State.isAdmin)              Admin.init();
  }

  function clearGuestStorage() {
    localStorage.removeItem('spritz_guest_id');
    localStorage.removeItem('spritz_guest_name');
    localStorage.removeItem('spritz_guest_drink_id');
    localStorage.removeItem('spritz_votes_submitted');
  }

  return { init };
})();

// ----------------------------------------------------------------
// Toast helper — global utility used by all screens
// ----------------------------------------------------------------

let toastTimer = null;

function showToast(message, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className   = 'toast' + (type !== 'default' ? ` toast-${type}` : '');
  el.hidden      = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}
