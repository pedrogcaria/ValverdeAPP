import { createClient } from 'npm:@supabase/supabase-js@2';

export function createAdminClient() {
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const secretKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!projectUrl || !secretKey) {
    throw new Error('A Edge Function não tem as credenciais Supabase necessárias.');
  }

  return createClient(projectUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
