import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { asBrandId } from "@procurement/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  S3QuotationObjectStore,
  XLSX_CONTENT_TYPE,
} from "./s3-quotation-object-store.js";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://uploads.example/signed"),
}));

const brandId = asBrandId("brand-1");
const hash = "a".repeat(64);
const key = `${brandId}/00000000-0000-4000-8000-000000000001.xlsx`;
const config = { region: "us-east-1", forcePathStyle: true, bucket: "uploads" };

const createStore = (send = vi.fn()) =>
  new S3QuotationObjectStore({ send } as never, config, { send } as never);

describe("S3 quotation object store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reserves a private upload with the exact signed headers", async () => {
    const reservation = await createStore().reserveUpload({
      brandId,
      filename: "quote.xlsx",
      contentHash: hash,
    });

    expect(reservation).toMatchObject({
      url: "https://uploads.example/signed",
      headers: {
        "content-type": XLSX_CONTENT_TYPE,
        "x-amz-meta-sha256": hash,
      },
    });
    expect(getSignedUrl).toHaveBeenCalledOnce();
  });

  it("verifies tenant key, hash, type, and bounded size", async () => {
    const send = vi.fn().mockResolvedValue({
      Metadata: { sha256: hash },
      ContentType: XLSX_CONTENT_TYPE,
      ContentLength: 42,
    });

    await expect(
      createStore(send).verifyUpload({ brandId, key, contentHash: hash }),
    ).resolves.toEqual({ size: 42, contentType: XLSX_CONTENT_TYPE });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("rejects untrusted metadata and oversized uploads", async () => {
    const send = vi.fn().mockResolvedValue({
      Metadata: { sha256: "wrong" },
      ContentType: XLSX_CONTENT_TYPE,
      ContentLength: MAX_UPLOAD_BYTES + 1,
    });

    await expect(
      createStore(send).verifyUpload({ brandId, key, contentHash: hash }),
    ).rejects.toThrow("verification failed");
  });

  it("reads private object bytes only inside the brand scope", async () => {
    const send = vi.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => [1, 2, 3] },
    });
    const store = createStore(send);

    await expect(
      store.read({ brandId: asBrandId("other-brand"), key }),
    ).rejects.toThrow("outside the brand scope");
    expect(send).not.toHaveBeenCalled();
    await expect(store.read({ brandId, key })).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("removes only objects inside the brand scope", async () => {
    const send = vi.fn().mockResolvedValue({});
    const store = createStore(send);

    await expect(
      store.remove({ brandId: asBrandId("other-brand"), key }),
    ).rejects.toThrow("outside the brand scope");
    expect(send).not.toHaveBeenCalled();

    await expect(store.remove({ brandId, key })).resolves.toBeUndefined();
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
