// Supabase client singleton.
// anonClient  — used by all guest operations (RLS enforced)
// adminClient — used only when isAdmin; uses service_role key (bypasses RLS)

const SupabaseLib = window.supabase;

const anonClient  = SupabaseLib.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
const adminClient = SupabaseLib.createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey);

// ----------------------------------------------------------------
// Realtime subscriptions
// ----------------------------------------------------------------

function subscribeToPhaseChanges(onPhaseChange) {
  return anonClient
    .channel('phase-watch')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'app_state' },
      (payload) => onPhaseChange(payload.new.phase)
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

async function fetchPhase() {
  const { data, error } = await anonClient
    .from('app_state')
    .select('phase')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.phase;
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

// Admin-only helpers (use service_role client)

async function adminInsertDrink(name, teamMembers) {
  const { data, error } = await adminClient
    .from('drinks')
    .insert({ name, team_members: teamMembers })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function adminDeleteDrink(drinkId) {
  const { error } = await adminClient
    .from('drinks')
    .delete()
    .eq('id', drinkId);
  if (error) throw error;
}

async function adminUpdateDrink(drinkId, name, teamMembers) {
  const { error } = await adminClient
    .from('drinks')
    .update({ name, team_members: teamMembers })
    .eq('id', drinkId);
  if (error) throw error;
}

async function adminAdvancePhase(nextPhase) {
  const { error } = await adminClient
    .from('app_state')
    .update({ phase: nextPhase })
    .eq('id', 1);
  if (error) throw error;
}
