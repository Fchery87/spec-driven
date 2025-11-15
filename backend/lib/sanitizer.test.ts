/**
 * Tests for Input Sanitizer
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  removeDangerousChars,
  sanitizeFilePath,
  sanitizeSqlInput,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeMarkdown,
  sanitizeJSON,
  containsDangerousContent
} from './sanitizer';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('should handle mixed content', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const expected = '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });
});

describe('removeDangerousChars', () => {
  it('should remove null bytes', () => {
    expect(removeDangerousChars('Hello\x00World')).toBe('HelloWorld');
  });

  it('should remove control characters', () => {
    expect(removeDangerousChars('Hello\x01\x02World')).toBe('HelloWorld');
  });

  it('should preserve normal whitespace', () => {
    const input = 'Hello\nWorld\tTest';
    expect(removeDangerousChars(input)).toBe(input);
  });
});

describe('sanitizeFilePath', () => {
  it('should prevent directory traversal', () => {
    expect(sanitizeFilePath('../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilePath('..\\windows\\system')).not.toContain('..');
  });

  it('should remove leading/trailing slashes', () => {
    expect(sanitizeFilePath('/path/to/file/')).toBe('path/to/file');
    expect(sanitizeFilePath('//double/slash')).toBe('double/slash');
  });

  it('should allow normal paths', () => {
    expect(sanitizeFilePath('folder/file.txt')).toBe('folder/file.txt');
    expect(sanitizeFilePath('spec/analysis/document.md')).toBe('spec/analysis/document.md');
  });

  it('should reject absolute paths on Windows', () => {
    expect(() => sanitizeFilePath('C:\\Windows\\System')).toThrow();
  });
});

describe('sanitizeSqlInput', () => {
  it('should escape single quotes', () => {
    expect(sanitizeSqlInput("'; DROP TABLE")).toContain("''");
  });

  it('should remove SQL comments', () => {
    expect(sanitizeSqlInput('test -- comment')).not.toContain('--');
    expect(sanitizeSqlInput('test /* comment */')).not.toContain('/*');
  });

  it('should remove statement terminators', () => {
    expect(sanitizeSqlInput('test;delete')).not.toContain(';');
  });

  it('should allow normal SQL values', () => {
    const input = 'normal@email.com';
    expect(sanitizeSqlInput(input)).toContain('normal');
    expect(sanitizeSqlInput(input)).toContain('email');
  });
});

describe('sanitizeUrl', () => {
  it('should allow valid HTTP URLs', () => {
    const url = 'https://example.com/page';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('should reject javascript: URLs', () => {
    expect(() => sanitizeUrl('javascript:alert(1)')).toThrow();
  });

  it('should reject data: URLs', () => {
    expect(() => sanitizeUrl('data:text/html,<script>alert(1)</script>')).toThrow();
  });

  it('should reject invalid protocols', () => {
    expect(() => sanitizeUrl('ftp://example.com')).toThrow();
  });
});

describe('sanitizeEmail', () => {
  it('should normalize email case', () => {
    expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('should remove special characters except @ and .', () => {
    const result = sanitizeEmail('user<>@example.com');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('should respect RFC 5321 length limit', () => {
    const longEmail = 'a'.repeat(300) + '@example.com';
    const result = sanitizeEmail(longEmail);
    expect(result.length).toBeLessThanOrEqual(254);
  });
});

describe('sanitizeMarkdown', () => {
  it('should remove script tags', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    const result = sanitizeMarkdown(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('should remove event handlers', () => {
    const input = '<img onerror="alert(1)" src="x">';
    const result = sanitizeMarkdown(input);
    expect(result).not.toContain('onerror');
  });

  it('should remove null bytes', () => {
    const input = 'Hello\x00World';
    expect(sanitizeMarkdown(input)).not.toContain('\x00');
  });

  it('should preserve markdown content', () => {
    const input = '# Title\n\n**Bold** and *italic*';
    expect(sanitizeMarkdown(input)).toContain('# Title');
    expect(sanitizeMarkdown(input)).toContain('**Bold**');
  });
});

describe('sanitizeJSON', () => {
  it('should sanitize string values', () => {
    const input = { name: 'Hello\x00World' };
    const result = sanitizeJSON(input);
    expect(result.name).not.toContain('\x00');
  });

  it('should recursively sanitize arrays', () => {
    const input = { items: ['<script>', 'normal'] };
    const result = sanitizeJSON(input);
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should skip dangerous keys', () => {
    const input = {
      __proto__: 'evil',
      constructor: 'evil',
      name: 'safe'
    };
    const result = sanitizeJSON(input);
    expect(result.__proto__).toBeUndefined();
    expect(result.constructor).toBeUndefined();
    expect(result.name).toBe('safe');
  });

  it('should handle null and undefined', () => {
    expect(sanitizeJSON(null)).toBeNull();
    expect(sanitizeJSON(undefined)).toBeUndefined();
  });

  it('should preserve primitive types', () => {
    expect(sanitizeJSON(123)).toBe(123);
    expect(sanitizeJSON(true)).toBe(true);
    expect(sanitizeJSON('string')).toBe('string');
  });
});

describe('containsDangerousContent', () => {
  it('should detect script tags', () => {
    expect(containsDangerousContent('<script>alert(1)</script>')).toBe(true);
  });

  it('should detect event handlers', () => {
    expect(containsDangerousContent('onclick="alert(1)"')).toBe(true);
    expect(containsDangerousContent('onerror="alert(1)"')).toBe(true);
  });

  it('should detect javascript: protocol', () => {
    expect(containsDangerousContent('javascript:alert(1)')).toBe(true);
  });

  it('should detect iframe tags', () => {
    expect(containsDangerousContent('<iframe src="evil.com">')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(containsDangerousContent('SCRIPT')).toBe(true);
    expect(containsDangerousContent('JavaScript:')).toBe(true);
  });

  it('should allow safe content', () => {
    expect(containsDangerousContent('This is safe text')).toBe(false);
    expect(containsDangerousContent('user@example.com')).toBe(false);
  });
});
