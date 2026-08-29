import type { ActorId, BrandId } from "@procurement/domain";

export type RequestContext = Readonly<{
  actorId: ActorId;
  brandId: BrandId;
  correlationId: string;
}>;
