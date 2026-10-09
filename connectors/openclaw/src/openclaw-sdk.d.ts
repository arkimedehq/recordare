// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright © 2026 Andrea Genovese

/**
 * The subset of OpenClaw's plugin SDK this plugin uses (types read from openclaw@2026.9.9, `dist/*.d.ts`). OpenClaw
 * resolves `openclaw/plugin-sdk/*` for the plugins it loads, so the plugin neither bundles nor installs OpenClaw.
 */
declare module 'openclaw/plugin-sdk/plugin-entry' {
  export interface PluginLogger {
    debug?: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  }

  /** `PluginHookAgentContext`: before_prompt_build, agent_end. */
  export interface AgentContext {
    runId?: string;
    agentId?: string;
    sessionKey?: string;
    /** Regenerated on /new and /reset. */
    sessionId?: string;
    messageProvider?: string;
    channel?: string;
    accountId?: string;
    chatId?: string;
    senderId?: string;
    trigger?: string;
    inputProvenance?: { kind?: string };
  }

  export interface BeforePromptBuildEvent {
    prompt: string;
    currentUserMessage?: string;
    currentUserMessageId?: string;
    messages: unknown[];
  }
  export interface BeforePromptBuildResult {
    prependContext?: string;
    appendContext?: string;
    prependSystemContext?: string;
    appendSystemContext?: string;
  }
  export interface AgentEndEvent { runId?: string; messages: unknown[]; success: boolean; error?: string; durationMs?: number }
  export interface SessionContext { agentId?: string; sessionId: string; sessionKey?: string }
  export interface SessionEndEvent {
    sessionId: string;
    sessionKey?: string;
    messageCount: number;
    reason?: 'new' | 'reset' | 'idle' | 'daily' | 'compaction' | 'deleted' | 'shutdown' | 'restart' | 'unknown';
  }
  export interface MessageContext { channelId: string; accountId?: string; conversationId?: string; sessionKey?: string; messageId?: string; senderId?: string }
  export interface MessageReceivedEvent {
    from: string; content: string; timestamp?: number; messageId?: string; senderId?: string; sessionKey?: string;
    /** The channel's facts about the message (OpenClaw fills `senderName` / `senderUsername` when the channel knows them). */
    metadata?: Record<string, unknown>;
  }

  export interface HookMap {
    before_prompt_build: (event: BeforePromptBuildEvent, ctx: AgentContext) => Promise<BeforePromptBuildResult | void> | BeforePromptBuildResult | void;
    agent_end: (event: AgentEndEvent, ctx: AgentContext) => Promise<void> | void;
    session_end: (event: SessionEndEvent, ctx: SessionContext) => Promise<void> | void;
    message_received: (event: MessageReceivedEvent, ctx: MessageContext) => Promise<void> | void;
  }

  /** `OpenClawPluginToolContext` (version 1). */
  export interface ToolContext {
    agentId?: string;
    sessionKey?: string;
    sessionId?: string;
    messageChannel?: string;
    agentAccountId?: string;
    requesterSenderId?: string;
    senderIsOwner?: boolean;
  }
  export interface ToolResult { content: Array<{ type: 'text'; text: string }>; details?: unknown }
  export interface AgentTool {
    name: string;
    label?: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolResult>;
  }

  export interface OpenClawPluginApi {
    id: string;
    pluginConfig?: Record<string, unknown>;
    logger: PluginLogger;
    on<K extends keyof HookMap>(hookName: K, handler: HookMap[K], opts?: { timeoutMs?: number }): void;
    registerTool(factory: (ctx: ToolContext) => AgentTool | null | undefined, opts?: { name?: string }): void;
    registerService(service: { id: string; start: () => void | Promise<void>; stop?: () => void | Promise<void> }): void;
  }

  export interface PluginEntry {
    id: string;
    name: string;
    description: string;
    configSchema?: unknown;
    register: (api: OpenClawPluginApi) => void;
  }
  export function definePluginEntry(entry: PluginEntry): PluginEntry;
}

declare module 'openclaw/plugin-sdk/routing' {
  export function isIncognitoSessionKey(sessionKey: string | undefined | null): boolean;
  export function isCronSessionKey(sessionKey: string | undefined | null): boolean;
  export function isSubagentSessionKey(sessionKey: string | undefined | null): boolean;
}
