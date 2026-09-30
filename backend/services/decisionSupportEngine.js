/**
 * Problem Solving & Decision Support Engine
 * AI-Dost v3.0 - Category 16
 *
 * Provides structured multi-criteria decision analysis (MCDA), trade-off evaluation,
 * RICE scoring, and actionable recommendations across 10 core decision domains:
 * - Laptop selection
 * - Course selection
 * - Project tech stack
 * - Cloud provider comparison
 * - Database selection
 * - Framework selection
 * - Career options
 * - Study priorities
 * - Budget planning
 * - Feature prioritization
 */

const DECISION_DOMAINS = [
  {
    id: 'laptop-selection',
    name: 'Laptop & Hardware Selection',
    icon: '💻',
    category: 'Hardware',
    criteria: ['Budget & Value', 'CPU / GPU Performance', 'RAM & Expandability', 'Battery Life & Thermals', 'Build Quality & Display'],
    description: 'Hardware recommendation matrix for coding, AI/ML training, gaming, video editing, and college students.'
  },
  {
    id: 'course-selection',
    name: 'Course & Certification Selection',
    icon: '🎓',
    category: 'Education',
    criteria: ['ROI & Cost', 'Syllabus Depth & Rigor', 'Portfolio Projects', 'Instructor Credibility', 'Industry Recognition'],
    description: 'Compares online degrees, bootcamps, courses, and certifications on real career ROI and syllabus depth.'
  },
  {
    id: 'tech-stack',
    name: 'Project Tech Stack Selection',
    icon: '🏗️',
    category: 'Engineering',
    criteria: ['Developer Velocity', 'Ecosystem & Libraries', 'Hiring Pool', 'Scalability & Performance', 'Operational Overhead'],
    description: 'Architecture evaluation balancing team velocity, long-term maintenance, and scale.'
  },
  {
    id: 'cloud-provider',
    name: 'Cloud Provider Comparison',
    icon: '☁️',
    category: 'Infrastructure',
    criteria: ['Pricing & Free Tier', 'Egress & Network Costs', 'Managed AI / GPU Services', 'Global Latency', 'Developer Ergonomics'],
    description: 'Head-to-head analysis of AWS, GCP, Azure, Cloudflare, DigitalOcean, and Hetzner for your workload.'
  },
  {
    id: 'database-selection',
    name: 'Database Architecture Selection',
    icon: '🗄️',
    category: 'Data & Storage',
    criteria: ['Data Structure (Relational vs Doc vs Key-Value)', 'Read / Write Ratio', 'ACID Consistency', 'Vector & Search Support', 'Hosting & Maintenance'],
    description: 'PostgreSQL vs MongoDB vs Redis vs ClickHouse vs SQLite vs DynamoDB tailored to query patterns.'
  },
  {
    id: 'framework-selection',
    name: 'Framework & Library Selection',
    icon: '⚡',
    category: 'Software',
    criteria: ['Performance & Bundle Size', 'SEO & SSR / Hydration', 'Community & Docs', 'Learning Curve', 'Long-Term Viability'],
    description: 'React/Vite vs Next.js vs Astro vs SvelteKit vs Express vs FastAPI vs Go/Gin comparison.'
  },
  {
    id: 'career-options',
    name: 'Career Path & Role Decision',
    icon: '🚀',
    category: 'Career',
    criteria: ['Market Demand & Hiring', 'Salary Ceiling', 'Work-Life Balance', 'Learning Curve', 'AI Automation Resilience'],
    description: 'Evaluates AI Engineer vs Full-Stack vs Data Scientist vs DevOps vs Product Engineer paths.'
  },
  {
    id: 'study-priorities',
    name: 'Study & Exam Priorities',
    icon: '📖',
    category: 'Academics',
    criteria: ['Exam Weightage', 'Current Weakness', 'Time to Master', 'High-Yield Multiplier', 'Prerequisite Urgency'],
    description: 'Eisenhower matrix (Urgent vs Important) and weighted scoring to maximize study output under tight deadlines.'
  },
  {
    id: 'budget-planning',
    name: 'Budget & Financial Allocation',
    icon: '💰',
    category: 'Finance',
    criteria: ['Cost-Benefit Ratio', 'Payback Period / Break-even', 'Capex vs Opex', 'Downside Risk', 'Opportunity Cost'],
    description: 'Strategic allocation for tech projects, personal purchases, SaaS subscriptions, or business investments.'
  },
  {
    id: 'feature-prioritization',
    name: 'Feature Prioritization (RICE / MoSCoW)',
    icon: '🎯',
    category: 'Product',
    criteria: ['Reach (Users Impacted)', 'Impact (Score 1-3)', 'Confidence (Percentage)', 'Effort (Person-Weeks)', 'MoSCoW Status'],
    description: 'RICE scoring and MoSCoW (Must, Should, Could, Won\'t) matrix for engineering roadmaps and product MVPs.'
  }
];

