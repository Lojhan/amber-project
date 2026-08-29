import { uuid } from "drizzle-orm/pg-core";

export const entityId = () => uuid("id").primaryKey();
