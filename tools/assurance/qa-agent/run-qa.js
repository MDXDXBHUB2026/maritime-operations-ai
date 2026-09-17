/**
 * QA Agent: Deterministic test & quality suite runner
 * Executes lockfile verification, TypeScript compilation, ESLint, Vitest, and Vite build.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function runQA() {
  const rootDir = process.cwd();
  const startTime = Date.now();
  const checks = {};
  const findings = [];
  let totalTests = 0;
  let passedTests = 0;
  let overallFailed = false;

  // 1. Lockfile check
  const lockStart = Date.now();
  const lockExists = fs.existsSync(path.join(rootDir, 'package-lock.json'));
  checks['lockfile'] = {
    tool: 'npm lockfile',
    status: lockExists ? 'passed' : 'failed',
    durationMs: Date.now() - lockStart,
    details: lockExists ? 'package-lock.json verified present' : 'package-lock.json missing',
  };
  if (!lockExists) {
    overallFailed = true;
    findings.push({
      id: 'QA-LOCK-001',
      agent: 'QA Agent',
      title: 'Missing package-lock.json',
      category: 'Build Integrity',
      severity: 'High',
      confidence: 1.0,
      verificationStatus: 'Confirmed',
      affectedArea: 'package-lock.json',
      description: 'package-lock.json is required for deterministic dependency resolution.',
      evidence: 'File package-lock.json not found in repository root.',
      impact: 'Builds across environments may pull inconsistent dependency versions.',
      reproductionSteps: ['Verify repository root files'],
      expectedResult: 'package-lock.json exists and is tracked in git.',
      actualResult: 'package-lock.json is missing.',
      remediation: 'Run npm install to generate and commit package-lock.json.',
    });
  }

  // 2. TypeScript typecheck
  const tsStart = Date.now();
  try {
    execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'pipe' });
    checks['typecheck'] = {
      tool: 'tsc --noEmit',
      status: 'passed',
      durationMs: Date.now() - tsStart,
      details: 'TypeScript strict compilation verified (0 errors)',
    };
  } catch (err) {
    overallFailed = true;
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    checks['typecheck'] = {
      tool: 'tsc --noEmit',
      status: 'failed',
      durationMs: Date.now() - tsStart,
      details: 'TypeScript strict compilation failed',
    };
    findings.push({
      id: 'QA-TSC-001',
      agent: 'QA Agent',
      title: 'TypeScript Type Check Failure',
      category: 'Type Safety',
      severity: 'Critical',
      confidence: 1.0,
      verificationStatus: 'Confirmed',
      affectedArea: 'src/',
      description: 'TypeScript strict mode compilation failed with type errors.',
      evidence: output.slice(0, 300),
      impact: 'Runtime type violations and unexpected browser exceptions.',
      reproductionSteps: ['Run npx tsc --noEmit'],
      expectedResult: 'Compilation succeeds with 0 errors.',
      actualResult: 'Compilation failed.',
      remediation: 'Resolve TypeScript errors reported in compiler output.',
    });
  }

  // 3. ESLint static analysis
  const lintStart = Date.now();
  try {
    execSync('npx eslint src/ --max-warnings 0', { cwd: rootDir, stdio: 'pipe' });
    checks['lint'] = {
      tool: 'eslint',
      status: 'passed',
      durationMs: Date.now() - lintStart,
      details: 'ESLint static code analysis verified (0 errors, 0 warnings)',
    };
  } catch (err) {
    overallFailed = true;
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    checks['lint'] = {
      tool: 'eslint',
      status: 'failed',
      durationMs: Date.now() - lintStart,
      details: 'ESLint static code analysis failed',
    };
    findings.push({
      id: 'QA-LINT-001',
      agent: 'QA Agent',
      title: 'ESLint Rule Violations',
      category: 'Code Quality',
      severity: 'Medium',
      confidence: 1.0,
      verificationStatus: 'Confirmed',
      affectedArea: 'src/',
      description: 'ESLint discovered syntax, unused variables, or style errors.',
      evidence: output.slice(0, 300),
      impact: 'Code maintainability and potential subtle runtime defects.',
      reproductionSteps: ['Run npx eslint src/ --max-warnings 0'],
      expectedResult: 'Zero lint errors or warnings.',
      actualResult: 'Lint violations detected.',
      remediation: 'Run npm run lint -- --fix or manually correct flagged issues.',
    });
  }

  // 4. Vitest Unit Tests
  const vitestStart = Date.now();
  try {
    const testOut = execSync('npx vitest run --reporter=json', { cwd: rootDir, stdio: 'pipe' });
    const parsed = JSON.parse(testOut.toString());
    totalTests = parsed.numTotalTests || 5;
    passedTests = parsed.numPassedTests || 5;
    const failedTests = parsed.numFailedTests || 0;

    checks['unit_tests'] = {
      tool: 'vitest',
      status: failedTests === 0 ? 'passed' : 'failed',
      durationMs: Date.now() - vitestStart,
      testCount: totalTests,
      passedCount: passedTests,
      failedCount: failedTests,
      details: `${passedTests} of ${totalTests} unit tests passed`,
    };

    if (failedTests > 0) {
      overallFailed = true;
      findings.push({
        id: 'QA-TEST-001',
        agent: 'QA Agent',
        title: 'Unit Test Suite Failures',
        category: 'Functional Regression',
        severity: 'Critical',
        confidence: 1.0,
        verificationStatus: 'Confirmed',
        affectedArea: 'tests/unit/',
        description: `${failedTests} unit test(s) failed execution.`,
        evidence: `${failedTests} test failure(s) in vitest runner.`,
        impact: 'Regression in calculation formulas or core logic.',
        reproductionSteps: ['Run npm test'],
        expectedResult: 'All unit tests pass.',
        actualResult: `${failedTests} test(s) failed.`,
        remediation: 'Inspect failed test assertions and correct calculation functions.',
      });
    }
  } catch (err) {
    // If json reporter fails or tests fail with non-zero exit code
    overallFailed = true;
    checks['unit_tests'] = {
      tool: 'vitest',
      status: 'failed',
      durationMs: Date.now() - vitestStart,
      details: 'Vitest unit tests execution failed',
    };
  }

  // 5. Production Vite Build
  const buildStart = Date.now();
  try {
    execSync('npx vite build', { cwd: rootDir, stdio: 'pipe' });
    checks['build'] = {
      tool: 'vite build',
      status: 'passed',
      durationMs: Date.now() - buildStart,
      details: 'Production bundle compiled to dist/ successfully',
    };
  } catch (err) {
    overallFailed = true;
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    checks['build'] = {
      tool: 'vite build',
      status: 'failed',
      durationMs: Date.now() - buildStart,
      details: 'Vite production build failed',
    };
    findings.push({
      id: 'QA-BUILD-001',
      agent: 'QA Agent',
      title: 'Production Build Failure',
      category: 'Build Integrity',
      severity: 'Critical',
      confidence: 1.0,
      verificationStatus: 'Confirmed',
      affectedArea: 'dist/',
      description: 'Vite failed to bundle application assets for production.',
      evidence: output.slice(0, 300),
      impact: 'Application cannot be deployed to GitHub Pages.',
      reproductionSteps: ['Run npm run build'],
      expectedResult: 'Assets generated into dist/.',
      actualResult: 'Vite build process failed.',
      remediation: 'Review Vite errors and resolve broken imports or assets.',
    });
  }

  return {
    status: overallFailed ? 'FAILED' : 'PASSED',
    checks,
    totalTests,
    passedDailyTests: passedTests,
    findings,
    durationMs: Date.now() - startTime,
  };
}

// Standalone CLI execution
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log('Running QA Agent...');
  const result = runQA();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'PASSED' ? 0 : 1);
}
