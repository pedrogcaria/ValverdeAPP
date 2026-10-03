import { syncAccessCodes } from '../_shared/access-codes.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { listKeypads, switchBotCredentials } from '../_shared/switchbot.ts';

// Chamada pelo trigger das reservas e pelo pg_cron (ver supabase/README.md).
// Emite, confirma, revoga e envia códigos de acesso; é idempotente.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 });
  const secret = request.headers.get('x-cron-secret');
  if (!secret) return Response.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    const client = createAdminClient();
    // O segredo vive só no Vault; a comparação é feita na base de dados.
    const { data: authorized, error: authError } = await client.rpc('access_codes_cron_secret_matches', { p_secret: secret });
    if (authError || authorized !== true) return Response.json({ error: 'Não autorizado.' }, { status: 401 });

    const credentials = switchBotCredentials();
    const summary = await syncAccessCodes(client, credentials);
    // Ajuda a configuração inicial: enquanto não houver keypads registados,
    // devolve os que existem na conta SwitchBot (id e nome, sem códigos).
    if (summary.keypads === 0) {
      return Response.json({ ...summary, availableKeypads: await listKeypads(credentials) });
    }
    return Response.json(summary);
  } catch (error) {
    console.error('A sincronização dos códigos de acesso falhou.', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: error instanceof Error ? error.message : 'A sincronização falhou.' }, { status: 500 });
  }
});
