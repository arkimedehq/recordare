// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * Writes the licences of the third-party packages an esbuild bundle contains (from its metafile), so a published
 * bundle carries their notices: `node bundle-licenses.mjs <metafile.json> <out.txt>` (run from the package directory).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const [metafile, out] = process.argv.slice(2);
const meta = JSON.parse(readFileSync(metafile, 'utf8'));
const roots = new Map(); // package name → its directory
for (const input of Object.keys(meta.inputs)) {
  const m = input.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//);
  if (m && !roots.has(m[2])) roots.set(m[2], resolve(m[1]));
}
const parts = ['Third-party software bundled in this package, with its licence texts.\n'];
for (const [name, dir] of [...roots].sort(([a], [b]) => a.localeCompare(b))) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const text = file ? readFileSync(join(dir, file), 'utf8').trim() : `(no licence file shipped; declared licence: ${pkg.license ?? 'unknown'})`;
  parts.push(`${'='.repeat(78)}\n${name}@${pkg.version} — ${pkg.license ?? 'unknown'}\n${pkg.homepage ?? pkg.repository?.url ?? ''}\n\n${text}\n`);
}
if (!existsSync(dirname(resolve(out)))) throw new Error(`no directory for ${out}`);
writeFileSync(out, parts.join('\n'));
console.log(`${out}: ${roots.size} packages`);
