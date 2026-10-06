import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL); await c.connect();
const { rows } = await c.query(`
  SELECT DISTINCT ON (pe.patch, left(e.content, 40), left(m.content, 40)) pe.patch, e.content AS plan, m.content AS msg, e.place,
    round((1 - (e.embedding <=> m.embedding))::numeric, 3) AS sim, e.keywords,
    (SELECT array_agg(alias) FROM episode_people ep WHERE ep.episode_id = e.id) AS people
  FROM plan_events pe JOIN episodes e ON e.id = pe.plan_id JOIN persons p ON p.id = e.owner_id JOIN messages m ON m.id = pe.evidence_message_id
  WHERE lower(p.display_name) IN ('tommaso','sofia','elisa') AND e.embedding IS NOT NULL AND m.embedding IS NOT NULL`);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = (s) => norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
for (const r of rows) {
  const anchors = [...(r.keywords ?? []), ...(r.people ?? []), r.place ?? ''].flatMap(words);
  const mw = new Set(words(r.msg).map((w) => w.slice(0, 5)));
  r.hit = anchors.filter((a) => mw.has(a.slice(0, 5)));
}
rows.sort((a, b) => a.sim - b.sim);
for (const r of rows.slice(0, 45)) console.log(r.sim, r.patch.padEnd(10), (r.hit.length ? 'LEX ' + r.hit.slice(0,3).join(',') : 'none').padEnd(30), '|', r.plan.slice(0, 60).replace(/\n/g, ' '), '|', r.msg.slice(0, 60).replace(/\n/g, ' '));
console.log('no-lex & sim<0.45:', rows.filter((r) => !r.hit.length && r.sim < 0.45).length, 'of', rows.length);
await c.end();
