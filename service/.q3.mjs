import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL); await c.connect();
const { rows } = await c.query(`
  SELECT DISTINCT ON (pe.patch, left(e.content, 40), left(m.content, 40)) pe.patch, left(e.content, 70) AS plan, left(m.content, 70) AS msg,
    round((1 - (e.embedding <=> m.embedding))::numeric, 3) AS sim, e.keywords
  FROM plan_events pe JOIN episodes e ON e.id = pe.plan_id JOIN persons p ON p.id = e.owner_id JOIN messages m ON m.id = pe.evidence_message_id
  WHERE lower(p.display_name) IN ('tommaso','sofia') AND e.embedding IS NOT NULL AND m.embedding IS NOT NULL`);
rows.sort((a, b) => a.sim - b.sim);
for (const r of rows) console.log(r.sim, r.patch.padEnd(10), '|', r.plan.replace(/\n/g, ' '), '|', r.msg.replace(/\n/g, ' '));
await c.end();
