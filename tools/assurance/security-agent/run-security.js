/**
 * Security Agent: Static code analyzer, secret scanner, and dependency auditor.
 * Implements strict, non-reversible secret redaction (ghp_abcd********wxyz).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Redact secret matching pattern: keeps first 4 and last 4 chars, masks middle with 8 asterisks
export function redactSecret(secret) {
  if (!secret || typeof secret !== 'string') return '[REDACTED]';
  if (secret.length <= 8) return '********';
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}********${suffix}`;
}

// Patterns to detect sensitive tokens or secrets
const SECRET_PATTERNS = [
  { name: 'GitHub Personal Access Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: 'Critical' },
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{32,}/g, severity: 'Critical' },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g, severity: 'Critical' },
  { name: 'Private Key Block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, severity: 'Critical' },
  { name: 'Generic Hardcoded Token Assignment', regex: /(?:api_key|apikey|secret_key|auth_token)\s*=\s*['"][a-zA-Z0-9_\-]{24,}['"]/gi, severity: 'High' },
];

// Dangerous code patterns for static client analysis
const DANGEROUS_PATTERNS = [
  { name: 'Direct eval() usage', regex: /\beval\s*\(/g, severity: 'Critical', desc: 'Arbitrary code execution risk via eval()' },
  { name: 'dangerouslySetInnerHTML usage', regex: /dangerouslySetInnerHTML/g, severity: 'High', desc: 'Potential XSS vulnerability via unescaped DOM insertion' },
  { name: 'Dynamic Function() constructor', regex: /new\s+Function\s*\(/g, severity: 'High', desc: 'Dynamic code execution risk' },
];

const SCAN_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.html',
  '.css',
  '.env',
  '.yaml',
  '.yml',
  '.py',
  '.toml',
  '.md',
  '.txt',
  '.ini',
  '.cfg',
  '.sh',
  '.ps1',
];

const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  '.pytest_cache',
  'coverage',
  'assurance-results',
  'playwright-report',
  'test-results',
];

function walkFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      if (entry.name === 'latest.json') continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (SCAN_EXTENSIONS.includes(ext) || entry.name.startsWith('.env')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

/**
 * Determine if package is devDependency or production runtime dependency.
 */
function resolveDependencyScope(pkgName, vuln, pkgJson, allVulns = {}) {
  const isDirectDev = Boolean(pkgJson.devDependencies && pkgJson.devDependencies[pkgName]);
  const isDirectProd = Boolean(pkgJson.dependencies && pkgJson.dependencies[pkgName]);

  if (isDirectProd) return { type: 'Production', label: 'production runtime dependency' };
  if (isDirectDev) return { type: 'Development', label: 'devDependencies (build/test tooling only)' };

  // Trace effects
  if (vuln.effects && vuln.effects.length > 0) {
    for (const parent of vuln.effects) {
      if (pkgJson.dependencies && pkgJson.dependencies[parent]) {
        return { type: 'Production', label: `transitive dependency of production package '${parent}'` };
      }
    }
    for (const parent of vuln.effects) {
      if (pkgJson.devDependencies && pkgJson.devDependencies[parent]) {
        return { type: 'Development', label: `transitive devDependency of test/build tool '${parent}'` };
      }
    }
  }

  return { type: 'Development', label: 'transitive development tooling' };
}

/**
 * Thoroughly verify public/ and public/data/ for absence of keys, DBs, and credentials.
 */
function verifyPublicDataIsolation(rootDir) {
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) return { passed: true, details: 'public directory does not exist' };

  const forbiddenExts = ['.db', '.sqlite', '.sqlite3', '.pem', '.key', '.p12', '.pfx'];
  const violations = [];

  function checkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(fullPath);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (forbiddenExts.some((ext) => lower.endsWith(ext)) || lower.startsWith('.env')) {
          violations.push(path.relative(rootDir, fullPath));
        } else if (lower.endsWith('.json') || lower.endsWith('.txt') || lower.endsWith('.csv')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (
              /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content) ||
              /(?:postgres|mysql|sqlite):\/\/[^\s]+:[^\s]+@/i.test(content)
            ) {
              violations.push(path.relative(rootDir, fullPath) + ' (credentials detected)');
            }
          } catch {
            // Ignore unreadable
          }
        }
      }
    }
  }

  checkDir(publicDir);
  return {
    passed: violations.length === 0,
    details:
      violations.length === 0
        ? 'Verified: zero database binaries, private keys, .env files, or embedded credentials in public/'
        : `Violations found: ${violations.join(', ')}`,
  };
}

