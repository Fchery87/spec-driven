/**
 * Tests for Validation Schemas
 */

import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  CreateProjectSchema,
  ApproveStackSchema
} from './validation_schemas';

describe('RegisterSchema', () => {
  it('should validate correct registration data', () => {
    const data = {
      email: 'user@example.com',
      name: 'John Doe',
      password: 'SecurePass123!'
    };

    expect(() => RegisterSchema.parse(data)).not.toThrow();
  });

  it('should require valid email', () => {
    const data = {
      email: 'invalid-email',
      name: 'John Doe',
      password: 'SecurePass123!'
    };

    expect(() => RegisterSchema.parse(data)).toThrow();
  });

  it('should normalize email to lowercase', () => {
    const data = {
      email: 'User@EXAMPLE.COM',
      name: 'John Doe',
      password: 'SecurePass123!'
    };

    const result = RegisterSchema.parse(data);
    expect(result.email).toBe('user@example.com');
  });

  it('should trim name whitespace', () => {
    const data = {
      email: 'user@example.com',
      name: '  John Doe  ',
      password: 'SecurePass123!'
    };

    const result = RegisterSchema.parse(data);
    expect(result.name).toBe('John Doe');
  });

  it('should require name with minimum 2 characters', () => {
    const data = {
      email: 'user@example.com',
      name: 'J',
      password: 'SecurePass123!'
    };

    expect(() => RegisterSchema.parse(data)).toThrow();
  });

  it('should require password with minimum 8 characters', () => {
    const data = {
      email: 'user@example.com',
      name: 'John Doe',
      password: 'Short1!'
    };

    expect(() => RegisterSchema.parse(data)).toThrow();
  });
});

describe('LoginSchema', () => {
  it('should validate correct login data', () => {
    const data = {
      email: 'user@example.com',
      password: 'SecurePass123!'
    };

    expect(() => LoginSchema.parse(data)).not.toThrow();
  });

  it('should require valid email', () => {
    const data = {
      email: 'invalid-email',
      password: 'SecurePass123!'
    };

    expect(() => LoginSchema.parse(data)).toThrow();
  });

  it('should normalize email to lowercase', () => {
    const data = {
      email: 'User@EXAMPLE.COM',
      password: 'SecurePass123!'
    };

    const result = LoginSchema.parse(data);
    expect(result.email).toBe('user@example.com');
  });

  it('should require password', () => {
    const data = {
      email: 'user@example.com',
      password: ''
    };

    expect(() => LoginSchema.parse(data)).toThrow();
  });

  it('should accept any password length for login', () => {
    const data = {
      email: 'user@example.com',
      password: 'x'
    };

    expect(() => LoginSchema.parse(data)).not.toThrow();
  });
});

describe('CreateProjectSchema', () => {
  it('should validate correct project data', () => {
    const data = {
      name: 'My Project',
      description: 'A great project'
    };

    expect(() => CreateProjectSchema.parse(data)).not.toThrow();
  });

  it('should require name with minimum 3 characters', () => {
    const data = {
      name: 'AB',
      description: 'Too short'
    };

    expect(() => CreateProjectSchema.parse(data)).toThrow();
  });

  it('should allow optional description', () => {
    const data = {
      name: 'My Project'
    };

    expect(() => CreateProjectSchema.parse(data)).not.toThrow();
  });

  it('should trim name', () => {
    const data = {
      name: '  My Project  '
    };

    const result = CreateProjectSchema.parse(data);
    expect(result.name).toBe('My Project');
  });

  it('should validate slug format if provided', () => {
    const validSlug = {
      name: 'My Project',
      slug: 'my-project'
    };

    expect(() => CreateProjectSchema.parse(validSlug)).not.toThrow();

    const invalidSlug = {
      name: 'My Project',
      slug: 'My_Project'
    };

    expect(() => CreateProjectSchema.parse(invalidSlug)).toThrow();
  });

  it('should reject uppercase in slug', () => {
    const data = {
      name: 'My Project',
      slug: 'My-Project'
    };

    expect(() => CreateProjectSchema.parse(data)).toThrow();
  });

  it('should reject special characters in slug', () => {
    const data = {
      name: 'My Project',
      slug: 'my@project'
    };

    expect(() => CreateProjectSchema.parse(data)).toThrow();
  });

  it('should allow hyphens and numbers in slug', () => {
    const data = {
      name: 'My Project',
      slug: 'my-project-123'
    };

    expect(() => CreateProjectSchema.parse(data)).not.toThrow();
  });
});

describe('ApproveStackSchema', () => {
  it('should validate correct stack approval', () => {
    const data = {
      stack_choice: 'nextjs-fastapi-expo',
      reasoning: 'This stack meets our requirements'
    };

    expect(() => ApproveStackSchema.parse(data)).not.toThrow();
  });

  it('should require stack_choice', () => {
    const data = {
      stack_choice: '',
      reasoning: 'Some reasoning'
    };

    expect(() => ApproveStackSchema.parse(data)).toThrow();
  });

  it('should allow optional reasoning', () => {
    const data = {
      stack_choice: 'nextjs-only'
    };

    expect(() => ApproveStackSchema.parse(data)).not.toThrow();
  });

  it('should validate reasoning length if provided', () => {
    const shortReasoning = {
      stack_choice: 'nextjs',
      reasoning: 'Good'
    };

    expect(() => ApproveStackSchema.parse(shortReasoning)).toThrow();

    const validReasoning = {
      stack_choice: 'nextjs',
      reasoning: 'This is a good choice because it has strong ecosystem'
    };

    expect(() => ApproveStackSchema.parse(validReasoning)).not.toThrow();
  });
});
