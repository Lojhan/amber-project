CREATE TABLE "quote_copilot_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_copilot_message_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "quote_copilot_message_role_valid" CHECK ("quote_copilot_message"."role" in ('user', 'assistant')),
	CONSTRAINT "quote_copilot_message_content_present" CHECK (length("quote_copilot_message"."content") > 0)
);
--> statement-breakpoint
ALTER TABLE "quote_copilot_message" ADD CONSTRAINT "quote_copilot_message_brand_id_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("brand_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_copilot_message" ADD CONSTRAINT "quote_copilot_message_brand_quotation_fk" FOREIGN KEY ("brand_id","quotation_id") REFERENCES "public"."quotation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_copilot_message_conversation_idx" ON "quote_copilot_message" USING btree ("brand_id","quotation_id","created_at");