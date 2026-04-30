import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { action, password, ...data } = await req.json();

    const adminPassword = Deno.env.get('ADMIN_PASSWORD');
    if (!adminPassword || password !== adminPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let result;

    switch (action) {
      case 'add_drink': {
        const { data: drink, error } = await supabase
          .from('drinks')
          .insert({ name: data.name, team_members: data.team_members })
          .select()
          .single();
        if (error) throw error;
        result = drink;
        break;
      }

      case 'delete_drink': {
        const { error } = await supabase.from('drinks').delete().eq('id', data.drink_id);
        if (error) throw error;
        result = { ok: true };
        break;
      }

      case 'update_drink': {
        const { error } = await supabase
          .from('drinks')
          .update({ name: data.name, team_members: data.team_members })
          .eq('id', data.drink_id);
        if (error) throw error;
        result = { ok: true };
        break;
      }

      case 'advance_phase': {
        const { error } = await supabase
          .from('app_state')
          .update({ phase: data.phase })
          .eq('id', 1);
        if (error) throw error;
        result = { ok: true };
        break;
      }

      case 'share_results': {
        const { error } = await supabase
          .from('app_state')
          .update({ results_shared: true })
          .eq('id', 1);
        if (error) throw error;
        result = { ok: true };
        break;
      }

      case 'reset_party': {
        // Delete in dependency order (votes + notes before guests, guests before drinks)
        const steps = [
          supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
          supabase.from('tasting_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        ];
        for (const step of steps) {
          const { error } = await step;
          if (error) throw error;
        }
        const { error: guestErr } = await supabase
          .from('guests')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (guestErr) throw guestErr;

        const { error: stateErr } = await supabase
          .from('app_state')
          .update({ phase: 'onboarding', results_shared: false })
          .eq('id', 1);
        if (stateErr) throw stateErr;

        result = { ok: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
