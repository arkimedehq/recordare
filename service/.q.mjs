import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL); await c.connect();
const r = await c.query(process.argv[2]); console.log(JSON.stringify(r.rows, null, 1)); await c.end();
