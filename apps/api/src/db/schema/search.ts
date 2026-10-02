import { index, pgTable, primaryKey, text, timestamp, vector } from 'drizzle-orm/pg-core';

// Semantic recipe search (docs/adr/0009). Catalog-derived only: one embedding per recipe and language,
// recomputed when the text it was made from changes. 202 rows need no ANN index: an exact scan is a fraction of a millisecond.

/** Dimensions of Yandex `text-search-doc` / `text-search-query`. */
export const EMBEDDING_DIMENSIONS = 256;

export const recipeEmbedding = pgTable(
  'recipe_embedding',
  {
    recipeId: text('recipe_id').notNull(),
    /** Language of the document: a query is closest to text in its own language. */
    locale: text('locale').notNull(),
    /** Embedding model, so a model change re-embeds everything. */
    model: text('model').notNull(),
    /** sha256 of the document text; unchanged text is never embedded again. */
    textHash: text('text_hash').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.locale] }),
    index('recipe_embedding_model_idx').on(t.model),
  ],
);
