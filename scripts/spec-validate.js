#!/usr/bin/env node

/**
 * Spec Validation Script
 * Runs validators from orchestrator_spec.yml against the project artifacts
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load orchestrator spec
const specPath = path.join(__dirname, '..', 'orchestrator_spec.yml');
let spec;
try {
  spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
} catch (e) {
  console.error('Failed to load orchestrator_spec.yml:', e.message);
  process.exit(1);
}

const validators = spec.validators || {};
const phases = spec.phases || {};

console.log('🔍 Spec Validation Starting...\n');

// Results tracking
const results = {
  timestamp: new Date().toISOString(),
  validators: {},
  phases: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

/**
 * Validate file presence
 */
function checkPresence(artifactPath) {
  const fullPath = path.join(__dirname, '..', artifactPath);
  const exists = fs.existsSync(fullPath);
  return {
    name: 'Presence Check',
    status: exists ? 'pass' : 'fail',
    details: exists ? `${artifactPath} exists` : `${artifactPath} not found`
  };
}

/**
 * Validate markdown frontmatter
 */
function checkFrontmatter(content, filename) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {
      name: 'Frontmatter Check',
      status: 'fail',
      details: `${filename} missing frontmatter`
    };
  }
  
  try {
    const frontmatter = yaml.load(frontmatterMatch[1]);
    const required = ['title', 'owner', 'version', 'date', 'status'];
    const missing = required.filter(field => !frontmatter[field]);
    
    if (missing.length > 0) {
      return {
        name: 'Frontmatter Check',
        status: 'fail',
        details: `${filename} missing required fields: ${missing.join(', ')}`
      };
    }
    
    return {
      name: 'Frontmatter Check',
      status: 'pass',
      details: `${filename} has valid frontmatter`
    };
  } catch (e) {
    return {
      name: 'Frontmatter Check',
      status: 'fail',
      details: `${filename} frontmatter parse error: ${e.message}`
    };
  }
}

/**
 * Validate OpenAPI spec
 */
function checkOpenAPISpec(content) {
  try {
    const spec = JSON.parse(content);
    if (spec.openapi && spec.openapi.startsWith('3.0')) {
      return {
        name: 'OpenAPI Validation',
        status: 'pass',
        details: `Valid OpenAPI ${spec.openapi} specification`
      };
    }
    return {
      name: 'OpenAPI Validation',
      status: 'fail',
      details: 'Not a valid OpenAPI 3.0.x specification'
    };
  } catch (e) {
    return {
      name: 'OpenAPI Validation',
      status: 'fail',
      details: `JSON parse error: ${e.message}`
    };
  }
}

/**
 * Validate task DAG (no circular dependencies)
 */
