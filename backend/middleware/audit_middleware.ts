/**
 * Audit Logging Middleware
 *
 * Provides structured audit logging for sensitive operations:
 * - Authentication events (login, logout, password changes)
 * - Admin actions (user management, project deletion)
 * - Secret/API key operations
 * - Data access and modifications
 */

import { logger } from '@/lib/logger';
import { JWTPayload } from '@/backend/services/auth/jwt_service';

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_change'
  | 'auth.password_reset'
  | 'auth.token_revoked'
  | 'admin.user_create'
  | 'admin.user_delete'
  | 'admin.user_role_change'
  | 'admin.project_delete'
  | 'admin.project_suspend'
  | 'secret.api_key_create'
  | 'secret.api_key_revoke'
  | 'secret.encryption_key_access'
  | 'data.export'
  | 'data.bulk_delete'
  | 'settings.update';

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
}

export interface AuditEvent {
  type: AuditEventType;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
  resourceType?: string;
  resourceId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Create an audit event
 */
export function auditLog(
  event: Omit<AuditEvent, 'timestamp'>,
  context?: AuditContext
): void {
  const auditEvent: AuditEvent = {
    timestamp: new Date().toISOString(),
    userId: context?.userId || event.userId,
    userEmail: context?.userEmail || event.userEmail,
    userRole: context?.userRole || event.userRole,
    ip: context?.ip || event.ip,
    userAgent: context?.userAgent || event.userAgent,
    requestId: context?.requestId || event.requestId,
    correlationId: context?.correlationId || event.correlationId,
    ...event,
  };

  // Log based on severity
  if (!auditEvent.success) {
    logger.error(`[AUDIT] ${auditEvent.type}`, undefined, {
      audit: auditEvent,
    });
  } else if (auditEvent.type.startsWith('admin.') || auditEvent.type.startsWith('secret.')) {
    logger.warn(`[AUDIT] ${auditEvent.type}`, { audit: auditEvent });
  } else {
    logger.info(`[AUDIT] ${auditEvent.type}`, { audit: auditEvent });
  }
}

/**
 * Helper for authentication events
 */
export function auditAuthEvent(
  type: AuditEventType,
  success: boolean,
  context: AuditContext,
  errorMessage?: string
): void {
  auditLog(
    {
      type,
      success,
      errorMessage,
      userId: context.userId,
      userEmail: context.userEmail,
      ip: context.ip,
      userAgent: context.userAgent,
    },
    context
  );
}

/**
 * Helper for admin actions
 */
export function auditAdminAction(
  type: AuditEventType,
  success: boolean,
  context: AuditContext,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
  errorMessage?: string
): void {
  auditLog(
    {
      type,
      success,
      errorMessage,
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      ip: context.ip,
      resourceType,
      resourceId,
      metadata,
    },
    context
  );
}

/**
 * Helper for secret/API key operations
 */
export function auditSecretOperation(
  type: AuditEventType,
  success: boolean,
  context: AuditContext,
  resourceId: string,
  metadata?: Record<string, unknown>,
  errorMessage?: string
): void {
  auditLog(
    {
      type,
      success,
      errorMessage,
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      ip: context.ip,
      resourceType: 'secret',
      resourceId,
      metadata,
    },
    context
  );
}

/**
 * Helper for data operations
 */
export function auditDataOperation(
  type: AuditEventType,
  success: boolean,
  context: AuditContext,
  resourceType: string,
  resourceId?: string,
  previousValue?: unknown,
  newValue?: unknown,
  errorMessage?: string
): void {
  auditLog(
    {
      type,
      success,
      errorMessage,
      userId: context.userId,
      userEmail: context.userEmail,
      userRole: context.userRole,
      ip: context.ip,
      resourceType,
      resourceId,
      previousValue,
      newValue,
    },
    context
  );
}

/**
 * Extract audit context from request and user
 */
export function extractAuditContext(
  request: Request,
  user?: JWTPayload
): AuditContext {
  const headers = request.headers as Headers;
  
  return {
    userId: user?.userId,
    userEmail: user?.email,
    userRole: (user as JWTPayload & { role?: string })?.role,
    ip: headers.get('x-forwarded-for')?.split(',')[0].trim() || 
         headers.get('x-real-ip') || 
         'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
    requestId: headers.get('x-request-id') || undefined,
    correlationId: headers.get('x-correlation-id') || undefined,
  };
}

/**
 * Middleware wrapper for automatic audit logging
 * Usage: Wrap your handler with auditMiddleware(handler, eventType, getResourceId)
 */
export function withAuditLogging<T extends Request>(
  handler: (req: T, context: AuditContext) => Promise<Response>,
  eventType: AuditEventType,
  getResourceId?: (req: T) => string | undefined
) {
  return async (req: T): Promise<Response> => {
    const context = extractAuditContext(req);
    
    try {
      const response = await handler(req, context);
      
      // Log successful operation
      auditLog({
        type: eventType,
        success: response.ok,
        resourceId: getResourceId?.(req),
        requestId: context.requestId,
        correlationId: context.correlationId,
      }, context);
      
      return response;
    } catch (error) {
      // Log failed operation
      auditLog({
        type: eventType,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        requestId: context.requestId,
        correlationId: context.correlationId,
      }, context);
      
      throw error;
    }
  };
}

/**
 * Pre-defined audit event types with metadata schemas
 */
export const AUDIT_EVENTS = {
  LOGIN: {
    type: 'auth.login' as const,
    getContext: (success: boolean, context: AuditContext, errorMessage?: string) => ({
      type: 'auth.login' as const,
      success,
      errorMessage,
      ...context,
    }),
  },
  
  LOGOUT: {
    type: 'auth.logout' as const,
    getContext: (context: AuditContext) => ({
      type: 'auth.logout' as const,
      success: true,
      ...context,
    }),
  },
  
  PASSWORD_CHANGE: {
    type: 'auth.password_change' as const,
    getContext: (success: boolean, context: AuditContext, errorMessage?: string) => ({
      type: 'auth.password_change' as const,
      success,
      errorMessage,
      ...context,
    }),
  },
  
  API_KEY_CREATE: {
    type: 'secret.api_key_create' as const,
    getContext: (context: AuditContext, keyId: string) => ({
      type: 'secret.api_key_create' as const,
      success: true,
      resourceType: 'api_key',
      resourceId: keyId,
      ...context,
    }),
  },
  
  API_KEY_REVOKE: {
    type: 'secret.api_key_revoke' as const,
    getContext: (context: AuditContext, keyId: string) => ({
      type: 'secret.api_key_revoke' as const,
      success: true,
      resourceType: 'api_key',
      resourceId: keyId,
      ...context,
    }),
  },
  
  PROJECT_DELETE: {
    type: 'admin.project_delete' as const,
    getContext: (success: boolean, context: AuditContext, projectId: string, errorMessage?: string) => ({
      type: 'admin.project_delete' as const,
      success,
      errorMessage,
      resourceType: 'project',
      resourceId: projectId,
      ...context,
    }),
  },
} as const;
