-- 이 마이그레이션 전의 랜딩은 첫 화면에 늘 휴대폰을 보였다. 이미 있는 응답은 그 값으로 채운다.
ALTER TABLE "waitlist_responses" ADD COLUMN "hero" text;--> statement-breakpoint
UPDATE "waitlist_responses" SET "hero" = 'phone';--> statement-breakpoint
ALTER TABLE "waitlist_responses" ALTER COLUMN "hero" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "occupation" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "occupation_other" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "save_intent" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "save_intent_other" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "frustration" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "frustration_other" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "wanted_help" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD COLUMN "wanted_help_other" text;--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD CONSTRAINT "waitlist_responses_hero_check" CHECK ("waitlist_responses"."hero" in ('none', 'card', 'notice', 'phone'));--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD CONSTRAINT "waitlist_responses_occupation_check" CHECK ("waitlist_responses"."occupation" in ('studying', 'employed', 'freelance', 'own_business', 'creator', 'other'));--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD CONSTRAINT "waitlist_responses_save_intent_check" CHECK ("waitlist_responses"."save_intent" in ('learn', 'work', 'try', 'enjoy', 'reference', 'other'));--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD CONSTRAINT "waitlist_responses_frustration_check" CHECK ("waitlist_responses"."frustration" in ('forget', 'cant_find', 'too_many', 'no_time', 'never_use', 'none', 'other'));--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD CONSTRAINT "waitlist_responses_wanted_help_check" CHECK ("waitlist_responses"."wanted_help" in ('rediscover', 'find', 'pick', 'use', 'one_place', 'other'));