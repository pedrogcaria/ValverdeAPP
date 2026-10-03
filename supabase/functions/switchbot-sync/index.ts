import { syncAccessCodes } from '../_shared/access-codes.ts';
import { secretMatches } from '../_shared/secret.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { switchBotCredentials } from '../_shared/switchbot.ts';

// Chamada pelo pg_cron (ver supabase/README.md). Emite, confirma, revoga e envia
// códigos de acesso; é idempotente e pode correr a cada poucos minutos.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 });
  if (!await secretMatches(request.headers.get('x-cron-secret'), Deno.env.get('ACCESS_CODES_CRON_SECRET'))) {
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const summary = await syncAccessCodes(createAdminClient(), switchBotCredentials());
    return Response.json(summary);
  } catch (error) {
    console.error('A sincronização dos códigos de acesso falhou.', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'A sincronização falhou.' }, { status: 500 });
  }
});
