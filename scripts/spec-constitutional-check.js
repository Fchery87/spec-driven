#!/usr/bin/env node

/**
 * Constitutional Compliance Check Script
 * Validates all 5 Constitutional Articles from orchestrator_spec.yml
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

const articles = spec.constitutional_articles || {};

console.log('🏛️  Constitutional Compliance Check\n');
console.log('Validating Articles 1-5 from orchestrator_spec.yml\n');

// Results
const results = {
  timestamp: new Date().toISOString(),
  articles: {},
  summary: {
    total: Object.keys(articles).length,
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

/**
 * Article 1: Library-First Principle
 */
function checkArticle1(architecture) {
  const checks = [];
  
  // Check for modular structure
  const hasModules = /module|component|library|service/i.test(architecture);
  checks.push({
    item: 'Modular structure defined',
    status: hasModules ? 'pass' : 'warning',
    message: hasModules ? 'Architecture shows modular design' : 'No clear modular boundaries found'
  });
  
  // Check for clear boundaries
  const hasBoundaries = /boundary|separation|isolation|decoupled/i.test(architecture);
  checks.push({
    item: 'Component boundaries specified',
    status: hasBoundaries ? 'pass' : 'warning',
    message: hasBoundaries ? 'Clear boundaries documented' : 'Component boundaries not explicitly defined'
  });
  
  return {
    name: 'Article 1: Library-First Principle',
    mandate: articles.article_1_library_first?.mandate || 'Every feature begins as a reusable module',
    checks
  };
}

/**
 * Article 2: Test-First Imperative
 */
function checkArticle2(tasks) {
  const checks = [];
  
  // Check for test specifications
  const hasTestSection = /test.*specification|test.*criteria|acceptance.*criteria/i.test(tasks);
  checks.push({
    item: 'Test specifications present',
    status: hasTestSection ? 'pass' : 'fail',
    message: hasTestSection ? 'Tests defined before implementation' : 'No test specifications found'
  });
  
  // Check for Gherkin format
  const hasGherkin = /GIVEN.*WHEN.*THEN/i.test(tasks);
  checks.push({
    item: 'Gherkin acceptance criteria',
    status: hasGherkin ? 'pass' : 'warning',
    message: hasGherkin ? 'Gherkin format used' : 'No Gherkin-style criteria found'
  });
  
  // Check for test types specified
  const hasTestTypes = /contract.*test|integration.*test|e2e.*test|unit.*test/i.test(tasks);
  checks.push({
    item: 'Test types specified',
    status: hasTestTypes ? 'pass' : 'warning',
    message: hasTestTypes ? 'Multiple test types documented' : 'Test types not clearly specified'
  });
  
  return {
    name: 'Article 2: Test-First Imperative',
    mandate: articles.article_2_test_first?.mandate || 'No implementation code before tests are specified',
    checks
  };
}

/**
 * Article 3: Simplicity Gate
 */
function checkArticle3(architecture) {
  const checks = [];
  
  // Count service mentions
  const serviceMatches = architecture.match(/service|microservice|api|backend|frontend/gi) || [];
  const hasComplexArchitecture = /microservice|distributed|polyglot/i.test(architecture);
  
  checks.push({
    item: 'MVP complexity (≤3 services)',
    status: !hasComplexArchitecture ? 'pass' : 'warning',
    message: hasComplexArchitecture ? 'Complex architecture detected, ensure justification exists' : 'Simple, focused architecture'
  });
  
  // Check for complexity justification
  const hasJustification = /justify|complexity|rationale|trade-?off/i.test(architecture);
  checks.push({
    item: 'Complexity justified',
    status: hasJustification || !hasComplexArchitecture ? 'pass' : 'warning',
    message: hasComplexArchitecture && !hasJustification ? 'Complex architecture lacks justification' : 'Complexity documented'
  });
  
  return {
    name: 'Article 3: Simplicity Gate',
    mandate: articles.article_3_simplicity?.mandate || 'Maximum 3 projects/services for MVP',
    checks
  };
}

/**
 * Article 4: Anti-Abstraction
 */
function checkArticle4(dependencies) {
  const checks = [];
  
  // Check for wrapper/abstraction libraries
  const wrapperPatterns = [
    /axios/i,
    /node-fetch/i,
    /lodash/i,
    /ramda/i,
    /underscore/i,
    /class-transformer/i,
    /class-validator/i
  ];
  
  let wrapperCount = 0;
  for (const pattern of wrapperPatterns) {
    if (pattern.test(dependencies)) wrapperCount++;
  }
  
  checks.push({
    item: 'No unnecessary wrappers',
    status: wrapperCount === 0 ? 'pass' : 'warning',
    message: wrapperCount === 0 
      ? 'No common wrapper/abstraction libraries detected' 
      : `${wrapperCount} potential wrapper(s) found - ensure justified`
  });
  
  // Check for abstraction justification
  const hasJustification = /justify|abstraction|layer|wrapper/i.test(dependencies);
  checks.push({
    item: 'Abstraction layers justified',
    status: hasJustification ? 'pass' : 'warning',
    message: hasJustification ? 'Abstractions documented' : 'No explicit justification for abstractions'
  });
  
  return {
    name: 'Article 4: Anti-Abstraction',
    mandate: articles.article_4_anti_abstraction?.mandate || 'Use framework directly; no unnecessary wrappers',
    checks
  };
}

/**
 * Article 5: Integration-First Testing
 */
