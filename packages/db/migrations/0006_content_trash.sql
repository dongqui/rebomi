ALTER TABLE "contents" ADD COLUMN "trashed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "trashed_from" text;--> statement-breakpoint
-- 이미 휴지통에 있던 콘텐츠는 언제 어디서 왔는지 기록이 없다. 지금 삭제한 것으로 보고
-- Inbox에서 온 것으로 채운다 (아래 제약을 만족해야 한다).
UPDATE "contents" SET "trashed_at" = now(), "trashed_from" = 'inbox' WHERE "archive_state" = 'trashed';--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_trashed_from_check" CHECK ("contents"."trashed_from" in ('inbox', 'archived'));--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_trashed_fields_check" CHECK (("contents"."archive_state" = 'trashed') = ("contents"."trashed_at" is not null) and ("contents"."archive_state" = 'trashed') = ("contents"."trashed_from" is not null));