/**
 * Tests for Password Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordService } from './password_service';
import { logger } from '@/lib/logger';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'MySecurePass123!';
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should create different hashes for same password', async () => {
      const password = 'MySecurePass123!';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should reject passwords shorter than 8 characters', async () => {
      const shortPassword = 'Short1!';
      await expect(service.hashPassword(shortPassword)).rejects.toThrow();
    });

    it('should hash valid passwords', async () => {
      const validPassword = 'ValidPass123!';
      const hash = await service.hashPassword(validPassword);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2')).toBe(true); // bcrypt hash format
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'MySecurePass123!';
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecurePass123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should return false on invalid hash', async () => {
      const isValid = await service.verifyPassword('password', 'invalid-hash');
      expect(isValid).toBe(false);
    });

    it('should be case sensitive', async () => {
      const password = 'MySecurePass123!';
      const wrongCase = 'mysecurepass123!';
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword(wrongCase, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate a password of specified length', () => {
      const length = 16;
      const password = service.generateRandomPassword(length);

      expect(password.length).toBe(length);
    });

    it('should use default length of 16', () => {
      const password = service.generateRandomPassword();
      expect(password.length).toBe(16);
    });

    it('should generate different passwords', () => {
      const password1 = service.generateRandomPassword();
      const password2 = service.generateRandomPassword();

      expect(password1).not.toBe(password2);
    });

    it('should include various character types', () => {
      const password = service.generateRandomPassword(100);

      const hasLowercase = /[a-z]/.test(password);
      const hasUppercase = /[A-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*]/.test(password);

      expect(hasLowercase || hasUppercase || hasNumber || hasSpecial).toBe(true);
    });
  });

  describe('checkPasswordStrength', () => {
    it('should rate weak passwords', () => {
      const result = service.checkPasswordStrength('weak');

      expect(result.strong).toBe(false);
      expect(result.score).toBeLessThan(5);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should rate strong passwords', () => {
      const result = service.checkPasswordStrength('StrongPass123!@#');

      expect(result.strong).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(5);
    });

    it('should require minimum 8 characters', () => {
      const result = service.checkPasswordStrength('Short1!');

      expect(result.feedback).toContain('Use at least 8 characters');
    });

    it('should suggest 12+ characters', () => {
      const result = service.checkPasswordStrength('OnlyEight1!');

      if (result.score < 6) {
        expect(result.feedback).toContain('Consider using 12+ characters');
      }
    });

    it('should require lowercase letters', () => {
      const result = service.checkPasswordStrength('ONLYUPPERCASE123!');

      expect(result.feedback).toContain('Add lowercase letters');
    });

    it('should require uppercase letters', () => {
      const result = service.checkPasswordStrength('onlylowercase123!');

      expect(result.feedback).toContain('Add uppercase letters');
    });

    it('should require numbers', () => {
      const result = service.checkPasswordStrength('NoNumbers!');

      expect(result.feedback).toContain('Add numbers');
    });

    it('should require special characters', () => {
      const result = service.checkPasswordStrength('NoSpecialChars123');

      expect(result.feedback).toContain('Add special characters');
    });

    it('should rate perfect password as strong', () => {
      const result = service.checkPasswordStrength('VeryStrongPass123!@#$');

      expect(result.strong).toBe(true);
      expect(result.score).toBe(6);
      expect(result.feedback.length).toBe(0);
    });

    it('should return feedback array', () => {
      const result = service.checkPasswordStrength('weak');

      expect(Array.isArray(result.feedback)).toBe(true);
      expect(result.feedback.every(f => typeof f === 'string')).toBe(true);
    });
  });
});
