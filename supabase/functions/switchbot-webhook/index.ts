import { reconcileCodes, type SyncSummary } from '../_shared/access-codes.ts';
import { secretMatches } from '../_shared/secret.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { switchBotCredentials } from '../_shared/switchbot.ts';

// A SwitchBot não assina os webhooks: o URL registado leva ?token=<segredo>,
// guardado só no Vault. Mesmo assim o payload só serve de gatilho; o estado é
// sempre confirmado na lista real de códigos do keypad (reconcileCodes).
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return new Response(null, { status: 401 });

  const client = createAdminClient();
  const { data: expected } = await client.rpc('switchbot_webhook_token');
  if (!await secretMatches(token, typeof expected === 'string' ? expected : undefined)) {
    return new Response(null, { status: 401 });
  }

  let context: { eventName?: string; commandId?: string; result?: string } | undefined;
  try {
    context = (await request.json() as { context?: typeof context }).context;
  } catch {
    return new Response(null, { status: 400 });
  }
  const eventName = context?.eventName?.trim();
  if (eventName !== 'createKey' && eventName !== 'deleteKey') return new Response(null, { status: 204 });

  try {
    const failed = Boolean(context?.commandId && context.result && context.result !== 'success');
    if (eventName === 'createKey' && failed) {
      await client.from('access_codes')
        .update({ status: 'failed', last_error: `O keypad respondeu ${context?.result}.` })
        .eq('switchbot_command_id', context?.commandId)
        .eq('status', 'pending');
    } else if (eventName === 'deleteKey' && failed) {
      // Volta a active para a próxima sincronização repetir a remoção.
      await client.from('access_codes')
        .update({ status: 'active', last_error: `O keypad não apagou o código (${context?.result}).` })
        .eq('switchbot_command_id', context?.commandId)
        .eq('status', 'deleting');
    } else {
      const summary: SyncSummary = { keypads: 0, issued: 0, activated: 0, failed: 0, revoked: 0, deleted: 0, notified: 0 };
      await reconcileCodes(client, switchBotCredentials(), summary);
    }
  } catch (error) {
    console.error('Webhook SwitchBot não processado.', error instanceof Error ? error.message : 'unknown');
  }
  // Responder sempre 204 a eventos válidos: o cron reconcilia o que aqui falhar.
  return new Response(null, { status: 204 });
});
