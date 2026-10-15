/**
 * Cybersecurity & Defensive Architecture Engine
 * AI-Dost v3.0 - Category 17
 *
 * Provides defensive security engineering, secure coding standards,
 * OWASP Top 10 mitigation patterns, threat modeling, and audit checklists.
 *
 * SAFETY MANDATE: Strictly defensive, remediation, and educational.
 * No offensive exploits, malware creation, or attack payloads.
 */

const SECURITY_DOMAINS = [
  {
    id: 'owasp-top-10',
    name: 'OWASP Top 10 Defense',
    icon: '🛡️',
    category: 'Application Security',
    standards: ['OWASP Top 10:2021', 'NIST SP 800-53', 'CWE Top 25'],
    description: 'Defense architectures against Injection, Broken Access Control, Cryptographic Failures, SSRF, and Security Misconfiguration.'
  },
  {
    id: 'secure-coding',
    name: 'Secure Coding Practices',
    icon: '💻',
    category: 'Engineering',
    standards: ['CERT Secure Coding', 'OWASP ASVS Level 2'],
    description: 'Language-specific secure patterns for Node.js, Python, Go, and React avoiding prototype pollution, path traversal, and unsafe deserialization.'
  },
  {
    id: 'auth-security',
    name: 'Authentication & Password Security',
    icon: '🔑',
    category: 'Identity',
    standards: ['NIST SP 800-63B', 'OWASP Auth Cheat Sheet'],
    description: 'Password hashing with Argon2id / bcrypt, salt rounds, TOTP multi-factor authentication, brute-force throttling, and session fixation guards.'
  },
  {
    id: 'jwt-security',
    name: 'JWT & Token Security',
    icon: '🎫',
    category: 'Identity',
    standards: ['RFC 7519', 'OWASP JWT Cheat Sheet'],
    description: 'Algorithm confusion mitigation (RS256 vs HS256), short-lived access tokens, rotation of refresh tokens via HTTP-only SameSite cookies.'
  },
  {
    id: 'api-security',
    name: 'API Security & BOLA Defense',
    icon: '🔌',
    category: 'API & Microservices',
    standards: ['OWASP API Security Top 10'],
    description: 'Broken Object Level Authorization (BOLA/IDOR) defense, rate limiting, request validation schemas (Zod/Joi), and CORS policies.'
  },
  {
    id: 'sqli-prevention',
    name: 'SQL Injection Prevention',
    icon: '🗄️',
    category: 'Data Security',
    standards: ['CWE-89', 'OWASP SQLi Prevention'],
    description: 'Parameterized queries, prepared statements, safe ORM usage (Prisma, TypeORM, SQLAlchemy, Knex), and least-privilege DB users.'
  },
  {
    id: 'xss-csrf-protection',
    name: 'XSS & CSRF Mitigation',
    icon: '🌐',
    category: 'Web Security',
    standards: ['CWE-79', 'CWE-352', 'OWASP XSS / CSRF'],
    description: 'Context-aware output encoding, DOMPurify, Content Security Policy (CSP) nonces, and Anti-CSRF Double-Submit Cookie patterns.'
  },
  {
    id: 'security-headers',
    name: 'Security Headers & Hardening',
    icon: '📋',
    category: 'Infrastructure',
    standards: ['Mozilla Web Security Guidelines', 'OWASP Secure Headers'],
    description: 'Production configuration for HSTS, Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options, and Permissions-Policy.'
  },
  {
    id: 'threat-modeling',
    name: 'STRIDE Threat Modeling',
    icon: '🗺️',
    category: 'Architecture',
    standards: ['Microsoft STRIDE', 'PASTA', 'NIST SP 800-154'],
    description: 'Systematic architectural threat analysis across Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.'
  },
  {
    id: 'vulnerability-assessment',
    name: 'Code Auditing & Vulnerability Review',
    icon: '🔍',
    category: 'Audit & Compliance',
    standards: ['Semgrep Rules', 'SAST / DAST Guidelines'],
    description: 'Source code security review, static analysis rule authoring, dependency vulnerability triage (npm audit / Trivy), and remediation.'
  },
  {
    id: 'incident-response',
    name: 'Incident Response & Triage',
    icon: '🚨',
    category: 'SecOps',
    standards: ['NIST SP 800-61 Rev 2', 'SANS PICERL'],
    description: 'Preparation, Identification, Containment, Eradication, Recovery, and Lessons Learned (PICERL) breach response runbooks.'
  },
  {
    id: 'security-checklist',
    name: 'Pre-Deployment Security Checklist',
    icon: '✅',
    category: 'DevSecOps',
    standards: ['CIS Benchmarks', 'OWASP Deployment Checklist'],
    description: 'Production go-live checklist covering environment variables, secret management, Docker isolation, HTTPS enforcement, and backup integrity.'
  }
];

