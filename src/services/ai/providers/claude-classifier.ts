import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
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

export class ClaudeClassifier implements AiClassifier {
  private client: Anthropic;
  private models: ReturnType<typeof modelsFor>;

  constructor(settings: { apiKey: string; workspaceId?: string | null; model?: string | null; supplierModel?: string | null }) {
    // A key that isn't scoped to a workspace is rejected unless the request names one.
    this.client = new Anthropic({
      apiKey: settings.apiKey,
      ...(settings.workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': settings.workspaceId } } : {}),
    });
    this.models = modelsFor('claude', settings);
  }

  /** Who a supplier is is world knowledge, asked once per RUC: its own model, whatever the tier. */
  async profileSupplier(request: SupplierProfileRequest): Promise<SupplierProfileResult | null> {
    const answer = await this.ask(this.models.supplier, buildProfilePrompt(request), ProfileSchema);
    return answer
      ? { ...answer.parsed, modelId: answer.model, promptVersion: PROFILE_PROMPT_VERSION }
      : null;
  }

  async judgeRelevance(request: RelevanceRequest): Promise<RelevanceResult | null> {
    const prompt = buildRelevancePrompt(request);
    const bulk = await this.ask(this.models.bulk, prompt, RelevanceSchema);
    if (!bulk) return null;
    // Asking deeper is switched off for now (DEEP_RETRY_ENABLED), and pointless when one model fills both tiers.
    const retry =
      DEEP_RETRY_ENABLED && bulk.parsed.confidence < AI_ACCEPTANCE_THRESHOLD && this.models.deep !== this.models.bulk
        ? await this.ask(this.models.deep, prompt, RelevanceSchema)
        : null;
    const best = retry ?? bulk;
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
