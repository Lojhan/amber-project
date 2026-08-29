import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  Clock,
  ConfirmationTokenService,
  ConfirmedNegotiationPolicy,
  HashingService,
  IdGenerator,
} from "@procurement/application/ports";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class Sha256HashingService implements HashingService {
  sha256(value: string | Uint8Array): string {
    return createHash("sha256").update(value).digest("hex");
  }
}

type ConfirmationClaims = Readonly<{
  version: "po-confirmation-v1";
  digest: string;
  negotiationId: string;
  offerId: string;
  brandId: string;
  actorId: string;
  expiresAt: number;
}>;

type PolicyConfirmationClaims = Readonly<{
  version: "negotiation-policy-confirmation-v1";
  quotationId: string;
  scenarioId: string;
  policy: ConfirmedNegotiationPolicy;
  brandId: string;
  actorId: string;
  expiresAt: number;
}>;

const sign = (secret: string, payload: string): Buffer =>
  createHmac("sha256", secret).update(payload).digest();

export class HmacConfirmationTokenService implements ConfirmationTokenService {
  constructor(
    private readonly secret: string,
    private readonly lifetimeMs = 5 * 60_000,
  ) {
    if (secret.length < 32)
      throw new Error("confirmation token secret is too short");
  }

  issue(
    claims: Parameters<ConfirmationTokenService["issue"]>[0],
    now: Date,
  ): string {
    const payload = Buffer.from(
      JSON.stringify({
        ...claims,
        version: "po-confirmation-v1",
        expiresAt: now.getTime() + this.lifetimeMs,
      } satisfies ConfirmationClaims),
    ).toString("base64url");

    return `${payload}.${sign(this.secret, payload).toString("base64url")}`;
  }

  verify(
    token: string,
    expected: Parameters<ConfirmationTokenService["verify"]>[1],
    now: Date,
  ): boolean {
    try {
      const claims = this.read<ConfirmationClaims>(token);
      if (!claims) return false;

      return (
        claims.version === "po-confirmation-v1" &&
        claims.digest === expected.digest &&
        claims.negotiationId === expected.negotiationId &&
        claims.offerId === expected.offerId &&
        claims.brandId === expected.brandId &&
        claims.actorId === expected.actorId &&
        Number.isSafeInteger(claims.expiresAt) &&
        claims.expiresAt >= now.getTime()
      );
    } catch {
      return false;
    }
  }

  issuePolicy(
    claims: Parameters<ConfirmationTokenService["issuePolicy"]>[0],
    now: Date,
  ): string {
    const payload = Buffer.from(
      JSON.stringify({
        ...claims,
        version: "negotiation-policy-confirmation-v1",
        expiresAt: now.getTime() + this.lifetimeMs,
      } satisfies PolicyConfirmationClaims),
    ).toString("base64url");

    return `${payload}.${sign(this.secret, payload).toString("base64url")}`;
  }

  verifyPolicy(
    token: string,
    expected: Parameters<ConfirmationTokenService["verifyPolicy"]>[1],
    now: Date,
  ): ConfirmedNegotiationPolicy | null {
    const claims = this.read<PolicyConfirmationClaims>(token);
    if (
      claims?.version !== "negotiation-policy-confirmation-v1" ||
      claims.quotationId !== expected.quotationId ||
      claims.scenarioId !== expected.scenarioId ||
      claims.policy?.hash !== expected.policyHash ||
      claims.brandId !== expected.brandId ||
      claims.actorId !== expected.actorId ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.expiresAt < now.getTime()
    )
      return null;

    return claims.policy;
  }

  private read<Claims>(token: string): Claims | null {
    const [payload, encodedSignature, extra] = token.split(".");
    if (!payload || !encodedSignature || extra) return null;

    const signature = sign(this.secret, payload);
    const provided = Buffer.from(encodedSignature, "base64url");
    if (
      provided.length !== signature.length ||
      !timingSafeEqual(provided, signature)
    )
      return null;

    try {
      return JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as Claims;
    } catch {
      return null;
    }
  }
}
