/**
 * Input Sanitizer
 *
 * Sanitizes user input to prevent XSS, injection attacks, and other vulnerabilities
 * Should be used in combination with Zod validation
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Remove null bytes and other dangerous characters
 */
export function removeDangerousChars(text: string): string {
  // Remove null bytes
  let sanitized = text.replace(/\0/g, '');

  // Remove control characters (except common whitespace)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Sanitize file paths to prevent directory traversal
 */
export function sanitizeFilePath(path: string): string {
  // Remove null bytes
  let sanitized = path.replace(/\0/g, '');

  // Remove directory traversal attempts
  sanitized = sanitized.replace(/\.\.\//g, '');
  sanitized = sanitized.replace(/\.\.\\/g, '');

  // Remove leading/trailing slashes
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');

  // Ensure no absolute paths
  if (sanitized.includes(':') && sanitized.match(/^[a-zA-Z]:/)) {
    throw new Error('Absolute paths are not allowed');
  }

  return sanitized;
}

/**
 * Sanitize SQL input (basic prevention, should use parameterized queries)
 */
export function sanitizeSqlInput(input: string): string {
  let sanitized = input.replace(/'/g, "''"); // Escape single quotes
  sanitized = sanitized.replace(/"/g, '""'); // Escape double quotes
  sanitized = sanitized.replace(/--/g, ''); // Remove SQL comments
  sanitized = sanitized.replace(/;/g, ''); // Remove statement terminators
  sanitized = sanitized.replace(/\/\*/g, ''); // Remove comment starts
  sanitized = sanitized.replace(/\*\//g, ''); // Remove comment ends

  return sanitized;
}

/**
 * Sanitize URLs
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL protocol');
    }

    // Prevent javascript: and data: URLs
    if (url.toLowerCase().startsWith('javascript:')) {
      throw new Error('JavaScript URLs are not allowed');
    }

    if (url.toLowerCase().startsWith('data:')) {
      throw new Error('Data URLs are not allowed');
    }

    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[<>()[\]\\,;:\s"]/g, '') // Remove invalid characters but keep @
    .substring(0, 254); // RFC 5321
}

/**
 * Sanitize user object names (usernames, project names, etc.)
 */
export function sanitizeUserName(name: string): string {
  return name
    .trim()
    .replace(/[<>()[\]\\,;:"]/g, '') // Remove special characters
    .substring(0, 255); // Max length
}

/**
 * Sanitize markdown content
 */
export function sanitizeMarkdown(content: string): string {
  // Remove script tags and event handlers
  let sanitized = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Sanitize JSON objects recursively
 */
 
export function sanitizeJSON(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return removeDangerousChars(obj);
  }

  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeJSON(item));
    }

     
    const sanitized: Record<string, any> = Object.create(null);
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys that might be injection vectors
      if (key.includes('__proto__') || key.includes('constructor')) {
        continue;
      }
      sanitized[key] = sanitizeJSON(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate and sanitize a complete request
 */
 
export function sanitizeRequest(request: Record<string, any>): Record<string, any> {
  return sanitizeJSON(request);
}

/**
 * List of dangerous patterns to check for
 */
const DANGEROUS_PATTERNS = [
  /script/i,
  /javascript:/i,
  /on\w+=/i,
  /onerror=/i,
  /onclick=/i,
  /onload=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /eval\(/i,
  /expression\(/i
];

/**
 * Check if content contains potentially dangerous patterns
 */
export function containsDangerousContent(content: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Strict validation - reject any potentially dangerous content
 */
export function strictValidate(content: string, fieldName: string = 'content'): void {
  if (containsDangerousContent(content)) {
    throw new Error(`${fieldName} contains potentially dangerous content`);
  }

  if (content.length > 10000000) { // 10MB limit
    throw new Error(`${fieldName} exceeds maximum size of 10MB`);
  }
}
