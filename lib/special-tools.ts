export const specialToolIds = ['protect', 'unlock', 'invoice-read', 'invoice-check'] as const;
export type SpecialTool = (typeof specialToolIds)[number];
export const isSpecialTool = (id: string): id is SpecialTool =>
  (specialToolIds as readonly string[]).includes(id);
