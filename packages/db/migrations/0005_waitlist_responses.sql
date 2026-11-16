CREATE TABLE "waitlist_responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"headline" text NOT NULL,
	"save_places" text[] DEFAULT '{}'::text[] NOT NULL,
	"revisit_frequency" text,
	"most_helpful" text,
	"willingness_to_pay" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_responses_locale_check" CHECK ("waitlist_responses"."locale" in ('ko', 'en')),
	CONSTRAINT "waitlist_responses_headline_check" CHECK ("waitlist_responses"."headline" in ('forgot', 'scattered', 'find')),
	CONSTRAINT "waitlist_responses_save_places_check" CHECK ("waitlist_responses"."save_places" <@ array['instagram', 'youtube', 'reddit', 'x', 'browser', 'notes', 'other']::text[]),
	CONSTRAINT "waitlist_responses_revisit_frequency_check" CHECK ("waitlist_responses"."revisit_frequency" in ('almost_never', 'sometimes', 'most_weeks')),
	CONSTRAINT "waitlist_responses_most_helpful_check" CHECK ("waitlist_responses"."most_helpful" in ('summary', 'search', 'resurfacing', 'one_place')),
	CONSTRAINT "waitlist_responses_willingness_to_pay_check" CHECK ("waitlist_responses"."willingness_to_pay" in ('yes', 'maybe', 'no'))
);
