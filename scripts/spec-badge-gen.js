#!/usr/bin/env node

/**
 * Validation Badge Generation Script
 * Creates status badge for README from validation results
 */

const fs = require('fs');
const path = require('path');

console.log('🏅 Generating Validation Badge...\n');

// Try to read validation report
const validationReportPath = path.join(__dirname, '..', 'validation-report.json');
const constitutionalReportPath = path.join(__dirname, '..', 'constitutional-report.json');

let overallStatus = 'unknown';
let statusColor = 'gray';
let summary = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0
};

// Try to read from validation report
try {
  if (fs.existsSync(validationReportPath)) {
    const report = JSON.parse(fs.readFileSync(validationReportPath, 'utf8'));
    overallStatus = report.summary?.overallStatus || 'unknown';
    summary = report.summary || summary;
  }
} catch (e) {
  console.log('No validation report found, using default status');
}

// If no validation report, try constitutional report
if (overallStatus === 'unknown') {
  try {
    if (fs.existsSync(constitutionalReportPath)) {
      const report = JSON.parse(fs.readFileSync(constitutionalReportPath, 'utf8'));
      overallStatus = report.summary?.overallStatus || 'unknown';
      summary = report.summary || summary;
    }
  } catch (e) {
    console.log('No constitutional report found, using default status');
  }
}

// Determine color based on status
switch (overallStatus) {
  case 'pass':
    statusColor = 'green';
    break;
  case 'fail':
    statusColor = 'red';
    break;
  case 'warning':
    statusColor = 'yellow';
    break;
  default:
    statusColor = 'lightgray';
}

// Generate badge JSON (for GitHub Actions)
const badgeJson = {
  schemaVersion: 1,
  label: 'spec validation',
  message: overallStatus,
  color: statusColor
};

// Generate SVG badge
const svgBadge = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="110" height="20" role="img" aria-label="spec validation: ${overallStatus}">
  <title>spec validation: ${overallStatus}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="110" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="71" height="20" fill="#555"/>
    <rect x="71" width="39" height="20" fill="${statusColor}"/>
    <rect width="110" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="365" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="610">spec validation</text>
    <text x="365" y="140" transform="scale(.1)" fill="#fff" textLength="610">spec validation</text>
    <text aria-hidden="true" x="895" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="290">${overallStatus}</text>
    <text x="895" y="140" transform="scale(.1)" fill="#fff" textLength="290">${overallStatus}</text>
  </g>
</svg>`;

// Generate Markdown badge code
const markdownBadge = `## Spec Validation Badge

![Spec Validation](https://img.shields.io/badge/spec%20validation-${overallStatus}-${statusColor})

Or using the generated SVG:

![Spec Validation](spec-validation-badge.svg)

### Current Status

| Metric | Value |
|--------|-------|
| **Status** | ${overallStatus.toUpperCase()} |
| **Checks Passed** | ${summary.passed} |
| **Checks Failed** | ${summary.failed} |
| **Warnings** | ${summary.warnings} |

### Generated Files

- \`badge.json\` - Badge data for GitHub Actions
- \`spec-validation-badge.svg\` - SVG badge image
- \`validation-report.json\` - Detailed validation report
`;

// Write badge.json
const badgeJsonPath = path.join(__dirname, '..', 'badge.json');
fs.writeFileSync(badgeJsonPath, JSON.stringify(badgeJson, null, 2));
console.log(`✅ badge.json written`);

// Write SVG badge
const svgPath = path.join(__dirname, '..', 'spec-validation-badge.svg');
fs.writeFileSync(svgPath, svgBadge);
console.log(`✅ spec-validation-badge.svg written`);

// Write markdown documentation
const mdPath = path.join(__dirname, '..', 'SPEC_VALIDATION_BADGE.md');
fs.writeFileSync(mdPath, markdownBadge);
console.log(`✅ SPEC_VALIDATION_BADGE.md written`);

// Output summary
console.log('\n' + '='.repeat(50));
console.log('BADGE GENERATION COMPLETE');
console.log('='.repeat(50));
console.log(`Status: ${overallStatus.toUpperCase()}`);
console.log(`Color: ${statusColor}`);
console.log(`Files generated:`);
console.log(`  - badge.json`);
console.log(`  - spec-validation-badge.svg`);
console.log(`  - SPEC_VALIDATION_BADGE.md`);
