'use client';
import { useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ocrLanguages, individualOcrLanguages, MAX_OCR_LANGUAGES } from '@/lib/ocr-languages';
import './ocr-language-picker.css';

export function OcrLanguagePicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [combining, setCombining] = useState(false);
  const selected = value
    .split('+')
    .filter((code) => individualOcrLanguages.some(([id]) => id === code));
  const preset = ocrLanguages.some(([code]) => code === value);
  const expanded = combining || !preset;
  return (
    <div className="ocr-language-picker">
      <label className="field">
        <span>{label}</span>
        <Select
          value={preset ? value : 'custom'}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === 'custom') setCombining(true);
            else {
              onChange(v);
              setCombining(false);
            }
          }}
        >
          <SelectTrigger aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ocrLanguages.map(([code, name]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
            <SelectItem value="custom">Eigene Sprachkombination</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {!expanded && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => setCombining(true)}>
          Sprachen kombinieren
        </Button>
      )}
      {expanded && (
        <fieldset disabled={disabled} className="ocr-language-options">
          <legend>
            Sprachkombination ({selected.length}/{MAX_OCR_LANGUAGES})
          </legend>
          <p className="fine-note">
            Wähle nur Sprachen, die im Dokument vorkommen. Bis zu acht gleichzeitig; zusätzliche
            Sprachen benötigen mehr Arbeitsspeicher.
          </p>
          <div className="ocr-language-grid">
            {individualOcrLanguages.map(([code, name]) => (
              <label key={code}>
                <input
                  type="checkbox"
                  checked={selected.includes(code)}
                  disabled={
                    disabled ||
                    (selected.includes(code)
                      ? selected.length === 1
                      : selected.length >= MAX_OCR_LANGUAGES)
                  }
                  onChange={(e) =>
                    onChange(
                      (e.target.checked
                        ? [...selected, code]
                        : selected.filter((v) => v !== code)
                      ).join('+'),
                    )
                  }
                />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
