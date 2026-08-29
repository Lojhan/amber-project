import type { OpenAPIHono } from "@hono/zod-openapi";
import type {
  ApiComposition,
  RequestContext,
} from "@procurement/bootstrap/api";

export type ApiTransportConfig = Readonly<{
  ACTOR_ID: string;
  BRAND_ID: string;
}>;

export type ApiDependencies = Readonly<{
  config: ApiTransportConfig;
  composition: ApiComposition;
}>;

export type ApiEnvironment = {
  Variables: {
    actorContext: RequestContext;
  };
};

export type ApiApp = OpenAPIHono<ApiEnvironment>;
