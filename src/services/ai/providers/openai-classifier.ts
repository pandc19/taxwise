import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AI_ACCEPTANCE_THRESHOLD, SUPPLIER_KINDS } from '@/domain/iva';
import { DEEP_RETRY_ENABLED, modelsFor } from '../models';
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
  private models: ReturnType<typeof modelsFor>;

  constructor(settings: { apiKey: string; model?: string | null; supplierModel?: string | null }) {
    this.client = new OpenAI({ apiKey: settings.apiKey });
    this.models = modelsFor('openai', settings);
  }

  /** Who a supplier is is world knowledge, asked once per RUC: its own model, whatever the tier. */
  async profileSupplier(request: SupplierProfileRequest): Promise<SupplierProfileResult | null> {
    const answer = await this.ask(this.models.supplier, buildProfilePrompt(request), ProfileSchema, 'supplier_profile');
    return answer
      ? { ...answer.parsed, modelId: answer.model, promptVersion: PROFILE_PROMPT_VERSION }
      : null;
  }

  async judgeRelevance(request: RelevanceRequest): Promise<RelevanceResult | null> {
    const prompt = buildRelevancePrompt(request);
    const bulk = await this.ask(this.models.bulk, prompt, RelevanceSchema, 'relevance');
    if (!bulk) return null;
    // Asking deeper is switched off for now (DEEP_RETRY_ENABLED), and pointless when one model fills both tiers.
    const retry =
      DEEP_RETRY_ENABLED && bulk.parsed.confidence < AI_ACCEPTANCE_THRESHOLD && this.models.deep !== this.models.bulk
        ? await this.ask(this.models.deep, prompt, RelevanceSchema, 'relevance')
        : null;
    const best = retry ?? bulk;
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
