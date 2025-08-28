import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';

export interface RLSContext {
  userId: string;
  projectId: string;
  userRole: string;
  isAIGenerated: boolean;
  operation: string;
  resourceType: string;
  resourceId?: string;
}

export interface AuditEntry {
  userId: string;
  projectId: string;
  operation: string;
  resourceType: string;
  resourceId?: string;
  isAIGenerated: boolean;
  metadata?: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class RLSService {
  private readonly logger = new Logger(RLSService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Enforce Row Level Security for data access
   */
  async enforceRLS(context: RLSContext): Promise<boolean> {
    try {
      // Check if user has access to the project
      const project = await this.projectRepository.findOne({
        where: { id: context.projectId },
        relations: ['users'],
      });

      if (!project) {
        this.logger.warn(`Project ${context.projectId} not found`);
        return false;
      }

      // Check if user is owner or has access
      const hasAccess = project.users.some(user => user.id === context.userId);
      if (!hasAccess) {
        this.logger.warn(`User ${context.userId} denied access to project ${context.projectId}`);
        return false;
      }

      // Log the access attempt
      await this.logAuditEntry({
        userId: context.userId,
        projectId: context.projectId,
        operation: context.operation,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        isAIGenerated: context.isAIGenerated,
        metadata: { userRole: context.userRole },
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      this.logger.error(`RLS enforcement failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Check RBAC permissions for specific operations
   */
  async checkRBAC(
    userId: string,
    projectId: string,
    operation: string,
    resourceType: string,
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });

      if (!user) {
        return false;
      }

      // Define RBAC rules
      const rbacRules = {
        'project:read': ['owner', 'editor', 'viewer'],
        'project:write': ['owner', 'editor'],
        'project:delete': ['owner'],
        'story:read': ['owner', 'editor', 'viewer'],
        'story:write': ['owner', 'editor'],
        'story:delete': ['owner', 'editor'],
        'quest:read': ['owner', 'editor', 'viewer'],
        'quest:write': ['owner', 'editor'],
        'quest:delete': ['owner', 'editor'],
        'dialogue:read': ['owner', 'editor', 'viewer'],
        'dialogue:write': ['owner', 'editor'],
        'dialogue:delete': ['owner', 'editor'],
        'lore:read': ['owner', 'editor', 'viewer'],
        'lore:write': ['owner', 'editor'],
        'lore:delete': ['owner', 'editor'],
        'simulation:read': ['owner', 'editor', 'viewer'],
        'simulation:write': ['owner', 'editor'],
        'simulation:delete': ['owner', 'editor'],
        'export:read': ['owner', 'editor', 'viewer'],
        'export:write': ['owner', 'editor'],
        'export:delete': ['owner'],
      };

      const operationKey = `${resourceType}:${operation}`;
      const allowedRoles = rbacRules[operationKey] || [];

      const hasPermission = user.roles.some(role => 
        allowedRoles.includes(role.name)
      );

      if (!hasPermission) {
        this.logger.warn(`User ${userId} denied ${operationKey} on project ${projectId}`);
      }

      return hasPermission;
    } catch (error) {
      this.logger.error(`RBAC check failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Log audit entry for AI vs human edits
   */
  async logAuditEntry(entry: AuditEntry): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        userId: entry.userId,
        projectId: entry.projectId,
        operation: entry.operation,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        isAIGenerated: entry.isAIGenerated,
        metadata: entry.metadata,
        timestamp: entry.timestamp,
      });

      await this.auditLogRepository.save(auditLog);

      // Log AI vs human edit statistics
      if (entry.isAIGenerated) {
        this.logger.log(`AI-generated ${entry.operation} on ${entry.resourceType} by user ${entry.userId}`);
      } else {
        this.logger.log(`Human ${entry.operation} on ${entry.resourceType} by user ${entry.userId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to log audit entry: ${error.message}`, error.stack);
    }
  }

  /**
   * Get audit trail for a project
   */
  async getAuditTrail(
    projectId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
    resourceType?: string,
  ): Promise<AuditLog[]> {
    try {
      // Verify user has access to project audit logs
      const hasAccess = await this.checkRBAC(userId, projectId, 'read', 'audit');
      if (!hasAccess) {
        throw new Error('Insufficient permissions to access audit logs');
      }

      const query = this.auditLogRepository
        .createQueryBuilder('audit')
        .where('audit.projectId = :projectId', { projectId })
        .orderBy('audit.timestamp', 'DESC');

      if (startDate) {
        query.andWhere('audit.timestamp >= :startDate', { startDate });
      }

      if (endDate) {
        query.andWhere('audit.timestamp <= :endDate', { endDate });
      }

      if (resourceType) {
        query.andWhere('audit.resourceType = :resourceType', { resourceType });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error(`Failed to get audit trail: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get AI vs human edit statistics
   */
  async getEditStatistics(projectId: string, userId: string): Promise<{
    totalEdits: number;
    aiEdits: number;
    humanEdits: number;
    aiEditPercentage: number;
    editsByResourceType: Record<string, { ai: number; human: number }>;
  }> {
    try {
      const hasAccess = await this.checkRBAC(userId, projectId, 'read', 'statistics');
      if (!hasAccess) {
        throw new Error('Insufficient permissions to access statistics');
      }

      const auditLogs = await this.auditLogRepository.find({
        where: { projectId },
        order: { timestamp: 'DESC' },
      });

      const totalEdits = auditLogs.length;
      const aiEdits = auditLogs.filter(log => log.isAIGenerated).length;
      const humanEdits = totalEdits - aiEdits;

      const editsByResourceType: Record<string, { ai: number; human: number }> = {};
      
      auditLogs.forEach(log => {
        if (!editsByResourceType[log.resourceType]) {
          editsByResourceType[log.resourceType] = { ai: 0, human: 0 };
        }
        
        if (log.isAIGenerated) {
          editsByResourceType[log.resourceType].ai++;
        } else {
          editsByResourceType[log.resourceType].human++;
        }
      });

      return {
        totalEdits,
        aiEdits,
        humanEdits,
        aiEditPercentage: totalEdits > 0 ? (aiEdits / totalEdits) * 100 : 0,
        editsByResourceType,
      };
    } catch (error) {
      this.logger.error(`Failed to get edit statistics: ${error.message}`, error.stack);
      throw error;
    }
  }
}
