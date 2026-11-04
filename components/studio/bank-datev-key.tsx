'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from './appearance';
import {
  forgetKey,
  hasSavedKey,
  personalKeyFormat,
  saveKey,
  unlockKey,
} from '@/lib/bank-datev/key-vault';

export function BankDatevKey({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const { t } = useLanguage();
  const [stored, setStored] = useState(hasSavedKey);
  const [pass, setPass] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function vault(action: 'save' | 'unlock' | 'forget') {
    setBusy(true);
    setError('');
    try {
      if (action === 'save') {
        await saveKey(value, pass);
        setStored(true);
      } else if (action === 'unlock') onChange(await unlockKey(pass));
      else {
        forgetKey();
        onChange('');
        setStored(false);
      }
      setPass('');
    } catch {
      setError(
        action === 'unlock'
          ? t(
              'Entsperren fehlgeschlagen. Bitte das Gerätepasswort prüfen.',
              'Could not unlock. Check the device passphrase.',
            )
          : t(
              'Der lokale Schlüsselspeicher ist nicht verfügbar.',
              'Local key storage is unavailable.',
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="bank-ai-fields">
      <label>
        {t('Eigener OpenAI-API-Schlüssel', 'Personal OpenAI API key')}
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          maxLength={503}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="sk-…"
        />
      </label>
      <p>
        {t(
          'Der Schlüssel gilt für dieses Werkzeug. Erst beim Senden leitet diese MoinPDF-Installation den Auftrag mit deinem Schlüssel an OpenAI weiter.',
          'The key is used in this tool. This MoinPDF installation forwards the request with your key to OpenAI only when you select Send.',
        )}
      </p>
      {value && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onChange('');
            setPass('');
          }}
        >
          {t('Schlüssel aus Sitzung entfernen', 'Clear key from session')}
        </Button>
      )}
      <details open={stored || undefined}>
        <summary>
          {stored
            ? t('Gespeicherter Schlüssel', 'Saved key')
            : t('Auf diesem Gerät verschlüsselt merken', 'Remember encrypted on this device')}
        </summary>
        <label>
          {t('Gerätepasswort für den Schlüssel', 'Device passphrase for the key')}
          <input
            type="password"
            value={pass}
            autoComplete="off"
            maxLength={200}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        <div className="bank-actions">
          {stored ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!pass}
                onClick={() => void vault('unlock')}
              >
                {t('Schlüssel entsperren', 'Unlock key')}
              </Button>
              <Button type="button" variant="outline" onClick={() => void vault('forget')}>
                {t('Gespeicherten Schlüssel löschen', 'Delete saved key')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={!personalKeyFormat.test(value) || pass.length < 12}
              onClick={() => void vault('save')}
            >
              {t(
                'Mit Gerätepasswort speichern (mind. 12 Zeichen)',
                'Save with a device passphrase (at least 12 characters)',
              )}
            </Button>
          )}
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