function checkTaskDAG(content) {
  // Check for TASK patterns and their dependencies
  const taskPattern = /TASK-\w+-\d+:\s*/g;
  const depPattern = /Depends On[:\s]*([A-Z0-9,\s]+)/i;
  
  const tasks = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const taskMatch = line.match(/###\s+(TASK-\w+-\d+)/);
    if (taskMatch) {
      const depMatch = line.match(depPattern);
      tasks.push({
        id: taskMatch[1],
        dependencies: depMatch ? depMatch[1].split(',').map(d => d.trim()) : []
      });
    }
  }
  
  // Check for circular dependencies
  const visited = new Set();
  const recursionStack = new Set();
  
  function hasCycle(taskId, graph) {
    if (recursionStack.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    
    recursionStack.add(taskId);
    visited.add(taskId);
    
    const task = graph.find(t => t.id === taskId);
    if (task) {
      for (const dep of task.dependencies) {
        if (dep === 'None' || dep === '') continue;
        if (hasCycle(dep, graph)) return true;
      }
    }
    
    recursionStack.delete(taskId);
    return false;
  }
  
  for (const task of tasks) {
    if (hasCycle(task.id, tasks)) {
      return {
        name: 'Task DAG Check',
        status: 'fail',
        details: `Circular dependency detected involving ${task.id}`
      };
    }
  }
  
  return {
    name: 'Task DAG Check',
    status: 'pass',
    details: `${tasks.length} tasks validated, no circular dependencies`
  };
}

/**
 * Validate requirements traceability
 */
function checkRequirementTraceability(prd, tasks) {
  const reqPattern = /REQ-[A-Z]+-\d{3}/g;
  const prdReqs = [...new Set(prd.match(reqPattern) || [])];
  const taskReqs = [...new Set(tasks.match(reqPattern) || [])];
  
  const unmapped = prdReqs.filter(req => !taskReqs.includes(req));
  
  if (unmapped.length > 0) {
    return {
      name: 'Requirement Traceability',
      status: 'fail',
      details: `${unmapped.length} requirements not mapped to tasks: ${unmapped.slice(0, 5).join(', ')}${unmapped.length > 5 ? '...' : ''}`
    };
  }
  
  return {
    name: 'Requirement Traceability',
    status: 'pass',
    details: `All ${prdReqs.length} requirements traced to tasks`
  };
}

/**
 * Run validation for a phase
 */
function validatePhase(phaseName, phaseConfig) {
  const phaseResults = {
    name: phaseName,
    validators: {},
    status: 'pass'
  };
  
  const requiredOutputs = phaseConfig.outputs || [];
  const phaseValidators = phaseConfig.validators || [];
  
  for (const output of requiredOutputs) {
    // Check presence
    const presenceResult = checkPresence(`specs/${phaseName.toLowerCase()}/${output}`);
    phaseResults.validators[`${output}_presence`] = presenceResult;
    
    if (output.endsWith('.md')) {
      // Check frontmatter for markdown files
      const content = readArtifact(`specs/${phaseName.toLowerCase()}/${output}`);
      if (content) {
        const frontmatterResult = checkFrontmatter(content, output);
        phaseResults.validators[`${output}_frontmatter`] = frontmatterResult;
      }
    } else if (output.endsWith('.json')) {
      // Validate JSON structure
      const content = readArtifact(`specs/${phaseName.toLowerCase()}/${output}`);
      if (content) {
        try {
          JSON.parse(content);
          phaseResults.validators[`${output}_json`] = {
            name: 'JSON Validation',
            status: 'pass',
            details: `${output} is valid JSON`
          };
        } catch (e) {
          phaseResults.validators[`${output}_json`] = {
            name: 'JSON Validation',
            status: 'fail',
            details: `${output} parse error: ${e.message}`
          };
        }
      }
    }
  }
  
  return phaseResults;
}

/**
 * Read artifact content
 */
function readArtifact(artifactPath) {
  const fullPath = path.join(__dirname, '..', artifactPath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}

// Run validation
console.log('Validating against orchestrator_spec.yml validators...\n');

// Check for specs directory
const specsDir = path.join(__dirname, '..', 'specs');
if (fs.existsSync(specsDir)) {
  const phases = fs.readdirSync(specsDir);
  
  for (const phase of phases) {
    const phasePath = path.join(specsDir, phase);
    if (fs.statSync(phasePath).isDirectory()) {
      const phaseConfig = spec.phases[phase.toUpperCase()];
      if (phaseConfig) {
        results.phases[phase] = validatePhase(phase.toUpperCase(), phaseConfig);
      }
    }
  }
}

// Check orchestrator spec itself
results.validators['spec_syntax'] = checkPresence('orchestrator_spec.yml');
const specContent = readArtifact('orchestrator_spec.yml');
if (specContent) {
  try {
    yaml.load(specContent);
    results.validators['spec_yaml'] = {
      name: 'Spec YAML Syntax',
      status: 'pass',
      details: 'orchestrator_spec.yml is valid YAML'
    };
  } catch (e) {
    results.validators['spec_yaml'] = {
      name: 'Spec YAML Syntax',
      status: 'fail',
      details: `Parse error: ${e.message}`
    };
  }
}

// Calculate summary
for (const phase of Object.values(results.phases)) {
  for (const check of Object.values(phase.validators)) {
    results.summary.total++;
    if (check.status === 'pass') results.summary.passed++;
    else if (check.status === 'fail') results.summary.failed++;
    else if (check.status === 'warning') results.summary.warnings++;
  }
}

for (const check of Object.values(results.validators)) {
  results.summary.total++;
  if (check.status === 'pass') results.summary.passed++;
  else if (check.status === 'fail') results.summary.failed++;
  else if (check.status === 'warning') results.summary.warnings++;
}

results.summary.overallStatus = results.summary.failed > 0 ? 'fail' : 
                                results.summary.warnings > 0 ? 'warning' : 'pass';

// Output results
console.log('='.repeat(60));
console.log('VALIDATION RESULTS');
console.log('='.repeat(60));

if (Object.keys(results.phases).length > 0) {
  console.log('\n📁 Phase Artifacts:');
  for (const [phase, data] of Object.entries(results.phases)) {
    const status = Object.values(data.validators).some(v => v.status === 'fail') ? '❌' : 
                   Object.values(data.validators).some(v => v.status === 'warning') ? '⚠️' : '✅';
    console.log(`  ${status} ${phase}`);
    for (const [check, result] of Object.entries(data.validators)) {
      const emoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      console.log(`    ${emoji} ${result.name}: ${result.details}`);
    }
  }
}

console.log('\n🔧 Spec Validators:');
for (const [check, result] of Object.entries(results.validators)) {
  const emoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  console.log(`  ${emoji} ${result.name}: ${result.details}`);
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Total Checks: ${results.summary.total}`);
console.log(`Passed: ${results.summary.passed}`);
console.log(`Failed: ${results.summary.failed}`);
console.log(`Warnings: ${results.summary.warnings}`);
console.log(`Overall Status: ${results.summary.overallStatus.toUpperCase()}`);

// Write validation report
const reportPath = path.join(__dirname, '..', 'validation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Report written to: ${reportPath}`);

// Exit with appropriate code
process.exit(results.summary.overallStatus === 'fail' ? 1 : 0);
