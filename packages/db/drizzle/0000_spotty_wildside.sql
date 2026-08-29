CREATE TYPE "public"."negotiation_state" AS ENUM('DRAFT', 'ROUND_1_RUNNING', 'ROUND_1_COMPLETE', 'CAPACITY_EVENT_APPLIED', 'ROUND_2_RUNNING', 'EVALUATED', 'RECOMMENDED', 'PO_COMMITTED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."quotation_state" AS ENUM('UPLOADED', 'PARSING', 'INTERPRETATION_REQUIRED', 'REVIEW_REQUIRED', 'READY', 'REJECTED', 'PARSE_FAILED');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" varchar(255) NOT NULL,
	"subject_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entry" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand" (
	"brand_id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"display_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"catalog_version" varchar(64) NOT NULL,
	"sku" varchar(128) NOT NULL,
	"name" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "product_sku_nonempty" CHECK (length("product"."sku") > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_counter" (
	"brand_id" uuid PRIMARY KEY NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_counter_positive" CHECK ("purchase_order_counter"."next_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_sku" varchar(128) NOT NULL,
	"product_name" text,
	"quantity" bigint NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"extended_total_minor" bigint NOT NULL,
	CONSTRAINT "purchase_order_line_quantity_positive" CHECK ("purchase_order_line"."quantity" > 0),
	CONSTRAINT "purchase_order_line_price_positive" CHECK ("purchase_order_line"."unit_price_minor" > 0),
	CONSTRAINT "purchase_order_line_total_positive" CHECK ("purchase_order_line"."extended_total_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"number" varchar(64) NOT NULL,
	"source_negotiation_id" uuid NOT NULL,
	"source_offer_id" uuid NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"supplier_id" varchar(64) NOT NULL,
	"supplier_display_name" text NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"total_minor" bigint NOT NULL,
	"terms" jsonb NOT NULL,
	"immutable_snapshot" jsonb NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" uuid NOT NULL,
	CONSTRAINT "purchase_order_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "purchase_order_total_positive" CHECK ("purchase_order"."total_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"decision_record" jsonb NOT NULL,
	"winner_offer_id" uuid,
	"policy_version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_brand_id_unique" UNIQUE("brand_id","id")
);
--> statement-breakpoint
CREATE TABLE "domain_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"aggregate_type" varchar(64) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"type" varchar(128) NOT NULL,
	"schema_version" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" varchar(255),
	"causation_id" uuid,
	"correlation_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_event_brand_id_unique" UNIQUE("brand_id","id")
);
--> statement-breakpoint
CREATE TABLE "projection_event" (
	"resume_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "projection_event_resume_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"brand_id" uuid NOT NULL,
	"domain_event_id" uuid NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_decision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"parsed_line_id" uuid NOT NULL,
	"candidates" jsonb NOT NULL,
	"selected_product_id" uuid,
	"excluded" boolean DEFAULT false NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_decision_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "match_decision_selected_xor_excluded" CHECK (not ("match_decision"."selected_product_id" is not null and "match_decision"."excluded"))
);
--> statement-breakpoint
CREATE TABLE "negotiation_turn" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"supplier_id" varchar(16) NOT NULL,
	"round" integer NOT NULL,
	"turn_key" varchar(96) NOT NULL,
	"status" varchar(24) NOT NULL,
	"result" jsonb NOT NULL,
	"provider_metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "negotiation_turn_round_valid" CHECK ("negotiation_turn"."round" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "negotiation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"order_intent_id" uuid NOT NULL,
	"state" "negotiation_state" NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"model_snapshot" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "negotiation_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "negotiation_version_positive" CHECK ("negotiation"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "offer_line_fulfillment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"offer_line_id" uuid NOT NULL,
	"fulfillable_quantity" bigint NOT NULL,
	"full_order_eligible" integer NOT NULL,
	CONSTRAINT "offer_line_fulfillment_quantity_nonnegative" CHECK ("offer_line_fulfillment"."fulfillable_quantity" >= 0),
	CONSTRAINT "offer_line_fulfillment_eligible_boolean" CHECK ("offer_line_fulfillment"."full_order_eligible" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "offer_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" bigint NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	CONSTRAINT "offer_line_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "offer_line_quantity_positive" CHECK ("offer_line"."quantity" > 0),
	CONSTRAINT "offer_line_price_positive" CHECK ("offer_line"."unit_price_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"negotiation_id" uuid NOT NULL,
	"supplier_id" varchar(16) NOT NULL,
	"round" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"lead_time_days" integer NOT NULL,
	"capacity_percent" integer NOT NULL,
	"payment_schedule" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"validation_result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "offer_round_positive" CHECK ("offer"."round" > 0),
	CONSTRAINT "offer_lead_time_positive" CHECK ("offer"."lead_time_days" > 0),
	CONSTRAINT "offer_capacity_percent_valid" CHECK ("offer"."capacity_percent" between 1 and 100),
	CONSTRAINT "offer_supplier_nonempty" CHECK (length("offer"."supplier_id") > 0)
);
--> statement-breakpoint
CREATE TABLE "order_intent_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"order_intent_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" bigint NOT NULL,
	"baseline_unit_price_minor" bigint NOT NULL,
	"source_tier_evidence" jsonb NOT NULL,
	CONSTRAINT "order_intent_line_quantity_positive" CHECK ("order_intent_line"."quantity" > 0),
	CONSTRAINT "order_intent_line_price_positive" CHECK ("order_intent_line"."baseline_unit_price_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_intent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"assumptions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_intent_brand_id_unique" UNIQUE("brand_id","id")
);
--> statement-breakpoint
CREATE TABLE "parsed_quote_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"source_evidence" jsonb NOT NULL,
	"normalized_candidates" jsonb NOT NULL,
	"raw_value" text,
	CONSTRAINT "parsed_quote_line_brand_id_unique" UNIQUE("brand_id","id")
);
--> statement-breakpoint
CREATE TABLE "quotation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"file_hash" varchar(128) NOT NULL,
	"object_key" text NOT NULL,
	"note" text,
	"failure_detail" text,
	"catalog_version" varchar(64) NOT NULL,
	"state" "quotation_state" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_brand_id_unique" UNIQUE("brand_id","id"),
	CONSTRAINT "quotation_version_positive" CHECK ("quotation"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "quote_scenario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"source_sheet" text NOT NULL,
	"rationale" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "quote_scenario_brand_id_unique" UNIQUE("brand_id","id")
);
--> statement-breakpoint
CREATE TABLE "quotation_scenario_selection" (
	"brand_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_scenario_selection_brand_id_quotation_id_pk" PRIMARY KEY("brand_id","quotation_id")
);
--> statement-breakpoint
CREATE TABLE "worker_completion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_failure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"queue" varchar(64) NOT NULL,
	"correlation_id" varchar(255) NOT NULL,
	"code" varchar(128) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_brand_id_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("brand_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("brand_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_brand_po_fk" FOREIGN KEY ("brand_id","purchase_order_id") REFERENCES "public"."purchase_order"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_brand_negotiation_fk" FOREIGN KEY ("brand_id","source_negotiation_id") REFERENCES "public"."negotiation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_brand_offer_fk" FOREIGN KEY ("brand_id","source_offer_id") REFERENCES "public"."offer"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_brand_recommendation_fk" FOREIGN KEY ("brand_id","recommendation_id") REFERENCES "public"."recommendation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_brand_negotiation_fk" FOREIGN KEY ("brand_id","negotiation_id") REFERENCES "public"."negotiation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_brand_offer_fk" FOREIGN KEY ("brand_id","winner_offer_id") REFERENCES "public"."offer"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_event" ADD CONSTRAINT "domain_event_brand_id_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("brand_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_event" ADD CONSTRAINT "projection_event_brand_id_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("brand_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_event" ADD CONSTRAINT "projection_event_brand_domain_event_fk" FOREIGN KEY ("brand_id","domain_event_id") REFERENCES "public"."domain_event"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_decision" ADD CONSTRAINT "match_decision_brand_line_fk" FOREIGN KEY ("brand_id","parsed_line_id") REFERENCES "public"."parsed_quote_line"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_decision" ADD CONSTRAINT "match_decision_brand_product_fk" FOREIGN KEY ("brand_id","selected_product_id") REFERENCES "public"."product"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation_turn" ADD CONSTRAINT "negotiation_turn_brand_negotiation_fk" FOREIGN KEY ("brand_id","negotiation_id") REFERENCES "public"."negotiation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation" ADD CONSTRAINT "negotiation_brand_quotation_fk" FOREIGN KEY ("brand_id","quotation_id") REFERENCES "public"."quotation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiation" ADD CONSTRAINT "negotiation_brand_order_intent_fk" FOREIGN KEY ("brand_id","order_intent_id") REFERENCES "public"."order_intent"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_line_fulfillment" ADD CONSTRAINT "offer_line_fulfillment_brand_offer_line_fk" FOREIGN KEY ("brand_id","offer_line_id") REFERENCES "public"."offer_line"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_line" ADD CONSTRAINT "offer_line_brand_offer_fk" FOREIGN KEY ("brand_id","offer_id") REFERENCES "public"."offer"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_line" ADD CONSTRAINT "offer_line_brand_product_fk" FOREIGN KEY ("brand_id","product_id") REFERENCES "public"."product"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_brand_negotiation_fk" FOREIGN KEY ("brand_id","negotiation_id") REFERENCES "public"."negotiation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intent_line" ADD CONSTRAINT "order_intent_line_brand_intent_fk" FOREIGN KEY ("brand_id","order_intent_id") REFERENCES "public"."order_intent"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intent_line" ADD CONSTRAINT "order_intent_line_brand_product_fk" FOREIGN KEY ("brand_id","product_id") REFERENCES "public"."product"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intent" ADD CONSTRAINT "order_intent_brand_quotation_fk" FOREIGN KEY ("brand_id","quotation_id") REFERENCES "public"."quotation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intent" ADD CONSTRAINT "order_intent_brand_scenario_fk" FOREIGN KEY ("brand_id","scenario_id") REFERENCES "public"."quote_scenario"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_quote_line" ADD CONSTRAINT "parsed_quote_line_brand_scenario_fk" FOREIGN KEY ("brand_id","scenario_id") REFERENCES "public"."quote_scenario"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_brand_id_brand_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("brand_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_scenario" ADD CONSTRAINT "quote_scenario_brand_quotation_fk" FOREIGN KEY ("brand_id","quotation_id") REFERENCES "public"."quotation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_scenario_selection" ADD CONSTRAINT "scenario_selection_brand_quotation_fk" FOREIGN KEY ("brand_id","quotation_id") REFERENCES "public"."quotation"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_scenario_selection" ADD CONSTRAINT "scenario_selection_brand_scenario_fk" FOREIGN KEY ("brand_id","scenario_id") REFERENCES "public"."quote_scenario"("brand_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_brand_subject_idx" ON "audit_log" USING btree ("brand_id","subject_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_key_unique" ON "brand" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_id_unique" ON "brand" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_brand_version_sku_unique" ON "product" USING btree ("brand_id","catalog_version","sku");--> statement-breakpoint
CREATE INDEX "product_brand_catalog_idx" ON "product" USING btree ("brand_id","catalog_version");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_line_brand_id_unique" ON "purchase_order_line" USING btree ("brand_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_source_offer_unique" ON "purchase_order" USING btree ("brand_id","source_offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_brand_idempotency_unique" ON "purchase_order" USING btree ("brand_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_brand_number_unique" ON "purchase_order" USING btree ("brand_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_negotiation_unique" ON "recommendation" USING btree ("brand_id","negotiation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_event_idempotency_unique" ON "domain_event" USING btree ("brand_id","idempotency_key") WHERE "domain_event"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "domain_event_aggregate_idx" ON "domain_event" USING btree ("brand_id","aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projection_event_resume_unique" ON "projection_event" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "projection_event_brand_resume_idx" ON "projection_event" USING btree ("brand_id","resume_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_decision_initial_fact_unique" ON "match_decision" USING btree ("brand_id","parsed_line_id") WHERE "match_decision"."actor_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "negotiation_turn_key_unique" ON "negotiation_turn" USING btree ("brand_id","negotiation_id","turn_key");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_line_fulfillment_line_unique" ON "offer_line_fulfillment" USING btree ("brand_id","offer_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_line_product_unique" ON "offer_line" USING btree ("brand_id","offer_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_supplier_round_unique" ON "offer" USING btree ("brand_id","negotiation_id","supplier_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX "order_intent_line_brand_id_unique" ON "order_intent_line" USING btree ("brand_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_intent_line_product_unique" ON "order_intent_line" USING btree ("brand_id","order_intent_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_brand_hash_unique" ON "quotation" USING btree ("brand_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_brand_idempotency_unique" ON "quotation" USING btree ("brand_id","idempotency_key") WHERE "quotation"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "quote_scenario_quotation_idx" ON "quote_scenario" USING btree ("brand_id","quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_completion_key_unique" ON "worker_completion" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "worker_failure_job_idx" ON "worker_failure" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "worker_failure_correlation_idx" ON "worker_failure" USING btree ("correlation_id");