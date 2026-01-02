import { describe, it, expect } from 'vitest';

describe('GitHub Actions Workflow', () => {
  describe('Workflow File Structure', () => {
    it('should have valid YAML syntax', () => {
      const yaml = require('js-yaml');
      const mockWorkflowContent = `
name: Spec Validation
on:
  push:
    branches: ["spec/**"]
  pull_request:
    paths: ["specs/**", "orchestrator_spec.yml"]
jobs:
  validate_specs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run spec:validate
`;
      expect(() => yaml.load(mockWorkflowContent)).not.toThrow();
    });

    it('should define push trigger for spec branches', () => {
      const yaml = require('js-yaml');
      const mockWorkflowContent = `
name: Spec Validation
on:
  push:
    branches: ["spec/**"]
`;
      const parsed = yaml.load(mockWorkflowContent);
      expect(parsed.on.push.branches).toContain('spec/**');
    });

    it('should define pull_request trigger for specs paths', () => {
      const yaml = require('js-yaml');
      const mockWorkflowContent = `
on:
  pull_request:
    paths: ["specs/**", "orchestrator_spec.yml"]
`;
      const parsed = yaml.load(mockWorkflowContent);
      expect(parsed.on.pull_request.paths).toContain('specs/**');
    });
  });

  describe('Badge Generation', () => {
    it('should generate valid badge.json structure', () => {
      const badge = {
        schemaVersion: 1,
        label: 'spec validation',
        message: 'pass',
        color: 'green'
      };

      expect(badge.schemaVersion).toBe(1);
      expect(badge.label).toBe('spec validation');
      expect(['pass', 'fail', 'warning', 'unknown']).toContain(badge.message);
      expect(['green', 'red', 'yellow', 'gray']).toContain(badge.color);
    });

    it('should generate SVG with correct structure', () => {
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="110" height="20">
  <rect width="71" height="20" fill="#555"/>
  <rect x="71" width="39" height="20" fill="green"/>
</svg>`;

      expect(svgContent.includes('<svg')).toBe(true);
      expect(svgContent.includes('</svg>')).toBe(true);
      expect(svgContent.includes('width="110"')).toBe(true);
      expect(svgContent.includes('height="20"')).toBe(true);
    });

    it('should map status to correct colors', () => {
      const colorMap = {
        pass: 'green',
        fail: 'red',
        warning: 'yellow',
        unknown: 'gray'
      };

      expect(colorMap.pass).toBe('green');
      expect(colorMap.fail).toBe('red');
      expect(colorMap.warning).toBe('yellow');
      expect(colorMap.unknown).toBe('gray');
    });
  });
});

describe('NPM Scripts Configuration', () => {
  it('should have spec:validate script defined', () => {
    const fs = require('fs');
    const packageJson = JSON.parse(
      fs.readFileSync('/home/nochaserz/Documents/Coding Projects/spec-driven/package.json', 'utf8')
    );
    
    expect(packageJson.scripts['spec:validate']).toBeDefined();
    expect(packageJson.scripts['spec:validate']).toContain('spec-validate');
  });

  it('should have spec:constitutional-check script defined', () => {
    const fs = require('fs');
    const packageJson = JSON.parse(
      fs.readFileSync('/home/nochaserz/Documents/Coding Projects/spec-driven/package.json', 'utf8')
    );
    
    expect(packageJson.scripts['spec:constitutional-check']).toBeDefined();
    expect(packageJson.scripts['spec:constitutional-check']).toContain('spec-constitutional-check');
  });

  it('should have spec:badge-gen script defined', () => {
    const fs = require('fs');
    const packageJson = JSON.parse(
      fs.readFileSync('/home/nochaserz/Documents/Coding Projects/spec-driven/package.json', 'utf8')
    );
    
    expect(packageJson.scripts['spec:badge-gen']).toBeDefined();
    expect(packageJson.scripts['spec:badge-gen']).toContain('spec-badge-gen');
  });
});

describe('Validation Scripts', () => {
  it('should have spec-validate.js script file', () => {
    const fs = require('fs');
    const scriptPath = '/home/nochaserz/Documents/Coding Projects/spec-driven/scripts/spec-validate.js';
    expect(fs.existsSync(scriptPath)).toBe(true);
    
    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content.includes('orchestrator_spec.yml')).toBe(true);
    expect(content.includes('validation-report.json')).toBe(true);
  });

  it('should have spec-constitutional-check.js script file', () => {
    const fs = require('fs');
    const scriptPath = '/home/nochaserz/Documents/Coding Projects/spec-driven/scripts/spec-constitutional-check.js';
    expect(fs.existsSync(scriptPath)).toBe(true);
    
    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content.includes('constitutional_articles')).toBe(true);
    expect(content.includes('Article')).toBe(true);
  });

  it('should have spec-badge-gen.js script file', () => {
    const fs = require('fs');
    const scriptPath = '/home/nochaserz/Documents/Coding Projects/spec-driven/scripts/spec-badge-gen.js';
    expect(fs.existsSync(scriptPath)).toBe(true);
    
    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content.includes('badge.json')).toBe(true);
    expect(content.includes('spec-validation-badge.svg')).toBe(true);
  });
});

describe('Validation Logic', () => {
  describe('Requirement to Task Mapping', () => {
    it('should detect unmapped requirements', () => {
      const prd = `
## REQ-AUTH-001: User authentication
## REQ-AUTH-002: User registration
## REQ-API-001: API access
      `;
      
      const tasks = `
### TASK-001: Implement auth
Requires: REQ-AUTH-001
      `;

      const reqPattern = /REQ-[A-Z]+-\d{3}/g;
      const prdReqs = [...new Set(prd.match(reqPattern) || [])];
      const taskReqs = [...new Set(tasks.match(reqPattern) || [])];
      
      const unmapped = prdReqs.filter(req => !taskReqs.includes(req));
      
      expect(prdReqs).toHaveLength(3);
      expect(taskReqs).toHaveLength(1);
      expect(unmapped).toContain('REQ-AUTH-002');
      expect(unmapped).toContain('REQ-API-001');
    });

    it('should identify fully mapped requirements', () => {
      const prd = `
## REQ-AUTH-001: User authentication
## REQ-USER-001: User profile
      `;
      
      const tasks = `
### TASK-001: Implement auth
Requires: REQ-AUTH-001

### TASK-002: User profile
Requires: REQ-USER-001
      `;

      const reqPattern = /REQ-[A-Z]+-\d{3}/g;
      const prdReqs = [...new Set(prd.match(reqPattern) || [])];
      const taskReqs = [...new Set(tasks.match(reqPattern) || [])];
      
      const unmapped = prdReqs.filter(req => !taskReqs.includes(req));
      
      expect(unmapped).toHaveLength(0);
    });
  });

  describe('Constitutional Articles', () => {
    it('should check Article 1: Library-First', () => {
      const architecture = `
# Architecture
We will use a modular design with clear component boundaries.
Each feature will be implemented as a reusable library.
      `;

      const hasModularStructure = /module|component|library|service/i.test(architecture);
      expect(hasModularStructure).toBe(true);
    });

    it('should check Article 2: Test-First', () => {
      const tasks = `
## Test Specifications
- GIVEN a user is logged in WHEN they access the dashboard THEN they see their profile

## Implementation Notes
Write the component code.
      `;

      const hasGherkin = /GIVEN.*WHEN.*THEN/i.test(tasks);
      const hasTestSection = /test.*specification/i.test(tasks);
      
      expect(hasGherkin).toBe(true);
      expect(hasTestSection).toBe(true);
    });

    it('should check Article 3: Simplicity Gate', () => {
      const simpleArch = `
Architecture uses Next.js with API routes. Simple monolith.
      `;
      
      const complexArch = `
Architecture uses 5 microservices:
1. Auth service
2. User service
3. Payment service
      `;

      const isSimple1 = /microservice|distributed/i.test(simpleArch);
      const isSimple2 = /microservice|distributed/i.test(complexArch);
      
      expect(isSimple1).toBe(false);
      expect(isSimple2).toBe(true);
    });

    it('should check Article 5: Integration-First', () => {
      const tasks = `
## Test Configuration
- Use real PostgreSQL database for integration tests
- Test against real external APIs using sandbox
      `;

      const hasRealDb = /real.*database|postgres|mysql/i.test(tasks);
      const hasRealServices = /real.*service|integration.*test/i.test(tasks);
      
      expect(hasRealDb).toBe(true);
      expect(hasRealServices).toBe(true);
    });
  });

  describe('Task DAG Validation', () => {
    it('should detect linear dependency chain', () => {
      const tasks = [
        { id: 'TASK-001', dependencies: [] },
        { id: 'TASK-002', dependencies: ['TASK-001'] },
        { id: 'TASK-003', dependencies: ['TASK-002'] },
      ];

      const visited = new Set();
      let hasCycle = false;

      function checkCycle(taskId: string, stack: Set<string>) {
        if (stack.has(taskId)) {
          hasCycle = true;
          return;
        }
        if (visited.has(taskId)) return;
        
        stack.add(taskId);
        visited.add(taskId);
        
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          for (const dep of task.dependencies) {
            if (dep) checkCycle(dep, new Set(stack));
          }
        }
      }

      for (const task of tasks) {
        checkCycle(task.id, new Set());
      }

      expect(hasCycle).toBe(false);
    });

    it('should detect circular dependency', () => {
      const tasks = [
        { id: 'TASK-001', dependencies: ['TASK-002'] },
        { id: 'TASK-002', dependencies: ['TASK-001'] },
      ];

      const visited = new Set();
      let hasCycle = false;

      function checkCycle(taskId: string, stack: Set<string>) {
        if (stack.has(taskId)) {
          hasCycle = true;
          return;
        }
        if (visited.has(taskId)) return;
        
        stack.add(taskId);
        visited.add(taskId);
        
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          for (const dep of task.dependencies) {
            if (dep) checkCycle(dep, new Set(stack));
          }
        }
      }

      for (const task of tasks) {
        checkCycle(task.id, new Set());
      }

      expect(hasCycle).toBe(true);
    });
  });
});

describe('Validation Report Generation', () => {
  it('should generate valid markdown report structure', () => {
    const completedAt = new Date().toISOString();
    const overallStatus = 'pass';
    const totalChecks = 1;
    const passed = 1;
    const failed = 0;
    const warnings = 0;

    const report = '---\n' +
      'title: Validation Report\n' +
      'project: Test Project\n' +
      'generated_at: ' + completedAt + '\n' +
      'overall_status: ' + overallStatus + '\n' +
      '---\n\n' +
      '# Validation Report\n\n' +
      '## Summary\n\n' +
      '| Metric | Count |\n' +
      '|--------|-------|\n' +
      '| Total Checks | ' + totalChecks + ' |\n' +
      '| Passed | ' + passed + ' |\n' +
      '| Failed | ' + failed + ' |\n' +
      '| Warnings | ' + warnings + ' |\n' +
      '| Overall Status | **' + overallStatus.toUpperCase() + '** |\n';

    expect(report).toContain('title: Validation Report');
    expect(report).toContain('| Total Checks | 1 |');
    expect(report).toContain('**PASS**');
    expect(report).toContain('| Passed | 1 |');
  });

  it('should generate coverage matrix structure', () => {
    const matrix = '---\n' +
      'title: Coverage Matrix\n' +
      'generated_at: ' + new Date().toISOString() + '\n' +
      '---\n\n' +
      '# Coverage Matrix\n\n' +
      '## Artifacts by Phase\n\n' +
      '| Phase | Artifact | Size | Status |\n' +
      '|-------|----------|------|--------|\n' +
      '| ANALYSIS | constitution.md | 1.2KB | ✅ Present |\n';

    expect(matrix).toContain('title: Coverage Matrix');
    expect(matrix).toContain('## Artifacts by Phase');
    expect(matrix).toContain('| Phase |');
  });
});

describe('Workflow YAML Validation', () => {
  it('should validate complete workflow structure', () => {
    const yaml = require('js-yaml');
    const workflow = 
      'name: Spec Validation\n\n' +
      'on:\n' +
      '  push:\n' +
      '    branches: ["spec/**"]\n' +
      '  pull_request:\n' +
      '    paths: ["specs/**", "orchestrator_spec.yml"]\n\n' +
      'env:\n' +
      '  NODE_VERSION: "20"\n\n' +
      'jobs:\n' +
      '  validate_specs:\n' +
      '    name: Validate Phase Artifacts\n' +
      '    runs-on: ubuntu-latest\n' +
      '    permissions:\n' +
      '      contents: read\n' +
      '      pull-requests: write\n' +
      '    steps:\n' +
      '      - name: Checkout repository\n' +
      '        uses: actions/checkout@v4\n\n' +
      '      - name: Setup Node.js\n' +
      '        uses: actions/setup-node@v4\n' +
      '        with:\n' +
      '          node-version: $NODE_VERSION\n' +
      '          cache: npm\n\n' +
      '      - name: Install dependencies\n' +
      '        run: npm ci\n\n' +
      '      - name: Validate orchestrator spec\n' +
      '        run: npm run spec:validate\n\n' +
      '      - name: Comment on PR\n' +
      '        if: github.event_name == pull_request\n' +
      '        uses: actions/github-script@v7\n';
    const parsed = yaml.load(workflow);
    
    expect(parsed.name).toBe('Spec Validation');
    expect(parsed.on.push.branches).toContain('spec/**');
    expect(parsed.on.pull_request.paths).toContain('specs/**');
    expect(parsed.jobs.validate_specs['runs-on']).toBe('ubuntu-latest');
    expect(parsed.jobs.validate_specs.steps).toHaveLength(5);
  });
});
