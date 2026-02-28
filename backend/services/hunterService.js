/**
 * Hunter.io Service
 * 1. Domain Search  — finds real HR emails for a company domain
 * 2. Email Verifier — confirms an email is deliverable before sending
 *
 * Free tier: 25 searches + 50 verifications / month
 */

const https = require('https');

const HR_DEPARTMENTS = ['human resources', 'hr', 'talent', 'recruiting', 'people', 'staffing'];
const HR_POSITIONS   = ['hr', 'recruiter', 'talent', 'hiring', 'people', 'workforce', 'human resources', 'acquisition'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = parsed.hostname.replace(/^www\./, '').split('.');
    if (parts.length >= 2) return parts.slice(-2).join('.');
    return parsed.hostname;
  } catch {
    const clean = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    const parts = clean.split('.');
    if (parts.length >= 2) return parts.slice(-2).join('.');
    return clean || null;
  }
}

function hrScore(entry) {
  let score = entry.confidence || 0;
  const dept = (entry.department || '').toLowerCase();
  const pos  = (entry.position  || '').toLowerCase();
  if (HR_DEPARTMENTS.some(k => dept.includes(k))) score += 60;
  if (HR_POSITIONS.some(k => pos.includes(k)))    score += 40;
  const val = (entry.value || '').toLowerCase();
  if (['hr@', 'careers@', 'recruiting@', 'talent@', 'jobs@', 'people@'].some(p => val.startsWith(p))) score += 30;
  return score;
}

function httpsGet(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── Hunter.io API calls ───────────────────────────────────────────────────────

async function hunterDomainSearch(domain, apiKey) {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${encodeURIComponent(apiKey)}`;
  const res = await httpsGet(url);
  return res?.data || null;
}

/**
 * Verify a single email address with Hunter.io
 * @returns {{ deliverable: boolean, result: string, score: number }} or null on error
 *   result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
 */
async function hunterVerifyEmail(email, apiKey) {
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(apiKey)}`;
  const res = await httpsGet(url);
  if (!res?.data) return null;
  const d = res.data;
  return {
    result:      d.result,                          // 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
    deliverable: d.result === 'deliverable',
    risky:       d.result === 'risky',
    score:       d.score || 0,
    mxRecords:   d.mx_records || false,
    smtpCheck:   d.smtp_check || false,
  };
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Find the best deliverable HR email for a company.
 * Strategy:
 *  1. Hunter.io domain search → ranked by HR-relevance
 *  2. Verify top candidates until we find a deliverable one
 *  3. Accept 'risky' if nothing deliverable found (still worth trying)
 *  4. Return null if all are undeliverable
 */
async function findHREmail(companyName, siteUrl) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { email: null, confidence: 0, source: 'none', domain: null };

  const domain = extractDomain(siteUrl) || extractDomain(companyName);
  if (!domain || domain.length < 4) return { email: null, confidence: 0, source: 'none', domain: null };

  const data = await hunterDomainSearch(domain, apiKey);
  if (!data || !Array.isArray(data.emails) || data.emails.length === 0) {
    return { email: null, confidence: 0, source: 'none', domain };
  }

  // Sort by HR-relevance and pick top 3 to verify
  const sorted   = [...data.emails].sort((a, b) => hrScore(b) - hrScore(a));
  const toVerify = sorted.slice(0, 3);

  let chosen       = null;
  let verifyResult = null;

  for (const candidate of toVerify) {
    const verification = await hunterVerifyEmail(candidate.value, apiKey);

    if (!verification) {
      // Verifier failed (network / quota) — accept Hunter.io confidence as-is
      chosen       = candidate;
      verifyResult = { result: 'unknown', deliverable: false, risky: false, score: candidate.confidence || 50 };
      break;
    }

    if (verification.deliverable) {
      chosen       = candidate;
      verifyResult = verification;
      break;                       // ← best possible result, stop here
    }

    if (verification.risky && !chosen) {
      chosen       = candidate;   // ← keep as fallback, keep checking
      verifyResult = verification;
    }
    // undeliverable → skip to next candidate
  }

  if (!chosen) {
    return { email: null, confidence: 0, source: 'hunter', domain, verifyResult: 'all_undeliverable' };
  }

  return {
    email:       chosen.value,
    confidence:  chosen.confidence || 50,
    source:      'hunter',
    domain,
    verified:    verifyResult?.deliverable || false,
    verifyResult: verifyResult?.result || 'unknown',
    position:    chosen.position    || null,
    department:  chosen.department  || null,
    allEmails:   sorted.slice(0, 3).map(e => ({
      email:      e.value,
      confidence: e.confidence,
      position:   e.position,
      department: e.department,
    })),
  };
}

module.exports = { findHREmail, extractDomain, hunterVerifyEmail };