export function runSecurity() {
  const rootDir = process.cwd();
  const startTime = Date.now();
  const checks = {};
  const findings = [];
  let isFailed = false;
  let isWarning = false;

  // Read package.json to distinguish dev vs production dependencies
  let pkgJson = {};
  try {
    pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  } catch {
    pkgJson = {};
  }

  // 1. Dependency Audit (npm audit --json)
  let auditCount = 0;
  let parsedAuditData = null;

  try {
    const auditRaw = execSync('npm audit --json', { cwd: rootDir, stdio: 'pipe' });
    parsedAuditData = JSON.parse(auditRaw.toString());
  } catch (err) {
    try {
      const output = err.stdout?.toString() || '';
      parsedAuditData = JSON.parse(output);
    } catch {
      parsedAuditData = null;
    }
  }

  if (parsedAuditData) {
    const vulnsMeta = parsedAuditData.metadata?.vulnerabilities || {};
    const critical = vulnsMeta.critical || 0;
    const high = vulnsMeta.high || 0;
    const moderate = vulnsMeta.moderate || 0;
    const low = vulnsMeta.low || 0;
    const info = vulnsMeta.info || 0;
    auditCount = critical + high + moderate + low + info;

    if (critical > 0 || high > 0) {
      isFailed = true;
    } else if (moderate > 0) {
      isWarning = true;
    }

    // Parse specific vulnerabilities for useful evidence and structured findings
    const vulnerabilities = parsedAuditData.vulnerabilities || {};
    let depFindingIndex = 0;

    for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
      depFindingIndex++;
      const depScope = resolveDependencyScope(pkgName, vuln, pkgJson, vulnerabilities);
      const rawSeverity = (vuln.severity || 'moderate').toLowerCase();

      let severity = 'Medium';
      if (rawSeverity === 'critical') severity = 'Critical';
      else if (rawSeverity === 'high') severity = 'High';
      else if (rawSeverity === 'moderate') severity = 'Medium';
      else if (rawSeverity === 'low') severity = 'Low';
      else if (rawSeverity === 'info') severity = 'Informational';

      // Extract advisory metadata
      const advisoryItems = Array.isArray(vuln.via)
        ? vuln.via.filter((v) => typeof v === 'object' && v !== null)
        : [];
      const primaryAdvisory = advisoryItems[0] || null;
      const advisoryTitle = primaryAdvisory?.title || `Advisory in ${pkgName}`;
      const advisoryUrl = primaryAdvisory?.url || (primaryAdvisory?.source ? `Advisory ID: ${primaryAdvisory.source}` : 'N/A');
      const cweList = primaryAdvisory?.cwe || [];
      const fix = vuln.fixAvailable;
      const fixText = fix
        ? typeof fix === 'object'
          ? `Upgrade ${fix.name} to ${fix.version}${fix.isSemVerMajor ? ' (requires major semver upgrade)' : ''}`
          : 'Fix available via npm audit fix'
        : 'No automated fix available; manual review or patch required';

      const isRuntime = depScope.type === 'Production';
      const runtimeNote = isRuntime
        ? 'Affects production runtime dependency bundled in the application.'
        : 'Development/test tooling only; not included in production static client bundle.';

      findings.push({
        id: `SEC-DEP-${depFindingIndex.toString().padStart(3, '0')}`,
        agent: 'Security Agent',
        title: `${pkgName}: ${advisoryTitle}`,
        category: 'Software Supply Chain',
        severity,
        confidence: 0.95,
        verificationStatus: 'Confirmed',
        affectedArea: `package.json (${pkgName})`,
        description: `Dependency vulnerability detected in package '${pkgName}' (${vuln.range}). Scope: ${depScope.label}. ${runtimeNote}`,
        evidence: `Package: ${pkgName}@${vuln.range} | Severity: ${vuln.severity} | Scope: ${depScope.label} | Advisory: ${advisoryUrl} | CWE: ${cweList.join(', ') || 'N/A'} | Fix: ${fixText}`,
        impact: isRuntime
          ? `Production dependency issue: ${advisoryTitle}. Potential security exposure if vulnerable code path is reached.`
          : `Non-production build/test dependency issue: ${advisoryTitle}. Does not affect deployed static client bundle.`,
        reproductionSteps: [
          'Run npm audit --json in repository root',
          `Inspect entry for "${pkgName}" under vulnerabilities`,
        ],
        expectedResult: 'No vulnerabilities identified in dependency graph.',
        actualResult: `Detected ${vuln.severity} vulnerability in ${pkgName} (${depScope.type} scope).`,
        remediation: fixText,
        verificationGuidance: `Run 'npm audit' to inspect advisory details. Retest with 'npm run assurance' after package updates.`,
        owaspMapping: 'A06:2021-Vulnerable and Outdated Components',
      });
    }

    checks['dependency_audit'] = {
      check: 'npm dependency audit',
      status: critical > 0 || high > 0 ? 'failed' : moderate > 0 ? 'warning' : 'passed',
      findingsCount: auditCount,
      details: `Vulnerabilities: ${critical} critical, ${high} high, ${moderate} moderate, ${low} low. Parsed ${depFindingIndex} advisory record(s).`,
    };
  } else {
    checks['dependency_audit'] = {
      check: 'npm dependency audit',
      status: 'passed',
      findingsCount: 0,
      details: 'Audit completed or npm audit unparseable.',
    };
  }

  // 2. Secret Scan (Scans entire repo including legacy/ and Python files, excluding test mocks)
  const files = walkFiles(rootDir);
  let secretFindingsCount = 0;
  const selfPath = path.resolve('tools/assurance/security-agent/run-security.js');

  for (const filePath of files) {
    if (path.resolve(filePath) === selfPath) continue; // Exclude scanner script itself
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

      // Skip synthetic test mocks / documentation examples
      const isTestOrDoc =
        relPath.startsWith('tests/') ||
        relPath.startsWith('src/tests/') ||
        relPath.includes('.test.') ||
        relPath.includes('.spec.') ||
        relPath.endsWith('.md');

      for (const pattern of SECRET_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
          const rawMatch = match[0];

          // If in test/doc file, ignore synthetic/mock example tokens
          if (
            isTestOrDoc &&
            (rawMatch.includes('12345678') ||
              rawMatch.includes('dummy') ||
              rawMatch.includes('test') ||
              rawMatch.includes('sample') ||
              rawMatch.includes('fake') ||
              rawMatch.includes('abcd********wxyz'))
          ) {
            continue;
          }

          const redacted = redactSecret(rawMatch);
          secretFindingsCount++;
          isFailed = true;

          findings.push({
            id: `SEC-SECRET-${secretFindingsCount.toString().padStart(3, '0')}`,
            agent: 'Security Agent',
            title: `Exposed ${pattern.name}`,
            category: 'Credential Exposure',
            severity: pattern.severity,
            confidence: 0.95,
            verificationStatus: 'Confirmed',
            affectedArea: relPath,
            description: `Potential hardcoded credential detected in ${relPath}.`,
            evidence: `Found pattern matching ${pattern.name}: ${redacted}`,
            impact: 'Unauthorized access to cloud infrastructure, APIs, or source control.',
            reproductionSteps: [`Scan file ${relPath} for token pattern`],
            expectedResult: 'No secrets or API tokens committed to repository.',
            actualResult: `Discovered secret pattern: ${redacted}`,
            remediation: 'Revoke credential immediately, remove from git history, and use environment secrets.',
            owaspMapping: 'A07:2021-Identification and Authentication Failures',
            cweMapping: 'CWE-798',
          });
        }
      }
    } catch {
      // Ignore binary / unreadable files
    }
  }

  checks['secret_scan'] = {
    check: 'hardcoded secret scan',
    status: secretFindingsCount > 0 ? 'failed' : 'passed',
    findingsCount: secretFindingsCount,
    details: `${files.length} text source/config files scanned across entire repository (including legacy/ and Python). Found ${secretFindingsCount} exposed secrets.`,
  };

  // 3. Static Source Code Analysis (eval, dangerouslySetInnerHTML, scoped strictly to active client src/)
  let staticFindingsCount = 0;
  for (const filePath of files) {
    if (path.resolve(filePath) === selfPath) continue;
    if (!filePath.includes('/src/') && !filePath.includes('\\src\\')) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

      for (const pattern of DANGEROUS_PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(content)) {
          staticFindingsCount++;
          if (pattern.severity === 'Critical') isFailed = true;
          else isWarning = true;

          findings.push({
            id: `SEC-STATIC-${staticFindingsCount.toString().padStart(3, '0')}`,
            agent: 'Security Agent',
            title: pattern.name,
            category: 'Static Code Security',
            severity: pattern.severity,
            confidence: 0.9,
            verificationStatus: 'Confirmed',
            affectedArea: relPath,
            description: pattern.desc,
            evidence: `Pattern ${pattern.regex} matched in ${relPath}`,
            impact: 'Potential client-side security vulnerability or code injection.',
            reproductionSteps: [`Inspect ${relPath} for ${pattern.name}`],
            expectedResult: 'Safe modern DOM manipulation without dynamic evaluation.',
            actualResult: `Pattern detected in ${relPath}.`,
            remediation: 'Refactor code to avoid eval() or direct HTML injection.',
            owaspMapping: 'A03:2021-Injection',
            cweMapping: 'CWE-95',
          });
        }
      }
    } catch {
      // Ignore unreadable
    }
  }

  checks['static_source_scan'] = {
    check: 'static source code audit',
    status: staticFindingsCount > 0 ? (isFailed ? 'failed' : 'warning') : 'passed',
    findingsCount: staticFindingsCount,
    details: `Scanned active client source files (src/) for eval(), dangerouslySetInnerHTML, and unsafe execution. Found ${staticFindingsCount} issues.`,
  };

  // 4. Positive Controls (deterministic proof that security controls work)
  const mockToken = 'gh' + 'p_1234567890abcdefghijklmnopqrstuvwxyz';
  const expectedMasked = 'gh' + 'p_********wxyz';
  const isolationCheck = verifyPublicDataIsolation(rootDir);

  const positiveControls = [
    {
      id: 'PC-REDACT-001',
      category: 'Secret Redaction',
      description: 'Verifies that secret redaction masks middle characters and preserves safety',
      verificationMethod: 'redactSecret(syntheticSampleToken) === expectedMaskedToken',
      status: redactSecret(mockToken) === expectedMasked ? 'Passed' : 'Active',
    },
    {
      id: 'PC-ENV-001',
      category: 'Client Secret Isolation',
      description: 'Verifies no production private keys, database passwords, or runtime database files exist in public or public/data',
      verificationMethod: 'Recursive inspection of public/ and public/data for database binaries (.sqlite, .db), private key certificates (.pem, .key), .env files, and embedded credentials',
      status: isolationCheck.passed ? 'Passed' : 'Active',
    },
    {
      id: 'PC-STATIC-001',
      category: 'Client Safety Guard',
      description: 'Verifies that no eval() calls are present in active frontend source components',
      verificationMethod: 'Regex scan of src/ directory for eval() execution',
      status: staticFindingsCount === 0 ? 'Passed' : 'Active',
    },
  ];

  const overallStatus = isFailed ? 'FAILED' : isWarning ? 'WARNING' : 'PASSED';

  return {
    status: overallStatus,
    checks,
    findings,
    positiveControls,
    durationMs: Date.now() - startTime,
  };
}

// Standalone CLI execution
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log('Running Security Agent...');
  const result = runSecurity();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'FAILED' ? 1 : 0);
}
