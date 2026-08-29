import { S3Client } from "@aws-sdk/client-s3";

export type S3StorageConfig = Readonly<{
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  bucket: string;
}>;

export const DEFAULT_S3_STORAGE_CONFIG: S3StorageConfig = {
  region: "us-east-1",
  forcePathStyle: false,
  bucket: "quotation-uploads",
};

export function createS3Client(config: S3StorageConfig): S3Client {
  return new S3Client({
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    region: config.region,
    forcePathStyle: config.forcePathStyle,
  });
}
