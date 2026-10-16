'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from './appearance';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type DuplicateDecision = { add: boolean; remember: boolean };
export type DuplicateRequest = {
  name: string;
  existingName: string;
  remaining: number;
  resolve: (choice: DuplicateDecision) => void;
};
export function DuplicatePrompt({
  request,
  onClose,
}: {
  request: DuplicateRequest | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [remember, setRemember] = useState(false);
  useEffect(() => setRemember(false), [request]);
  const finish = (add: boolean) => {
    onClose();
    request?.resolve({ add, remember });
  };
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('Diese Datei ist bereits geöffnet.', 'This file is already open.')}
          </DialogTitle>
          <DialogDescription>
            <span className="duplicate-file-name">{request?.name}</span>
            {t(
              'Der Inhalt stimmt mit einer bereits geladenen Datei überein:',
              'The content matches a file that is already loaded:',
            )}
            <span className="duplicate-file-name">{request?.existingName}</span>
          </DialogDescription>
        </DialogHeader>
        {!!request?.remaining && (
          <label className="duplicate-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            {t(
              'Für weitere doppelte Dateien in diesem Upload merken',
              'Remember for other duplicates in this upload',
            )}
          </label>
        )}
        <div className="duplicate-actions">
          <Button type="button" variant="outline" onClick={() => finish(true)}>
            {t('Trotzdem hinzufügen', 'Add anyway')}
          </Button>
          <Button type="button" onClick={() => finish(false)}>
            {t('Überspringen', 'Skip')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
