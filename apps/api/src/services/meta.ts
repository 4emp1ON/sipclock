export const API_VERSION = '1';

export interface MetaService {
  getMeta(): { apiVersion: string; catalogVersion: string | null; time: string };
}

export function createMetaService(now: () => Date = () => new Date()): MetaService {
  return {
    getMeta: () => ({ apiVersion: API_VERSION, catalogVersion: null, time: now().toISOString() }),
  };
}
