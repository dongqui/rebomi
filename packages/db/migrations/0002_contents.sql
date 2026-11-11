CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text,
	"domain" text NOT NULL,
	"image_url" text,
	"source" text NOT NULL,
	"archive_state" text DEFAULT 'inbox' NOT NULL,
	"link_state" text DEFAULT 'ok' NOT NULL,
	"extraction_level" text DEFAULT 'metadata_only' NOT NULL,
	"summary_status" text DEFAULT 'pending' NOT NULL,
	"metadata_status" text DEFAULT 'pending' NOT NULL,
	"resurfacing_included" boolean NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contents_user_id_normalized_url_unique" UNIQUE("user_id","normalized_url"),
	CONSTRAINT "contents_source_check" CHECK ("contents"."source" in ('extension', 'mobile', 'web', 'import')),
	CONSTRAINT "contents_archive_state_check" CHECK ("contents"."archive_state" in ('inbox', 'archived', 'trashed')),
	CONSTRAINT "contents_link_state_check" CHECK ("contents"."link_state" in ('ok', 'dead')),
	CONSTRAINT "contents_extraction_level_check" CHECK ("contents"."extraction_level" in ('full', 'partial', 'metadata_only')),
	CONSTRAINT "contents_summary_status_check" CHECK ("contents"."summary_status" in ('pending', 'done', 'failed', 'no_content')),
	CONSTRAINT "contents_metadata_status_check" CHECK ("contents"."metadata_status" in ('pending', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contents_user_id_saved_at_idx" ON "contents" USING btree ("user_id","saved_at" DESC NULLS LAST);