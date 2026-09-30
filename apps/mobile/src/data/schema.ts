import { column, Schema, Table } from '@powersync/react-native';

// Client schema for PowerSync (docs/adr/0006). `id` is implicit on every table.
// Synced tables mirror the server's user data tables; flags are 0/1 integers because SQLite has no booleans.
// Removals are tombstones (flag = 0 with a newer updated_at): rows are never deleted locally.

const bar_item = new Table({
  in_bar: column.integer,
  updated_at: column.integer,
});

const favorite = new Table({
  is_favorite: column.integer,
  updated_at: column.integer,
});

const drink_log = new Table(
  {
    recipe_id: column.text,
    made_at: column.integer,
  },
  { indexes: { made_at: ['made_at'] } },
);

/** Device-local state (recent picks, the account the data belongs to). Never uploaded, kept on sign-out. */
const kv = new Table({ value: column.text }, { localOnly: true });

export const AppSchema = new Schema({ bar_item, favorite, drink_log, kv });
