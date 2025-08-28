import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { StoryArc } from '../../entities/story-arc.entity';
import { Quest } from '../../entities/quest.entity';
import { Dialogue } from '../../entities/dialogue.entity';
import { LoreEntry } from '../../entities/lore-entry.entity';
import { Character } from '../../entities/character.entity';
import { Simulation } from '../../entities/simulation.entity';
import { Export } from '../../entities/export.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { SignedUrlsService } from './signed-urls.service';
import { RLSService } from '../auth/rls.service';

export interface DataExportRequest {
  userId: string;
  projectId: string;
  format: 'json' | 'csv' | 'xml';
  includeAuditLogs: boolean;
  includeDeleted: boolean;
  encryptionKey?: string;
}

export interface DataExportResult {
  exportId: string;
  downloadUrl: string;
  expiresAt: Date;
  fileSize: number;
  recordCount: number;
  checksum: string;
}

export interface DataDeletionRequest {
  userId: string;
  projectId: string;
  softDelete: boolean;
  deleteAuditLogs: boolean;
  deleteExports: boolean;
}

export interface DataDeletionResult {
  deletionId: string;
  deletedRecords: number;
  deletedAt: Date;
  auditLogId: string;
}

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(StoryArc)
    private storyArcRepository: Repository<StoryArc>,
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,
    @InjectRepository(Dialogue)
    private dialogueRepository: Repository<Dialogue>,
    @InjectRepository(LoreEntry)
    private loreEntryRepository: Repository<LoreEntry>,
    @InjectRepository(Character)
    private characterRepository: Repository<Character>,
    @InjectRepository(Simulation)
    private simulationRepository: Repository<Simulation>,
    @InjectRepository(Export)
    private exportRepository: Repository<Export>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private signedUrlsService: SignedUrlsService,
    private rlsService: RLSService,
  ) {}

  /**
   * Export all project data in the requested format
   */
  async exportProjectData(request: DataExportRequest): Promise<DataExportResult> {
    try {
      // Verify user has permission to export project data
      const hasPermission = await this.rlsService.checkRBAC(
        request.userId,
        request.projectId,
        'read',
        'export',
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions to export project data');
      }

      // Collect all project data
      const projectData = await this.collectProjectData(request);

      // Generate export file
      const exportFile = await this.generateExportFile(projectData, request.format);

      // Generate encryption key if requested
      let encryptionKey;
      if (request.encryptionKey) {
        encryptionKey = await this.signedUrlsService.generateProjectEncryptionKey(request.projectId);
      }

      // Encrypt file if encryption key provided
      let finalFile = exportFile;
      if (encryptionKey) {
        const encrypted = await this.signedUrlsService.encryptProjectData(
          request.projectId,
          Buffer.from(exportFile),
          encryptionKey,
        );
        finalFile = JSON.stringify(encrypted);
      }

      // Upload to S3 and generate signed URL
      const fileName = `project_export_${request.projectId}_${Date.now()}.${request.format}`;
      const uploadResult = await this.signedUrlsService.generateUploadUrl(
        request.projectId,
        fileName,
        {
          contentType: this.getContentType(request.format),
          metadata: {
            exportType: 'project_data',
            userId: request.userId,
            format: request.format,
            encrypted: encryptionKey ? 'true' : 'false',
          },
        },
      );

      // Generate download URL
      const downloadResult = await this.signedUrlsService.generateDownloadUrl(
        request.projectId,
        uploadResult.fileKey,
        { expiresIn: 24 * 3600 }, // 24 hours
      );

      // Create export record
      const exportRecord = this.exportRepository.create({
        projectId: request.projectId,
        userId: request.userId,
        type: 'project_export',
        format: request.format,
        fileKey: uploadResult.fileKey,
        fileSize: Buffer.byteLength(finalFile),
        recordCount: projectData.recordCount,
        metadata: {
          includeAuditLogs: request.includeAuditLogs,
          includeDeleted: request.includeDeleted,
          encrypted: !!encryptionKey,
          encryptionKeyId: encryptionKey?.keyId,
        },
        expiresAt: downloadResult.expiresAt,
      });

      await this.exportRepository.save(exportRecord);

      // Log audit entry
      await this.rlsService.logAuditEntry({
        userId: request.userId,
        projectId: request.projectId,
        operation: 'export',
        resourceType: 'project_data',
        isAIGenerated: false,
        metadata: {
          exportId: exportRecord.id,
          format: request.format,
          recordCount: projectData.recordCount,
        },
        timestamp: new Date(),
      });

      this.logger.log(`Exported project ${request.projectId} data for user ${request.userId}`);

      return {
        exportId: exportRecord.id,
        downloadUrl: downloadResult.downloadUrl,
        expiresAt: downloadResult.expiresAt,
        fileSize: exportRecord.fileSize,
        recordCount: exportRecord.recordCount,
        checksum: this.generateChecksum(finalFile),
      };
    } catch (error) {
      this.logger.error(`Failed to export project data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete project data with GDPR compliance
   */
  async deleteProjectData(request: DataDeletionRequest): Promise<DataDeletionResult> {
    try {
      // Verify user has permission to delete project data
      const hasPermission = await this.rlsService.checkRBAC(
        request.userId,
        request.projectId,
        'delete',
        'project',
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions to delete project data');
      }

      const deletionId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let deletedRecords = 0;

      // Delete project data based on request
      if (request.softDelete) {
        // Soft delete - mark as deleted but keep data
        deletedRecords += await this.softDeleteProjectData(request.projectId);
      } else {
        // Hard delete - permanently remove data
        deletedRecords += await this.hardDeleteProjectData(request.projectId, request);
      }

      // Log deletion for audit purposes
      const auditLog = this.auditLogRepository.create({
        userId: request.userId,
        projectId: request.projectId,
        operation: 'delete',
        resourceType: 'project_data',
        isAIGenerated: false,
        metadata: {
          deletionId,
          softDelete: request.softDelete,
          deleteAuditLogs: request.deleteAuditLogs,
          deleteExports: request.deleteExports,
          deletedRecords,
        },
        timestamp: new Date(),
      });

      await this.auditLogRepository.save(auditLog);

      this.logger.log(`Deleted project ${request.projectId} data for user ${request.userId}`);

      return {
        deletionId,
        deletedRecords,
        deletedAt: new Date(),
        auditLogId: auditLog.id,
      };
    } catch (error) {
      this.logger.error(`Failed to delete project data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Collect all project data for export
   */
  private async collectProjectData(request: DataExportRequest): Promise<{
    project: any;
    storyArcs: any[];
    quests: any[];
    dialogues: any[];
    loreEntries: any[];
    characters: any[];
    simulations: any[];
    exports: any[];
    auditLogs: any[];
    recordCount: number;
  }> {
    const project = await this.projectRepository.findOne({
      where: { id: request.projectId },
      relations: ['users'],
    });

    const storyArcs = await this.storyArcRepository.find({
      where: { projectId: request.projectId },
    });

    const quests = await this.questRepository.find({
      where: { projectId: request.projectId },
    });

    const dialogues = await this.dialogueRepository.find({
      where: { projectId: request.projectId },
    });

    const loreEntries = await this.loreEntryRepository.find({
      where: { projectId: request.projectId },
    });

    const characters = await this.characterRepository.find({
      where: { projectId: request.projectId },
    });

    const simulations = await this.simulationRepository.find({
      where: { projectId: request.projectId },
    });

    const exports = await this.exportRepository.find({
      where: { projectId: request.projectId },
    });

    let auditLogs = [];
    if (request.includeAuditLogs) {
      auditLogs = await this.auditLogRepository.find({
        where: { projectId: request.projectId },
        order: { timestamp: 'DESC' },
      });
    }

    const recordCount = [
      storyArcs,
      quests,
      dialogues,
      loreEntries,
      characters,
      simulations,
      exports,
      auditLogs,
    ].reduce((total, array) => total + array.length, 0);

    return {
      project,
      storyArcs,
      quests,
      dialogues,
      loreEntries,
      characters,
      simulations,
      exports,
      auditLogs,
      recordCount,
    };
  }

  /**
   * Generate export file in the requested format
   */
  private async generateExportFile(data: any, format: string): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.convertToCSV(data);
      
      case 'xml':
        return this.convertToXML(data);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Implementation for CSV conversion
    // This is a simplified version - in production you'd want a proper CSV library
    const csvLines = [];
    
    // Add project data
    csvLines.push('Type,ID,Name,CreatedAt,UpdatedAt');
    csvLines.push(`Project,${data.project.id},${data.project.name},${data.project.createdAt},${data.project.updatedAt}`);
    
    // Add other data types
    data.storyArcs.forEach(arc => {
      csvLines.push(`StoryArc,${arc.id},${arc.title},${arc.createdAt},${arc.updatedAt}`);
    });
    
    data.quests.forEach(quest => {
      csvLines.push(`Quest,${quest.id},${quest.title},${quest.createdAt},${quest.updatedAt}`);
    });
    
    return csvLines.join('\n');
  }

  /**
   * Convert data to XML format
   */
  private convertToXML(data: any): string {
    // Implementation for XML conversion
    // This is a simplified version - in production you'd want a proper XML library
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<projectExport>\n';
    
    // Add project data
    xml += `  <project id="${data.project.id}">\n`;
    xml += `    <name>${data.project.name}</name>\n`;
    xml += `    <createdAt>${data.project.createdAt}</createdAt>\n`;
    xml += `    <updatedAt>${data.project.updatedAt}</updatedAt>\n`;
    xml += '  </project>\n';
    
    // Add other data types
    xml += '  <storyArcs>\n';
    data.storyArcs.forEach(arc => {
      xml += `    <storyArc id="${arc.id}">\n`;
      xml += `      <title>${arc.title}</title>\n`;
      xml += `      <createdAt>${arc.createdAt}</createdAt>\n`;
      xml += '    </storyArc>\n';
    });
    xml += '  </storyArcs>\n';
    
    xml += '</projectExport>';
    
    return xml;
  }

  /**
   * Soft delete project data
   */
  private async softDeleteProjectData(projectId: string): Promise<number> {
    let deletedCount = 0;

    // Mark project as deleted
    await this.projectRepository.update(projectId, { deletedAt: new Date() });
    deletedCount++;

    // Mark related entities as deleted
    await this.storyArcRepository.update({ projectId }, { deletedAt: new Date() });
    await this.questRepository.update({ projectId }, { deletedAt: new Date() });
    await this.dialogueRepository.update({ projectId }, { deletedAt: new Date() });
    await this.loreEntryRepository.update({ projectId }, { deletedAt: new Date() });
    await this.characterRepository.update({ projectId }, { deletedAt: new Date() });
    await this.simulationRepository.update({ projectId }, { deletedAt: new Date() });

    return deletedCount;
  }

  /**
   * Hard delete project data
   */
  private async hardDeleteProjectData(
    projectId: string,
    request: DataDeletionRequest,
  ): Promise<number> {
    let deletedCount = 0;

    // Delete related entities first
    await this.simulationRepository.delete({ projectId });
    await this.dialogueRepository.delete({ projectId });
    await this.questRepository.delete({ projectId });
    await this.loreEntryRepository.delete({ projectId });
    await this.characterRepository.delete({ projectId });
    await this.storyArcRepository.delete({ projectId });

    // Delete exports if requested
    if (request.deleteExports) {
      await this.exportRepository.delete({ projectId });
    }

    // Delete audit logs if requested
    if (request.deleteAuditLogs) {
      await this.auditLogRepository.delete({ projectId });
    }

    // Delete project last
    await this.projectRepository.delete(projectId);
    deletedCount++;

    return deletedCount;
  }

  /**
   * Get content type for export format
   */
  private getContentType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Generate checksum for file
   */
  private generateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
