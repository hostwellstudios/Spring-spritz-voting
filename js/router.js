// Router maps (state.phase + state.guestId + state.resultsShared) → which screen is visible.

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
    const { phase, resultsShared, guestId, votesSubmitted, isAdmin } = State;

    // Admin panel visibility
    const adminPanel = document.getElementById('screen-admin');
    if (adminPanel) adminPanel.hidden = !isAdmin;

    // No guest registered — always show onboarding regardless of phase
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
        if (isAdmin || resultsShared) {
          showScreen('screen-results');
        } else {
          document.getElementById('waiting-title').textContent    = 'Results incoming… 🏆';
          document.getElementById('waiting-subtitle').textContent = 'The host is about to reveal the winners!';
          showScreen('screen-waiting');
        }
        break;

      default:
        showScreen('screen-onboarding');
    }
  }

  return { render };
})();

// ----------------------------------------------------------------
// Shared utility — used by App.init and the realtime handler
// ----------------------------------------------------------------

function clearGuestStorage() {
  localStorage.removeItem('spritz_guest_id');
  localStorage.removeItem('spritz_guest_name');
  localStorage.removeItem('spritz_guest_drink_id');
  localStorage.removeItem('spritz_votes_submitted');
}

function clearGuestState() {
  State.guestId        = null;
  State.guestName      = null;
  State.guestDrinkId   = null;
  State.votesSubmitted = false;
  State.myNotes        = {};
  clearGuestStorage();
}

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
    const savedId = localStorage.getItem('spritz_guest_id');

    if (savedId) {
      const guest = await fetchGuest(savedId);
      if (guest) {
        State.guestId      = guest.id;
        State.guestName    = guest.name;
        State.guestDrinkId = guest.drink_id;

        if (localStorage.getItem('spritz_votes_submitted') === '1') {
          State.votesSubmitted = true;
        }

        const notes = await fetchMyTastingNotes(State.guestId);
        notes.forEach(n => {
          State.myNotes[n.drink_id] = { text: n.note_text, share: n.share_anonymous };
        });
      } else {
        clearGuestState();
      }
    }

    // Load initial app state and drinks
    try {
      const appState   = await fetchAppState();
      State.phase        = appState.phase;
      State.resultsShared = appState.resultsShared;
      State.drinks = await fetchDrinks();
    } catch (err) {
      showToast('Could not connect to database', 'error');
      console.error(err);
    }

    // Subscribe to app_state changes (every client)
    subscribeToAppStateChanges(async ({ phase, resultsShared }) => {
      const prevPhase = State.phase;
      State.phase        = phase;
      State.resultsShared = resultsShared;

      // Party was reset — if our guest no longer exists, clear session
      if (phase === 'onboarding' && State.guestId) {
        const guest = await fetchGuest(State.guestId);
        if (!guest) clearGuestState();
      }

      Router.render();

      // Stop watching drinks once past onboarding
      if (phase !== 'onboarding' && drinksChannel) {
        drinksChannel.unsubscribe();
        drinksChannel = null;
      }

      // Init newly active screens (only when phase actually changed)
      if (phase !== prevPhase) {
        if (phase === 'tasting') Tasting.init();
        if (phase === 'voting')  Voting.init();
        if (phase === 'results') Results.load();
      }

      // Results just got shared — load for guests seeing it for the first time
      if (phase === 'results' && resultsShared && !State.isAdmin) Results.load();

      if (State.isAdmin) Admin.onPhaseChange();
    });

    // Subscribe to drink changes
    drinksChannel = subscribeToDrinksChanges(async () => {
      State.drinks = await fetchDrinks();
      Onboarding.refreshDrinkSelect();
    });

    // Admin watches votes for live tally during voting and results
    if (State.isAdmin) {
      subscribeToVotesChanges(() => {
        if (State.phase === 'voting')  Admin.renderVoteProgress();
        if (State.phase === 'results') Results.load();
      });
    }

    // iOS Safari: re-sync on tab resume
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        try {
          const appState = await fetchAppState();
          if (appState.phase !== State.phase || appState.resultsShared !== State.resultsShared) {
            State.phase        = appState.phase;
            State.resultsShared = appState.resultsShared;
            Router.render();
          }
        } catch (_) { /* silent */ }
      }
    });

    // Initial render
    Router.render();

    // Init screens
    Onboarding.init();
    if (State.phase === 'tasting') Tasting.init();
    if (State.guestId && State.phase === 'voting' && !State.votesSubmitted) Voting.init();
    if (State.phase === 'results' && (State.isAdmin || State.resultsShared)) Results.load();
    if (State.isAdmin) Admin.init();
  }

  return { init };
})();

// ----------------------------------------------------------------
// Toast helper
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
