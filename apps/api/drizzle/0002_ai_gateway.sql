CREATE TABLE "ai_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"ru_pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_spend_monthly" (
	"provider" text NOT NULL,
	"month" date NOT NULL,
	"reserved_micros" bigint DEFAULT 0 NOT NULL,
	"spent_micros" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_spend_monthly_provider_month_pk" PRIMARY KEY("provider","month")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_daily" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_daily_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "ai_profile" ADD CONSTRAINT "ai_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;