import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  CopyObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';

export const UPLOAD_TTL_SECONDS = 900;
export const READ_TTL_SECONDS = 900;
export const MAX_HOMEWORK_FILE_BYTES = 52428800;
export interface PrivateUpload {
  bucket: string;
  key: string;
  stagingKey: string;
  size: number;
  mimeType: string;
  expiresAt: Date;
}
export interface PrivateRead {
  bucket: string;
  key: string;
  fileName: string;
  canDownload: boolean;
  signingDate: Date;
  expiresIn: number;
}

@Injectable()
export class PrivateUploads implements OnModuleDestroy {
  private connection: S3Client | undefined;
  onModuleDestroy(): void {
    this.connection?.destroy();
  }
  bucket(): string {
    const value = process.env.S3_BUCKET;
    if (!value || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value))
      return fail(domainError('STORAGE_NOT_CONFIGURED', 503));
    return value;
  }
  private client(): S3Client {
    if (this.connection) return this.connection;
    const endpoint = process.env.S3_ENDPOINT,
      accessKeyId = process.env.S3_ACCESS_KEY,
      secretAccessKey = process.env.S3_SECRET_KEY,
      region = process.env.S3_REGION;
    if (!endpoint || !accessKeyId || !secretAccessKey || !region)
      return fail(domainError('STORAGE_NOT_CONFIGURED', 503));
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      return fail(domainError('STORAGE_NOT_CONFIGURED', 503));
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      return fail(domainError('STORAGE_NOT_CONFIGURED', 503));
    this.connection = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      requestHandler: { requestTimeout: 5000, connectionTimeout: 2000 },
    });
    return this.connection;
  }
  async sign(input: PrivateUpload): Promise<string> {
    if (+input.expiresAt <= Date.now()) return fail(domainError('UPLOAD_URL_EXPIRED', 409));
    try {
      return await getSignedUrl(
        this.client(),
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.stagingKey,
          ContentLength: input.size,
          ContentType: input.mimeType,
        }),
        {
          expiresIn: UPLOAD_TTL_SECONDS,
          signingDate: new Date(+input.expiresAt - UPLOAD_TTL_SECONDS * 1000),
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      );
    } catch (error) {
      return this.unavailable(error);
    }
  }
  async signRead(input: PrivateRead): Promise<string> {
    if (
      !Number.isInteger(input.expiresIn) ||
      input.expiresIn < 1 ||
      input.expiresIn > READ_TTL_SECONDS
    )
      return fail(domainError('FILE_ACCESS_DENIED', 403));
    // Only presentation changes with can_download. A readable browser response is never DRM.
    const name = input.fileName.replace(/[\\/]/g, '_');
    const encoded = encodeURIComponent(name).replace(
      /['()*]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );
    try {
      return await getSignedUrl(
        this.client(),
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ResponseContentDisposition: `${input.canDownload ? 'attachment' : 'inline'}; filename="material"; filename*=UTF-8''${encoded}`,
          ResponseCacheControl: 'private, no-store',
        }),
        { expiresIn: input.expiresIn, signingDate: input.signingDate },
      );
    } catch (error) {
      return this.unavailable(error);
    }
  }
  async confirm(input: PrivateUpload): Promise<void> {
    try {
      const client = this.client();
      const head = await client.send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: input.stagingKey }),
      );
      if (head.ContentLength !== input.size || head.ContentType !== input.mimeType || !head.ETag)
        return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
      // PUT URLs grant access only to staging. A verified final object is never writable by that URL.
      // Conditional server-side copy also rejects a replacement between HEAD and COPY.
      await client.send(
        new CopyObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          CopySource: [input.bucket, ...input.stagingKey.split('/')]
            .map(encodeURIComponent)
            .join('/'),
          CopySourceIfMatch: head.ETag,
          MetadataDirective: 'REPLACE',
          ContentType: input.mimeType,
          ContentDisposition: 'attachment',
          CacheControl: 'private, no-store',
        }),
      );
      const final = await client.send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }),
      );
      if (final.ContentLength !== input.size || final.ContentType !== input.mimeType)
        return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
    } catch (error) {
      return this.unavailable(error);
    }
  }
  private unavailable(error: unknown): never {
    if (error instanceof AppException) return fail(error.domain);
    // Provider errors can contain signed URLs/headers; never log or expose them.
    return fail(domainError('PRIVATE_STORAGE_UNAVAILABLE', 503));
  }
}
