import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RLSService, RLSContext } from './rls.service';

export interface RLSMetadata {
  resourceType: string;
  operation: string;
  projectIdParam?: string;
  resourceIdParam?: string;
  requireAIGenerated?: boolean;
}

export const RLS = (metadata: RLSMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rls', metadata, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class RLSGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rlsService: RLSService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rlsMetadata = this.reflector.get<RLSMetadata>('rls', context.getHandler());
    
    if (!rlsMetadata) {
      return true; // No RLS metadata, allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract project ID from request
    const projectId = this.extractProjectId(request, rlsMetadata);
    if (!projectId) {
      throw new ForbiddenException('Project ID not found in request');
    }

    // Extract resource ID if needed
    const resourceId = rlsMetadata.resourceIdParam 
      ? request.params[rlsMetadata.resourceIdParam] 
      : undefined;

    // Check RBAC permissions
    const hasPermission = await this.rlsService.checkRBAC(
      user.id,
      projectId,
      rlsMetadata.operation,
      rlsMetadata.resourceType,
    );

    if (!hasPermission) {
      throw new ForbiddenException(`Insufficient permissions for ${rlsMetadata.operation} on ${rlsMetadata.resourceType}`);
    }

    // Determine if this is an AI-generated operation
    const isAIGenerated = this.determineIfAIGenerated(request, rlsMetadata);

    // Enforce RLS
    const rlsContext: RLSContext = {
      userId: user.id,
      projectId,
      userRole: user.role || 'viewer',
      isAIGenerated,
      operation: rlsMetadata.operation,
      resourceType: rlsMetadata.resourceType,
      resourceId,
    };

    const hasAccess = await this.rlsService.enforceRLS(rlsContext);
    
    if (!hasAccess) {
      throw new ForbiddenException('Access denied by Row Level Security');
    }

    return true;
  }

  private extractProjectId(request: any, metadata: RLSMetadata): string | null {
    // Try to get project ID from various sources
    if (metadata.projectIdParam) {
      return request.params[metadata.projectIdParam] || 
             request.body[metadata.projectIdParam] || 
             request.query[metadata.projectIdParam];
    }

    // Fallback to common patterns
    return request.params.projectId || 
           request.body.projectId || 
           request.query.projectId ||
           request.headers['x-project-id'];
  }

  private determineIfAIGenerated(request: any, metadata: RLSMetadata): boolean {
    // Check if operation is explicitly marked as AI-generated
    if (metadata.requireAIGenerated) {
      return true;
    }

    // Check request headers for AI generation indicators
    const aiGeneratedHeader = request.headers['x-ai-generated'];
    if (aiGeneratedHeader === 'true') {
      return true;
    }

    // Check request body for AI generation indicators
    if (request.body && request.body.isAIGenerated === true) {
      return true;
    }

    // Check for AI-specific endpoints
    const aiEndpoints = ['/generate', '/ai/', '/auto-'];
    const url = request.url;
    if (aiEndpoints.some(endpoint => url.includes(endpoint))) {
      return true;
    }

    return false;
  }
}
