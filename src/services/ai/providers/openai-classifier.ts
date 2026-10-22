import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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
 * No equivalent to CLAUDE.md's Claude model table exists for OpenAI, and
 * model IDs on that side churn independently of this project -- both are
 * overridable via env instead of hardcoded, so picking this provider
 * doesn't require a code change when OpenAI renames a model.
 */
const BULK_MODEL = process.env.OPENAI_BULK_MODEL || 'gpt-4o-mini';
const ESCALATION_MODEL = process.env.OPENAI_ESCALATION_MODEL || 'gpt-4o';

/**
 * Knowing who a supplier is is a matter of world knowledge, and the answer
 * is asked once per RUC and then shared by every taxpayer (ADR-017) -- so
 * it uses the strong model straight away: the small one confused a steel
 * supplier with a computer shop. Overridable like the other two.
 */
const PROFILE_MODEL = process.env.OPENAI_PROFILE_MODEL || ESCALATION_MODEL;

// Mirrors ClaudeClassifier's threshold -- both providers implement the
// same AiClassifier contract, including when they escalate.
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

export class OpenAiClassifier implements AiClassifier {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async profileSupplier(request: SupplierProfileRequest): Promise<SupplierProfileResult | null> {
    const answer = await this.ask(PROFILE_MODEL, buildProfilePrompt(request), ProfileSchema, 'supplier_profile');
    return answer
      ? { ...answer.parsed, modelId: answer.model, promptVersion: PROFILE_PROMPT_VERSION }
      : null;
  }

  async judgeRelevance(request: RelevanceRequest): Promise<RelevanceResult | null> {
    const prompt = buildRelevancePrompt(request);
    const bulk = await this.ask(BULK_MODEL, prompt, RelevanceSchema, 'relevance');
    if (!bulk) return null;
    const best =
      bulk.parsed.confidence >= ESCALATION_THRESHOLD
        ? bulk
        : ((await this.ask(ESCALATION_MODEL, prompt, RelevanceSchema, 'relevance')) ?? bulk);
    return { ...best.parsed, modelId: best.model, promptVersion: RELEVANCE_PROMPT_VERSION };
  }

  private async ask<T extends z.ZodType>(
    model: string,
    prompt: string,
    schema: T,
    name: string
  ): Promise<{ parsed: z.infer<T>; model: string } | null> {
    const completion = await this.client.chat.completions.parse({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: zodResponseFormat(schema, name),
    });

    const parsed = completion.choices[0]?.message.parsed;
    return parsed ? { parsed: parsed as z.infer<T>, model } : null;
  }
}
