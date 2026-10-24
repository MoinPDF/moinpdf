'use client';
import { useEffect, useState } from 'react';
import { Check, Minimize2, Scale, Sparkles } from 'lucide-react';
import { useLanguage } from './appearance';
const key = 'moinpdf-compression-preference-v1';
type Quality = 'gentle' | 'balanced' | 'small';
const valid = (value: string | null): value is Quality =>
  value === 'gentle' || value === 'balanced' || value === 'small';
export function CompressionPresets({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: Quality) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const [remember, setRemember] = useState(false);
  // Restoring the preference is owned by Studio, once per empty workspace.
  useEffect(() => {
    try {
      setRemember(valid(localStorage.getItem(key)));
    } catch {}
  }, []);
  const persist = (next: string, enabled: boolean) => {
    try {
      if (enabled) localStorage.setItem(key, next);
      else localStorage.removeItem(key);
    } catch {}
  };
  return (
    <section className="compression-presets" aria-label={t('Komprimierung', 'Compression')}>
      <h3>{t('Wie klein soll die PDF werden?', 'How small should the PDF be?')}</h3>
      <div className="compression-preset-grid">
        {(
          [
            ['small', 'Kleine Datei', 'Small file', 'Zum Teilen', 'For sharing', Minimize2],
            ['balanced', 'Ausgewogen', 'Balanced', 'Für den Alltag', 'For everyday use', Scale],
            ['gentle', 'Hohe Qualität', 'High quality', 'Für den Druck', 'For printing', Sparkles],
          ] as const
        ).map(([id, de, en, subDe, subEn, Icon]) => (
          <button
            type="button"
            key={id}
            aria-pressed={value === id}
            disabled={disabled}
            onClick={() => {
              onChange(id);
              persist(id, remember);
            }}
          >
            <Icon size={23} />
            <strong>{t(de, en)}</strong>
            <small>{t(subDe, subEn)}</small>
            {value === id && <Check className="preset-check" size={15} />}
          </button>
        ))}
      </div>
      <label className="preference-check">
        <input
          type="checkbox"
          checked={remember}
          disabled={disabled}
          onChange={(event) => {
            setRemember(event.target.checked);
            persist(value, event.target.checked);
          }}
        />
        {t('Auswahl für das nächste Mal merken', 'Remember for next time')}
      </label>
    </section>
  );
}
export function savedCompressionQuality(): Quality | null {
  try {
    const value = localStorage.getItem(key);
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}
