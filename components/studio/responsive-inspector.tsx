'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SelectPortalContainer } from '@/components/ui/select';
import { X } from 'lucide-react';
import { useLanguage } from './appearance';

/** Native modal keeps inspector drafts mounted while closed and traps focus. */
export function ResponsiveInspector({
  children,
  editor,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  editor: boolean;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t } = useLanguage();
  const [mobile, setMobile] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
  const attach = useCallback((element: HTMLDialogElement | null) => {
    dialog.current = element;
    setContainer(element);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) onOpenChange(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [onOpenChange]);
  useEffect(() => {
    const sheet = dialog.current;
    if (!sheet) return;
    if (open && !sheet.open) {
      sheet.showModal();
      sheet.querySelector<HTMLElement>('h2')?.focus();
    } else if (!open && sheet.open) sheet.close();
  }, [open, mobile, editor, container]);
  if (!editor || !mobile) return <>{children}</>;
  return createPortal(
    <dialog
      ref={attach}
      className="editor-settings-sheet"
      aria-labelledby="editor-sheet-title"
      onCancel={() => onOpenChange(false)}
      onClose={() => {
        onOpenChange(false);
        document.getElementById('mobile-editor-format')?.focus();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onOpenChange(false);
      }}
    >
      <div className="editor-settings-sheet-heading">
        <h2 id="editor-sheet-title" tabIndex={-1}>
          {t('Bearbeitungseinstellungen', 'Editing settings')}
        </h2>
        <button
          type="button"
          aria-label={t('Schließen', 'Close')}
          onClick={() => onOpenChange(false)}
        >
          <X size={21} />
        </button>
      </div>
      <div className="editor-settings-sheet-body">
        <SelectPortalContainer.Provider value={container}>
          {children}
        </SelectPortalContainer.Provider>
      </div>
      <button type="button" className="quick-access-done" onClick={() => onOpenChange(false)}>
        {t('Zurück zur PDF', 'Back to PDF')}
      </button>
    </dialog>,
    document.body,
  );
}
