CREATE TABLE "content_bodies" (
	"content_id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "content_bodies" ADD CONSTRAINT "content_bodies_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;