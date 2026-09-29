/**
 * Serializes storage writes behind optimistic UI updates.
 *
 * Writes run one at a time in call order. If any write fails, the queue keeps going and, once it is
 * empty, calls `resync` so the UI can reload the database's truth. Reloading earlier would read the
 * database before the writes queued behind the failed one have run and drop those optimistic changes.
 */
export interface WriteQueue {
  enqueue(write: () => Promise<void>): Promise<void>;
  /** Writes queued or running. */
  pending(): number;
}

export function createWriteQueue(resync: () => Promise<void>): WriteQueue {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  let failed = false;

  return {
    enqueue(write) {
      pending++;
      tail = tail
        .then(write)
        .catch(() => {
          failed = true;
        })
        .then(async () => {
          pending--;
          if (pending === 0 && failed) {
            failed = false;
            await resync().catch(() => undefined);
          }
        });
      return tail;
    },
    pending: () => pending,
  };
}
