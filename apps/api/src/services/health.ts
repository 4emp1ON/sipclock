export interface HealthService {
  /** Resolves true when the database answers within the timeout. */
  isReady(): Promise<boolean>;
}

export function createHealthService(ping: () => Promise<void>, timeoutMs = 2000): HealthService {
  return {
    async isReady() {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          ping(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('db ping timeout')), timeoutMs);
          }),
        ]);
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
