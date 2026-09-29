export const API_VERSION = '1';

export interface MetaService {
  getMeta(): { apiVersion: string; catalogVersion: string | null; time: string };
}

export function createMetaService(
  catalogVersion: string | null,
  now: () => Date = () => new Date(),
): MetaService {
  return {
    getMeta: () => ({ apiVersion: API_VERSION, catalogVersion, time: now().toISOString() }),
  };
}
