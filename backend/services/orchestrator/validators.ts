import { Validator, ValidationResult, Project } from '@/types/orchestrator';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

export class Validators {
  private validators: Record<string, Validator>;
  private projectsBasePath: string;

  constructor(validators: Record<string, Validator>) {
    this.validators = validators;
    this.projectsBasePath = resolve(process.cwd(), 'projects');
  }

  /**
   * Run multiple validators for a phase
   */
  async runValidators(validatorNames: string[], project: Project): Promise<ValidationResult> {
    const results: ValidationResult = {
      status: 'pass',
      checks: {},
      errors: [],
      warnings: []
    };

    for (const validatorName of validatorNames) {
      const validator = this.validators[validatorName];
      if (!validator) {
        results.errors?.push(`Unknown validator: ${validatorName}`);
        continue;
      }

      try {
        const result = await this.runValidator(validatorName, validator, project);
        results.checks[validatorName] = result.checks || {};
        
        if (result.status === 'fail') {
          results.status = 'fail';
          results.errors?.push(...(result.errors || []));
        } else if (result.status === 'warn' && results.status === 'pass') {
          results.status = 'warn';
        }
        
        results.warnings?.push(...(result.warnings || []));
      } catch (error) {
        results.status = 'fail';
        results.errors?.push(`Validator ${validatorName} failed: ${error}`);
      }
    }

    return results;
  }

  /**
   * Run a single validator
   */
  private async runValidator(
    name: string, 
    validator: Validator, 
    project: Project
  ): Promise<ValidationResult> {
    switch (validator.implementation) {
      case 'file_exists_check':
        return this.validateFilePresence(project);
      
      case 'frontmatter_parser':
        return this.validateFrontmatter(project);
      
      case 'content_length_check':
        return this.validateContentLength(project, validator.min_length || 100);
      
      case 'coverage_analysis':
        return this.validateCoverage(project, validator.requirements || {});
      
      case 'openapi_validator':
        return this.validateOpenAPI(project);
      
      case 'database_field_check':
        return this.validateDatabaseField(project, validator.field, validator.expected_value);
      
      case 'script_execution':
        return this.validateScripts(project, validator.scripts || []);
      
      case 'dependency_graph_analysis':
        return this.validateTaskDependencies(project);
      
      case 'handoff_validator':
        return this.validateHandoff(project, validator.required_sections || []);
      
      case 'zip_validation':
        return this.validateZip(project, validator.required_files || []);
      
      default:
        return {
          status: 'warn',
          checks: {},
          warnings: [`Unknown validator implementation: ${validator.implementation}`]
        };
    }
  }

