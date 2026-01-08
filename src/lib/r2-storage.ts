/**
 * Cloudflare R2 Storage Service for Project Artifacts
 * Handles upload, download, and management of project files in Cloudflare R2
 * R2 is S3-compatible with zero egress fees
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';

// Validate required environment variables at module load time
// Support both naming conventions for backwards compatibility
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'spec-driven-artifacts';

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ACCOUNT_ID) {
  logger.warn('Cloudflare R2 credentials not configured. File uploads will be disabled.', {
    hasAccessKey: !!R2_ACCESS_KEY_ID,
    hasSecretKey: !!R2_SECRET_ACCESS_KEY,
    hasAccountId: !!R2_ACCOUNT_ID,
  });
}

// Initialize S3 client with R2 endpoint
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

export interface R2UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

export interface R2FileInfo {
  name: string;
  size: number;
  lastModified: Date;
  url?: string;
}

/**
 * Generate R2 key path for a project artifact
 * Format: projects/{slug}/specs/{phase}/v1/{name}
 */
function generateR2Key(slug: string, phase: string, name: string): string {
  return `projects/${slug}/specs/${phase}/v1/${name}`;
}

/**
 * Generate R2 key path for project metadata
 */
 
function generateMetadataKey(slug: string): string {
  return `projects/${slug}/metadata.json`;
}

/**
 * Generate R2 key path for project idea
 */
 
function generateProjectIdeaKey(slug: string): string {
  return `projects/${slug}/project_idea.txt`;
}

/**
 * Upload a file to R2
 */
export async function uploadToR2(
  slug: string,
  phase: string,
  name: string,
  content: string | Buffer,
  options: R2UploadOptions = {}
): Promise<string> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket name not configured');
  }

  const key = generateR2Key(slug, phase, name);
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: options.metadata,
    });

    await r2Client.send(command);
    logger.info('File uploaded to R2', { bucket: R2_BUCKET_NAME, key });

    return key;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to upload file to R2', err, { key, slug, phase, name });
    throw err;
  }
}

/**
 * Upload project metadata to R2
 */
export async function uploadProjectMetadata(slug: string, metadata: Record<string, unknown>): Promise<string> {
  return uploadToR2(
    slug,
    'metadata',
    'metadata.json',
    JSON.stringify(metadata, null, 2),
    { contentType: 'application/json' }
  );
}

/**
 * Upload project idea file to R2
 */
export async function uploadProjectIdea(slug: string, content: string): Promise<string> {
  return uploadToR2(slug, 'metadata', 'project_idea.txt', content, {
    contentType: 'text/plain',
  });
}

/**
 * Download a file from R2
 */
export async function downloadFromR2(slug: string, phase: string, name: string): Promise<Buffer> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket name not configured');
  }

  const key = generateR2Key(slug, phase, name);

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    const chunks: (Uint8Array | string | Buffer)[] = [];

    if (response.Body) {
      const reader = response.Body as NodeJS.ReadableStream;
      for await (const chunk of reader) {
        chunks.push(chunk);
      }
    }

    return Buffer.concat(chunks as Buffer[]);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to download file from R2', err, { key, slug, phase, name });
    throw err;
  }
}

/**
 * Get file metadata from R2 without downloading entire file
 */
export async function getR2FileInfo(slug: string, phase: string, name: string): Promise<R2FileInfo> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket name not configured');
  }

  const key = generateR2Key(slug, phase, name);

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);

    return {
      name,
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      url: `r2://${R2_BUCKET_NAME}/${key}`,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get file info from R2', err, { key, slug, phase, name });
    throw err;
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(slug: string, phase: string, name: string): Promise<void> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket name not configured');
  }

  const key = generateR2Key(slug, phase, name);

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    logger.info('File deleted from R2', { bucket: R2_BUCKET_NAME, key });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to delete file from R2', err, { key, slug, phase, name });
    throw err;
  }
}

/**
 * List all artifacts for a phase in R2
 */
export async function listR2Artifacts(slug: string, phase: string): Promise<R2FileInfo[]> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket name not configured');
  }

  const prefix = `projects/${slug}/specs/${phase}/v1/`;

  try {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await r2Client.send(command);
    const files: R2FileInfo[] = [];

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          const name = object.Key.replace(prefix, '');
          files.push({
            name,
            size: object.Size || 0,
            lastModified: object.LastModified || new Date(),
            url: `r2://${R2_BUCKET_NAME}/${object.Key}`,
          });
        }
      }
    }

    logger.debug('Listed artifacts from R2', { bucket: R2_BUCKET_NAME, prefix, count: files.length });
    return files;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to list artifacts from R2', err, { slug, phase });
    throw err;
  }
}

/**
 * Delete all project files from R2 (bulk delete)
 * Removes all artifacts, metadata, and project-related files for a given project slug
 */
export async function deleteProjectFromR2(slug: string): Promise<void> {
  if (!R2_BUCKET_NAME) {
    logger.warn('R2 not configured, skipping R2 deletion', { slug });
    return;
  }

  const projectPrefix = `projects/${slug}/`;

  try {
    // List all objects with the project prefix
    let continuationToken: string | undefined;
    let deletedCount = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: projectPrefix,
        ContinuationToken: continuationToken,
      });

      const response = await r2Client.send(listCommand);
      const keysToDelete = response.Contents?.map((obj) => ({ Key: obj.Key! })) || [];

      if (keysToDelete.length === 0) {
        break;
      }

      // Delete all listed objects
      for (const key of keysToDelete) {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key.Key,
          });
          await r2Client.send(deleteCommand);
          deletedCount++;
        } catch (deleteError) {
          const err = deleteError instanceof Error ? deleteError : new Error(String(deleteError));
          logger.warn('Failed to delete individual R2 file during project deletion', {
            slug,
            key: key.Key,
            error: err.message,
          });
          // Continue deleting other files even if one fails
        }
      }

      // Handle pagination
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    logger.info('Project deleted from R2', { slug, deletedCount });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to delete project from R2', err, { slug });
    throw err;
  }
}

/**
 * Generate a signed URL for temporary access to a file
 * Useful for download links that expire after a certain time
 */
export async function generatePresignedUrl(
  slug: string,
  phase: string,
  name: string,
  expirationSeconds: number = 3600
): Promise<string> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2 bucket name not configured');
  }

  const key = generateR2Key(slug, phase, name);

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: expirationSeconds });
    logger.debug('Generated presigned URL', { key, expiresIn: expirationSeconds });
    return url;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to generate presigned URL', err, { key, slug, phase, name });
    throw err;
  }
}

/**
 * Check if R2 is configured and accessible
 */
export async function checkR2Health(): Promise<boolean> {
  if (!R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    logger.warn('R2 not properly configured');
    return false;
  }

  try {
    // Try to list objects with empty prefix as a health check
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      MaxKeys: 1,
    });

    await r2Client.send(command);
    logger.info('R2 health check passed');
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('R2 health check failed', err);
    return false;
  }
}

export { S3Client };