function checkArticle5(tasks, dependencies) {
  const checks = [];
  
  // Check for real database mentions
  const hasRealDb = /real.*database|postgres|mysql|mongodb|production.*db/i.test(tasks);
  checks.push({
    item: 'Real database for integration tests',
    status: hasRealDb ? 'pass' : 'warning',
    message: hasRealDb ? 'Integration tests use real database' : 'No explicit real database usage mentioned'
  });
  
  // Check for real service mentions
  const hasRealServices = /real.*service|integration.*test|end-?to-?end/i.test(tasks);
  checks.push({
    item: 'Real service integration tests',
    status: hasRealServices ? 'pass' : 'warning',
    message: hasRealServices ? 'Real service tests configured' : 'Prefer real services over mocks'
  });
  
  // Check test configuration
  const hasTestConfig = /test.*configuration|vitest|playwright|jest/i.test(dependencies);
  checks.push({
    item: 'Test infrastructure configured',
    status: hasTestConfig ? 'pass' : 'warning',
    message: hasTestConfig ? 'Test frameworks in dependencies' : 'Test framework not detected in dependencies'
  });
  
  return {
    name: 'Article 5: Integration-First Testing',
    mandate: articles.article_5_integration_first?.mandate || 'Prefer real databases over mocks',
    checks
  };
}

// Run checks
const specsDir = path.join(__dirname, '..', 'specs');

// Check Article 1
const architecturePath = path.join(specsDir, 'solutioning/architecture.md');
if (fs.existsSync(architecturePath)) {
  const architecture = fs.readFileSync(architecturePath, 'utf8');
  results.articles.article_1 = checkArticle1(architecture);
} else {
  results.articles.article_1 = {
    name: 'Article 1: Library-First Principle',
    status: 'pending',
    message: 'architecture.md not found - cannot validate'
  };
}

// Check Article 2
const tasksPath = path.join(specsDir, 'solutioning/tasks.md');
if (fs.existsSync(tasksPath)) {
  const tasks = fs.readFileSync(tasksPath, 'utf8');
  results.articles.article_2 = checkArticle2(tasks);
} else {
  results.articles.article_2 = {
    name: 'Article 2: Test-First Imperative',
    status: 'pending',
    message: 'tasks.md not found - cannot validate'
  };
}

// Check Article 3
if (fs.existsSync(architecturePath)) {
  const architecture = fs.readFileSync(architecturePath, 'utf8');
  results.articles.article_3 = checkArticle3(architecture);
} else {
  results.articles.article_3 = {
    name: 'Article 3: Simplicity Gate',
    status: 'pending',
    message: 'architecture.md not found - cannot validate'
  };
}

// Check Article 4
const depsPath = path.join(specsDir, 'dependencies/dependencies.json');
const depsMdPath = path.join(specsDir, 'dependencies/DEPENDENCIES.md');
if (fs.existsSync(depsPath) || fs.existsSync(depsMdPath)) {
  const deps = fs.readFileSync(depsPath, 'utf8') || fs.readFileSync(depsMdPath, 'utf8');
  results.articles.article_4 = checkArticle4(deps);
} else {
  results.articles.article_4 = {
    name: 'Article 4: Anti-Abstraction',
    status: 'pending',
    message: 'dependencies.json/DEPENDENCIES.md not found - cannot validate'
  };
}

// Check Article 5
if (fs.existsSync(tasksPath)) {
  const tasks = fs.readFileSync(tasksPath, 'utf8');
  const deps = fs.existsSync(depsPath) ? fs.readFileSync(depsPath, 'utf8') : '';
  results.articles.article_5 = checkArticle5(tasks, deps);
} else {
  results.articles.article_5 = {
    name: 'Article 5: Integration-First Testing',
    status: 'pending',
    message: 'tasks.md not found - cannot validate'
  };
}

// Calculate results for each article
for (const [key, article] of Object.entries(results.articles)) {
  if (article.checks) {
    const failures = article.checks.filter(c => c.status === 'fail').length;
    const warnings = article.checks.filter(c => c.status === 'warning').length;
    article.status = failures > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass';
    
    results.summary.failed += failures;
    results.summary.warnings += warnings;
    if (article.status === 'pass') results.summary.passed++;
  }
}

results.summary.overallStatus = results.summary.failed > 0 ? 'fail' : 
                                results.summary.warnings > 0 ? 'warning' : 'pass';

// Output results
console.log('='.repeat(60));
console.log('CONSTITUTIONAL COMPLIANCE RESULTS');
console.log('='.repeat(60));

for (const [key, article] of Object.entries(results.articles)) {
  const statusEmoji = article.status === 'pass' ? '✅' : 
                      article.status === 'fail' ? '❌' : 
                      article.status === 'pending' ? '⏳' : '⚠️';
  console.log(`\n${statusEmoji} ${article.name}`);
  if (article.mandate) {
    console.log(`   Mandate: ${article.mandate}`);
  }
  if (article.checks) {
    for (const check of article.checks) {
      const emoji = check.status === 'pass' ? '✅' : 
                    check.status === 'fail' ? '❌' : '⚠️';
      console.log(`   ${emoji} ${check.item}: ${check.message}`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Articles Checked: ${results.summary.total}`);
console.log(`Fully Compliant: ${results.summary.passed}`);
console.log(`Failed: ${results.summary.failed}`);
console.log(`Warnings: ${results.summary.warnings}`);
console.log(`Overall Status: ${results.summary.overallStatus.toUpperCase()}`);

// Write report
const reportPath = path.join(__dirname, '..', 'constitutional-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Report written to: ${reportPath}`);

// Exit with appropriate code
process.exit(results.summary.overallStatus === 'fail' ? 1 : 0);