  /**
   * Validate if required files exist
   */
  private validateFilePresence(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // Get current phase and check required outputs
    const projectPath = project.project_path;
    const phasePath = `${projectPath}/specs/${project.current_phase}/v1`;
    
    const requiredFiles = this.getRequiredFilesForPhase(project.current_phase);
    
    for (const file of requiredFiles) {
      const filePath = resolve(phasePath, file);
      const exists = existsSync(filePath);
      checks[file] = exists;
      
      if (!exists) {
        errors.push(`Required file missing: ${file}`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate markdown frontmatter
   */
  private validateFrontmatter(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    const requiredFields = ['title', 'owner', 'version', 'date', 'status'];
    const markdownFiles = this.getMarkdownFilesForPhase(project.current_phase);

    for (const file of markdownFiles) {
      const content = this.getArtifactContent(project.id, file);
      const frontmatter = this.extractFrontmatter(content);
      
      checks[file] = true;
      
      for (const field of requiredFields) {
        if (!frontmatter || !frontmatter[field]) {
          errors.push(`${file} missing frontmatter field: ${field}`);
          checks[file] = false;
        }
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate content length
   */
  private validateContentLength(project: Project, minLength: number): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const files = this.getMarkdownFilesForPhase(project.current_phase);
    
    for (const file of files) {
      const content = this.getArtifactContent(project.id, file);
      const length = content.replace(/\s/g, '').length;
      
      checks[file] = length >= minLength;
      
      if (length < minLength) {
        errors.push(`${file} content too short: ${length} chars (min ${minLength})`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate content coverage
   */
  private validateCoverage(project: Project, requirements: Record<string, string>): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    for (const [file, requirement] of Object.entries(requirements)) {
      checks[file] = true;
      
      switch (requirement) {
        case 'at_least_5_requirements':
          const prdContent = this.getArtifactContent(project.id, 'PRD.md');
          const reqMatches = prdContent.match(/REQ-\w+-\d+/g) || [];
          if (reqMatches.length < 5) {
            errors.push(`${file} has only ${reqMatches.length} requirements (min 5)`);
            checks[file] = false;
          }
          break;
          
        case 'has_tables':
          const dataModelContent = this.getArtifactContent(project.id, 'data-model.md');
          if (!dataModelContent.includes('CREATE TABLE') && !dataModelContent.includes('```sql')) {
            errors.push(`${file} missing table definitions`);
            checks[file] = false;
          }
          break;
          
        case 'has_endpoints':
          const apiSpec = this.getArtifactContent(project.id, 'api-spec.json');
          try {
            const spec = JSON.parse(apiSpec);
            const endpoints = Object.keys(spec.paths || {});
            if (endpoints.length === 0) {
              errors.push(`${file} has no endpoints defined`);
              checks[file] = false;
            }
          } catch {
            errors.push(`${file} is not valid JSON`);
            checks[file] = false;
          }
          break;
          
        case 'at_least_10_tasks':
          const tasksContent = this.getArtifactContent(project.id, 'tasks.md');
          const taskMatches = tasksContent.match(/## Task \d+\.\d+/g) || [];
          if (taskMatches.length < 10) {
            errors.push(`${file} has only ${taskMatches.length} tasks (min 10)`);
            checks[file] = false;
          }
          break;
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate OpenAPI specification
   */
  private validateOpenAPI(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    try {
      const apiSpec = JSON.parse(this.getArtifactContent(project.id, 'api-spec.json'));
      
      checks['has_openapi_version'] = !!(apiSpec.openapi && apiSpec.openapi.startsWith('3.'));
      checks['has_info'] = !!apiSpec.info;
      checks['has_paths'] = !!(apiSpec.paths && Object.keys(apiSpec.paths).length > 0);
      
      if (!checks['has_openapi_version']) {
        errors.push('Missing or invalid OpenAPI version');
      }
      if (!checks['has_info']) {
        errors.push('Missing API info section');
      }
      if (!checks['has_paths']) {
        errors.push('No API paths defined');
      }
    } catch (error) {
      errors.push(`Invalid JSON in api-spec.json: ${error}`);
      checks['valid_json'] = false;
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate database field
   */
  private validateDatabaseField(
    project: Project, 
    field: string, 
    expectedValue: any
  ): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const actualValue = (project as any)[field];
    checks[field] = actualValue === expectedValue;

    if (actualValue !== expectedValue) {
      errors.push(`${field} is ${actualValue} (expected ${expectedValue})`);
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate scripts (npm audit, pip-audit, etc.)
   */
  private validateScripts(project: Project, scripts: string[]): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const script of scripts) {
      if (script === 'npm_audit') {
        const npmResult = this.runNpmAudit(project.id);
        checks['npm_audit'] = npmResult.passed;

        if (!npmResult.passed) {
          errors.push(`npm audit found vulnerabilities: ${npmResult.message}`);
        }
        if (npmResult.warnings) {
          warnings.push(...npmResult.warnings);
        }
      } else if (script === 'pip_audit') {
        const pipResult = this.runPipAudit(project.id);
        checks['pip_audit'] = pipResult.passed;

        if (!pipResult.passed) {
          errors.push(`pip-audit found vulnerabilities: ${pipResult.message}`);
        }
        if (pipResult.warnings) {
          warnings.push(...pipResult.warnings);
        }
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : (warnings.length > 0 ? 'warn' : 'pass'),
      checks,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Run npm audit and check for HIGH/CRITICAL vulnerabilities
   */
  private runNpmAudit(projectId: string): { passed: boolean; message: string; warnings?: string[] } {
    try {
      const projectPath = resolve(this.projectsBasePath, projectId);

      // Check if package.json exists
      if (!existsSync(resolve(projectPath, 'package.json'))) {
        return {
          passed: true,
          message: 'No package.json found - npm audit skipped',
          warnings: ['npm audit skipped: no package.json']
        };
      }

      // Run npm audit with JSON output
      let auditOutput: string;
      try {
        auditOutput = execSync('npm audit --json', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (error: any) {
        // npm audit exits with non-zero code when vulnerabilities are found
        // The output is still in error.stdout
        auditOutput = error.stdout || '';
      }

      // Parse audit results
      try {
        const auditData = JSON.parse(auditOutput);

        // Check for metadata
        const metadata = auditData.metadata || {};
        const vulnerabilities = auditData.vulnerabilities || {};

        // Count HIGH and CRITICAL vulnerabilities
        let criticalCount = 0;
        let highCount = 0;
        const vulnerablePackages: string[] = [];

        for (const [pkgName, vulnData] of Object.entries(vulnerabilities)) {
          const vuln = vulnData as any;
          if (vuln.severity === 'critical') {
            criticalCount++;
            vulnerablePackages.push(`${pkgName} (CRITICAL)`);
          } else if (vuln.severity === 'high') {
            highCount++;
            vulnerablePackages.push(`${pkgName} (HIGH)`);
          }
        }

        if (criticalCount > 0 || highCount > 0) {
          return {
            passed: false,
            message: `Found ${criticalCount} CRITICAL and ${highCount} HIGH vulnerabilities`,
            warnings: vulnerablePackages.slice(0, 5) // Limit to first 5
          };
        }

        return {
          passed: true,
          message: 'npm audit passed - no HIGH/CRITICAL vulnerabilities',
          warnings: metadata.vulnerabilities ? [`Found ${metadata.vulnerabilities} total vulnerabilities (all LOW/MODERATE)`] : undefined
        };
      } catch (parseError) {
        // If JSON parsing fails, fallback to string parsing
        if (auditOutput.includes('CRITICAL') || auditOutput.includes('high')) {
          return {
            passed: false,
            message: 'npm audit found HIGH or CRITICAL vulnerabilities'
          };
        }
        return {
          passed: true,
          message: 'npm audit passed'
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `npm audit execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Run pip-audit and check for HIGH/CRITICAL vulnerabilities
   */
  private runPipAudit(projectId: string): { passed: boolean; message: string; warnings?: string[] } {
    try {
      const projectPath = resolve(this.projectsBasePath, projectId);

      // Check if requirements.txt or setup.py exists
      const hasRequirements = existsSync(resolve(projectPath, 'requirements.txt'));
      const hasSetupPy = existsSync(resolve(projectPath, 'setup.py'));

      if (!hasRequirements && !hasSetupPy) {
        return {
          passed: true,
          message: 'No Python dependencies found - pip-audit skipped',
          warnings: ['pip-audit skipped: no requirements.txt or setup.py']
        };
      }

      // Run pip-audit with JSON output
      let auditOutput: string;
      try {
        auditOutput = execSync('pip-audit --format json', {
          cwd: projectPath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (error: any) {
        // pip-audit may exit with non-zero code when vulnerabilities are found
        auditOutput = error.stdout || '';
      }

      // Parse audit results
      try {
        const auditData = JSON.parse(auditOutput);
        const vulnerabilities = auditData.vulnerabilities || [];

        // Check for HIGH and CRITICAL severities
        let criticalCount = 0;
        let highCount = 0;
        const vulnerablePackages: string[] = [];

        for (const vuln of vulnerabilities) {
          const severity = vuln.fix_available ? 'MEDIUM' : 'HIGH'; // pip-audit uses different severity system

          // Check if vulnerability description contains CRITICAL
          if (vuln.description?.toUpperCase().includes('CRITICAL') || vuln.vulnerability_id?.includes('CRITICAL')) {
            criticalCount++;
            vulnerablePackages.push(`${vuln.name} (${vuln.vulnerability_id})`);
          } else if (severity === 'HIGH') {
            highCount++;
            vulnerablePackages.push(`${vuln.name} (${vuln.vulnerability_id})`);
          }
        }

        if (criticalCount > 0 || highCount > 0) {
          return {
            passed: false,
            message: `Found ${criticalCount} CRITICAL and ${highCount} HIGH vulnerabilities`,
            warnings: vulnerablePackages.slice(0, 5) // Limit to first 5
          };
        }

        return {
          passed: true,
          message: 'pip-audit passed - no HIGH/CRITICAL vulnerabilities',
          warnings: vulnerabilities.length > 0 ? [`Found ${vulnerabilities.length} LOW/MODERATE vulnerabilities`] : undefined
        };
      } catch (parseError) {
        // If JSON parsing fails, fallback to string parsing
        if (auditOutput.toUpperCase().includes('CRITICAL') || auditOutput.toUpperCase().includes('HIGH')) {
          return {
            passed: false,
            message: 'pip-audit found HIGH or CRITICAL vulnerabilities'
          };
        }
        return {
          passed: true,
          message: 'pip-audit passed'
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `pip-audit execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate task dependencies - check for circular references in task DAG
   */
  private validateTaskDependencies(project: Project): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Read tasks.md artifact
      const tasksContent = this.getArtifactContent(project.id, 'tasks.md', 'SOLUTIONING');

      if (!tasksContent) {
        warnings.push('tasks.md not found - skipping task dependency validation');
        checks['no_circular_deps'] = true;
        return {
          status: 'warn',
          checks,
          warnings
        };
      }

      // Parse task dependencies from markdown
      const taskDependencies = this.parseTaskDependencies(tasksContent);

      if (Object.keys(taskDependencies).length === 0) {
        checks['no_circular_deps'] = true;
        warnings.push('No task dependencies found in tasks.md');
        return {
          status: 'warn',
          checks,
          warnings
        };
      }

      // Detect circular dependencies using DFS
      const circularDeps = this.detectCircularDependencies(taskDependencies);

      if (circularDeps.length > 0) {
        checks['no_circular_deps'] = false;
        for (const cycle of circularDeps) {
          errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
        }
        return {
          status: 'fail',
          checks,
          errors
        };
      }

      // Validate DAG structure
      checks['no_circular_deps'] = true;
      checks['valid_dag'] = true;
      const stats = this.validateDAGStructure(taskDependencies);

      if (stats.orphanedTasks.length > 0) {
        warnings.push(`Found ${stats.orphanedTasks.length} orphaned tasks: ${stats.orphanedTasks.join(', ')}`);
      }

      if (stats.deepestPath > 10) {
        warnings.push(`Task dependency depth is ${stats.deepestPath} (consider breaking into smaller epics)`);
      }

      return {
        status: warnings.length > 0 ? 'warn' : 'pass',
        checks,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        status: 'fail',
        checks: { 'no_circular_deps': false },
        errors: [`Failed to validate task dependencies: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Parse task dependencies from tasks.md markdown content
   */
  private parseTaskDependencies(tasksContent: string): Record<string, string[]> {
    const dependencies: Record<string, string[]> = {};

    // Match task entries with IDs and dependencies
    // Expected format: # T-001: Task Name\nDependencies: T-002, T-003
    const taskRegex = /#{1,3}\s+([T\w-]+):\s+(.+?)(?=#{1,3}\s+[T\w-]+:|$)/gs;
    let match;

    while ((match = taskRegex.exec(tasksContent)) !== null) {
      const taskId = match[1].trim();
      const taskBlock = match[2];

      // Find dependencies section
      const depsRegex = /(?:depends\s+on|dependencies?):\s*(.+?)(?:\n\n|$)/i;
      const depsMatch = depsRegex.exec(taskBlock);

      if (depsMatch) {
        const depsText = depsMatch[1];
        // Extract task IDs from comma/space-separated list
        const depIds = depsText
          .split(/[,\s]+/)
          .map(id => id.trim())
          .filter(id => id.match(/^[T\w-]+$/));

        if (depIds.length > 0) {
          dependencies[taskId] = depIds;
        } else {
          dependencies[taskId] = [];
        }
      } else {
        dependencies[taskId] = [];
      }
    }

    return dependencies;
  }

  /**
   * Detect circular dependencies using depth-first search
   */
  private detectCircularDependencies(
    dependencies: Record<string, string[]>
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string) => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const deps = dependencies[taskId] || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          // Found a cycle - extract the cycle path
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart).concat([dep]);
          cycles.push(cycle);
        }
      }

      recursionStack.delete(taskId);
      path.pop();
    };

    // Run DFS from each unvisited node
    for (const taskId of Object.keys(dependencies)) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  /**
   * Validate overall DAG structure and return statistics
   */
  private validateDAGStructure(
    dependencies: Record<string, string[]>
  ): { orphanedTasks: string[]; deepestPath: number } {
    const allTasks = new Set(Object.keys(dependencies));
    const tasksWithIncoming = new Set<string>();
    const maxDepth: Record<string, number> = {};

    // Find tasks with incoming edges
    for (const deps of Object.values(dependencies)) {
      deps.forEach(dep => tasksWithIncoming.add(dep));
    }

    // Find orphaned tasks (no incoming edges, no outgoing edges)
    const orphanedTasks = Array.from(allTasks).filter(
      task => !tasksWithIncoming.has(task) && (dependencies[task]?.length || 0) === 0
    );

    // Calculate deepest path using memoization
    const calculateDepth = (taskId: string, visited = new Set<string>()): number => {
      if (maxDepth[taskId] !== undefined) {
        return maxDepth[taskId];
      }

      if (visited.has(taskId)) {
        return 0; // Avoid infinite recursion in case of cycles (shouldn't happen)
      }

      visited.add(taskId);
      const deps = dependencies[taskId] || [];
      const childDepths = deps.map(dep => calculateDepth(dep, new Set(visited)));
      const depth = childDepths.length > 0 ? 1 + Math.max(...childDepths) : 1;

      maxDepth[taskId] = depth;
      return depth;
    };

    let deepestPath = 0;
    for (const taskId of allTasks) {
      deepestPath = Math.max(deepestPath, calculateDepth(taskId));
    }

    return {
      orphanedTasks,
      deepestPath
    };
  }

  /**
   * Validate handoff document
   */
  private validateHandoff(project: Project, requiredSections: string[]): ValidationResult {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    const handoffContent = this.getArtifactContent(project.id, 'HANDOFF.md');
    
    for (const section of requiredSections) {
      const hasSection = handoffContent.includes(section) || 
                       handoffContent.toLowerCase().includes(section.toLowerCase());
      checks[section] = hasSection;
      
      if (!hasSection) {
        errors.push(`HANDOFF.md missing section: ${section}`);
      }
    }

    return {
      status: errors.length > 0 ? 'fail' : 'pass',
      checks,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate ZIP file (placeholder)
   */
  private validateZip(project: Project, requiredFiles: string[]): ValidationResult {
    const checks: Record<string, boolean> = {};
    const warnings: string[] = [];

    for (const file of requiredFiles) {
      checks[file] = true; // Placeholder - would check ZIP contents
      warnings.push(`ZIP validation not implemented for: ${file}`);
    }

    return {
      status: warnings.length > 0 ? 'warn' : 'pass',
      checks,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // Helper methods
  private getRequiredFilesForPhase(phase: string): string[] {
    const phaseFiles: Record<string, string[]> = {
      ANALYSIS: ['constitution.md', 'project-brief.md', 'personas.md'],
      STACK_SELECTION: ['plan.md', 'README.md'],
      SPEC: ['PRD.md', 'data-model.md', 'api-spec.json'],
      DEPENDENCIES: ['DEPENDENCIES.md', 'dependency-proposal.md'],
      SOLUTIONING: ['architecture.md', 'epics.md', 'tasks.md'],
      DONE: ['HANDOFF.md']
    };
    
    return phaseFiles[phase] || [];
  }

  private getMarkdownFilesForPhase(phase: string): string[] {
    return this.getRequiredFilesForPhase(phase).filter(file => file.endsWith('.md'));
  }

  private getArtifactContent(projectId: string, artifactName: string, phase?: string): string {
    try {
      // Extract phase from artifactName if provided in format "PHASE/artifact.md"
      let targetPhase = phase;
      let targetName = artifactName;

      if (artifactName.includes('/')) {
        const [phaseFromName, nameFromArtifact] = artifactName.split('/');
        targetPhase = phaseFromName;
        targetName = nameFromArtifact;
      }

      // Construct artifact path: /projects/{projectId}/specs/{phase}/v1/{artifactName}
      const artifactPath = resolve(
        this.projectsBasePath,
        projectId,
        'specs',
        targetPhase || 'ANALYSIS',
        'v1',
        targetName
      );

      if (!existsSync(artifactPath)) {
        return '';
      }

      return readFileSync(artifactPath, 'utf8');
    } catch (error) {
      console.error(`Error reading artifact ${artifactName}:`, error);
      return '';
    }
  }

  private extractFrontmatter(content: string): Record<string, any> | null {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (!match) return null;
    
    try {
      // Simple YAML parsing - in production use proper YAML parser
      const frontmatter: Record<string, any> = {};
      const lines = match[1].split('\n');
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          frontmatter[key.trim()] = valueParts.join(':').trim();
        }
      }
      
      return frontmatter;
    } catch {
      return null;
    }
  }
}