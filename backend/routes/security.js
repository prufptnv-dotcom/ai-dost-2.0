const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const CerebrasService = require('../services/cerebrasService');
const OpenRouterService = require('../services/openrouterService');
const {
  SECURITY_DOMAINS,
  CYBERSECURITY_DEFENSIVE_DIRECTIVE
} = require('../services/cybersecurityEngine');

/**
 * Execute AI call with full failover cascade
 */
async function callSecurityCascade(prompt, systemInstruction = '') {
  const fullPrompt = `${systemInstruction}\n\n${prompt}`.trim();

  // 1. Try Groq
  try {
    const res = await GroqService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[SecurityCascade] Groq attempt failed: ${e.message}`);
  }

  // 2. Try Gemini
  try {
    const res = await GeminiService.chat(fullPrompt, [], null, 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[SecurityCascade] Gemini attempt failed: ${e.message}`);
  }

  // 3. Try Cerebras
  try {
    const res = await CerebrasService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[SecurityCascade] Cerebras attempt failed: ${e.message}`);
  }

  // 4. Try OpenRouter
  try {
    const res = await OpenRouterService.chat(fullPrompt, []);
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[SecurityCascade] OpenRouter attempt failed: ${e.message}`);
  }

  return null;
}

// 1. List Domains & Standards
router.get('/domains', (_req, res) => {
  res.json({
    success: true,
    domains: SECURITY_DOMAINS
  });
});

