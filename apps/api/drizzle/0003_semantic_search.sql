-- The init script enables pgvector only on a fresh volume; existing databases get it here.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "recipe_embedding" (
	"recipe_id" text NOT NULL,
	"locale" text NOT NULL,
	"model" text NOT NULL,
	"text_hash" text NOT NULL,
	"embedding" vector(256) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_embedding_recipe_id_locale_pk" PRIMARY KEY("recipe_id","locale")
);
--> statement-breakpoint
CREATE INDEX "recipe_embedding_model_idx" ON "recipe_embedding" USING btree ("model");