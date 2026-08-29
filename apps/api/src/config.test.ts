import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const environment = {
  ACTOR_ID: "11111111-1111-4111-8111-111111111111",
  BRAND_ID: "99999999-0000-4000-8000-000000000001",
};

describe("API transport configuration", () => {
  it("loads only listener and challenge actor settings", () => {
    const config = loadConfig(environment);

    expect(config).toMatchObject({
      PORT: 3001,
      ACTOR_ID: environment.ACTOR_ID,
      BRAND_ID: environment.BRAND_ID,
    });
    expect(config).not.toHaveProperty("DATABASE_URL");
  });
});
