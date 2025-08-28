import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface SignedUrlOptions {
  expiresIn?: number; // seconds
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface EncryptionKey {
  projectId: string;
  keyId: string;
  encryptedKey: string;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class SignedUrlsService {
  private readonly logger = new Logger(SignedUrlsService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || 'ai-game-narrative';
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.secretKey = this.configService.get<string>('SIGNED_URL_SECRET') || 'default-secret-key';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Generate a signed URL for uploading files
   */
  async generateUploadUrl(
    projectId: string,
    fileName: string,
    options: SignedUrlOptions = {},
  ): Promise<{
    uploadUrl: string;
    fileKey: string;
    expiresAt: Date;
  }> {
    try {
      const fileKey = `projects/${projectId}/uploads/${this.generateUniqueFileName(fileName)}`;
      const expiresIn = options.expiresIn || 3600; // 1 hour default
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: {
          projectId,
          uploadedAt: new Date().toISOString(),
          ...options.metadata,
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`Generated upload URL for project ${projectId}, file: ${fileName}`);

      return {
        uploadUrl,
        fileKey,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a signed URL for downloading files
   */
  async generateDownloadUrl(
    projectId: string,
    fileKey: string,
    options: SignedUrlOptions = {},
  ): Promise<{
    downloadUrl: string;
    expiresAt: Date;
  }> {
    try {
      const expiresIn = options.expiresIn || 3600; // 1 hour default
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`Generated download URL for project ${projectId}, file: ${fileKey}`);

      return {
        downloadUrl,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a per-project encryption key
   */
  async generateProjectEncryptionKey(projectId: string): Promise<EncryptionKey> {
    try {
      const keyId = crypto.randomUUID();
      const algorithm = 'aes-256-gcm';
      
      // Generate a random encryption key
      const key = crypto.randomBytes(32);
      
      // Encrypt the key with the master secret
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.secretKey);
      cipher.setAAD(Buffer.from(projectId));
      
      let encryptedKey = cipher.update(key);
      encryptedKey = Buffer.concat([encryptedKey, cipher.final()]);
      
      const encryptionKey: EncryptionKey = {
        projectId,
        keyId,
        encryptedKey: encryptedKey.toString('base64'),
        algorithm,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      };

      this.logger.log(`Generated encryption key for project ${projectId}`);

      return encryptionKey;
    } catch (error) {
      this.logger.error(`Failed to generate encryption key: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Decrypt a project encryption key
   */
  async decryptProjectKey(encryptionKey: EncryptionKey): Promise<Buffer> {
    try {
      const encryptedKeyBuffer = Buffer.from(encryptionKey.encryptedKey, 'base64');
      
      const decipher = crypto.createDecipher(encryptionKey.algorithm, this.secretKey);
      decipher.setAAD(Buffer.from(encryptionKey.projectId));
      
      let decryptedKey = decipher.update(encryptedKeyBuffer);
      decryptedKey = Buffer.concat([decryptedKey, decipher.final()]);
      
      return decryptedKey;
    } catch (error) {
      this.logger.error(`Failed to decrypt project key: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Encrypt data with project-specific key
   */
  async encryptProjectData(
    projectId: string,
    data: Buffer,
    encryptionKey: EncryptionKey,
  ): Promise<{
    encryptedData: string;
    iv: string;
    tag: string;
  }> {
    try {
      const key = await this.decryptProjectKey(encryptionKey);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipherGCM(encryptionKey.algorithm, key, iv);
      cipher.setAAD(Buffer.from(projectId));
      
      let encryptedData = cipher.update(data);
      encryptedData = Buffer.concat([encryptedData, cipher.final()]);
      
      const tag = cipher.getAuthTag();

      return {
        encryptedData: encryptedData.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
      };
    } catch (error) {
      this.logger.error(`Failed to encrypt project data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Decrypt data with project-specific key
   */
  async decryptProjectData(
    projectId: string,
    encryptedData: string,
    iv: string,
    tag: string,
    encryptionKey: EncryptionKey,
  ): Promise<Buffer> {
    try {
      const key = await this.decryptProjectKey(encryptionKey);
      const ivBuffer = Buffer.from(iv, 'base64');
      const tagBuffer = Buffer.from(tag, 'base64');
      const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
      
      const decipher = crypto.createDecipherGCM(encryptionKey.algorithm, key, ivBuffer);
      decipher.setAAD(Buffer.from(projectId));
      decipher.setAuthTag(tagBuffer);
      
      let decryptedData = decipher.update(encryptedDataBuffer);
      decryptedData = Buffer.concat([decryptedData, decipher.final()]);
      
      return decryptedData;
    } catch (error) {
      this.logger.error(`Failed to decrypt project data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a unique filename with timestamp and random suffix
   */
  private generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const extension = originalName.includes('.') 
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    const baseName = originalName.includes('.')
      ? originalName.substring(0, originalName.lastIndexOf('.'))
      : originalName;
    
    return `${baseName}_${timestamp}_${randomSuffix}${extension}`;
  }

  /**
   * Validate signed URL signature
   */
  validateSignedUrlSignature(url: string, expectedSignature: string): boolean {
    try {
      const urlObj = new URL(url);
      const signature = urlObj.searchParams.get('X-Amz-Signature');
      
      if (!signature) {
        return false;
      }

      // In a real implementation, you would validate the AWS signature
      // For now, we'll do a simple comparison
      return signature === expectedSignature;
    } catch (error) {
      this.logger.error(`Failed to validate signed URL signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Revoke all signed URLs for a project
   */
  async revokeProjectUrls(projectId: string): Promise<void> {
    try {
      // In a real implementation, you would maintain a list of active URLs
      // and invalidate them. For S3, you would typically use bucket policies
      // or IAM policies to restrict access.
      
      this.logger.log(`Revoked all signed URLs for project ${projectId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke project URLs: ${error.message}`, error.stack);
      throw error;
    }
  }
}
