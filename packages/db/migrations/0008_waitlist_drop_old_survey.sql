ALTER TABLE "waitlist_responses" DROP CONSTRAINT "waitlist_responses_save_places_check";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP CONSTRAINT "waitlist_responses_revisit_frequency_check";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP CONSTRAINT "waitlist_responses_most_helpful_check";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP CONSTRAINT "waitlist_responses_willingness_to_pay_check";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP CONSTRAINT "waitlist_responses_headline_check";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP COLUMN "save_places";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP COLUMN "revisit_frequency";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP COLUMN "most_helpful";--> statement-breakpoint
ALTER TABLE "waitlist_responses" DROP COLUMN "willingness_to_pay";--> statement-breakpoint
ALTER TABLE "waitlist_responses" ADD CONSTRAINT "waitlist_responses_headline_check" CHECK ("waitlist_responses"."headline" in ('progress', 'forgot', 'scattered', 'find'));