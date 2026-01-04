import { describe, it, expect } from 'vitest';
import { ProjectType, PROJECT_TYPE_CONFIG, getRequiredLayerCount } from './composition';

describe('ProjectType Configuration', () => {
  it('should define all project types', () => {
    expect(ProjectType.WEB_APP).toBe('web_app');
    expect(ProjectType.MOBILE_APP).toBe('mobile_app');
    expect(ProjectType.BOTH).toBe('both');
    expect(ProjectType.API_ONLY).toBe('api_only');
  });

  it('should return correct required layer count for web_app', () => {
    expect(getRequiredLayerCount(ProjectType.WEB_APP)).toBe(4);
  });

  it('should return correct required layer count for mobile_app', () => {
    expect(getRequiredLayerCount(ProjectType.MOBILE_APP)).toBe(4);
  });

  it('should return correct required layer count for both', () => {
    expect(getRequiredLayerCount(ProjectType.BOTH)).toBe(5);
  });

  it('should return correct required layer count for api_only', () => {
    expect(getRequiredLayerCount(ProjectType.API_ONLY)).toBe(3);
  });
});
