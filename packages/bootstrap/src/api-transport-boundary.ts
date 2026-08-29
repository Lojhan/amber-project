import { ApplicationError } from "@procurement/application";
import type { ProjectionEvent } from "@procurement/application/ports";
import {
  asActorId,
  asBrandId,
  DomainInvariantError,
} from "@procurement/domain";

export type { RequestContext } from "@procurement/application";
export type { ProjectionEvent };

export const createRequestContext = (input: {
  actorId: string;
  brandId: string;
  correlationId: string;
}) => ({
  actorId: asActorId(input.actorId),
  brandId: asBrandId(input.brandId),
  correlationId: input.correlationId,
});

export type KnownApplicationProblem = Readonly<{
  code: string;
  status: number;
  detail: string;
  fields?: Readonly<Record<string, string>>;
}>;

export const knownApplicationProblem = (
  error: Error,
): KnownApplicationProblem | null => {
  if (error instanceof ApplicationError)
    return {
      code: error.code,
      status: error.status,
      detail: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    };
  if (!(error instanceof DomainInvariantError)) return null;

  return {
    code: error.code,
    status: 422,
    detail: error.message,
  };
};
