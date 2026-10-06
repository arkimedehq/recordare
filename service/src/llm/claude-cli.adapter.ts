// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * LlmPort over the local Claude Code CLI in headless mode (`claude -p`), authenticated with the
 * operator's own Claude plan. **Local evaluation only**: calls count against that personal plan;
 * a service used by other people uses an API key with the native Anthropic adapter (D27).
 * Each call runs the CLI with no tools, no settings, no MCP servers and our system prompt only.
 */
import { spawn } from 'node:child_process';
import { type LlmCallRecord, type LlmCallRecorder } from './llm-call-recorder';
import { LlmOutputError, type JsonCompletionRequest, type LlmCallContext, type LlmPort } from './llm.port';
import { parseJsonObject } from './openai-compatible.adapter';

export interface ClaudeCliConfig {
  model: string;
  binary?: string;
  timeoutMs?: number;
}

interface CliResult {
  result?: string;
  is_error?: boolean;
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number };
}

export class ClaudeCliAdapter implements LlmPort {
  constructor(private readonly cfg: ClaudeCliConfig, private readonly recorder?: LlmCallRecorder) {}

  async completeJson<T>(req: JsonCompletionRequest<T>, ctx: LlmCallContext = {}): Promise<T> {
    const model = this.cfg.model;
    let user = req.user;
    let lastIssue = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = Date.now();
      const { out, usage } = await this.run(model, req.system, user).catch(async (err: unknown) => {
        await this.recorder?.record({ promptId: req.promptId, provider: 'claude-cli', model, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started, status: 'error' }, ctx);
        throw err;
      });
      const record: Omit<LlmCallRecord, 'status'> = { ...usage, promptId: req.promptId, provider: 'claude-cli', model, latencyMs: Date.now() - started };
      try {
        const parsed = req.schema.safeParse(parseJsonObject(out));
        if (parsed.success) {
          await this.recorder?.record({ ...record, status: 'ok' }, ctx);
          return parsed.data;
        }
        lastIssue = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      } catch (err) {
        lastIssue = (err as Error).message;
      }
      await this.recorder?.record({ ...record, status: 'invalid_output' }, ctx);
      user = `${req.user}\n\n(Your previous output was not valid: ${lastIssue}. Reply with ONLY one JSON object.)`;
    }
    throw new LlmOutputError(`invalid output after repair: ${lastIssue}`, req.promptId);
  }

  private run(model: string, system: string, user: string): Promise<{ out: string; usage: Pick<LlmCallRecord, 'inputTokens' | 'cachedInputTokens' | 'outputTokens'> }> {
    return new Promise((resolve, reject) => {
      const args = ['-p', '--output-format', 'json', '--model', model, '--tools', '', '--setting-sources', '',
        '--strict-mcp-config', '--no-session-persistence', '--system-prompt', system];
      const child = spawn(this.cfg.binary ?? 'claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('claude CLI timed out')); }, this.cfg.timeoutMs ?? 300_000);
      child.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          const r = JSON.parse(stdout) as CliResult;
          if (code !== 0 || r.is_error) return reject(new Error(`claude CLI failed (exit ${code})`));
          const u = r.usage ?? {};
          resolve({
            out: r.result ?? '',
            usage: {
              inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
              cachedInputTokens: u.cache_read_input_tokens ?? 0,
              outputTokens: u.output_tokens ?? 0,
            },
          });
        } catch {
          reject(new Error(`claude CLI returned no JSON (exit ${code}): ${stderr.slice(0, 120)}`));
        }
      });
      child.stdin.end(user);
    });
  }
}
