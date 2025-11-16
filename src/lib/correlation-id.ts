/**
 * Correlation ID utility for request tracing
 * Allows tracking related operations across services and logs
 */

import { headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Get or create a correlation ID for the current request
 * On server: reads from headers or generates new
 * On client: generates and stores in localStorage
 */
export function getCorrelationId(): string {
  // Server-side
  if (typeof window === 'undefined') {
    const headersList = headers();
    const correlationId = headersList.get(CORRELATION_ID_HEADER);
    return correlationId || uuidv4();
  }

  // Client-side: use localStorage for session persistence
  const stored = localStorage.getItem(CORRELATION_ID_HEADER);
  if (stored) return stored;

  const newId = uuidv4();
  localStorage.setItem(CORRELATION_ID_HEADER, newId);
  return newId;
}

/**
 * Get unique request ID (different for each request)
 */
export function getRequestId(): string {
  if (typeof window === 'undefined') {
    const headersList = headers();
    return headersList.get(REQUEST_ID_HEADER) || uuidv4();
  }
  return uuidv4();
}

/**
 * Middleware to inject correlation IDs into response headers
 */
export function withCorrelationId(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const correlationId = req.headers.get(CORRELATION_ID_HEADER) || uuidv4();
    const requestId = uuidv4();

    // Call handler
    const response = await handler(req);

    // Add correlation headers to response
    const newHeaders = new Headers(response.headers);
    newHeaders.set(CORRELATION_ID_HEADER, correlationId);
    newHeaders.set(REQUEST_ID_HEADER, requestId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Add correlation ID to fetch requests from client
 */
export function withCorrelationIdFetch(url: string, init?: RequestInit): RequestInit {
  const correlationId = getCorrelationId();
  return {
    ...init,
    headers: {
      ...init?.headers,
      [CORRELATION_ID_HEADER]: correlationId,
    },
  };
}
