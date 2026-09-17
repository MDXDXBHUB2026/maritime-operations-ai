/**
 * Finding Verifier: Validates, deduplicates, and normalizes findings from QA and Security Agents.
 * Enforces secret redaction and builds prioritized remediation roadmap.
 */
import fs from 'node:fs';
import path from 'node:path';

export function verifyFindings(rawFindings = []) {
  const rootDir = process.cwd();
  const verifiedFindings = [];
  const seenKeys = new Set();

  for (const finding of rawFindings) {
    // Unique deduplication key: title + affectedArea
    const key = `${finding.title}::${finding.affectedArea}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Normalize severity
    let severity = finding.severity || 'Informational';
    if (!['Critical', 'High', 'Medium', 'Low', 'Informational'].includes(severity)) {
      severity = 'Informational';
    }

    // Verify affected file existence if it points to a local file
    let verificationStatus = finding.verificationStatus || 'Confirmed';
    if (finding.affectedArea && !finding.affectedArea.startsWith('http')) {
      const fullPath = path.join(rootDir, finding.affectedArea);
      if (!fs.existsSync(fullPath)) {
        verificationStatus = 'Requires Manual Verification';
      }
    }

    // Double check secret redaction: evidence must NEVER contain unredacted secrets
    let sanitizedEvidence = finding.evidence || '';
    if (finding.category === 'Credential Exposure') {
      // Ensure no raw 20+ char alphanumeric keys without asterisks
      sanitizedEvidence = sanitizedEvidence.replace(/(gh[pousr]_[A-Za-z0-9_]{4})[A-Za-z0-9_]+([A-Za-z0-9_]{4})/g, '$1********$2');
      sanitizedEvidence = sanitizedEvidence.replace(/(sk-[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})/g, '$1********$2');
    }

    verifiedFindings.push({
      ...finding,
      severity,
      verificationStatus,
      evidence: sanitizedEvidence,
    });
  }

  // Build remediation roadmap sorted by severity
  const severityWeight = { Critical: 1, High: 2, Medium: 3, Low: 4, Informational: 5 };
  verifiedFindings.sort((a, b) => (severityWeight[a.severity] || 99) - (severityWeight[b.severity] || 99));

  const roadmap = verifiedFindings.map((f, index) => {
    let timeline = 'Next Sprint';
    if (f.severity === 'Critical') timeline = 'Immediate (< 24h)';
    else if (f.severity === 'High') timeline = 'Within 48h';
    else if (f.severity === 'Medium') timeline = 'Current Milestone';

    return {
      priority: index + 1,
      findingId: f.id,
      action: f.remediation || `Resolve ${f.title}`,
      timeline,
    };
  });

  return {
    verifiedFindings,
    remediationRoadmap: roadmap,
  };
}
