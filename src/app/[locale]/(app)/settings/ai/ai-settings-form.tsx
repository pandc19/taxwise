'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfirm } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_MODELS, SUGGESTED_MODELS } from '@/services/ai/models';
import type { ProviderName } from '@/services/ai/models';
import { removeAiSettings, saveAiSettings } from './actions';
import type { SaveAiError } from './actions';

interface Saved {
  provider: ProviderName;
  keyHint: string | null;
  workspaceId: string | null;
  model: string | null;
  supplierModel: string | null;
}

export function AiSettingsForm({ saved }: { saved: Saved | null }) {
  const t = useTranslations('Settings');
  const { confirm, dialog } = useConfirm();
  const [provider, setProvider] = useState<ProviderName>(saved?.provider ?? 'claude');
  const [key, setKey] = useState('');
  const [workspaceId, setWorkspaceId] = useState(saved?.workspaceId ?? '');
  const [model, setModel] = useState(saved?.model ?? '');
  const [supplierModel, setSupplierModel] = useState(saved?.supplierModel ?? '');
  const [error, setError] = useState<SaveAiError | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The saved key can stay only while the provider is the same: a key belongs to one provider.
  const keepsKey = saved !== null && saved.provider === provider;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await saveAiSettings({ provider, key, workspaceId, model, supplierModel });
      if (result.success) {
        setKey('');
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  async function remove() {
    if (!(await confirm({ message: t('removeConfirm'), confirmLabel: t('removeKey'), destructive: true }))) return;
    startTransition(async () => {
      await removeAiSettings();
      setKey('');
      setModel('');
      setSupplierModel('');
      setWorkspaceId('');
      setDone(false);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {dialog}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      )}
      {done && (
        <Alert>
          <AlertDescription>{t('saved')}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('providerQuestion')}</legend>
        {(
          [
            ['claude', 'Anthropic (Claude)'],
            ['openai', 'OpenAI'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="provider"
              value={value}
              checked={provider === value}
              onChange={() => setProvider(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="ai-key">{t('apiKey')}</Label>
        <Input
          id="ai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required={!keepsKey}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="font-mono"
        />
        {keepsKey && <p className="text-xs text-muted-foreground">{t('keepKey')}</p>}
      </div>

      {provider === 'claude' && (
        <div className="space-y-2">
          <Label htmlFor="ai-workspace">{t('workspace')}</Label>
          <Input
            id="ai-workspace"
            autoComplete="off"
            spellCheck={false}
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{t('workspaceHint')}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ai-supplier-model">{t('supplierModel')}</Label>
        <Input
          id="ai-supplier-model"
          list={`models-${provider}`}
          autoComplete="off"
          spellCheck={false}
          value={supplierModel}
          placeholder={DEFAULT_MODELS[provider].deep}
          onChange={(e) => setSupplierModel(e.target.value)}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {t('supplierModelHint', { model: DEFAULT_MODELS[provider].deep })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-model">{t('otherModel')}</Label>
        <Input
          id="ai-model"
          list={`models-${provider}`}
          autoComplete="off"
          spellCheck={false}
          value={model}
          placeholder={DEFAULT_MODELS[provider].bulk}
          onChange={(e) => setModel(e.target.value)}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {t('otherModelHint', { model: DEFAULT_MODELS[provider].bulk })}
        </p>
      </div>
      <datalist id={`models-${provider}`}>
        {SUGGESTED_MODELS[provider].map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('checking') : saved ? t('saveChanges') : t('saveKey')}
        </Button>
        {saved && (
          <Button type="button" variant="outline" disabled={isPending} onClick={remove}>
            {t('removeKey')}
          </Button>
        )}
      </div>
    </form>
  );
}
