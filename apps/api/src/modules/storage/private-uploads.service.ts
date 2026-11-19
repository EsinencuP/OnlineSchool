import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { addAbortSignal, Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import { UUID } from '../../core/http.js';
import { matchesUploadFormat, supportsUploadMime } from './upload-format.js';
import { UploadMalwareScanner } from './upload-malware-scanner.js';

export const UPLOAD_TTL_SECONDS = 900;
export const READ_TTL_SECONDS = 900;
export const PDF_READ_TTL_SECONDS = 3600;
export const MAX_HOMEWORK_FILE_BYTES = 52428800;
const INSPECTION_TIMEOUT_MS = 10_000;
const MAX_SIMULTANEOUS_INSPECTIONS = 2;
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

export interface UploadCleanupTarget {
  bucket: string;
  fileId: string;
  scope: 'homework' | 'materials';
  mode: 'STAGING_ONLY' | 'ABANDONED';
}

@Injectable()
export class PrivateUploads implements OnModuleDestroy {
  private connection: S3Client | undefined;
  private inspections = 0;
  private readonly malwareScanner = new UploadMalwareScanner();
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
    if (!supportsUploadMime(input.mimeType))
      return fail(domainError('UPLOAD_TYPE_UNSUPPORTED', 422));
    if (!Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_HOMEWORK_FILE_BYTES)
      return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
    if (this.inspections >= MAX_SIMULTANEOUS_INSPECTIONS)
      return fail(domainError('STORAGE_INSPECTION_BUSY', 503));

    this.inspections++;
    const signal = AbortSignal.timeout(INSPECTION_TIMEOUT_MS);
    const options = { abortSignal: signal };
    try {
      const client = this.client();
      const head = await client.send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: input.stagingKey }),
        options,
      );
      if (head.ContentLength !== input.size || head.ContentType !== input.mimeType || !head.ETag)
        return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
      const staged = await client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.stagingKey,
          IfMatch: head.ETag,
        }),
        options,
      );
      if (!(staged.Body instanceof Readable))
        return fail(domainError('PRIVATE_STORAGE_UNAVAILABLE', 503));
      const stream = addAbortSignal(signal, staged.Body);
      try {
        if (staged.ETag !== head.ETag) return fail(domainError('UPLOAD_OBJECT_CHANGED', 409));
        if (staged.ContentLength !== input.size || staged.ContentType !== input.mimeType)
          return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
        const bytes = await this.readExact(stream, input.size);
        if (!(await matchesUploadFormat(bytes, input.mimeType, signal)))
          return fail(domainError('UPLOAD_CONTENT_MISMATCH', 422));
        const scan = await this.malwareScanner.scan(bytes, signal);
        if (scan === 'REJECTED') return fail(domainError('UPLOAD_SCAN_REJECTED', 422));
        if (scan === 'NOT_CONFIGURED') return fail(domainError('UPLOAD_SCAN_NOT_CONFIGURED', 503));
        if (scan !== 'CLEAN') return fail(domainError('UPLOAD_SCAN_UNAVAILABLE', 503));
      } finally {
        stream.destroy();
      }
      // PUT URLs grant access only to staging. A verified final object is never writable by that URL.
      // COPY uses the same ETag as the inspected GET.
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
        options,
      );
      const final = await client.send(
        new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }),
        options,
      );
      if (final.ContentLength !== input.size || final.ContentType !== input.mimeType)
        return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412)
        return fail(domainError('UPLOAD_OBJECT_CHANGED', 409));
      return this.unavailable(error);
    } finally {
      this.inspections--;
    }
  }

  private async readExact(stream: Readable, size: number): Promise<Buffer> {
    const bytes = Buffer.alloc(size);
    let offset = 0;
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      if (offset + chunk.length > size) return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (offset !== size) return fail(domainError('UPLOAD_METADATA_MISMATCH', 422));
    return bytes;
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

  async deleteExpiredUpload(target: UploadCleanupTarget): Promise<void> {
    if (
      target.bucket !== this.bucket() ||
      !UUID.test(target.fileId) ||
      (target.scope !== 'homework' && target.scope !== 'materials') ||
      (target.mode !== 'STAGING_ONLY' && target.mode !== 'ABANDONED')
    )
      return fail(domainError('UPLOAD_CLEANUP_TARGET_INVALID', 422));
    const { bucket: Bucket, scope, fileId, mode } = target;
    const options = { abortSignal: AbortSignal.timeout(6000) };
    try {
      const client = this.client();
      await client.send(
        new DeleteObjectCommand({ Bucket, Key: `${scope}/incoming/${fileId}` }),
        options,
      );
      if (mode === 'ABANDONED') {
        await client.send(
          new DeleteObjectCommand({ Bucket, Key: `${scope}/final/${fileId}` }),
          options,
        );
      }
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
