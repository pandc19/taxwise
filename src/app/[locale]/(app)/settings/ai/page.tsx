import { getTranslations } from 'next-intl/server';
import { DEFAULT_MODELS } from '@/services/ai';
import { getAiSettings } from './actions';
import { AiSettingsForm } from './ai-settings-form';

export default async function AiSettingsPage() {
  const t = await getTranslations('Settings');
  const { canStore, saved } = await getAiSettings();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-3 text-3xl font-semibold">{t('title')}</h1>
      <p className="mb-2 text-sm text-muted-foreground">{t('intro')}</p>
      <p className="mb-6 text-sm text-muted-foreground">{t('ownKey')}</p>

      <div className="mb-6 rounded-lg border border-l-4 border-l-primary bg-card px-4 py-3 text-sm">
        {saved ? (
          <ul className="space-y-0.5">
            <li>
              {t('using', {
                provider: saved.provider === 'openai' ? 'OpenAI' : 'Anthropic',
                hint: saved.keyHint ?? '••••',
              })}
            </li>
            <li className="text-muted-foreground">
              {t('supplierModelUsing', {
                model: saved.supplierModel || DEFAULT_MODELS[saved.provider].deep,
                default: saved.supplierModel ? '' : t('theDefault'),
              })}
            </li>
            <li className="text-muted-foreground">
              {t('otherModelUsing', {
                model: saved.model || DEFAULT_MODELS[saved.provider].bulk,
                default: saved.model ? '' : t('theDefault'),
              })}
            </li>
            {saved.workspaceId && (
              <li className="text-muted-foreground">{t('workspaceSaved', { id: saved.workspaceId })}</li>
            )}
          </ul>
        ) : (
          <span className="text-muted-foreground">{t('off')}</span>
        )}
      </div>

      {canStore ? (
        <AiSettingsForm saved={saved} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{t('footnote')}</p>
    </div>
  );
}