const DECISION_SUPPORT_DIRECTIVE = `
=== AI-DOST CATEGORY 16: PROBLEM SOLVING & DECISION SUPPORT DIRECTIVE (2030 MCDA SUITE) ===
You are AI-Dost's Principal Decision Scientist, Executive Strategist & Chief Technology Advisor.
When the user requests structured analysis, selection, or comparison across options:

1. SCIENTIFIC DECISION PROTOCOL:
   Never give vague, wishy-washy advice like "it depends on your preference."
   Deconstruct the problem using Multi-Criteria Decision Analysis (MCDA):
   - Identify candidate options (minimum 2-3).
   - Evaluate against 4-5 weighted criteria on a 1-10 scale.
   - Present a clear, unambiguous winner with conditions.

2. STRUCTURED RESPONSE FORMAT:
   - 🏆 **The Verdict & Executive Recommendation**: 2-3 sentences declaring the clear optimal choice for their exact situation.
   - 📊 **Weighted Evaluation Matrix**: Markdown table comparing candidates across domain criteria (scored 1-10) with Total Score.
   - ⚖️ **Pros, Cons & Critical Trade-offs**: Bullet points detailing real hidden catches (pricing traps, cold starts, vendor lock-in).
   - 🔄 **Reversibility Assessment**:
     - Type 1 (Irreversible / High-Stakes) vs Type 2 (Reversible / Low-Risk).
     - How to backtrack or pivot if the decision fails.
   - 🗺️ **Immediate Action Checklist**: 3-4 concrete next steps to execute today.

3. DOMAIN-SPECIFIC HEURISTICS:
   - Laptop: Ask or state RAM (minimum 16GB for dev, 32GB for local LLMs/Docker), GPU VRAM, thermal throttling, price in ₹ or $.
   - Course: Verify hands-on project depth, syllabus recency (2025/2026 stack), certificate real-world credibility vs marketing fluff.
   - Tech Stack & DB: Differentiate between Day-1 MVP velocity vs Day-1000 scale. Default to boring, reliable tech unless specific requirement forces bleeding-edge.
   - Cloud: Emphasize egress bandwidth pricing, managed service lock-in, and free-tier longevity.
   - Feature Prioritization: Calculate RICE Score: (Reach × Impact × Confidence) / Effort.

4. TONE & EMPATHY:
   - Decisive, objective, analytical, and respectful.
   - If user asks in Hindi/Hinglish, explain trade-offs in sharp, relatable Hinglish.
`;

/**
 * Detect decision support & problem solving intent from user query.
 */
function detectDecisionIntent(message) {
  if (!message || typeof message !== 'string') {
    return { isDecision: false };
  }

  const clean = message.trim();
  const lower = clean.toLowerCase();

  // 1. Laptop selection
  if (/(?:laptop|macbook|thinkpad|gaming laptop|coding laptop|konsa laptop lu|laptop selection|best laptop under|which laptop to buy)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'laptop-selection',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'laptop-selection'),
      inputQuery: clean
    };
  }

  // 2. Course selection
  if (/(?:course|certification|bootcamp|konsa course|course selection|which course|udemy|coursera|worth it|certificate value)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'course-selection',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'course-selection'),
      inputQuery: clean
    };
  }

  // 3. Project tech stack
  if (/(?:tech stack|technology stack|stack selection|konsa stack|full stack choice|mern vs|architecture stack|project stack)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'tech-stack',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'tech-stack'),
      inputQuery: clean
    };
  }

  // 4. Cloud provider comparison
  if (/(?:cloud provider|aws vs gcp|aws vs azure|cloud comparison|which cloud|cloudflare vs|hetzner vs|digitalocean vs|cloud hosting choice)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'cloud-provider',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'cloud-provider'),
      inputQuery: clean
    };
  }

  // 5. Database selection
  if (/(?:database|postgres vs mongo|sql vs nosql|db selection|which database|sqlite vs|clickhouse vs|redis vs|vector db selection|konsa database)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'database-selection',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'database-selection'),
      inputQuery: clean
    };
  }

  // 6. Framework selection
  if (/(?:framework|next\.?js vs|react vs vue|svelte vs|vite vs|express vs fastapi|which framework|konsa framework|framework selection)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'framework-selection',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'framework-selection'),
      inputQuery: clean
    };
  }

  // 7. Career options
  if (/(?:career option|career choice|konsi field|ai engineer vs|full stack vs data science|devops vs|career switch|which job role|career path)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'career-options',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'career-options'),
      inputQuery: clean
    };
  }

  // 8. Study priorities
  if (/(?:study priorit|what to study first|exam preparation priority|kya pehle padhe|syllabus prioritize|eisenhower matrix study|high yield topics)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'study-priorities',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'study-priorities'),
      inputQuery: clean
    };
  }

  // 9. Budget planning
  if (/(?:budget plan|budget allocation|capex vs opex|cost benefit|roi calculation|50\/30\/20 budget|financial decision|kharche ka plan|budget planning)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'budget-planning',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'budget-planning'),
      inputQuery: clean
    };
  }

  // 10. Feature prioritization
  if (/(?:feature priorit|rice score|rice framework|moscow priorit|roadmap priorit|konsa feature pehle|backlog prioritize|mvp features)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'feature-prioritization',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'feature-prioritization'),
      inputQuery: clean
    };
  }

  // Generic Decision / Comparison / Pros vs Cons trigger
  if (/(?:decision support|decision matrix|pros and cons|compare options|which one should i choose|konsa choose karein|compare.*vs|trade-?offs between)/i.test(lower)) {
    return {
      isDecision: true,
      domain: 'tech-stack',
      domainConfig: DECISION_DOMAINS.find(d => d.id === 'tech-stack'),
      inputQuery: clean
    };
  }

  return { isDecision: false };
}

module.exports = {
  DECISION_DOMAINS,
  DECISION_SUPPORT_DIRECTIVE,
  detectDecisionIntent
};
