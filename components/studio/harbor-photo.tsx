'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { headerPhotos, randomHeaderPhoto, type HeaderPhoto } from '@/lib/header-photos';
import { useLanguage } from './appearance';

const storageKey = 'moinpdf-header-photo';

function previousPhoto(): string | null {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function preparePhoto(photo: HeaderPhoto, priority: 'high' | 'low') {
  const image = new Image();
  image.fetchPriority = priority;
  image.src = photo.src;
  return {
    photo,
    ready: image.decode().then(
      () => true,
      () => false,
    ),
  };
}

export function HarborPhoto() {
  const { t } = useLanguage();
  const [photo, setPhoto] = useState<HeaderPhoto | null>(null);
  const current = useRef<HeaderPhoto | null>(null);
  const prepared = useRef<ReturnType<typeof preparePhoto> | null>(null);
  const mounted = useRef(false);
  const changing = useRef(false);

  const changePhoto = useCallback(async () => {
    if (changing.current) return;
    changing.current = true;
    try {
      let next =
        prepared.current ??
        preparePhoto(randomHeaderPhoto(current.current?.src ?? previousPhoto()), 'high');
      prepared.current = null;
      if (!(await next.ready)) {
        // Keep a displayed photo on a failed request; the next click can retry.
        // On first open, the original header is a reliable fallback.
        if (current.current || !mounted.current) return;
        next = preparePhoto(headerPhotos[0], 'high');
        if (!(await next.ready)) return;
      }
      if (!mounted.current) return;
      current.current = next.photo;
      setPhoto(next.photo);
      try {
        sessionStorage.setItem(storageKey, next.photo.src);
      } catch {
        // The gallery also works with browser storage disabled.
      }
      // Decode only the next random image in advance. Swap the ready image
      // directly on activation, without transitions or an empty frame.
      prepared.current = preparePhoto(randomHeaderPhoto(next.photo.src), 'low');
    } finally {
      changing.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void changePhoto();
    return () => {
      mounted.current = false;
    };
  }, [changePhoto]);

  const label = t('Anderes Headerbild anzeigen', 'Show another header image');
  return (
    <button
      type="button"
      className="harbor-photo"
      onClick={() => void changePhoto()}
      aria-label={label}
      title={label}
    >
      {photo && (
        <img
          src={photo.src}
          width={photo.width}
          height={photo.height}
          style={{ objectPosition: photo.position }}
          alt={t(photo.de, photo.en)}
          fetchPriority="high"
          decoding="sync"
          draggable={false}
        />
      )}
    </button>
  );
}
