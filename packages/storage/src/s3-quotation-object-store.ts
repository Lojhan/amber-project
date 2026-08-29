import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectOutput,
  HeadObjectCommand,
  type HeadObjectOutput,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { QuotationObjectStore } from "@procurement/application/ports";
import type { S3StorageConfig } from "./config.js";

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const UPLOAD_EXPIRY_SECONDS = 300;

const safeUploadInput = (filename: string, brandId: string, hash: string) => {
  if (!/^[^/\\]+\.xlsx$/iu.test(filename) || filename.includes(".."))
    throw new Error("only safe .xlsx filenames are accepted");
  if (!/^[a-zA-Z0-9_-]+$/u.test(brandId)) throw new Error("brand id is unsafe");
  if (!/^[a-f0-9]{64}$/u.test(hash))
    throw new Error("sha256 must be lowercase hexadecimal");
};

const ownsKey = (brandId: string, key: string): boolean =>
  key.startsWith(`${brandId}/`) &&
  /^[a-zA-Z0-9_-]+\/[0-9a-f-]{36}\.xlsx$/iu.test(key);

export class S3QuotationObjectStore implements QuotationObjectStore {
  constructor(
    private readonly client: S3Client,
    private readonly config: S3StorageConfig,
    private readonly signingClient: S3Client = client,
  ) {}

  async reserveUpload(
    input: Parameters<QuotationObjectStore["reserveUpload"]>[0],
  ): ReturnType<QuotationObjectStore["reserveUpload"]> {
    safeUploadInput(input.filename, input.brandId, input.contentHash);
    const key = `${input.brandId}/${randomUUID()}.xlsx`;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: XLSX_CONTENT_TYPE,
      Metadata: { sha256: input.contentHash },
    });
    const url = await getSignedUrl(this.signingClient, command, {
      expiresIn: UPLOAD_EXPIRY_SECONDS,
      unhoistableHeaders: new Set(["x-amz-meta-sha256"]),
    });

    return {
      key,
      url,
      headers: {
        "content-type": XLSX_CONTENT_TYPE,
        "x-amz-meta-sha256": input.contentHash,
      },
    };
  }

  async verifyUpload(
    input: Parameters<QuotationObjectStore["verifyUpload"]>[0],
  ): ReturnType<QuotationObjectStore["verifyUpload"]> {
    const object = (await this.client.send(
      new HeadObjectCommand({ Bucket: this.config.bucket, Key: input.key }),
    )) as HeadObjectOutput;

    if (
      !ownsKey(input.brandId, input.key) ||
      object.Metadata?.sha256 !== input.contentHash ||
      object.ContentType !== XLSX_CONTENT_TYPE ||
      !object.ContentLength ||
      object.ContentLength > MAX_UPLOAD_BYTES
    )
      throw new Error("quotation upload verification failed");

    return { size: object.ContentLength, contentType: object.ContentType };
  }

  async read(
    input: Parameters<QuotationObjectStore["read"]>[0],
  ): Promise<Uint8Array> {
    if (!ownsKey(input.brandId, input.key))
      throw new Error("quotation object key is outside the brand scope");

    const object = (await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: input.key }),
    )) as GetObjectOutput;

    const body = object.Body as
      | { transformToByteArray(): Promise<Uint8Array> }
      | undefined;

    if (!body?.transformToByteArray)
      throw new Error("quotation object has no readable body");

    return new Uint8Array(await body.transformToByteArray());
  }

  async remove(
    input: Parameters<QuotationObjectStore["remove"]>[0],
  ): Promise<void> {
    if (!ownsKey(input.brandId, input.key))
      throw new Error("quotation object key is outside the brand scope");

    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: input.key }),
    );
  }
}
