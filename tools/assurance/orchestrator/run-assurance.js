/**
 * Assurance Orchestrator: Runs QA Agent, Security Agent, and Finding Verifier.
 * Emits public/assurance/latest.json and assurance-results/report.md.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runQA } from '../qa-agent/run-qa.js';
import { runSecurity } from '../security-agent/run-security.js';
import { verifyFindings } from '../verifier/verify-findings.js';

function getGitMetadata() {
  try {
    const rawSha = process.env.GITHUB_SHA || execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
    const sha = rawSha.length > 7 ? rawSha.substring(0, 7) : rawSha;
    const branch = process.env.GITHUB_REF_NAME || execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' }).toString().trim();
    return { sha, branch };
  } catch {
    return { sha: 'dynamic-build', branch: 'local' };
  }
}

export function runAssurance() {
  const rootDir = process.cwd();
  console.log('====================================================');
  console.log('⚓ MARITIME AI APPLICATION ASSURANCE PLATFORM');
  console.log('====================================================');

  const { sha, branch } = getGitMetadata();
  const runId = process.env.GITHUB_RUN_ID || `local_${Date.now()}`;
  const timestamp = new Date().toISOString();

  // 1. Run QA Agent
  console.log('\n[1/3] Executing QA Agent (Typecheck, Lint, Test, Build)...');
  const qaResult = runQA();
  console.log(`QA Gate Status: ${qaResult.status} (${qaResult.passedDailyTests}/${qaResult.totalTests} tests passed)`);

  // 2. Run Security Agent
  console.log('\n[2/3] Executing Security Agent (Audit, Secret Scan, Static Rules)...');
  const securityResult = runSecurity();
  console.log(`Security Gate Status: ${securityResult.status}`);

  // 3. Verify Findings
  console.log('\n[3/3] Running Finding Verifier (Deduplication & Remediation Roadmap)...');
  const allRawFindings = [...qaResult.findings, ...securityResult.findings];
  const { verifiedFindings, remediationRoadmap } = verifyFindings(allRawFindings);

  const criticalCount = verifiedFindings.filter((f) => f.severity === 'Critical').length;
  const highCount = verifiedFindings.filter((f) => f.severity === 'High').length;
  const mediumCount = verifiedFindings.filter((f) => f.severity === 'Medium').length;
  const lowCount = verifiedFindings.filter((f) => f.severity === 'Low').length;
  const infoCount = verifiedFindings.filter((f) => f.severity === 'Informational').length;

  const overallStatus =
    qaResult.status === 'FAILED' || securityResult.status === 'FAILED' || criticalCount > 0 || highCount > 0
      ? 'FAILED'
      : securityResult.status === 'WARNING' || qaResult.status === 'WARNING' || mediumCount > 0
        ? 'WARNING'
        : 'PASSED';

  const report = {
    runId,
    commitSha: sha,
    timestamp,
    status: overallStatus,
    environment: process.env.CI ? 'GitHub Actions CI' : 'Local Environment',
    summary: {
      totalFindings: verifiedFindings.length,
      criticalFindings: criticalCount,
      highFindings: highCount,
      mediumFindings: mediumCount,
      lowFindings: lowCount,
      informationalFindings: infoCount,
      qaGateStatus: qaResult.status,
      securityGateStatus: securityResult.status,
      positiveControlsCount: securityResult.positiveControls?.length || 0,
    },
    qa: {
      status: qaResult.status,
      checks: qaResult.checks,
      totalTests: qaResult.totalTests,
      passedDailyTests: qaResult.passedDailyTests,
    },
    security: {
      status: securityResult.status,
      checks: securityResult.checks,
    },
    findings: verifiedFindings,
    positiveControls: securityResult.positiveControls || [],
    remediationRoadmap,
  };

  // Ensure directories exist
  const publicAssuranceDir = path.join(rootDir, 'public', 'assurance');
  if (!fs.existsSync(publicAssuranceDir)) {
    fs.mkdirSync(publicAssuranceDir, { recursive: true });
  }

  const resultsDir = path.join(rootDir, 'assurance-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Write public/assurance/latest.json
  const jsonPath = path.join(publicAssuranceDir, 'latest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✓ Written report to ${jsonPath}`);

  // Write assurance-results/report.md
  const mdLines = [
    '# Maritime Operations AI - Application Assurance Report',
    '',
    `**Status**: ${report.status} | **Commit**: \`${report.commitSha}\` | **Branch**: \`${branch}\` | **Date**: ${report.timestamp}`,
    '',
    '## Quality & Security Gates',
    `- **QA Gate**: ${report.summary.qaGateStatus}`,
    `- **Security Gate**: ${report.summary.securityGateStatus}`,
    `- **Total Tests**: ${report.qa.totalTests} (Passed: ${report.qa.passedDailyTests})`,
    `- **Total Findings**: ${report.summary.totalFindings} (Critical: ${report.summary.criticalFindings}, High: ${report.summary.highFindings}, Medium: ${report.summary.mediumFindings})`,
    '',
    '## Positive Controls Verified',
  ];

  for (const pc of report.positiveControls) {
    mdLines.push(`- **${pc.id}** [${pc.status}]: ${pc.description}`);
  }

  mdLines.push('', '## Findings Register');
  if (report.findings.length === 0) {
    mdLines.push('No vulnerabilities or quality defects detected in this run.');
  } else {
    for (const f of report.findings) {
      mdLines.push(`### [${f.severity}] ${f.id}: ${f.title}`);
      mdLines.push(`- **Affected Area**: \`${f.affectedArea}\``);
      mdLines.push(`- **Status**: ${f.verificationStatus}`);
      mdLines.push(`- **Evidence**: ${f.evidence}`);
      mdLines.push(`- **Remediation**: ${f.remediation}`);
      mdLines.push('');
    }
  }

  const mdPath = path.join(resultsDir, 'report.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');
  console.log(`✓ Written markdown summary to ${mdPath}`);

  console.log('\n====================================================');
  console.log(`ASSURANCE SUMMARY: ${overallStatus}`);
  console.log('====================================================\n');

  return report;
}

// Standalone execution
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const report = runAssurance();
  process.exit(report.status === 'FAILED' ? 1 : 0);
}
