import { syncAccessCodes } from '../_shared/access-codes.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { ensureWebhook, listKeypads, switchBotCredentials } from '../_shared/switchbot.ts';

// Chamada pelo trigger das reservas e pelo pg_cron (ver supabase/README.md).
// Emite, confirma, revoga e envia códigos de acesso; é idempotente.
// Com {"ensureWebhook": true} no corpo, também regista o webhook na SwitchBot.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 });
  const secret = request.headers.get('x-cron-secret');
  if (!secret) return Response.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    const client = createAdminClient();
    // O segredo vive só no Vault; a comparação é feita na base de dados.
    const { data: authorized, error: authError } = await client.rpc('access_codes_cron_secret_matches', { p_secret: secret });
    if (authError || authorized !== true) return Response.json({ error: 'Não autorizado.' }, { status: 401 });

    const options = await request.json().catch(() => ({})) as { ensureWebhook?: boolean };
    const credentials = switchBotCredentials();

    let webhook: unknown;
    if (options.ensureWebhook === true) {
      const { data: token, error: tokenError } = await client.rpc('switchbot_webhook_token');
      if (tokenError || typeof token !== 'string' || !token) throw new Error('O token do webhook não está no Vault.');
      const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/switchbot-webhook?token=${token}`;
      webhook = await ensureWebhook(credentials, url);
    }

    const summary = await syncAccessCodes(client, credentials);
    // Ajuda a configuração inicial: enquanto não houver keypads registados,
    // devolve os que existem na conta SwitchBot (id e nome, sem códigos).
    if (summary.keypads === 0) {
      return Response.json({ ...summary, webhook, availableKeypads: await listKeypads(credentials) });
    }
    return Response.json({ ...summary, webhook });
  } catch (error) {
    console.error('A sincronização dos códigos de acesso falhou.', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: error instanceof Error ? error.message : 'A sincronização falhou.' }, { status: 500 });
  }
});
