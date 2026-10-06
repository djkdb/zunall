export const createId = (prefix = "id"): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
