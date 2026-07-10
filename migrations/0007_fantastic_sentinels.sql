CREATE TABLE "refresh_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" varchar NOT NULL,
	"expiry" timestamp NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"replaced_by" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;