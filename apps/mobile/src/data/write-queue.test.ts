import { createWriteQueue } from './write-queue';

describe('write queue', () => {
  it('runs writes in order and resyncs only after the queue drains when one failed', async () => {
    const db = new Set<string>();
    const log: string[] = [];
    let uiAfterResync: string[] | null = null;
    const queue = createWriteQueue(async () => {
      log.push('resync');
      uiAfterResync = [...db];
    });

    queue.enqueue(async () => {
      log.push('add gin');
      throw new Error('disk full');
    });
    const last = queue.enqueue(async () => {
      log.push('add lime');
      db.add('lime');
    });
    expect(queue.pending()).toBe(2);
    await last;

    expect(log).toEqual(['add gin', 'add lime', 'resync']);
    // The reload sees the later successful write instead of dropping it.
    expect(uiAfterResync).toEqual(['lime']);
    expect(queue.pending()).toBe(0);
  });

  it('does not resync when every write succeeds', async () => {
    const resync = jest.fn(async () => undefined);
    const queue = createWriteQueue(resync);
    await queue.enqueue(async () => undefined);
    await queue.enqueue(async () => undefined);
    expect(resync).not.toHaveBeenCalled();
  });
});
