export type StorageHealth = {
  supported: boolean;
  persisted: boolean | null;
  usage?: number;
  quota?: number;
  pressure: boolean;
};
export async function storageHealth(manager?: StorageManager): Promise<StorageHealth> {
  const storage = manager ?? (typeof navigator === 'undefined' ? undefined : navigator.storage);
  if (!storage) return { supported: false, persisted: null, pressure: false };
  const [estimate, persisted] = await Promise.allSettled([
    storage.estimate?.(),
    storage.persisted?.(),
  ]);
  const value = estimate.status === 'fulfilled' ? estimate.value : undefined;
  const usage = Number.isFinite(value?.usage) ? value!.usage : undefined;
  const quota = Number.isFinite(value?.quota) && value!.quota! > 0 ? value!.quota : undefined;
  return {
    supported: typeof storage.persist === 'function',
    persisted:
      persisted.status === 'fulfilled' && typeof persisted.value === 'boolean'
        ? persisted.value
        : null,
    usage,
    quota,
    pressure:
      usage !== undefined &&
      quota !== undefined &&
      (usage / quota >= 0.85 || quota - usage < 32 * 1024 ** 2),
  };
}
