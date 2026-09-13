// QA only. Run with: node --env-file=.env.qa-cli.local scripts/qa-query.mjs file.sql
import { readFileSync } from 'node:fs';
const ref = 'egzlxzuzmwwfnauydbua';
if (!process.env.SUPABASE_ACCESS_TOKEN || !process.argv[2]) throw new Error('Token local e ficheiro SQL obrigatórios');
const query = readFileSync(process.argv[2], 'utf8');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!response.ok) throw new Error(`QA query HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
