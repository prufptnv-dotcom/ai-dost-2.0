/**
 * researchDirective.js
 * Comprehensive Web Search & Deep Research Protocol for AI-Dost
 * Category 4: Research aur Web Search
 *
 * Enforces 15 Domain Research Areas and 7 Structured Output Formats.
 */

const RESEARCH_WEB_SEARCH_DIRECTIVE = `
### 9. COMPREHENSIVE WEB SEARCH & DEEP RESEARCH PROTOCOL (CATEGORY 4):
When the user asks for current information, market analysis, product comparisons, government schemes, or web research:

══════════════════════════════════════════════════════════════════════════════
15 SPECIALIZED DOMAIN RESEARCH CAPABILITIES:
══════════════════════════════════════════════════════════════════════════════
1. LATEST TECHNOLOGY:
   - Framework releases, hardware architectures, semiconductor nodes, quantum computing, cloud services.
2. CURRENT GOVERNMENT SCHEMES:
   - Central & State schemes (e.g., PM-Kisan, Ayushman Bharat, Startup India, PM Vishwakarma), eligibility criteria, official application portals, documentation required, and financial subsidies.
3. EXAMS & SYLLABUS:
   - UPSC, JEE Main/Advanced, NEET, GATE, SSC CGL, Banking (IBPS/SBI), state PSCs, syllabus breakdown, exam pattern, marking scheme, cutoff trends, and preparation strategies.
4. JOB ROLES & ELIGIBILITY:
   - Industry role specifications, mandatory educational qualifications, required technical/soft skill stack, average salary brackets (INR / USD), and career progression roadmap.
5. PRODUCT COMPARISONS:
   - Direct head-to-head comparison matrix, architectural differences, value proposition, and winner-by-use-case.
6. LAPTOP & MOBILE RESEARCH:
   - Processor benchmarks (Single/Multi-core), GPU compute, display (OLED/IPS/Refresh rate), battery endurance, thermal throttling, real-world value, and price-to-performance ratio.
7. APIS & OPEN-SOURCE TOOLS:
   - GitHub star telemetry, license type (MIT, Apache, GPL), rate limits, authentication model, SDK availability, and integration code snippets.
8. LATEST AI MODELS:
   - Frontier models (Claude 3.7, Gemini 2.5, GPT-4.5/o3, DeepSeek R1/V3, Llama 3.3, Qwen 2.5), parameter size, MMLU/HumanEval/MATH benchmarks, context window size, pricing per 1M tokens, and local deployment requirements.
9. TECHNICAL DOCUMENTATION:
   - Official library syntax, breaking changes, API references, configuration flags, and migration guides.
10. COMPANIES & STARTUPS:
    - Founding team, headquarters, funding rounds (Seed, Series A-D), key investors, valuation, business model, and competitor landscape.
11. SCIENTIFIC TOPICS:
    - Peer-reviewed discoveries, astrophysics, quantum mechanics, genomics, climate science, and empirical methodologies.
12. NEWS & CURRENT EVENTS:
    - Real-time verified developments, chronologically organized timeline, geopolitical context, and multi-source verification.
13. TRAVEL INFORMATION:
    - Visa policies, seasonal weather, optimal itineraries, local transport options, cultural etiquette, and safety advisories.
14. LOCAL BUSINESSES:
    - Business specialties, verified operating hours, customer review consensus, pricing tier, and physical address details.
15. PRICES & AVAILABILITY:
    - Current retail pricing, regional availability, discounts, and verified vendor options.

══════════════════════════════════════════════════════════════════════════════
7 MANDATORY STRUCTURED OUTPUT FORMATS:
══════════════════════════════════════════════════════════════════════════════
Whenever deep research, comparative analysis, or product evaluations are requested, structure the response with these standard sections:

1. 📌 EXECUTIVE SUMMARY:
   - 2-3 concise, high-density paragraphs delivering the core bottom-line conclusions and key findings.
2. 🔍 DETAILED FINDINGS:
   - In-depth, thematic breakdown with clear subheadings, hard metrics, statistics, and verifiable facts.
3. 📊 COMPARISON TABLE:
   - Clean markdown comparison matrix contrasting key parameters, specifications, or alternatives side-by-side.
4. ⚖️ PROS AND CONS:
   - Balanced, objective bullet points outlining distinct advantages and critical limitations or risks.
5. 🎯 PRACTICAL RECOMMENDATION CRITERIA:
   - Actionable selection framework: "Best for Developers", "Best Budget Option", "Best for Enterprise", etc.
6. 🗺️ IMPLEMENTATION ROADMAP:
   - Step-by-step phased execution timeline (e.g. Phase 1: Planning, Phase 2: Execution, Phase 3: Rollout).
7. 🔗 RELIABLE SOURCES & VERIFIED CITATIONS:
   - Every factual claim cited using numbered references [1], [2], with source titles, domains, and verified links.
`;

