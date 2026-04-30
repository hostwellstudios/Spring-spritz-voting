// Supabase client singleton.
// All guest operations use anonClient (RLS enforced).
// Admin writes go through the Edge Function — service_role key never touches the browser.

const SupabaseLib = window.supabase;

const anonClient = SupabaseLib.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

// ----------------------------------------------------------------
// Realtime subscriptions
// ----------------------------------------------------------------

function subscribeToAppStateChanges(onAppStateChange) {
  return anonClient
    .channel('phase-watch')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'app_state' },
      (payload) => onAppStateChange({
        phase:         payload.new.phase,
        resultsShared: payload.new.results_shared,
      })
    )
    .subscribe();
}

function subscribeToDrinksChanges(onDrinksChange) {
  return anonClient
    .channel('drinks-watch')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'drinks' },
      () => onDrinksChange()
    )
    .subscribe();
}

function subscribeToVotesChanges(onVotesChange) {
  return anonClient
    .channel('votes-watch')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'votes' },
      () => onVotesChange()
    )
    .subscribe();
}

// ----------------------------------------------------------------
// Data helpers
// ----------------------------------------------------------------

async function fetchAppState() {
  const { data, error } = await anonClient
    .from('app_state')
    .select('phase, results_shared')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return { phase: data.phase, resultsShared: data.results_shared };
}

async function fetchDrinks() {
  const { data, error } = await anonClient
    .from('drinks')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function insertGuest(name, drinkId) {
  const { data, error } = await anonClient
    .from('guests')
    .insert({ name, drink_id: drinkId || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchGuest(guestId) {
  const { data, error } = await anonClient
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .single();
  if (error) return null;
  return data;
}

async function upsertTastingNote(guestId, drinkId, noteText, shareAnonymous) {
  const { error } = await anonClient
    .from('tasting_notes')
    .upsert(
      { guest_id: guestId, drink_id: drinkId, note_text: noteText, share_anonymous: shareAnonymous },
      { onConflict: 'guest_id,drink_id' }
    );
  if (error) throw error;
}

async function fetchMyTastingNotes(guestId) {
  const { data, error } = await anonClient
    .from('tasting_notes')
    .select('*')
    .eq('guest_id', guestId);
  if (error) throw error;
  return data;
}

async function insertVotes(voteRows) {
  const { error } = await anonClient
    .from('votes')
    .insert(voteRows);
  if (error) throw error;
}

async function fetchAllVotes() {
  const { data, error } = await anonClient
    .from('votes')
    .select('*');
  if (error) throw error;
  return data;
}

async function fetchSharedNotes() {
  const { data, error } = await anonClient
    .from('tasting_notes')
    .select('drink_id, note_text')
    .eq('share_anonymous', true)
    .neq('note_text', '');
  if (error) throw error;
  return data;
}

// Admin-only helpers — call the Edge Function (service_role key stays server-side)

async function callAdminFunction(action, payload = {}) {
  const { data, error } = await anonClient.functions.invoke('admin', {
    body: { action, password: CONFIG.adminPassword, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function adminInsertDrink(name, teamMembers) {
  return callAdminFunction('add_drink', { name, team_members: teamMembers });
}

async function adminDeleteDrink(drinkId) {
  return callAdminFunction('delete_drink', { drink_id: drinkId });
}

async function adminUpdateDrink(drinkId, name, teamMembers) {
  return callAdminFunction('update_drink', { drink_id: drinkId, name, team_members: teamMembers });
}

async function adminAdvancePhase(nextPhase) {
  return callAdminFunction('advance_phase', { phase: nextPhase });
}

async function adminShareResults() {
  return callAdminFunction('share_results');
}

async function adminResetParty() {
  return callAdminFunction('reset_party');
}
