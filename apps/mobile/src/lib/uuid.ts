interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
}

function randomBytes(crypto: CryptoLike | undefined): Uint8Array {
  const bytes = new Uint8Array(16);
  if (crypto?.getRandomValues) return crypto.getRandomValues(bytes);
  // Hermes may have no Web Crypto. Row ids only need to be unique per user, not unguessable.
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** RFC 4122 version 4 UUID; uses `crypto.randomUUID` when the runtime has it. */
export function uuidV4(crypto: CryptoLike | undefined = globalThis.crypto as CryptoLike): string {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = randomBytes(crypto);
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