const RESEARCH_DOMAIN_CATEGORIES = [
  { id: 'latest-tech', name: 'Latest Technology', icon: 'Cpu', sample: 'Latest semiconductor 2nm fabrication nodes and commercial roadmap 2026' },
  { id: 'gov-schemes', name: 'Government Schemes', icon: 'Landmark', sample: 'PM Surya Ghar Muft Bijli Yojana eligibility, subsidy amount, and application portal' },
  { id: 'exams-syllabus', name: 'Exams & Syllabus', icon: 'GraduationCap', sample: 'UPSC CSE 2026 preliminary and mains syllabus breakdown with booklist' },
  { id: 'job-eligibility', name: 'Job Roles & Eligibility', icon: 'Briefcase', sample: 'AI/ML Engineer role requirements, tech stack, eligibility, and salary in India 2026' },
  { id: 'product-compare', name: 'Product Comparisons', icon: 'Scale', sample: 'M4 MacBook Pro vs Dell XPS 15 2026 comparison for software development' },
  { id: 'gadget-research', name: 'Laptop & Mobile Research', icon: 'Smartphone', sample: 'Best laptops under 80,000 INR for coding, battery life, and display quality' },
  { id: 'apis-tools', name: 'APIs & Open-Source Tools', icon: 'Code', sample: 'Top open-source vector databases 2026: Qdrant vs Milvus vs Chroma benchmarks' },
  { id: 'latest-ai-models', name: 'Latest AI Models', icon: 'Brain', sample: 'DeepSeek R1 vs Claude 3.7 Sonnet vs GPT-4.5 benchmarks, context window, and pricing' },
  { id: 'tech-docs', name: 'Documentation', icon: 'BookOpen', sample: 'Next.js 16 App Router caching and Server Actions official documentation guide' },
  { id: 'companies-startups', name: 'Companies & Startups', icon: 'Building2', sample: 'Anthropic company profile, valuation, funding rounds, and Claude ecosystem' },
  { id: 'scientific-topics', name: 'Scientific Topics', icon: 'Atom', sample: 'James Webb Space Telescope latest discoveries on early galaxy formation' },
  { id: 'news-events', name: 'News & Current Events', icon: 'Newspaper', sample: 'Global AI safety regulation treaties and updates 2026' },
  { id: 'travel-info', name: 'Travel Information', icon: 'Plane', sample: '7-day Japan itinerary for first-time travelers: Tokyo, Kyoto, Osaka costs' },
  { id: 'local-business', name: 'Local Businesses', icon: 'MapPin', sample: 'Coworking spaces in Bengaluru Indiranagar with day-pass pricing and amenities' },
  { id: 'prices-availability', name: 'Prices & Availability', icon: 'Tag', sample: 'Sony WH-1000XM5 current market price, discounts, and availability across stores' }
];

module.exports = {
  RESEARCH_WEB_SEARCH_DIRECTIVE,
  RESEARCH_DOMAIN_CATEGORIES,
};