const CYBERSECURITY_DEFENSIVE_DIRECTIVE = `
=== AI-DOST CATEGORY 17: CYBERSECURITY & DEFENSIVE ENGINEERING DIRECTIVE ===
You are AI-Dost's Principal Application Security Architect & Defensive Cybersecurity Engineer.
Your mandate is strictly DEFENSIVE, REMEDIATION, AUDITING, and EDUCATIONAL.

CORE PRINCIPLES:
1. DEFENSE-IN-DEPTH & LEAST PRIVILEGE:
   - Always assume individual layers can fail. Recommend defense across network, host, container, application, and database.
   - Enforce least privilege: database accounts should only have SELECT/INSERT/UPDATE where necessary; never grant SUPERUSER or DROP in web connection pools.

2. NEVER GENERATE EXPLOITS OR MALICIOUS PAYLOADS:
   - When discussing vulnerabilities (SQLi, XSS, CSRF, SSRF), do NOT write functional attack scripts or weaponized payloads.
   - Strictly focus on:
     a) Why the vulnerable pattern is dangerous.
     b) The exact secure, hardened code implementation (Drop-in fix).
     c) The underlying cryptographic or architectural principle.

3. STRUCTURED AUDIT & REMEDIATION FORMAT:
   - 🛡️ **Vulnerability & Threat Summary**: CWE / OWASP ID, severity (Low / Medium / High / Critical), and business risk.
   - ❌ **Vulnerable Anti-Pattern**: Highlight the flaw (e.g. string concatenation in SQL, unescaped innerHTML, missing token expiration).
   - ✅ **Hardened Production Remediation**: Complete, production-grade drop-in code snippet using modern, secure best practices (e.g. parameterized queries, DOMPurify, Argon2id, crypto.timingSafeEqual).
   - 🔍 **Verification & Testing**: How to verify the fix defensively (unit test, linter rule, or header probe).
   - 📋 **Hardening Checklist**: 2-3 supporting defense-in-depth steps.

4. ACCURATE CRYPTOGRAPHIC STANDARDS (2026+ BASELINE):
   - Password Hashing: Default to Argon2id (m=65536, t=3, p=4) or bcrypt (work factor >= 12). Never MD5, SHA-1, or plain SHA-256 without salt/KDF.
   - JWT: Always specify \`algorithms: ['RS256']\` explicitly on verification to prevent algorithm confusion (\`none\` or \`HS256\` substitution).
   - Randomness: Always use cryptographically secure PRNG (\`crypto.randomBytes\`, \`crypto.getRandomValues\`). Never \`Math.random()\` for secrets or tokens.
   - Timing Attacks: Use constant-time comparison (\`crypto.timingSafeEqual\`) for API keys and tokens.

5. TONE & EMPATHY:
   - Authoritative, clear, and reassuring. If user asks in Hindi/Hinglish, explain security concepts in accessible, clear Hinglish.
`;

/**
 * Detect cybersecurity & defensive engineering intent from user query.
 */
function detectSecurityIntent(message) {
  if (!message || typeof message !== 'string') {
    return { isSecurity: false };
  }

  const clean = message.trim();
  const lower = clean.toLowerCase();

  // 1. OWASP Top 10
  if (/(?:owasp|owasp top 10|broken access control|ssrf|insecure deserialization|security misconfiguration)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'owasp-top-10',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'owasp-top-10'),
      inputQuery: clean
    };
  }

  // 2. SQL Injection prevention
  if (/(?:sql injection|sqli|sql inject|parameterized query|prepared statement|prevent sqli|sql injection prevention)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'sqli-prevention',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'sqli-prevention'),
      inputQuery: clean
    };
  }

  // 3. XSS & CSRF
  if (/(?:xss|csrf|cross site scripting|cross-site request forgery|dompurify|csp nonce|content security policy|same site cookie)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'xss-csrf-protection',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'xss-csrf-protection'),
      inputQuery: clean
    };
  }

  // 4. JWT security
  if (/(?:jwt security|jwt token|json web token|jwt expire|token refresh|rs256|algorithm confusion|jwt best practices)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'jwt-security',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'jwt-security'),
      inputQuery: clean
    };
  }

  // 5. Password hashing & Auth security
  if (/(?:password hash|argon2|bcrypt|salt rounds|password security|mfa|2fa|brute force protection|session fixation|auth security)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'auth-security',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'auth-security'),
      inputQuery: clean
    };
  }

  // 6. Security Headers
  if (/(?:security headers|hsts|strict-transport-security|x-frame-options|x-content-type-options|helmet js|permissions-policy)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'security-headers',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'security-headers'),
      inputQuery: clean
    };
  }

  // 7. API security
  if (/(?:api security|bola|idor|broken object level|rate limit api|api throttling|cors security|api authentication)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'api-security',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'api-security'),
      inputQuery: clean
    };
  }

  // 8. Threat modeling
  if (/(?:threat model|threat modeling|stride|pasta threat|data flow diagram security|trust boundary)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'threat-modeling',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'threat-modeling'),
      inputQuery: clean
    };
  }

  // 9. Vulnerability assessment & Code auditing
  if (/(?:vulnerability assessment|security audit|code audit|sast|static analysis|semgrep|security review|check code for vulnerabilities|audit this code)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'vulnerability-assessment',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'vulnerability-assessment'),
      inputQuery: clean
    };
  }

  // 10. Incident Response
  if (/(?:incident response|picerl|breach response|security incident|containment strategy|data breach triage)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'incident-response',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'incident-response'),
      inputQuery: clean
    };
  }

  // 11. Security Checklist
  if (/(?:security checklist|pre-deployment security|production hardening|security audit checklist|go-live security checklist)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'security-checklist',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'security-checklist'),
      inputQuery: clean
    };
  }

  // 12. General Cybersecurity / Secure Coding / CTF education
  if (/(?:cybersecurity|cyber security|secure coding|defensive security|networking security|ctf concept|ctf challenge explanation|infosec)/i.test(lower)) {
    return {
      isSecurity: true,
      domain: 'secure-coding',
      domainConfig: SECURITY_DOMAINS.find(d => d.id === 'secure-coding'),
      inputQuery: clean
    };
  }

  return { isSecurity: false };
}

module.exports = {
  SECURITY_DOMAINS,
  CYBERSECURITY_DEFENSIVE_DIRECTIVE,
  detectSecurityIntent
};
