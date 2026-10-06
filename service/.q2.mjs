import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL); await c.connect();
const { rows } = await c.query(`
  SELECT pe.patch, p.display_name, e.content AS plan, (e.occurred_at)::date::text AS plan_day, n.content AS new_plan, (n.occurred_at)::date::text AS new_day,
         m.content AS msg, m.role, m.sent_at::date::text AS msg_day, pe.note
  FROM plan_events pe JOIN episodes e ON e.id = pe.plan_id JOIN persons p ON p.id = e.owner_id
  LEFT JOIN episodes n ON n.id = pe.new_plan_id LEFT JOIN messages m ON m.id = pe.evidence_message_id
  WHERE pe.patch IN ('cancel','reschedule') AND lower(p.display_name) = 'tommaso'
  ORDER BY pe.created_at DESC LIMIT 400`);
console.log(rows.length);
const seen = new Set(); for (const r of rows.filter((r) => { const k = r.patch + r.plan.slice(0, 40) + (r.msg ?? "").slice(0, 40); if (seen.has(k)) return false; seen.add(k); return true; })) console.log(`\n[${r.patch}] PLAN(${r.plan_day}): ${r.plan.slice(0,140)}${r.new_plan ? `\n  → NEW(${r.new_day}): ${r.new_plan.slice(0,100)}` : ''}\n  MSG(${r.msg_day},${r.role}): ${(r.msg ?? '').slice(0,220).replace(/\n/g,' ')}\n  NOTE: ${r.note}`);
await c.end();
