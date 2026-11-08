import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';

export const UPLOAD_TTL_SECONDS = 900;
export const READ_TTL_SECONDS = 900;
export const PDF_READ_TTL_SECONDS = 3600;
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
  async putPdf(
    bucket: string,
    key: string,
    body: Buffer,
    sha256: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!/^student-exports\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/.test(key))
      return fail(domainError('PDF_OBJECT_INVALID', 422));
    const client = this.client();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/pdf',
          ContentLength: body.length,
          CacheControl: 'private, no-store',
          ContentDisposition: 'attachment',
          IfNoneMatch: '*',
          Metadata: { sha256 },
        }),
        signal ? { abortSignal: signal } : {},
      );
    } catch (error) {
      // The PUT response can be lost after success. Resolve that exact object;
      // never overwrite a previously advertised object or mint a public ACL.
      try {
        const found = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (
          found.ContentLength === body.length &&
          found.ContentType === 'application/pdf' &&
          found.Metadata?.sha256 === sha256
        )
          return;
      } catch {
        /* safe retry uses a new attempt object; do not expose provider details */
      }
      return this.unavailable(error);
    }
  }
  async signPdf(input: Omit<PrivateRead, 'canDownload'>): Promise<string> {
    if (
      input.expiresIn !== PDF_READ_TTL_SECONDS ||
      +input.signingDate + PDF_READ_TTL_SECONDS * 1000 <= Date.now()
    )
      return fail(domainError('PDF_EXPORT_EXPIRED', 409));
    if (!/^student-exports\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/.test(input.key))
      return fail(domainError('PDF_OBJECT_INVALID', 422));
    try {
      return await getSignedUrl(
        this.client(),
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          ResponseContentDisposition: 'attachment; filename="online-academy-history.pdf"',
          ResponseCacheControl: 'private, no-store',
        }),
        { expiresIn: PDF_READ_TTL_SECONDS, signingDate: input.signingDate },
      );
    } catch (error) {
      return this.unavailable(error);
    }
  }
  async deletePdf(bucket: string, key: string): Promise<void> {
    if (!/^student-exports\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/.test(key))
      return fail(domainError('PDF_OBJECT_INVALID', 422));
    try {
      await this.client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      return this.unavailable(error);
    }
  }
  async readAvatar(
    bucket: string,
    key: string,
    contentType: string,
    size: number,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(contentType) ||
      size < 1 ||
      size > 2097152
    )
      return fail(domainError('AVATAR_FILE_INVALID', 422));
    try {
      const result = await this.client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body || result.ContentLength !== size || result.ContentType !== contentType)
        return fail(domainError('AVATAR_FILE_INVALID', 422));
      const parts: Buffer[] = [];
      let total = 0;
      for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
        const part = Buffer.from(chunk);
        total += part.length;
        if (total > 2097152) return fail(domainError('AVATAR_FILE_INVALID', 422));
        parts.push(part);
      }
      const bytes = Buffer.concat(parts);
      const valid =
        contentType === 'image/png'
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : contentType === 'image/jpeg'
            ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
            : bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
              bytes.subarray(8, 12).toString('ascii') === 'WEBP';
      if (total !== size || !valid) return fail(domainError('AVATAR_FILE_INVALID', 422));
      return { bytes, contentType };
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
