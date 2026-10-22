import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { SUPPLIER_KINDS, AI_ACCEPTANCE_THRESHOLD } from '@/domain/iva';
import type {
  AiClassifier,
  RelevanceRequest,
  RelevanceResult,
  SupplierProfileRequest,
  SupplierProfileResult,
} from '../types';
import {
  buildProfilePrompt,
  buildRelevancePrompt,
  PROFILE_PROMPT_VERSION,
  RELEVANCE_PROMPT_VERSION,
} from '../types';

/**
 * CLAUDE.md -> "AI models": haiku for the bulk pass, opus only to
 * escalate a case the bulk model itself flagged as low-confidence.
 * Defaults are the project's documented choice; overridable via env like
 * the OpenAI side, so a model swap (e.g. a new Haiku generation) doesn't
 * need a code change -- update CLAUDE.md's table if the default changes.
 */
const BULK_MODEL = process.env.CLAUDE_BULK_MODEL || 'claude-haiku-4-5';
const ESCALATION_MODEL = process.env.CLAUDE_ESCALATION_MODEL || 'claude-opus-5';

/**
 * Knowing who a supplier is is a matter of world knowledge, and the answer
 * is asked once per RUC and then shared by every taxpayer (ADR-017) -- so
 * it uses the strong model straight away: the small one confused a steel
 * supplier with a computer shop. Overridable like the other two.
 */
const PROFILE_MODEL = process.env.CLAUDE_PROFILE_MODEL || ESCALATION_MODEL;

// Same bar the cascade requires to accept an answer -- no point accepting a
// bulk answer the cascade would discard anyway without trying for a better one.
const ESCALATION_THRESHOLD = AI_ACCEPTANCE_THRESHOLD;

const ProfileSchema = z.object({
  kinds: z.array(z.enum(SUPPLIER_KINDS)).min(1),
  summary: z.string(),
  mixedUse: z.boolean(),
  confidence: z.number().min(0).max(1),
});

const RelevanceSchema = z.object({
  relevance: z.enum(['RELATED', 'NOT_RELATED', 'UNSURE']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export class ClaudeClassifier implements AiClassifier {
  private client: Anthropic;

  constructor() {
    // A key that isn't scoped to a workspace is rejected unless the request
    // names one. Omitted when unset, so scoped keys keep working as before.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
    this.client = new Anthropic(
      workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : undefined
    );
  }

  async profileSupplier(request: SupplierProfileRequest): Promise<SupplierProfileResult | null> {
    const answer = await this.ask(PROFILE_MODEL, buildProfilePrompt(request), ProfileSchema);
    return answer
      ? { ...answer.parsed, modelId: answer.model, promptVersion: PROFILE_PROMPT_VERSION }
      : null;
  }

  async judgeRelevance(request: RelevanceRequest): Promise<RelevanceResult | null> {
    const prompt = buildRelevancePrompt(request);
    const bulk = await this.ask(BULK_MODEL, prompt, RelevanceSchema);
    if (!bulk) return null;
    const best =
      bulk.parsed.confidence >= ESCALATION_THRESHOLD
        ? bulk
        : ((await this.ask(ESCALATION_MODEL, prompt, RelevanceSchema)) ?? bulk);
    return { ...best.parsed, modelId: best.model, promptVersion: RELEVANCE_PROMPT_VERSION };
  }

  private async ask<T extends z.ZodType>(
    model: string,
    prompt: string,
    schema: T
  ): Promise<{ parsed: z.infer<T>; model: string } | null> {
    const response = await this.client.messages.parse({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    });

    return response.parsed_output ? { parsed: response.parsed_output as z.infer<T>, model } : null;
  }
}
