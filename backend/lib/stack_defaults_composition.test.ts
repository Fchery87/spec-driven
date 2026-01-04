import { describe, it, expect } from 'vitest';
import { deriveIntelligentDefaultStack, parseProjectClassification, deriveCompositionFromClassification } from './stack_defaults';

describe('Stack Defaults - Composition Integration', () => {
  it('should derive composition from project classification', () => {
    const classification = parseProjectClassification('{"project_type":"web_app"}');
    const result = deriveIntelligentDefaultStack(classification, 'A simple web app');
    
    expect(result.stack).toBe('nextjs_web_app');
    expect(result.reason).toBe('project_type=web_app');
  });

  it('should return legacy template ID for backward compatibility', () => {
    const classification = parseProjectClassification('{"project_type":"fullstack_with_mobile"}');
    const result = deriveIntelligentDefaultStack(classification, 'A mobile app with web');
    
    expect(result.stack).toBe('nextjs_fullstack_expo');
  });

  it('should handle null classification', () => {
    const result = deriveIntelligentDefaultStack(null, 'Build a website');
    
    expect(result.stack).toBeDefined();
    expect(typeof result.stack).toBe('string');
  });

  describe('deriveCompositionFromClassification', () => {
    it('should return composition for web_app project type', () => {
      const classification = parseProjectClassification('{"project_type":"web_app"}');
      const result = deriveCompositionFromClassification(classification, 'A simple web app');
      
      expect(result).toBeDefined();
      expect(result?.base).toBe('nextjs_app_router');
      expect(result?.mobile).toBe('none');
    });

    it('should return composition for fullstack_with_mobile project type', () => {
      const classification = parseProjectClassification('{"project_type":"fullstack_with_mobile"}');
      const result = deriveCompositionFromClassification(classification, 'A mobile app with web');
      
      expect(result).toBeDefined();
      expect(result?.mobile).toBe('expo_integration');
    });

    it('should return null for unknown project type', () => {
      const classification = parseProjectClassification('{"project_type":"unknown_type"}');
      const result = deriveCompositionFromClassification(classification, 'Something random');
      
      expect(result).toBeNull();
    });

    it('should handle null classification', () => {
      const result = deriveCompositionFromClassification(null, 'Build a website');
      
      expect(result).toBeNull();
    });
  });
});
