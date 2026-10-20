/** Share local font bytes across undo snapshots in the bounded project manifest. */
export function stringifyEditorProject(value: unknown) {
  const fonts = new Map<string, number>();
  return JSON.stringify(value, (key, item) => {
    if (key === 'customFont' && typeof item?.data === 'string') {
      const existing = fonts.get(item.data);
      if (existing !== undefined) return { ...item, data: `@font:${existing}` };
      fonts.set(item.data, fonts.size);
    }
    return item;
  });
}
export function editorProjectReviver() {
  const fonts: string[] = [];
  return (key: string, value: unknown) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error('Ungültiger Schlüssel');
    if (
      key === 'customFont' &&
      value &&
      typeof value === 'object' &&
      'data' in value &&
      typeof value.data === 'string'
    ) {
      const match = /^@font:(\d+)$/.exec(value.data);
      if (match) {
        const data = fonts[Number(match[1])];
        if (data === undefined) throw new Error('Ungültiger Schriftverweis');
        return { ...value, data };
      }
      fonts.push(value.data);
    }
    return value;
  };
}
