CREATE TABLE "quotation_line_quantity" (
	"brand_id" uuid NOT NULL,
	"parsed_line_id" uuid NOT NULL,
	"requested_quantity" bigint NOT NULL,
	"actor_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_line_quantity_brand_id_parsed_line_id_pk" PRIMARY KEY("brand_id","parsed_line_id"),
	CONSTRAINT "quotation_line_quantity_positive" CHECK ("quotation_line_quantity"."requested_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "quotation_line_quantity" ADD CONSTRAINT "quotation_line_quantity_brand_line_fk" FOREIGN KEY ("brand_id","parsed_line_id") REFERENCES "public"."parsed_quote_line"("brand_id","id") ON DELETE no action ON UPDATE no action;