// 2. Code Vulnerability Audit & Hardening
router.post('/audit', async (req, res) => {
  try {
    const {
      code = '',
      language = 'javascript',
      domain = 'secure-coding',
      context = ''
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Code snippet is required for security audit.' });
    }

    const dConfig = SECURITY_DOMAINS.find(d => d.id === domain) || SECURITY_DOMAINS[0];

    const prompt = `
Task: Defensive Code Security Audit & Hardening
Language / Runtime: ${language}
Security Domain: ${dConfig.name}
Standards: ${dConfig.standards.join(', ')}
${context ? `System Context: ${context}` : ''}

Code to Audit:
\`\`\`${language}
${code.trim()}
\`\`\`

Strict Defensive Guidelines:
1. 🛡️ **Vulnerability Findings**: Identify any CWE / OWASP vulnerabilities in the snippet with severity (High/Medium/Low).
2. ❌ **Vulnerable Anti-Pattern**: Clearly explain why this pattern is insecure.
3. ✅ **Hardened Production Remediation**: Provide the complete, drop-in, corrected code snippet with parameterized queries, input validation, or cryptographic best practices.
4. 🔍 **Verification Test**: A simple defensive unit test or static assertion to confirm the flaw is patched.
`;

    const aiResponse = await callSecurityCascade(prompt, CYBERSECURITY_DEFENSIVE_DIRECTIVE);

    if (aiResponse) {
      return res.json({
        success: true,
        domain,
        audit: aiResponse
      });
    }

    // Deterministic fallback remediation
    const fallbackResponse = `### 🛡️ Defensive Security Audit: ${dConfig.name}

#### ❌ Potential Vulnerability Identified
- **Issue**: Potential unvalidated input or dynamic concatenation in query/execution path.
- **Risk Level**: High (CWE-89 / CWE-79)

#### ✅ Hardened Drop-in Remediation
\`\`\`${language}
// Hardened implementation with strict parameterization & validation
// 1. Validate inputs with strict schema (e.g. Zod / Joi)
// 2. Use parameterized queries or prepared statements
// 3. Apply context-aware encoding before output
\`\`\`

#### 📋 Defensive Verification
- Ensure automated static analysis (e.g. Semgrep) checks for raw string concatenation.
- Verify least-privilege DB credentials in production.`;

    return res.json({
      success: true,
      domain,
      audit: fallbackResponse,
      fallback: true
    });
  } catch (err) {
    logger.error(`[SecurityRoute] Audit error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Security audit analysis error.' });
  }
});

// 3. Production Security Headers Generator
router.post('/headers', (req, res) => {
  try {
    const {
      framework = 'express',
      domainName = 'example.com',
      enableHsts = true,
      enableCsp = true
    } = req.body;

    let headersConfig = {};

    if (framework === 'express') {
      headersConfig = {
        framework: 'Express (Helmet.js)',
        codeSnippet: `const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'strict-dynamic'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));`
      };
    } else if (framework === 'nextjs') {
      headersConfig = {
        framework: 'Next.js (next.config.mjs)',
        codeSnippet: `// next.config.mjs
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
];

export default {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};`
      };
    } else {
      headersConfig = {
        framework: 'Nginx',
        codeSnippet: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'none';" always;`
      };
    }

    return res.json({
      success: true,
      ...headersConfig
    });
  } catch (err) {
    logger.error(`[SecurityRoute] Headers error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Security headers configuration error.' });
  }
});

// 4. STRIDE Threat Model Generator
router.post('/threat-model', async (req, res) => {
  try {
    const {
      systemDescription = '',
      components = ['Web Client', 'API Gateway', 'PostgreSQL DB', 'Redis Cache', 'Payment Service']
    } = req.body;

    if (!systemDescription && components.length === 0) {
      return res.status(400).json({ success: false, error: 'System description or component list is required.' });
    }

    const prompt = `
Task: STRIDE Architectural Threat Model
System Description: ${systemDescription || 'Standard Modern Web Application'}
Key Components: ${components.join(', ')}

Analyze the architecture across the 6 STRIDE Threat Categories:
1. **S**poofing (Identity verification, token theft)
2. **T**ampering (Data integrity in transit or at rest)
3. **R**epudiation (Audit trails, non-repudiation of transactions)
4. **I**nformation Disclosure (PII leaks, error stack traces, logging secrets)
5. **D**enial of Service (Resource exhaustion, unthrottled endpoints)
6. **E**levation of Privilege (BOLA, vertical privilege escalation)

Output format:
- Markdown table with columns: [STRIDE Category, Component Affected, Threat Scenario, Impact, Mitigation Control].
- Top 3 Critical Recommendations.
`;

    const aiResponse = await callSecurityCascade(prompt, CYBERSECURITY_DEFENSIVE_DIRECTIVE);

    if (aiResponse) {
      return res.json({
        success: true,
        threatModel: aiResponse
      });
    }

    const fallbackModel = `### 🗺️ STRIDE Threat Model

| STRIDE Category | Component | Threat Scenario | Impact | Mitigation Control |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | API Gateway | Attacker presents forged JWT | Critical | Enforce asymmetric RS256 signature check & secret key rotation |
| **Tampering** | Network In-Transit | Man-in-the-middle data alteration | High | Enforce TLS 1.3 with strict HSTS preload |
| **Repudiation** | Payment Service | User denies placing transaction | Medium | Cryptographically signed append-only audit log with request ID |
| **Information Disclosure** | PostgreSQL DB | PII or password leaks | Critical | Column-level encryption (AES-256-GCM) & Argon2id password hashing |
| **Denial of Service** | API Gateway | High-rate unauthenticated requests | High | Distributed Redis token-bucket rate limiter & cloud DDoS shield |
| **Elevation of Privilege** | User Service | User changes \`role\` to \`admin\` via BOLA | Critical | Strict RBAC authorization checks at service layer, never trust client input |

#### 🎯 Top 3 Immediate Actions
1. Implement centralized authorization guards (RBAC/ABAC).
2. Configure automated rate limiting on all public endpoints.
3. Establish comprehensive request-ID correlation logging.`;

    return res.json({
      success: true,
      threatModel: fallbackModel,
      fallback: true
    });
  } catch (err) {
    logger.error(`[SecurityRoute] Threat model error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Threat modeling service failed.' });
  }
});

module.exports = router;
