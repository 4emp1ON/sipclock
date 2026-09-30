import { PowerSyncDatabase } from '@powersync/react-native';
import { LogBox } from 'react-native';

import { endpoints, refreshSession, sessionCookie } from '@/lib/auth';
import { createConnector } from './connector';
import { DATABASE_FILENAME } from './db';
import { AppSchema } from './schema';
import { createSessionSync } from './session';

/** The app's one local database (PowerSync over op-sqlite). Usable offline and without an account. */
export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: DATABASE_FILENAME },
});

// Losing the sync server is a normal state for an offline-first app. PowerSync logs every failed
// reconnect as an error; keep them in the Metro console but out of the in-app dev overlay.
LogBox.ignoreLogs(['[PowerSync]: Sync error']);

export const connector = createConnector({
  apiUrl: endpoints.api,
  powersyncUrl: endpoints.powersync,
  getCookie: sessionCookie,
  onUnauthorized: refreshSession,
});

export const sessionSync = createSessionSync(powerSync, {
  connect: () => powerSync.connect(connector),
  disconnect: () => powerSync.disconnect(),
  // Keep local-only tables (recent picks, sync owner) when the account's data is wiped.
  clear: () => powerSync.disconnectAndClear({ clearLocal: false }),
});
