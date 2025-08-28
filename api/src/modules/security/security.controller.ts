import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RLSService } from '../auth/rls.service';
import { SignedUrlsService } from './signed-urls.service';
import { DataExportService, DataExportRequest, DataDeletionRequest } from './data-export.service';
import { RLSGuard, RLS } from '../auth/rls.guard';

export class GenerateUploadUrlDto {
  fileName: string;
  contentType?: string;
  expiresIn?: number;
  metadata?: Record<string, string>;
}

export class GenerateDownloadUrlDto {
  fileKey: string;
  expiresIn?: number;
}

export class ExportProjectDataDto {
  format: 'json' | 'csv' | 'xml';
  includeAuditLogs: boolean;
  includeDeleted: boolean;
  encryptionKey?: string;
}

export class DeleteProjectDataDto {
  softDelete: boolean;
  deleteAuditLogs: boolean;
  deleteExports: boolean;
}

@ApiTags('Security')
@Controller('security')
@UseGuards(RLSGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(
    private rlsService: RLSService,
    private signedUrlsService: SignedUrlsService,
    private dataExportService: DataExportService,
  ) {}

  @Post('projects/:projectId/upload-url')
  @RLS({ resourceType: 'project', operation: 'write', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Generate signed URL for file upload' })
  @ApiResponse({ status: 200, description: 'Upload URL generated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateUploadUrl(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateUploadUrlDto,
    @Request() req: any,
  ) {
    const result = await this.signedUrlsService.generateUploadUrl(
      projectId,
      dto.fileName,
      {
        expiresIn: dto.expiresIn,
        contentType: dto.contentType,
        metadata: dto.metadata,
      },
    );

    // Log audit entry
    await this.rlsService.logAuditEntry({
      userId: req.user.id,
      projectId,
      operation: 'generate_upload_url',
      resourceType: 'file',
      isAIGenerated: false,
      metadata: { fileName: dto.fileName },
      timestamp: new Date(),
    });

    return result;
  }

  @Post('projects/:projectId/download-url')
  @RLS({ resourceType: 'project', operation: 'read', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Generate signed URL for file download' })
  @ApiResponse({ status: 200, description: 'Download URL generated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateDownloadUrl(
    @Param('projectId') projectId: string,
    @Body() dto: GenerateDownloadUrlDto,
    @Request() req: any,
  ) {
    const result = await this.signedUrlsService.generateDownloadUrl(
      projectId,
      dto.fileKey,
      { expiresIn: dto.expiresIn },
    );

    // Log audit entry
    await this.rlsService.logAuditEntry({
      userId: req.user.id,
      projectId,
      operation: 'generate_download_url',
      resourceType: 'file',
      isAIGenerated: false,
      metadata: { fileKey: dto.fileKey },
      timestamp: new Date(),
    });

    return result;
  }

  @Post('projects/:projectId/encryption-key')
  @RLS({ resourceType: 'project', operation: 'write', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Generate per-project encryption key' })
  @ApiResponse({ status: 200, description: 'Encryption key generated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateEncryptionKey(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    const result = await this.signedUrlsService.generateProjectEncryptionKey(projectId);

    // Log audit entry
    await this.rlsService.logAuditEntry({
      userId: req.user.id,
      projectId,
      operation: 'generate_encryption_key',
      resourceType: 'encryption',
      isAIGenerated: false,
      metadata: { keyId: result.keyId },
      timestamp: new Date(),
    });

    return result;
  }

  @Post('projects/:projectId/export')
  @RLS({ resourceType: 'export', operation: 'write', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Export project data' })
  @ApiResponse({ status: 200, description: 'Project data exported successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async exportProjectData(
    @Param('projectId') projectId: string,
    @Body() dto: ExportProjectDataDto,
    @Request() req: any,
  ) {
    const request: DataExportRequest = {
      userId: req.user.id,
      projectId,
      format: dto.format,
      includeAuditLogs: dto.includeAuditLogs,
      includeDeleted: dto.includeDeleted,
      encryptionKey: dto.encryptionKey,
    };

    return await this.dataExportService.exportProjectData(request);
  }

  @Delete('projects/:projectId/data')
  @RLS({ resourceType: 'project', operation: 'delete', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Delete project data' })
  @ApiResponse({ status: 200, description: 'Project data deleted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteProjectData(
    @Param('projectId') projectId: string,
    @Body() dto: DeleteProjectDataDto,
    @Request() req: any,
  ) {
    const request: DataDeletionRequest = {
      userId: req.user.id,
      projectId,
      softDelete: dto.softDelete,
      deleteAuditLogs: dto.deleteAuditLogs,
      deleteExports: dto.deleteExports,
    };

    return await this.dataExportService.deleteProjectData(request);
  }

  @Get('projects/:projectId/audit-trail')
  @RLS({ resourceType: 'audit', operation: 'read', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Get project audit trail' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getAuditTrail(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('resourceType') resourceType?: string,
    @Request() req: any,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return await this.rlsService.getAuditTrail(
      projectId,
      req.user.id,
      start,
      end,
      resourceType,
    );
  }

  @Get('projects/:projectId/edit-statistics')
  @RLS({ resourceType: 'statistics', operation: 'read', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Get AI vs human edit statistics' })
  @ApiResponse({ status: 200, description: 'Edit statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getEditStatistics(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return await this.rlsService.getEditStatistics(projectId, req.user.id);
  }

  @Post('projects/:projectId/revoke-urls')
  @RLS({ resourceType: 'project', operation: 'write', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Revoke all signed URLs for project' })
  @ApiResponse({ status: 200, description: 'URLs revoked successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async revokeProjectUrls(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    await this.signedUrlsService.revokeProjectUrls(projectId);

    // Log audit entry
    await this.rlsService.logAuditEntry({
      userId: req.user.id,
      projectId,
      operation: 'revoke_urls',
      resourceType: 'file',
      isAIGenerated: false,
      timestamp: new Date(),
    });

    return { message: 'All signed URLs for project have been revoked' };
  }

  @Post('projects/:projectId/encrypt-data')
  @RLS({ resourceType: 'project', operation: 'write', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Encrypt project data' })
  @ApiResponse({ status: 200, description: 'Data encrypted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async encryptProjectData(
    @Param('projectId') projectId: string,
    @Body() body: { data: string; encryptionKey: any },
    @Request() req: any,
  ) {
    const encrypted = await this.signedUrlsService.encryptProjectData(
      projectId,
      Buffer.from(body.data, 'utf8'),
      body.encryptionKey,
    );

    // Log audit entry
    await this.rlsService.logAuditEntry({
      userId: req.user.id,
      projectId,
      operation: 'encrypt_data',
      resourceType: 'data',
      isAIGenerated: false,
      metadata: { dataSize: body.data.length },
      timestamp: new Date(),
    });

    return encrypted;
  }

  @Post('projects/:projectId/decrypt-data')
  @RLS({ resourceType: 'project', operation: 'read', projectIdParam: 'projectId' })
  @ApiOperation({ summary: 'Decrypt project data' })
  @ApiResponse({ status: 200, description: 'Data decrypted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async decryptProjectData(
    @Param('projectId') projectId: string,
    @Body() body: { encryptedData: string; iv: string; tag: string; encryptionKey: any },
    @Request() req: any,
  ) {
    const decrypted = await this.signedUrlsService.decryptProjectData(
      projectId,
      body.encryptedData,
      body.iv,
      body.tag,
      body.encryptionKey,
    );

    // Log audit entry
    await this.rlsService.logAuditEntry({
      userId: req.user.id,
      projectId,
      operation: 'decrypt_data',
      resourceType: 'data',
      isAIGenerated: false,
      metadata: { dataSize: decrypted.length },
      timestamp: new Date(),
    });

    return { data: decrypted.toString('utf8') };
  }
}
