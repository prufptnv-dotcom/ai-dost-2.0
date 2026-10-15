/**
 * masterCapabilityCatalog.js
 * AI-Dost 3.0 — 50-Domain Master Capability Catalog & Directive Router
 * 
 * Provides unified classification, rich metadata, and deep professional directives
 * across all 50 platform capabilities.
 */

const CAPABILITY_CLUSTERS = {
    ENGINEERING_CODE: 'Engineering & Software',
    AI_DATA: 'AI, Data & Intelligence',
    SCIENCE_ACADEMICS: 'Science, Math & Academia',
    MEDIA_CREATIVE: 'Design, Media & Content',
    BUSINESS_MANAGEMENT: 'Business, Product & Leadership',
    REAL_WORLD_SOCIETY: 'Real-World, Society & Life'
};

const CAPABILITY_CATALOG = [
    // 1. Programming & Software Engineering
    {
        id: 1,
        slug: 'programming-software-engineering',
        title: 'Programming & Software Engineering',
        icon: 'Code2',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Polyglot coding (Python, JS/TS, Java, C/C++, Rust, Go), debugging, OOP/FP, design patterns, and clean architecture.',
        tags: ['python', 'typescript', 'javascript', 'rust', 'golang', 'java', 'cpp', 'clean code', 'refactor'],
        samplePrompts: [
            'Write a thread-safe LRU Cache in Go using sync.Mutex and doubly linked list',
            'Python me async context manager kaise banaye with clean exception handling?',
            'C++20 me smart pointers aur RAII pattern ka production example do'
        ],
        regex: /(?:programming|software engineering|clean code|refactor|\boop\b|functional programming|c\+\+|\brust\b|golang|\bjava\b|python 3|typescript|javascript|design pattern|solid principles)/i,
        directive: `[DOMAIN 1: PROGRAMMING & SOFTWARE ENGINEERING]
- Act as Principal Staff Polyglot Software Engineer.
- Provide production-ready, idiomatic, zero-placeholder code in the requested language (Python 3.12+, TS 5+, Rust 2021, Go 1.22+, C++20, Java 21).
- Include type safety, error boundaries, memory safety considerations, and modular structure.
- When refactoring, highlight the specific design pattern applied (SOLID, Factory, Strategy, Observer, Adapter).`
    },

    // 2. AI/ML & Generative AI
    {
        id: 2,
        slug: 'aiml-generative-ai',
        title: 'AI/ML & Generative AI',
        icon: 'Bot',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'LLMs, RAG pipelines, autonomous agents, LoRA/QLoRA fine-tuning, computer vision, and NLP architectures.',
        tags: ['llm', 'rag', 'langchain', 'llamaindex', 'agents', 'fine-tuning', 'lora', 'pytorch', 'nlp', 'cv'],
        samplePrompts: [
            'Design an advanced RAG pipeline with hybrid search (BM25 + vector) and Cohere reranker',
            'LoRA aur QLoRA fine-tuning me kya farak hai? Memory calculation samjhao for 7B model',
            'Autonomous ReAct agent loop implement karo Python me without external frameworks'
        ],
        regex: /(?:ai\/ml|generative ai|\bllm\b|\brag\b|retrieval augmented|fine-tuning|\blora\b|\bqlora\b|langchain|llamaindex|vector db|embeddings|transformers|pytorch|huggingface|computer vision|\bnlp\b|ollama)/i,
        directive: `[DOMAIN 2: AI/ML & GENERATIVE AI]
- Act as Principal AI/ML Architect & GenAI Systems Engineer.
- Provide concrete system diagrams (Mermaid or ASCII), exact hyperparameter recommendations, and VRAM sizing calculations.
- Detail chunking strategies (parent-document, semantic, recursive), embedding dimensions, and evaluation metrics (RAGAS, G-Eval).
- Provide copy-paste runnable Python code using PyTorch, Transformers, or LlamaIndex/LangChain.`
    },

    // 3. Data Science & Statistics
    {
        id: 3,
        slug: 'data-science-statistics',
        title: 'Data Science & Statistics',
        icon: 'Brain',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'Exploratory data analysis (EDA), probability distributions, hypothesis testing, A/B experiments, regression, and forecasting.',
        tags: ['data science', 'statistics', 'probability', 'hypothesis testing', 'a/b testing', 'eda', 'pandas', 'time series'],
        samplePrompts: [
            'How to design an A/B test with sample size determination and p-value correction for multiple variants?',
            'Pandas me missing values aur outliers detect karne ka complete statistical pipeline do',
            'ARIMA vs Prophet for sales forecasting: mathematical comparison and implementation'
        ],
        regex: /(?:data science|statistics|probability|hypothesis test|p-value|a\/b test|z-score|chi-square|anova|bayesian|forecasting|arima|prophet|\beda\b|correlation|regression analysis)/i,
        directive: `[DOMAIN 3: DATA SCIENCE & STATISTICS]
- Act as Chief Data Scientist & Biostatistician.
- Provide rigorous mathematical foundations (formulas in LaTeX/Unicode, null vs alternative hypotheses, confidence intervals).
- Supply vectorized, efficient Python code (Pandas, Polars, SciPy, Statsmodels) and explain assumptions (normality, homoscedasticity, multicollinearity).
- Provide practical recommendations for interpretation and common pitfalls (p-hacking, selection bias, survivorship bias).`
    },

    // 4. Databases
    {
        id: 4,
        slug: 'databases',
        title: 'Databases & Schema Engineering',
        icon: 'Database',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Relational & NoSQL databases, PostgreSQL, MySQL, MongoDB, Redis, schema normalization, query optimization, and indexing.',
        tags: ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'indexing', 'schema design', 'acid', 'query optimization'],
        samplePrompts: [
            'Design a multi-tenant PostgreSQL schema with Row-Level Security (RLS) and partition pruning',
            'MongoDB aggregation pipeline for calculating 30-day rolling customer retention',
            'PostgreSQL slow query optimize kaise karein using EXPLAIN ANALYZE and composite indexes?'
        ],
        regex: /(?:database|databases|postgres|postgresql|mysql|mongodb|\bredis\b|sql query|schema design|normalization|acid transaction|index optimization|explain analyze|query plan|dynamodb|cassandra)/i,
        directive: `[DOMAIN 4: DATABASES & SCHEMA ENGINEERING]
- Act as Principal Database Administrator & Data Architect.
- Include complete DDL with primary keys, foreign keys (with ON DELETE constraints), composite/covering indexes, and check constraints.
- Provide EXPLAIN ANALYZE interpretation, transaction isolation levels (Read Committed, Repeatable Read, Serializable), and indexing strategies (B-Tree, GIN, GiST, Hash).
- Include Redis caching patterns (Cache-Aside, Write-Through, TTL, eviction policies).`
    },

    // 5. Web Development
    {
        id: 5,
        slug: 'web-development',
        title: 'Web Development',
        icon: 'Globe',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Modern frontend & backend web engineering, React 19, Next.js 15/16, FastAPI, Express, REST/GraphQL APIs, and responsive design.',
        tags: ['react', 'next.js', 'fastapi', 'express', 'rest api', 'graphql', 'tailwindcss', 'css', 'ssr'],
        samplePrompts: [
            'Build a Next.js App Router server action with optimistic UI update and Zod validation',
            'FastAPI me async background tasks and WebSocket endpoint kaise setup karein?',
            'React custom hook for infinite scroll with IntersectionObserver and memory cleanup'
        ],
        regex: /(?:web development|web dev|\breact\b(?!\s*native)|next\.?js|django|fastapi|express\.?js|html5|vanilla css|tailwind|frontend|backend|rest api|graphql|\bssr\b|\bspa\b)/i,
        directive: `[DOMAIN 5: WEB DEVELOPMENT]
- Act as Principal Full-Stack Web Architect.
- Emphasize modern component architecture (Server Components vs Client Components in Next.js, hooks, clean state management).
- Ensure strict TypeScript types, defensive input validation (Zod/Pydantic), accessible HTML semantics, and mobile-responsive UI tokens.
- Provide complete, runnable code files with realistic imports and zero incomplete ellipsis placeholders.`
    },

    // 6. Mobile App Development
    {
        id: 6,
        slug: 'mobile-app-development',
        title: 'Mobile App Development',
        icon: 'Smartphone',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Cross-platform & native mobile apps: React Native, Flutter, Kotlin/Android, SwiftUI/iOS, and Progressive Web Apps (PWA).',
        tags: ['react native', 'flutter', 'android', 'ios', 'kotlin', 'swiftui', 'pwa', 'mobile app', 'expo'],
        samplePrompts: [
            'Design an offline-first mobile sync architecture using WatermelonDB in React Native',
            'Flutter me state management with Riverpod: clean architecture folder structure and example',
            'Next.js PWA setup with background sync and offline service worker caching'
        ],
        regex: /(?:mobile app|mobile development|react native|flutter|\bandroid\b|\bios\b|kotlin|swiftui|\bexpo\b|\bpwa\b|progressive web app|offline-first|mobile navigation)/i,
        directive: `[DOMAIN 6: MOBILE APP DEVELOPMENT]
- Act as Lead Mobile Solutions Architect.
- Detail lifecycle management, offline storage (SQLite, WatermelonDB, Hive), gesture handling, push notification architecture, and deep linking.
- Emphasize 60fps performance (list virtualization, memoization, avoiding re-renders, background thread offloading).
- Provide concrete React Native / Flutter / Kotlin / Swift code blocks with platform-specific permissions and manifest updates.`
    },

    // 7. Cloud & DevOps
    {
        id: 7,
        slug: 'cloud-devops',
        title: 'Cloud & DevOps',
        icon: 'Cloud',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Containerization, Docker, Kubernetes, CI/CD pipelines, reverse proxies (Nginx/Caddy), AWS/GCP, infrastructure as code (Terraform).',
        tags: ['docker', 'kubernetes', 'ci/cd', 'github actions', 'nginx', 'aws', 'terraform', 'linux server', 'monitoring'],
        samplePrompts: [
            'Create a production multi-stage Dockerfile for Next.js standalone output with Alpine non-root user',
            'GitHub Actions workflow for automated testing, Docker build, and zero-downtime deployment',
            'Nginx reverse proxy config with SSL (Let\'s Encrypt), rate limiting, and gzip compression'
        ],
        regex: /(?:cloud\b|devops|docker|dockerfile|kubernetes|\bk8s\b|ci\/cd|continuous integration|github actions|nginx|caddy|\baws\b|\bgcp\b|\bazure\b|terraform|ansible|reverse proxy|prometheus|grafana)/i,
        directive: `[DOMAIN 7: CLOUD & DEVOPS]
- Act as Principal Site Reliability Engineer (SRE) & Cloud Architect.
- Deliver production-hardened configs (multi-stage Dockerfiles, clean docker-compose.yml, declarative GitHub Actions workflows, Nginx configs).
- Include health check probes, graceful termination (SIGTERM), secret management (.env separation, no hardcoded tokens), and resource limits (CPU/memory).
- Follow 12-factor app principles and zero-downtime rolling deployment strategies.`
    },

    // 8. Cybersecurity
    {
        id: 8,
        slug: 'cybersecurity',
        title: 'Cybersecurity & Defensive Engineering',
        icon: 'ShieldCheck',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Application security, OWASP Top 10, cryptographic primitives, authentication (JWT/OAuth), security headers, and vulnerability mitigation.',
        tags: ['cybersecurity', 'owasp', 'cryptography', 'jwt', 'oauth', 'xss', 'sql injection', 'security audit', 'defensive security'],
        samplePrompts: [
            'How to implement secure refresh token rotation with fingerprinting and reuse detection?',
            'Code review this Express endpoint for OWASP Top 10 vulnerabilities and provide fix',
            'Argon2id vs Bcrypt: password hashing implementation with salt and work factor'
        ],
        regex: /(?:cybersecurity|cyber security|infosec|owasp|cryptography|encryption|decryption|jwt token|oauth2|sql injection|\bsqli\b|\bxss\b|\bcsrf\b|security audit|penetration testing|threat model|\bcwe\b|security headers)/i,
        directive: `[DOMAIN 8: CYBERSECURITY & DEFENSIVE ENGINEERING]
- Act as Principal Application Security Architect & Defensive Security Engineer.
- STRICT SAFETY MANDATE: Exclusively DEFENSIVE, REMEDIATION, AUDITING, and EDUCATIONAL guidance. Never output functional exploit scripts or attack payloads.
- State the Vulnerability / CWE / OWASP ID and real-world business impact.
- Contrast the Vulnerable Anti-Pattern against the Hardened Production Remediation.
- Provide copy-paste ready secure code (parameterized queries, DOMPurify, Argon2id, crypto.timingSafeEqual, CSP headers).`
    },

    // 9. Operating Systems & Computer Architecture
    {
        id: 9,
        slug: 'os-computer-architecture',
        title: 'Operating Systems & Computer Architecture',
        icon: 'Cpu',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Linux & Windows internals, processes, threads, virtual memory, paging, CPU scheduling, filesystems, and assembly/syscalls.',
        tags: ['operating systems', 'linux kernel', 'processes', 'threads', 'virtual memory', 'cpu scheduling', 'filesystems', 'syscalls'],
        samplePrompts: [
            'Explain Linux Virtual Memory management: page tables, TLB, demand paging, and page faults with diagram',
            'Process vs Thread memory layout in Linux (text, data, bss, heap, stack) and fork() COW mechanism',
            'CPU cache hierarchies (L1, L2, L3) and cache locality impact on algorithmic performance'
        ],
        regex: /(?:operating system|os internals|computer architecture|linux kernel|windows internals|process management|thread vs process|virtual memory|page fault|paging|cpu scheduling|round robin|deadlock|mutex vs semaphore|\bsyscall\b|\bposix\b|filesystems|\bext4\b|\bntfs\b|\bx86\b|arm architecture|cache line)/i,
        directive: `[DOMAIN 9: OPERATING SYSTEMS & COMPUTER ARCHITECTURE]
- Act as Principal Systems Programmer & OS Kernel Engineer.
- Break down low-level mechanics: registers, stack/heap layout, hardware interrupts, context switching overhead, and syscall boundary crossings.
- Use visual memory maps (ASCII diagrams) showing addresses, segments, and page-table translations.
- Provide concrete C / Rust or POSIX examples demonstrating system concepts (fork, pthread, mmap, epoll, futex).`
    },

    // 10. Computer Networks
    {
        id: 10,
        slug: 'computer-networks',
        title: 'Computer Networks',
        icon: 'Network',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'TCP/IP stack, HTTP/1.1 vs HTTP/2 vs HTTP/3 (QUIC), DNS resolution, routing protocols (BGP/OSPF), VPNs, and packet analysis.',
        tags: ['networking', 'tcp/ip', 'http3', 'quic', 'dns', 'routing', 'bgp', 'vpn', 'wireshark', 'sockets'],
        samplePrompts: [
            'Explain TCP 3-way handshake and 4-way termination with sequence numbers and state diagram',
            'How does DNS resolution work end-to-end from browser cache to root nameserver?',
            'HTTP/2 multiplexing vs HTTP/3 QUIC (UDP based): Head-of-line blocking solution explained'
        ],
        regex: /(?:computer network|networking|\btcp\b|\bosi model\b|\budp\b|http\/2|http\/3|\bquic\b|dns resolution|\bbgp\b|\bospf\b|\bcidr\b|subnetting|\bnat\b|\bvpn\b|wireguard|wireshark|socket programming|(?:3-way|three-way)\s*handshake|packet loss)/i,
        directive: `[DOMAIN 10: COMPUTER NETWORKS]
- Act as Principal Network Engineer & Distributed Systems Protocol Architect.
- Illustrate packet headers, protocol state machines, and sequence flow diagrams.
- Detail practical troubleshooting commands (traceroute, dig/nslookup, netstat/ss, tcpdump, curl -v, mtr).
- Explain performance nuances: latency, bandwidth-delay product (BDP), congestion control algorithms (Cubic, BBR), and TLS 1.3 handshake optimization.`
    },

    // 11. Education & Learning
    {
        id: 11,
        slug: 'education-learning',
        title: 'Education & Learning Systems',
        icon: 'GraduationCap',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Personalized pedagogy, Feynman technique, Bloom\'s taxonomy, syllabus breakdown, lesson plans, and conceptual mental models.',
        tags: ['education', 'learning', 'pedagogy', 'feynman technique', 'study plan', 'syllabus', 'mental models', 'teaching'],
        samplePrompts: [
            'Create a 4-week structured curriculum to learn Quantum Computing for a Computer Science student',
            'Explain Special Relativity using the Feynman technique for a 10th-grade high school student',
            'Design an interactive lesson plan on Photosynthesis with real-world analogies and checks for understanding'
        ],
        regex: /(?:\beducation\b|\blearning\b|pedagogy|study plan|syllabus|lesson plan|feynman technique|bloom's taxonomy|curriculum|mental model|explain simply|concept breakdown)/i,
        directive: `[DOMAIN 11: EDUCATION & LEARNING SYSTEMS]
- Act as Master Educator & Pedagogical Guru.
- Anchor explanations in intuitive, real-world analogies before formal abstraction.
- Structure using progressive scaffolding: Intuition -> Formal Definition -> Visual Representation -> Worked Example -> Common Misconceptions -> Quick Self-Test.
- Provide actionable, week-by-week or day-by-day study plans with estimated time commitments and active recall milestones.`
    },

    // 12. Science (Physics, Chemistry, Biology, Astronomy, Earth Science)
    {
        id: 12,
        slug: 'science',
        title: 'Science (Physics, Chem, Bio, Astronomy)',
        icon: 'Atom',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Theoretical & applied natural sciences: mechanics, thermodynamics, quantum physics, organic synthesis, genetics, and astronomy.',
        tags: ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'earth science', 'genetics', 'quantum'],
        samplePrompts: [
            'Derive the time dilation formula from Einstein\'s light clock thought experiment step-by-step',
            'Explain CRISPR-Cas9 gene editing mechanism with molecular steps and target recognition',
            'Explain the lifecycle of a high-mass star from nebula to neutron star or black hole'
        ],
        regex: /(?:(?<!(?:climate|computer|data|food)\s*)\bscience\b|\bphysics\b|\bchemistry\b|\bbiology\b|\bastronomy\b|earth science|quantum mechanics|thermodynamics|organic chemistry|genetics|photosynthesis|stellar evolution|black hole|gravitational waves)/i,
        directive: `[DOMAIN 12: NATURAL SCIENCES]
- Act as Senior Research Scientist & Academic Physicist/Biologist/Chemist.
- Provide rigorous first-principles scientific derivations and balanced chemical equations.
- Include SI units, dimensional analysis, fundamental constants (c, G, h, k_B), and empirical evidence.
- Contrast classical vs modern models (e.g. Bohr model vs Quantum mechanical orbital model).`
    },

    // 13. Mathematics
    {
        id: 13,
        slug: 'mathematics',
        title: 'Mathematics (Calculus, Linear Algebra, Discrete)',
        icon: 'Variable',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Pure and applied mathematics: calculus, differential equations, linear algebra, discrete math, probability, and proofs.',
        tags: ['mathematics', 'calculus', 'linear algebra', 'discrete math', 'differential equations', 'proofs', 'matrices', 'eigenvalues'],
        samplePrompts: [
            'Step-by-step mathematical proof of why Singular Value Decomposition (SVD) exists for any matrix',
            'Solve the differential equation dy/dx + 2y = e^(-x) with initial condition y(0) = 1',
            'Explain the intuition behind Eigenvalues and Eigenvectors with geometric transformations'
        ],
        regex: /(?:mathematics|\bmath\b|calculus|linear algebra|discrete math|differential equations|eigenvalue|eigenvector|matrix multiplication|fourier transform|combinatorics|graph theory math|mathematical proof|laplace transform)/i,
        directive: `[DOMAIN 13: MATHEMATICS]
- Act as Professor of Mathematics.
- Provide clean, rigorous step-by-step mathematical derivations with clear justifications for every transformation.
- Highlight the geometric intuition behind algebraic abstractions (e.g. determinants as scaling of volume, dot products as projections).
- Format all equations legibly using structured notation and identify domain/range/boundary conditions.`
    },

    // 14. Engineering
    {
        id: 14,
        slug: 'engineering',
        title: 'Engineering (EE, ECE, Mech, Civil, Systems)',
        icon: 'Cog',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Core engineering disciplines: electronics, circuits, signal processing, thermodynamics, structural mechanics, and mechatronics.',
        tags: ['engineering', 'electronics', 'electrical', 'mechanical', 'civil', 'circuits', 'op-amp', 'microcontroller', 'thermodynamics'],
        samplePrompts: [
            'Design an active low-pass Butterworth filter with 1kHz cutoff frequency using an Op-Amp',
            'Explain the thermodynamic Rankine cycle with T-s and P-h diagrams and efficiency calculation',
            'ESP32 microcontroller circuit design for battery-powered IoT sensor with deep sleep'
        ],
        regex: /(?:(?<!(?:software|performance|prompt|system)\s*)\bengineering\b|electrical engineering|electronics|mechanical engineering|civil engineering|systems engineering|circuit design|op-amp|microcontroller|arduino|esp32|fluid mechanics|stress strain|structural design)/i,
        directive: `[DOMAIN 14: CORE ENGINEERING & SYSTEMS]
- Act as Licensed Professional Engineer & Hardware Systems Architect.
- Provide exact schematic design calculations, component tolerances, power dissipation budgets, and thermal considerations.
- Cite relevant standards (IEEE, ISO, ASME, IS codes).
- Provide circuit pinouts, bill of materials (BOM), and failure mode effects analysis (FMEA).`
    },

    // 15. System Architecture
    {
        id: 15,
        slug: 'system-architecture',
        title: 'System Architecture & Distributed Systems',
        icon: 'Workflow',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Scalable system design, microservices, event-driven architecture, Kafka/RabbitMQ, distributed consensus, CAP theorem, and caching.',
        tags: ['system design', 'architecture', 'microservices', 'distributed systems', 'kafka', 'event-driven', 'cap theorem', 'scalability'],
        samplePrompts: [
            'Design a globally distributed URL shortener (like Bitly) handling 100M daily writes with sub-10ms reads',
            'Event-driven microservices architecture using Kafka: saga pattern for distributed transactions',
            'CAP Theorem vs PACELC Theorem with real-world database examples (Cassandra, Spanner, Redis)'
        ],
        regex: /(?:system architecture|system design|distributed system|microservices|event-driven|scalable architecture|cap theorem|saga pattern|cqrs|kafka|message queue|load balancer|distributed cache|high availability)/i,
        directive: `[DOMAIN 15: SYSTEM ARCHITECTURE & DISTRIBUTED SYSTEMS]
- Act as Chief Enterprise Architect & Distributed Systems Specialist.
- Structure answers into: Functional & Non-Functional Requirements, Capacity Estimations (RPS, Storage, Bandwidth), High-Level Architecture (HLA), Deep-Dive Components, and Bottlenecks/Single Points of Failure (SPOFs).
- ALWAYS include a comprehensive visual Mermaid diagram (\`\`\`mermaid) showing components, queues, databases, and network paths.
- Discuss real-world trade-offs: latency vs consistency, at-least-once vs exactly-once delivery, partition tolerance.`
    },

    // 16. Research & Literature Review
    {
        id: 16,
        slug: 'research-literature-review',
        title: 'Research & Literature Review',
        icon: 'BookOpenCheck',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'Academic methodology, systematic literature reviews, hypothesis synthesis, citation formats (APA, IEEE), and evidence analysis.',
        tags: ['research', 'literature review', 'academic paper', 'methodology', 'citations', 'evidence synthesis', 'peer review'],
        samplePrompts: [
            'Conduct a literature review on Transformer attention mechanisms from Vaswani (2017) to FlashAttention-3',
            'Formulate a formal research proposal: problem statement, hypotheses, methodology, and evaluation metrics',
            'How to write a systematic PRISMA literature review on AI in healthcare?'
        ],
        regex: /(?:research paper|literature review|research methodology|academic research|evidence synthesis|peer review|apa citation|ieee format|prisma methodology|research question|systematic review)/i,
        directive: `[DOMAIN 16: RESEARCH & ACADEMIC SYNTHESIS]
- Act as Academic Fellow & Research Methodologist.
- Structure research using standard scholarly sections: Background, Research Questions (RQ1..RQn), Methodological Rigor, Synthesis Table, Limitations, and Future Directions.
- Provide objective balance, highlighting conflicting findings and methodological gaps in existing literature.
- Include proper academic citation formats (APA 7th, IEEE, Nature).`
    },

    // 17. Documents & Office Work
    {
        id: 17,
        slug: 'documents-office-work',
        title: 'Documents & Office Work (PDF, Office, Reports)',
        icon: 'FileText',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Executive reports, PDFs, Word documents (DOCX), PowerPoint decks (PPTX), Excel spreadsheets (XLSX/CSV), and business memos.',
        tags: ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'report', 'presentation', 'spreadsheet', 'office'],
        samplePrompts: [
            'Draft a formal project completion report with executive summary, deliverables table, and sign-off block',
            'Create a 10-slide investor pitch deck outline for an AI SaaS startup',
            'Financial spreadsheet template for monthly department budget tracking with variance analysis'
        ],
        regex: /(?:document|\bpdf\b|\bdocx\b|word doc|\bpptx\b|powerpoint|presentation slides|excel sheet|spreadsheet|\bxlsx\b|\bcsv\b|executive report|business memo|formal report)/i,
        directive: `[DOMAIN 17: DOCUMENTS & EXECUTIVE OFFICE WORK]
- Act as Executive Chief of Staff & Document Publishing Specialist.
- Deliver publication-grade documents with clean hierarchy: Title, Executive Summary, Table of Contents, Detailed Sections, Metrics Tables, and Next Steps.
- If slide decks (PPTX), provide clear slide-by-slide breakdowns with: Slide Title, Visual/Graphic Concept, 3-4 High-Impact Bullet Points, and Speaker Notes.
- If tabular/spreadsheet, output formatted Markdown tables with column types, formulas, and totals.`
    },

    // 18. Data Visualization
    {
        id: 18,
        slug: 'data-visualization',
        title: 'Data Visualization & Dashboard Engineering',
        icon: 'BarChart3',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'Chart selection, dashboard wireframing, Recharts/Chart.js/D3.js implementations, color theory, and metric storytelling.',
        tags: ['data visualization', 'charts', 'dashboards', 'recharts', 'chart.js', 'd3.js', 'kpi', 'analytics dashboard'],
        samplePrompts: [
            'Design an executive SaaS metrics dashboard layout showing MRR, Churn, LTV:CAC, and Net Revenue Retention',
            'React Recharts implementation of a multi-line chart with custom tooltip and responsive container',
            'How to choose the right chart: comparison guide for distributions, compositions, and correlations'
        ],
        regex: /(?:data visualization|chart\.?js|recharts|d3\.?js|dashboard design|bar chart|line chart|pie chart|heatmap|scatter plot|kpi dashboard|metric visualization)/i,
        directive: `[DOMAIN 18: DATA VISUALIZATION & DASHBOARD ENGINEERING]
- Act as Principal Data Visualization Architect & BI Designer.
- Specify exact chart types based on data geometry (e.g. box-plot for distributions, sankey for flows, treemap for hierarchical shares).
- Provide copy-paste ready React (Recharts/Chart.js) code with accessible color palettes, animated transitions, custom tooltips, and responsive wrappers.
- Define KPI card schemas with current value, delta percentage (+/-), sparklines, and benchmark targets.`
    },

    // 19. Writing & Content Creation
    {
        id: 19,
        slug: 'writing-content-creation',
        title: 'Writing & Content Creation',
        icon: 'PenTool',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Storytelling, novel plotting, high-converting copy, blog articles, ghostwriting, speeches, and technical documentation.',
        tags: ['writing', 'copywriting', 'storytelling', 'blog post', 'content creation', 'creative writing', 'ghostwriting', 'speech'],
        samplePrompts: [
            'Write a compelling 1,000-word blog post on the future of local-first AI software with strong hooks',
            'Draft an inspiring keynote speech for a tech conference on human-AI collaboration',
            'Create a 3-act story outline with character arcs and turning points for a sci-fi thriller'
        ],
        regex: /(?:copywriting|blog post|article writing|creative writing|story writing|novel outline|speech writing|ghostwriting|technical writing)/i,
        directive: `[DOMAIN 19: WRITING & CONTENT CREATION]
- Act as Master Copywriter, Author & Communication Strategist.
- Tailor tone, pacing, and vocabulary to the target audience (Executive, Technical, Consumer, Poetic).
- Eliminate weak filler words and clichés; prioritize high-impact hooks, vivid metaphors, rhythm, and clear narrative arcs.
- Format cleanly in Markdown with engaging subheadings, callout blocks, and memorable punchlines.`
    },

    // 20. Audio & Voice
    {
        id: 20,
        slug: 'audio-voice',
        title: 'Audio & Voice Production',
        icon: 'Mic',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Audiobook narration scripts, podcast episode structures, voice-over SSML tagging, Edge TTS integration, and audio post-production.',
        tags: ['audio', 'voice', 'podcast', 'tts', 'audiobook', 'ssml', 'voiceover', 'narration', 'sound design'],
        samplePrompts: [
            'Format an educational narration script with SSML tags (<break>, <emphasis>, <prosody>) for Edge TTS',
            'Design a 45-minute tech podcast episode blueprint: intro hook, co-host dialogue segments, and outro CTA',
            'Audiobook pacing guide: how to mark pauses, tonal shifts, and character voices in a manuscript'
        ],
        regex: /(?:\baudio\b|\bvoice\b|audiobook|podcast|\btts\b|text-to-speech|\bssml\b|voiceover|narration script|sound design|voice acting|audio editing)/i,
        directive: `[DOMAIN 20: AUDIO & VOICE PRODUCTION]
- Act as Audio Director & Professional Voice-Over Producer.
- Structure narration scripts with precise vocal directions in [brackets] (e.g. [Warm, conversational tone], [Pause 1.5s], [Whisper], [Energetic crescendo]).
- Supply standard W3C SSML markup with pitch, rate, volume, and phoneme tags where applicable.
- Detail episode pacing, background ambience music cues ([Fade in low lofi beat]), and clean segment markers.`
    },

    // 21. Video Production
    {
        id: 21,
        slug: 'video-production',
        title: 'Video Production & Screenplay',
        icon: 'Video',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Screenplay writing, sluglines, storyboards, SRT/VTT subtitle files, editing timelines, shot lists, and YouTube/cinematic pacing.',
        tags: ['video', 'screenplay', 'storyboard', 'subtitles', 'shot list', 'cinematography', 'youtube script', 'video editing'],
        samplePrompts: [
            'Write a 60-second viral YouTube Shorts script with 3-second hook, B-roll directions, and caption overlays',
            'Industry standard screenplay scene with scene headings (INT./EXT.), action lines, and parentheticals',
            'Cinematography shot list for a dramatic interview: camera angles, focal lengths, lighting, and movement'
        ],
        regex: /(?:video production|screenplay|storyboard|subtitles|\bsrt file\b|\bvtt file\b|shot list|cinematography|youtube video script|video editing|slugline|\bb-roll\b)/i,
        directive: `[DOMAIN 21: VIDEO PRODUCTION & CINEMATOGRAPHY]
- Act as Film Director & Cinematic Production Lead.
- Use strict screenplay formatting: Scene Headings (EXT. ROOFTOP - NIGHT), Action blocks in active voice, CHARACTER CUES, and (parentheticals).
- In shot lists, specify: Shot #, Framing (Wide, Medium, Close-Up, Macro), Angle, Camera Movement (Gimbal push-in, Pan, Static), Lens (24mm, 50mm, 85mm), and Lighting.
- Include precise video timestamps and B-roll/sound-effect cues [SFX: Whoosh, B-ROLL: Rapid terminal scrolling].`
    },

    // 22. Graphic & Visual Design
    {
        id: 22,
        slug: 'graphic-visual-design',
        title: 'Graphic & Visual Design',
        icon: 'Palette',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Brand identity, logo design concepts, poster art, YouTube thumbnails, typography pairings, color palettes, and AI image prompts.',
        tags: ['graphic design', 'logo design', 'thumbnails', 'posters', 'typography', 'color theory', 'brand identity', 'image prompt'],
        samplePrompts: [
            'Create a cohesive brand identity system for a futuristic robotics startup: color palette, typography, and logo concept',
            'High-converting YouTube thumbnail concept description and Pollinations image prompt for a coding tutorial',
            'Poster design layout for an electronic music festival: Swiss style grid, typography hierarchy, and textures'
        ],
        regex: /(?:graphic design|visual design|logo design|poster design|thumbnail|banner design|typography pairing|color palette|brand identity|vector art|illustration concept)/i,
        directive: `[DOMAIN 22: GRAPHIC & VISUAL DESIGN]
- Act as Creative Director & Brand Identity Designer.
- Detail visual hierarchy, focal points, whitespace balance, and golden ratio proportions.
- Provide curated color palettes with exact HEX/HSL codes, semantic usage (60-30-10 rule), and contrast ratios.
- When generating image prompts, supply rich, photographic, lighting-specific descriptions (e.g. volumetric lighting, 8k, cinematic octane render) suitable for modern diffusion engines.`
    },

    // 23. UI/UX Design
    {
        id: 23,
        slug: 'ui-ux-design',
        title: 'UI/UX Design & Design Systems',
        icon: 'Layout',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Wireframing, user journeys, interaction design, design tokens, Figma component structures, and WCAG 2.2 accessibility.',
        tags: ['ui/ux', 'design system', 'wireframes', 'user flow', 'accessibility', 'wcag', 'figma', 'interaction design', 'design tokens'],
        samplePrompts: [
            'Design a complete design system token architecture (colors, typography scales, elevation, spacing) in CSS variables',
            'User onboarding flow wireframe and state transitions for a mobile fintech investment app',
            'Conduct a WCAG 2.2 accessibility review for an e-commerce checkout flow'
        ],
        regex: /(?:ui\/ux|user experience|user interface|wireframe|design system|user flow|interaction design|\bwcag\b|accessibility|design tokens|figma design|information architecture)/i,
        directive: `[DOMAIN 23: UI/UX DESIGN & ACCESSIBILITY]
- Act as Principal Product Designer & Design Systems Lead.
- Provide clean ASCII wireframe layouts showing component boundaries, headers, navigation bars, and CTA placements.
- Detail interaction states: default, hover, active, focus-visible, disabled, loading skeleton, and error empty-states.
- Guarantee WCAG 2.2 AA compliance: 4.5:1 text contrast, ARIA landmarks, keyboard navigation tab order, and screen reader announcements.`
    },

    // 24. Algorithms & DSA
    {
        id: 24,
        slug: 'algorithms-dsa',
        title: 'Algorithms & Data Structures (DSA)',
        icon: 'Binary',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Data structures, arrays, trees, graphs, dynamic programming, sorting, Big-O complexity, and competitive programming patterns.',
        tags: ['dsa', 'algorithms', 'data structures', 'dynamic programming', 'graphs', 'trees', 'big-o', 'leetcode', 'binary search'],
        samplePrompts: [
            'Explain the Dijkstra algorithm with priority queue implementation in Python and trace step-by-step',
            'Dynamic programming pattern: 0/1 Knapsack problem with 2D array and space-optimized 1D array solutions',
            'Detect and remove a cycle in a linked list using Floyd\'s Tortoise and Hare algorithm with mathematical proof'
        ],
        regex: /(?:algorithms?|data structures?|\bdsa\b|dynamic programming|\bdp\b|graph algorithm|binary tree|\btrie\b|binary search|dijkstra|breadth first search|depth first search|sorting algorithm|big-o|time complexity|space complexity|leetcode)/i,
        directive: `[DOMAIN 24: ALGORITHMS & DATA STRUCTURES]
- Act as Competitive Programming Champion & Algorithms Professor.
- Structure every solution with:
  1. Problem Breakdown & Core Intuition
  2. Optimal Data Structure Choice
  3. Step-by-step Dry Run with sample input
  4. Complete, bug-free, copy-paste ready code (Python/C++/Java) with comments
  5. Exact Complexity Analysis (Worst/Average Time: O(...), Space: O(...))
  6. Edge Cases Handled (Empty inputs, single element, negative numbers, overflow).`
    },

    // 25. Career & Professional Development
    {
        id: 25,
        slug: 'career-professional-development',
        title: 'Career & Professional Development',
        icon: 'Briefcase',
        cluster: CAPABILITY_CLUSTERS.BUSINESS_MANAGEMENT,
        description: 'Resume/CV optimization, portfolio architecture, technical interview coaching, STAR behavioral questions, and salary negotiation.',
        tags: ['career', 'resume', 'cv', 'interview prep', 'star method', 'portfolio', 'salary negotiation', 'promotion roadmap'],
        samplePrompts: [
            'Rewrite these 3 resume bullet points to use the Google XYZ formula (Accomplished [X] as measured by [Y] by doing [Z])',
            'How to answer "Tell me about a time you had a conflict with a tech lead" using the STAR method?',
            '12-month skill roadmap to transition from Mid-Level to Staff Software Engineer'
        ],
        regex: /(?:\bcareer\b|resume|\bcv\b|job interview|interview prep|star method|portfolio review|salary negotiation|promotion roadmap|tech lead interview|faang interview|skill roadmap)/i,
        directive: `[DOMAIN 25: CAREER & PROFESSIONAL STRATEGY]
- Act as Executive Career Coach & Former FAANG Hiring Committee Member.
- Transform generic statements into quantifiable impact metrics using the Google XYZ formula (Accomplished X by Y through Z).
- Provide verbatim STAR answers (Situation, Task, Action, Result) with confident, leadership-oriented vocabulary.
- Detail actionable 30-60-90 day transition roadmaps and executive communication tips.`
    },

    // 26. Startup & Product Development
    {
        id: 26,
        slug: 'startup-product-development',
        title: 'Startup & Product Development',
        icon: 'Rocket',
        cluster: CAPABILITY_CLUSTERS.BUSINESS_MANAGEMENT,
        description: 'Product Requirements Documents (PRD), MVP scoping, TAM/SAM/SOM market sizing, Lean Canvas, business models, and go-to-market.',
        tags: ['startup', 'product management', 'prd', 'mvp', 'lean canvas', 'business model', 'tam sam som', 'go-to-market', 'saas'],
        samplePrompts: [
            'Write a comprehensive PRD for an AI meeting assistant with user stories, acceptance criteria, and edge cases',
            'Complete Lean Canvas breakdown for an AI-powered local services marketplace in India',
            'How to calculate TAM, SAM, and SOM for a B2B SaaS dev tool in 2026'
        ],
        regex: /(?:startup|product development|\bprd\b|product requirements|\bmvp\b|lean canvas|tam sam som|business model|go-to-market|gtm strategy|founder|venture capital)/i,
        directive: `[DOMAIN 26: STARTUP & PRODUCT DEVELOPMENT]
- Act as Chief Product Officer (CPO) & Venture Partner.
- Deliver structured PRDs with: Objective, Target Personas, Success Metrics (North Star, Secondary), In-Scope vs Out-of-Scope, Detailed User Stories with Given/When/Then acceptance criteria.
- Emphasize rapid time-to-value, aggressive MVP de-risking, and defensible moats (network effects, data flywheels, proprietary distribution).`
    },

    // 27. Project Management
    {
        id: 27,
        slug: 'project-management',
        title: 'Project Management & Agile Operations',
        icon: 'Kanban',
        cluster: CAPABILITY_CLUSTERS.BUSINESS_MANAGEMENT,
        description: 'Agile/Scrum ceremonies, sprint planning, Work Breakdown Structures (WBS), Gantt roadmaps, risk registers, and milestone tracking.',
        tags: ['project management', 'agile', 'scrum', 'sprint', 'kanban', 'wbs', 'risk register', 'milestones', 'gantt'],
        samplePrompts: [
            'Create a 12-week Work Breakdown Structure (WBS) with dependencies for migrating a monolith to microservices',
            'Draft a comprehensive Project Risk Register with impact/probability scores and mitigation plans',
            'Design an Agile sprint retrospective format that surfaces actionable engineering improvements'
        ],
        regex: /(?:project management|agile|scrum|sprint planning|work breakdown structure|\bwbs\b|risk register|gantt chart|milestones|jira|\bpmp\b|retrospective)/i,
        directive: `[DOMAIN 27: PROJECT MANAGEMENT & AGILE OPERATIONS]
- Act as Principal Technical Project Director & Agile Coach.
- Provide structured Work Breakdown Structures (WBS) with task IDs, owner roles, estimated story points, and dependencies.
- Include 5x5 Risk Registers (Probability x Impact) with explicit Contingency and Mitigation protocols.
- Provide practical checklists and Kanban boards ready for immediate team execution.`
    },

    // 28. Accounting & Business Analytics
    {
        id: 28,
        slug: 'accounting-business-analytics',
        title: 'Accounting & Business Analytics',
        icon: 'Receipt',
        cluster: CAPABILITY_CLUSTERS.BUSINESS_MANAGEMENT,
        description: 'Financial statements, unit economics (CAC, LTV, Payback, Churn), DCF valuations, runway calculations, budgeting, and P&L modeling.',
        tags: ['accounting', 'finance', 'business analytics', 'unit economics', 'cac', 'ltv', 'financial modeling', 'burn rate', 'p&l'],
        samplePrompts: [
            'Build a SaaS unit economics model calculating LTV, CAC Payback period, and Magic Number with formulas',
            'Explain how changes in working capital affect the 3 financial statements (Income, Balance Sheet, Cash Flow)',
            'Early-stage startup runway calculation with gross burn, net burn, and hiring buffer'
        ],
        regex: /(?:accounting|financial model|unit economics|\bcac\b|\bltv\b|burn rate|runway calculation|balance sheet|income statement|cash flow|dcf valuation|\bebitda\b|p&l statement|budgeting)/i,
        directive: `[DOMAIN 28: ACCOUNTING & FINANCIAL ANALYTICS]
- Act as Chief Financial Officer (CFO) & Financial Analyst.
- Provide mathematically exact formulas and interconnected 3-statement impacts.
- Format all financial metrics in clean comparison tables showing sensitivities (Base, Bull, Bear cases).
- Detail critical health indicators: Gross Margins, Net Burn, Rule of 40, and Cash Conversion Cycles.`
    },

    // 29. Government/Public Services
    {
        id: 29,
        slug: 'government-public-services',
        title: 'Government & Public Services (Bharat & Global)',
        icon: 'Landmark',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Citizen workflows, government schemes (PM Kisan, Ayushman Bharat), portal navigation, RTI filing, forms, and compliance.',
        tags: ['government schemes', 'public services', 'bharat', 'digilocker', 'ayushman bharat', 'pm kisan', 'rti', 'citizen services'],
        samplePrompts: [
            'Step-by-step guide to applying for an Ayushman Bharat Golden Card: eligibility, documents, and portal process',
            'How to file a Right to Information (RTI) application online in India: format and fees',
            'DigiLocker account setup and document issuance process for Indian citizens'
        ],
        regex: /(?:government scheme|public services|sarkari yojana|pm kisan|ayushman bharat|digilocker|rti application|citizen services|passport seva|aadhaar card|pan card|\bepfo\b|voter id)/i,
        directive: `[DOMAIN 29: CITIZEN SERVICES & PUBLIC GOVERNANCE]
- Act as Senior Public Policy Analyst & Citizen Services Concierge.
- Provide step-by-step procedures with exact official portal URLs, eligibility criteria, required document checklists, and nominal fee structures.
- Detail escalation matrices, grievance redressal options (CPGRAMS), and offline vs online application paths.
- Ensure 100% factual accuracy without speculation regarding government regulations.`
    },

    // 30. Languages & Translation
    {
        id: 30,
        slug: 'languages-translation',
        title: 'Languages & Translation Hub',
        icon: 'Languages',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Multilingual translation (Hindi, English, Hinglish, Sanskrit, Indic & Global), grammar correction, vocabulary, and localization.',
        tags: ['translation', 'languages', 'hindi', 'hinglish', 'sanskrit', 'grammar', 'localization', 'polyglot', 'spoken english'],
        samplePrompts: [
            'Translate this technical software agreement from English to formal Hindi preserving legal nuance',
            'Convert this casual Hinglish text into executive-grade professional corporate English',
            'Grammar correction breakdown with before/after diff and rule explanations for common mistakes'
        ],
        regex: /(?:translate|translation|hindi translation|hinglish|sanskrit|marathi|bengali|urdu|grammar correction|spoken english|vocabulary building|polyglot|language localization)/i,
        directive: `[DOMAIN 30: LANGUAGES & MULTILINGUAL LOCALIZATION]
- Act as Master Polyglot, Principal Linguist & Executive Communication Coach.
- Provide culturally authentic translations that preserve idiomatic expressions, humor, and tone.
- When correcting grammar, provide a side-by-side diff (❌ Original vs ✅ Corrected) with grammatical rule justification.
- When teaching vocabulary, provide etymology, phonetic guide, connotation, and 3 distinct real-world contextual examples.`
    },

    // 31. Psychology & Behavioral Science
    {
        id: 31,
        slug: 'psychology-behavioral-science',
        title: 'Psychology & Behavioral Science (Non-Clinical)',
        icon: 'BrainCircuit',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Cognitive models, behavioral economics (Kahneman/Tversky), habit formation, cognitive biases, and organizational psychology.',
        tags: ['psychology', 'behavioral science', 'cognitive bias', 'behavioral economics', 'habits', 'decision making', 'motivation'],
        samplePrompts: [
            'Explain System 1 vs System 2 thinking from Daniel Kahneman with everyday decision examples',
            'Cognitive biases in product design: loss aversion, anchoring, and choice overload explained',
            'How the habit loop (Cue, Routine, Reward) works with scientific neurobiology of dopamine'
        ],
        regex: /(?:psychology|behavioral science|cognitive bias|behavioral economics|kahneman|heuristics|loss aversion|habit loop|operant conditioning|maslow|social psychology|decision psychology)/i,
        directive: `[DOMAIN 31: PSYCHOLOGY & BEHAVIORAL SCIENCE]
- Act as Cognitive Scientist & Behavioral Economics Researcher.
- STRICT SAFETY MANDATE: Strictly educational and theoretical frameworks. NEVER diagnose, prescribe, or provide clinical psychiatric/medical advice. Include a clear disclaimer for medical inquiries.
- Ground explanations in empirical research (studies, replicated experiments, peer-reviewed cognitive models).
- Detail practical applications for productivity, communication, and ethical product design.`
    },

    // 32. Environment & Climate
    {
        id: 32,
        slug: 'environment-climate',
        title: 'Environment & Climate Science',
        icon: 'Leaf',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Ecology, carbon accounting, renewable energy systems, climate science, biodiversity, circular economy, and sustainability.',
        tags: ['environment', 'climate science', 'sustainability', 'renewable energy', 'solar', 'carbon footprint', 'ecology', 'circular economy'],
        samplePrompts: [
            'How does Scope 1, Scope 2, and Scope 3 carbon accounting work for an enterprise?',
            'Solar PV cell physics: how p-n junction converts photons to electricity with efficiency limits',
            'Circular economy principles vs linear take-make-dispose model in electronics manufacturing'
        ],
        regex: /(?:environment|climate science|climate change|global warming|sustainability|carbon footprint|carbon accounting|scope [123]|renewable energy|solar power|wind energy|\becology\b|biodiversity|circular economy|carbon capture)/i,
        directive: `[DOMAIN 32: ENVIRONMENT & SUSTAINABILITY SCIENCE]
- Act as Environmental Systems Scientist & Sustainability Engineer.
- Provide objective, data-backed metrics (e.g. CO2 equivalent in metric tons, IPCC warming scenarios, levelized cost of energy (LCOE)).
- Explain ecological feedback loops, life-cycle assessments (LCA), and circular design strategies.
- Emphasize pragmatic technological and policy solutions grounded in physical realities.`
    },

    // 33. Food & Cooking
    {
        id: 33,
        slug: 'food-cooking',
        title: 'Food Science & Culinary Arts',
        icon: 'UtensilsCrossed',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Culinary chemistry (Maillard reaction, emulsification), authentic recipes, meal planning, macronutrient balancing, and kitchen safety.',
        tags: ['cooking', 'food science', 'recipes', 'meal plan', 'maillard reaction', 'fermentation', 'nutrition', 'culinary'],
        samplePrompts: [
            'The science behind sourdough fermentation: wild yeast, lactobacilli, and hydration percentages',
            'Authentic Hyderabadi Dum Biryani step-by-step recipe with spice timing and steam sealing physics',
            'Weekly high-protein vegetarian meal plan (120g protein/day) with grocery list and prep guide'
        ],
        regex: /(?:cooking|recipe|food science|meal plan|culinary|maillard reaction|fermentation|\bnutrition\b|macronutrients|baking science|spice pairing)/i,
        directive: `[DOMAIN 33: FOOD SCIENCE & CULINARY ARTS]
- Act as Executive Chef & Food Biochemist.
- Explain the "why" behind cooking techniques (temperature management, starch gelatinization, gluten development, smoke points).
- Provide ingredients with exact weight measurements (grams) and volume equivalents, cooking equipment needed, and step-by-step procedures.
- Include culinary troubleshooting tips (how to fix over-salted curry, broken emulsion, or dry baked goods).`
    },

    // 34. Home & DIY
    {
        id: 34,
        slug: 'home-diy',
        title: 'Home & DIY Engineering',
        icon: 'Home',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Home organization, maintenance troubleshooting (plumbing, carpentry, electrical safety), ergonomics, and interior spatial layout.',
        tags: ['home diy', 'home improvement', 'maintenance', 'plumbing', 'electrical safety', 'carpentry', 'interior layout', 'organization'],
        samplePrompts: [
            'How to diagnose and fix a running toilet: flapper, fill valve, and float adjustment steps',
            'Ergonomic home office setup: monitor height, lumbar support angles, and lighting layout',
            'Step-by-step DIY guide to wall-mounting a heavy TV on drywall with stud finders'
        ],
        regex: /(?:home diy|do it yourself|home improvement|home maintenance|plumbing repair|electrical safety|carpentry|home organization|ergonomics|interior design|drywall repair)/i,
        directive: `[DOMAIN 34: HOME & DIY PRACTICAL ENGINEERING]
- Act as Master Craftsman & Residential Maintenance Specialist.
- SAFETY FIRST: Always state necessary protective equipment (goggles, gloves) and critical safety shutoffs (main water valve, circuit breaker).
- Provide a numbered tools & materials checklist before step-by-step instructions.
- Distinguish between safe DIY tasks and jobs requiring licensed professional contractors (e.g. gas lines, main panel wiring).`
    },

    // 35. Automotive
    {
        id: 35,
        slug: 'automotive',
        title: 'Automotive Technology & Engineering',
        icon: 'Car',
        cluster: CAPABILITY_CLUSTERS.REAL_WORLD_SOCIETY,
        description: 'Vehicle technology (ICE vs Hybrid vs EV), battery management systems, transmissions, OBD-II diagnostics, and preventive maintenance.',
        tags: ['automotive', 'electric vehicle', 'ev battery', 'engine', 'transmission', 'obd2', 'car maintenance', 'hybrid'],
        samplePrompts: [
            'Compare EV battery chemistries: LFP vs NMC in terms of energy density, cycle life, and thermal safety',
            'How does a dual-clutch transmission (DCT) work compared to a torque-converter automatic?',
            'How to read OBD-II diagnostic trouble codes (e.g. P0300 random misfire) and step-by-step diagnosis'
        ],
        regex: /(?:automotive|vehicle technology|electric vehicle|ev battery|internal combustion engine|transmission|obd-ii|obd2|car maintenance|brake system|turbocharger)/i,
        directive: `[DOMAIN 35: AUTOMOTIVE TECHNOLOGY & DIAGNOSTICS]
- Act as Master Automotive Engineer & Powertrain Specialist.
- Break down mechanical and electrical subsystems with engineering diagrams and operating parameters.
- Provide structured diagnostic fault-tree procedures (Symptom -> Possible Causes -> Diagnostic Test -> Fix).
- Highlight safety warnings for high-voltage EV battery packs, brake hydraulics, and pressurized cooling systems.`
    },

    // 36. Aviation & Space Technology
    {
        id: 36,
        slug: 'aviation-space',
        title: 'Aviation & Space Technology',
        icon: 'Plane',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Aerodynamics, jet engines vs turboprops, orbital mechanics (Keplerian orbits, delta-V), rocket stages, and space mission design.',
        tags: ['aviation', 'aerospace', 'space technology', 'orbital mechanics', 'rocket science', 'isro', 'aerodynamics', 'jet engine'],
        samplePrompts: [
            'Derive the Tsiolkovsky rocket equation and calculate delta-V required for Low Earth Orbit (LEO)',
            'How does a turbofan jet engine generate thrust: bypass ratio, compressor, combustor, and turbine stages',
            'Hohmann transfer orbit calculation: semi-major axis, delta-V at periapsis and apoapsis from Earth to Mars'
        ],
        regex: /(?:aviation|space technology|aerospace|aerodynamics|orbital mechanics|rocket science|jet engine|turbofan|tsiolkovsky|hohmann transfer|isro mission|satellite orbit|delta-v)/i,
        directive: `[DOMAIN 36: AEROSPACE & ORBITAL MECHANICS]
- Act as Aerospace Systems Engineer & Astrodynamicist.
- Provide exact orbital mechanics equations (vis-viva equation, Kepler's laws, specific impulse Isp, staging mass ratios).
- Detail aerodynamic principles (Bernoulli vs Newton lift, angle of attack, Mach numbers, shockwaves).
- Reference historic and contemporary space missions (ISRO Chandrayaan/Gaganyaan, Artemis, Starship).`
    },

    // 37. Laboratory & Technical Workflows
    {
        id: 37,
        slug: 'laboratory-technical-workflows',
        title: 'Laboratory & Technical Workflows',
        icon: 'FlaskConical',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Experimental protocols, molarity/dilution stoichiometry, Standard Operating Procedures (SOPs), lab safety (MSDS), and QA.',
        tags: ['laboratory', 'experimental design', 'stoichiometry', 'molarity', 'sop', 'lab safety', 'titration', 'protocols'],
        samplePrompts: [
            'Calculate how to prepare 500 mL of 0.25 M Phosphate Buffered Saline (PBS) from stock solutions',
            'Draft a Standard Operating Procedure (SOP) for operating a UV-Vis spectrophotometer with calibration',
            'Stoichiometric calculation for acid-base titration curve with equivalence point and pH indicators'
        ],
        regex: /(?:laboratory workflow|lab protocol|\bsop\b|standard operating procedure|stoichiometry|molarity calculation|dilution calculation|buffer preparation|pipetting|spectrophotometer|lab safety)/i,
        directive: `[DOMAIN 37: LABORATORY PROTOCOLS & TECHNICAL WORKFLOWS]
- Act as Senior Principal Lab Director & Quality Assurance Specialist.
- Provide step-by-step SOP protocols with required PPE, chemical CAS numbers, hazards, and waste disposal protocols.
- Include precise calculation tables showing target concentrations, molecular weights, solvent volumes, and tolerances.
- Emphasize contamination prevention, negative/positive control experiments, and calibration curves.`
    },

    // 38. Exam Preparation
    {
        id: 38,
        slug: 'exam-preparation',
        title: 'Exam Preparation & Mastery System',
        icon: 'ClipboardCheck',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Syllabus decomposition, high-yield notes, active recall flashcards, practice questions, mistake logs, and revision cycles.',
        tags: ['exam prep', 'gate', 'jee', 'upsc', 'mock test', 'active recall', 'spaced repetition', 'revision notes'],
        samplePrompts: [
            'Create a 30-day revision schedule for GATE CS / Data Structures with Spaced Repetition intervals',
            '10 high-yield multiple-choice questions with tricky distractors and detailed explanations for Indian Polity',
            'Formula cheat sheet and mistake analysis checklist for Organic Chemistry reaction mechanisms'
        ],
        regex: /(?:exam prep|exam preparation|mock test|practice questions|previous year questions|\bpyq\b|gate exam|jee exam|\bupsc\b|neet exam|spaced repetition|flashcards|revision notes)/i,
        directive: `[DOMAIN 38: COMPETITIVE EXAM MASTERY & REVISION]
- Act as National Rank Exam Strategist & Master Coach.
- Classify topics into High-Yield (80/20 rule) vs Low-Yield, detailing typical trap patterns and negative marking pitfalls.
- Format practice questions with 4 distinct options (A, B, C, D), followed by a collapsible or clearly separated Detailed Explanation.
- Provide mistake-log templates and accelerated Spaced Repetition revision schedules (Day 1, 3, 7, 21).`
    },

    // 39. Teaching Assistant
    {
        id: 39,
        slug: 'teaching-assistant',
        title: 'Teaching Assistant & Mentor',
        icon: 'UserCheck',
        cluster: CAPABILITY_CLUSTERS.SCIENCE_ACADEMICS,
        description: 'Multi-level explanations (Beginner, Intermediate, Advanced), interactive Socratic probing, assignments, and grading rubrics.',
        tags: ['teaching assistant', 'mentor', 'socratic method', 'grading rubric', 'assignment design', 'student explanations'],
        samplePrompts: [
            'Explain recursion at 3 distinct levels: for a 10-year-old, a first-year CS student, and a senior engineer',
            'Act as a Socratic tutor helping me understand why quicksort has O(n^2) worst-case time complexity',
            'Create a grading rubric with criteria and point allocation for a university web development project'
        ],
        regex: /(?:teaching assistant|socratic tutor|explain like i am|\beli5\b|grading rubric|mentor explanation|beginner to advanced|homework help|assignment design)/i,
        directive: `[DOMAIN 39: TEACHING ASSISTANT & SOCRATIC MENTOR]
- Act as University Head Teaching Assistant & Socratic Mentor.
- Ask probing questions that guide the student to discover the answer themselves rather than lecturing passively.
- Provide structured multi-tier explanations: Intuition (Analogy) -> Formal Mechanics -> Code/Visual Example.
- Emphasize empathy, intellectual curiosity, and constructive positive reinforcement.`
    },

    // 40. Automation
    {
        id: 40,
        slug: 'automation',
        title: 'Workflow Automation & Schedulers',
        icon: 'Zap',
        cluster: CAPABILITY_CLUSTERS.BUSINESS_MANAGEMENT,
        description: 'Autonomous workflows, cron schedules, event triggers, webhook pipelines, batch processing, and bot automation.',
        tags: ['automation', 'workflow', 'cron job', 'webhooks', 'scheduler', 'batch processing', 'n8n', 'zapier', 'scripting'],
        samplePrompts: [
            'Design an automated pipeline that checks an RSS feed every hour and posts summaries to Telegram',
            'Python script with schedule library for daily database backup with email alert on failure',
            'Cron expression breakdown and setup guide for running a job on the 1st Monday of every month'
        ],
        regex: /(?:automation|workflow automation|cron job|scheduled task|webhook pipeline|batch processing|\bn8n\b|\bzapier\b|event trigger|task scheduler)/i,
        directive: `[DOMAIN 40: WORKFLOW AUTOMATION & AGENTIC SCHEDULING]
- Act as Principal Automation Architect & Systems Integrator.
- Specify exact triggers (cron syntax, webhook payloads, file system watchers) and deterministic action steps.
- Include idempotency guards, retry policies with exponential backoff, and dead-letter queue (DLQ) handling.
- Provide complete scripts (Node.js/Python) with multi-channel alerting (Telegram, email, Slack).`
    },

    // 41. Information Retrieval & Research
    {
        id: 41,
        slug: 'information-retrieval-research',
        title: 'Information Retrieval & Fact Verification',
        icon: 'SearchCheck',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'Advanced search operators, source triangulation, fact verification, credibility scoring, and data extraction.',
        tags: ['information retrieval', 'fact checking', 'search operators', 'source verification', 'web research', 'credibility'],
        samplePrompts: [
            'Verify the claim that "India became the 4th country to land on the Moon": sources, date, and mission details',
            'Boolean search operator cheat sheet for advanced technical intelligence gathering',
            'How to assess the credibility of an online technical claim: 5-point verification framework'
        ],
        regex: /(?:information retrieval|fact checking|fact check|source comparison|verify facts|search operators|cross-reference|credibility analysis|evidence gathering)/i,
        directive: `[DOMAIN 41: INFORMATION RETRIEVAL & FACT VERIFICATION]
- Act as Senior Investigative Fact-Checker & Intelligence Analyst.
- Triangulate claims across multiple independent primary sources.
- Assign confidence ratings (Verified, Disputed, Unverified) with explicit supporting citations and publication dates.
- Separate established empirical facts from opinions, promotional claims, or speculative forecasts.`
    },

    // 42. Knowledge Management
    {
        id: 42,
        slug: 'knowledge-management',
        title: 'Knowledge Management & Personal RAG',
        icon: 'FolderKanban',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'Zettelkasten, Second Brain (PARA method), Obsidian/Notion architectures, RAG knowledge bases, and taxonomy design.',
        tags: ['knowledge management', 'second brain', 'zettelkasten', 'para method', 'obsidian', 'notion', 'rag index', 'note taking'],
        samplePrompts: [
            'How to organize a personal software engineering knowledge base using the PARA method (Projects, Areas, Resources, Archives)',
            'Zettelkasten note-taking system: literature notes vs permanent notes with tagging rules',
            'Design a hierarchical taxonomy and metadata schema for technical documentation in Notion/Obsidian'
        ],
        regex: /(?:knowledge management|second brain|zettelkasten|para method|\bobsidian\b|notion setup|personal wiki|note-taking system|taxonomy design|personal rag|knowledge base)/i,
        directive: `[DOMAIN 42: KNOWLEDGE ARCHITECTURE & PERSONAL RAG]
- Act as Chief Knowledge Officer & Personal Information Architect.
- Design sustainable filing structures (PARA, Johnny.Decimal, Zettelkasten) that prevent digital hoard clutter.
- Provide clean markdown templates with frontmatter metadata (tags, created, updated, status, aliases).
- Explain bidirectional linking strategies and semantic embedding chunking for downstream LLM retrieval.`
    },

    // 43. Git/GitHub & Codebase Engineering
    {
        id: 43,
        slug: 'git-codebase-engineering',
        title: 'Git/GitHub & Codebase Engineering',
        icon: 'GitPullRequest',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Conventional commits, branching strategies (Trunk-based vs GitFlow), PR reviews, ADRs, and repo architecture.',
        tags: ['git', 'github', 'pull request', 'conventional commits', 'git rebase', 'branching strategy', 'adr', 'code review'],
        samplePrompts: [
            'Generate 3 Conventional Commit options for a PR adding JWT authentication with refresh tokens',
            'How to resolve a complex Git merge conflict during interactive rebase: step-by-step commands',
            'Architectural Decision Record (ADR) template in Michael Nygard format for choosing PostgreSQL over MongoDB'
        ],
        regex: /(?:\bgit\b|\bgithub\b|gitlab|pull request|git commit|conventional commit|git rebase|merge conflict|branching strategy|trunk-based|git flow|architectural decision record|\badr\b)/i,
        directive: `[DOMAIN 43: GIT & CODEBASE ENGINEERING PROTOCOL]
- Act as Principal Open-Source Maintainer & Technical Project Director.
- Provide exact Conventional Commits (feat, fix, refactor, chore, docs, test, perf) with concise and detailed variants.
- Structure Pull Requests with: Summary, Motivation, Detailed Changes Checklist, Verification Steps, and Breaking Changes.
- Supply Michael Nygard ADR format (Title, Status, Context, Decision, Consequences, Alternatives Considered).`
    },

    // 44. Software Testing & QA
    {
        id: 44,
        slug: 'software-testing-qa',
        title: 'Software Testing & Quality Assurance',
        icon: 'CheckCircle2',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Unit testing, integration testing, E2E (Playwright/Cypress), Test-Driven Development (TDD), mocking, and test matrices.',
        tags: ['software testing', 'qa', 'unit tests', 'integration tests', 'e2e', 'playwright', 'jest', 'vitest', 'pytest', 'tdd'],
        samplePrompts: [
            'Write comprehensive Jest unit tests for an authentication service mocking database calls and JWT signing',
            'Playwright E2E test script covering an e-commerce checkout flow with network request interception',
            'Test-Driven Development (TDD) workflow example: Red-Green-Refactor cycle for a Roman numeral converter'
        ],
        regex: /(?:software testing|\bqa\b|quality assurance|unit test|integration test|e2e test|end-to-end|playwright|cypress|\bjest\b|vitest|pytest|\btdd\b|test-driven development|mocking)/i,
        directive: `[DOMAIN 44: SOFTWARE TESTING & QUALITY ASSURANCE]
- Act as Lead QA Architect & Test Automation Engineer.
- Enforce the Testing Trophy model (Unit, Integration, E2E, Static Analysis).
- Write clean, non-flaky tests using Arrange-Act-Assert (AAA) pattern with comprehensive edge cases (null, bounds, network timeout).
- Provide copy-paste ready tests with realistic mock factories without skipping assertions.`
    },

    // 45. Performance Engineering
    {
        id: 45,
        slug: 'performance-engineering',
        title: 'Performance Engineering & Optimization',
        icon: 'Gauge',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'CPU/memory profiling, memory leak detection, database query plan tuning, Core Web Vitals (LCP, FID, CLS), and caching.',
        tags: ['performance optimization', 'profiling', 'memory leaks', 'web vitals', 'query tuning', 'benchmarking', 'caching', 'latency'],
        samplePrompts: [
            'How to diagnose and fix a Node.js V8 memory leak using heap snapshots and chrome://inspect',
            'Frontend Core Web Vitals optimization guide for improving Largest Contentful Paint (LCP) and Cumulative Layout Shift (CLS)',
            'Database query optimization: index tuning for a high-traffic SQL query with millions of rows'
        ],
        regex: /(?:performance engineering|performance optimization|profiling|memory leak|heap snapshot|web vitals|\blcp\b|\bcls\b|\bfid\b|\binp\b|benchmarking|latency optimization|query optimization)/i,
        directive: `[DOMAIN 45: PERFORMANCE ENGINEERING & PROFILING]
- Act as Principal Performance Architect & Systems Optimizer.
- Quantify improvements with clear Before vs After metrics (e.g. p95 latency: 450ms -> 38ms, memory: 1.2GB -> 180MB).
- Provide systematic profiling workflows: CPU flame graphs, memory allocations, network waterfall bottlenecks, and database execution plans.
- Deliver production-tested, low-overhead optimization code.`
    },

    // 46. Troubleshooting & Root Cause Analysis
    {
        id: 46,
        slug: 'troubleshooting-root-cause',
        title: 'Troubleshooting & Root Cause Analysis',
        icon: 'Wrench',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Log analysis, stack trace decoding, 5-Whys methodology, bisection, reproduction steps, and post-mortem incident reports.',
        tags: ['troubleshooting', 'root cause analysis', 'debugging', 'log analysis', 'stack trace', '5 whys', 'post-mortem', 'bug fix'],
        samplePrompts: [
            'Analyze this Node.js unhandled promise rejection stack trace and explain root cause and fix',
            'Conduct a 5-Whys root cause analysis for a production database outage caused by a connection pool exhaustion',
            'Blameless post-mortem incident report template with timeline, impact, and preventive action items'
        ],
        regex: /(?:troubleshooting|troubleshoot|root cause analysis|\brca\b|stack trace|error log|5 whys|post-mortem|incident report|debugging error|why did this crash)/i,
        directive: `[DOMAIN 46: TROUBLESHOOTING & ROOT CAUSE ANALYSIS]
- Act as Principal Incident Commander & Site Reliability Debugger.
- Follow a 4-step diagnostic protocol:
  1. Incident Summary & Observed Error
  2. Root Cause Analysis (mechanism of failure, triggered conditions)
  3. Immediate Surgical Remediation (exact code/config change)
  4. Permanent Prevention & Guardrails (monitoring alert, lint rule, unit test).`
    },

    // 47. Game Development
    {
        id: 47,
        slug: 'game-development',
        title: 'Game Development & Systems Design',
        icon: 'Gamepad2',
        cluster: CAPABILITY_CLUSTERS.MEDIA_CREATIVE,
        description: 'Game loops, state machines, physics engines, collision detection (AABB), shaders, tilemaps, and Godot/Unity/Phaser code.',
        tags: ['game development', 'game dev', 'game loop', 'physics engine', 'collision detection', 'godot', 'unity', 'phaser', 'shaders'],
        samplePrompts: [
            'Implement a fixed-timestep game loop with interpolation in JavaScript/HTML5 Canvas',
            'Axis-Aligned Bounding Box (AABB) collision detection and resolution algorithm with code',
            'Godot 4 GDScript state machine for player character movement (Idle, Run, Jump, Fall)'
        ],
        regex: /(?:game development|game dev|game design|game loop|collision detection|\baabb\b|physics engine|godot|unity3d|phaser|tilemap|game mechanics|sprite animation)/i,
        directive: `[DOMAIN 47: GAME DEVELOPMENT & SYSTEMS DESIGN]
- Act as Lead Game Systems Architect & Technical Director.
- Detail game loops (delta time, fixed physics steps), component-entity systems (ECS), and finite state machines (FSM).
- Provide complete, runnable code examples (HTML5 Canvas/JavaScript, Godot GDScript, or C#).
- Explain collision mathematics, spatial partitioning (Quadtrees), and frame rate optimization techniques.`
    },

    // 48. Interactive Applications
    {
        id: 48,
        slug: 'interactive-applications',
        title: 'Interactive Applications & Simulators',
        icon: 'Sparkles',
        cluster: CAPABILITY_CLUSTERS.ENGINEERING_CODE,
        description: 'Simulators, financial calculators, interactive educational widgets, Three.js 3D physics worlds, and interactive tools.',
        tags: ['interactive app', 'simulator', 'calculator', 'three.js', 'canvas', 'interactive tool', 'interactive widget'],
        samplePrompts: [
            'Build a self-contained interactive EMI loan calculator in HTML/CSS/JS with monthly amortization table',
            'Interactive gravity orbital physics simulator using HTML5 Canvas with draggable planets',
            'React interactive quiz component with timer, score tracking, and instant review cards'
        ],
        regex: /(?:interactive application|interactive app|simulator|physics simulation|interactive calculator|three\.?js simulation|interactive tool|playable widget)/i,
        directive: `[DOMAIN 48: INTERACTIVE APPLICATIONS & SIMULATORS]
- Act as Lead Creative Technologist & Interactive Web Architect.
- Deliver 100% SELF-CONTAINED, runnable HTML/CSS/JS or React components.
- Include interactive HUD controls (sliders, toggle buttons, reset controls, live metric readouts).
- Ensure smooth animations using requestAnimationFrame and responsive styling with glassmorphic aesthetic.`
    },

    // 49. News & Current Information Research
    {
        id: 49,
        slug: 'news-current-information',
        title: 'News & Current Information Research',
        icon: 'Newspaper',
        cluster: CAPABILITY_CLUSTERS.AI_DATA,
        description: 'Verified real-time news synthesis, current events analysis, source citations, event timelines, and multi-perspective reporting.',
        tags: ['news', 'current events', 'fact check', 'breaking news', 'citations', 'media analysis', 'verified sources'],
        samplePrompts: [
            'Summarize the latest developments in AI regulation and frontier model governance in 2026',
            'Timeline and factual analysis of recent space exploration milestones from ISRO and NASA',
            'Synthesize current global economic trends: inflation, interest rates, and tech sector hiring'
        ],
        regex: /(?:\bnews\b|current events|latest news|breaking news|current information|recent developments|news analysis|today's news|2026 news)/i,
        directive: `[DOMAIN 49: CURRENT INFORMATION & NEWS SYNTHESIS]
- Act as Senior Foreign Affairs & Technology News Editor.
- Structure news reports with: Headline Summary, Chronological Timeline of Events, Key Stakeholder Perspectives, Verified Implications, and Primary Source Citations.
- Maintain neutral, objective journalistic tone and explicitly cite verified sources and dates.`
    },

    // 50. Complex Problem Solving
    {
        id: 50,
        slug: 'complex-problem-solving',
        title: 'Complex Problem Solving (End-to-End)',
        icon: 'Workflow',
        cluster: CAPABILITY_CLUSTERS.BUSINESS_MANAGEMENT,
        description: 'Deconstructing massive challenges: First-principles -> Requirements -> Architecture -> Implementation -> Verification.',
        tags: ['problem solving', 'first principles', 'systems thinking', 'end to end', 'requirements to code', 'complex challenge'],
        samplePrompts: [
            'Deconstruct the problem of building a real-time collaborative document editor (like Google Docs) from first principles',
            'How to approach designing a fault-tolerant banking transaction system handling network partitions?',
            'End-to-end framework to analyze, architect, implement, and verify an AI-powered customer support escalation system'
        ],
        regex: /(?:complex problem solving|first-principles thinking|break down this problem|end-to-end solution|problem deconstruction|requirements to implementation|systems thinking)/i,
        directive: `[DOMAIN 50: COMPLEX PROBLEM SOLVING & SYSTEMS THINKING]
- Act as Principal Polymath Strategist & Chief Systems Architect.
- Apply a rigorous 5-stage First-Principles Framework:
  1. Fundamental Truths & Axiomatic Constraints (What are the immutable laws?)
  2. Requirements Decomposition (Functional, Non-Functional, Edge boundaries)
  3. System Architecture & Trade-Off Matrix (Mermaid visual diagram, Option A vs Option B)
  4. Concrete Implementation Blueprint (Core algorithms, data structures, configs)
  5. Verification, Failure Modes & Continuous Validation Plan.`
    }
];

// Priority ordering for detection: Specialized sub-domains are evaluated BEFORE broad umbrella domains
const DETECTION_PRIORITY = [
    // Specialized Engineering & DevOps & QA
    47, // Game Dev
    45, // Performance Engineering
    46, // Troubleshooting & Root Cause Analysis
    44, // Software Testing & QA
    43, // Git & Codebase
    42, // Knowledge Management (PARA/Zettelkasten)
    40, // Automation (Cron/Workflow)
    8,  // Cybersecurity
    9,  // OS & Architecture
    10, // Computer Networks
    6,  // Mobile Development (React Native/Flutter)
    7,  // Cloud & DevOps (Docker/K8s/CI-CD)
    4,  // Databases (Postgres/Mongo/Redis/SQL)
    2,  // AI/ML & Generative AI (LLM/RAG)
    3,  // Data Science (Statistics/EDA)
    15, // System Architecture (Microservices/Distributed)
    24, // Algorithms & DSA
    32, // Environment & Climate
    28, // Accounting & Financial Models (Unit Economics/LTV/CAC)
    26, // Startup & PRD
    27, // Project Management (WBS/Gantt/Agile)
    29, // Government & Citizen Services
    30, // Languages & Translation
    31, // Psychology & Behavioral Science
    33, // Food Science & Cooking
    34, // Home & DIY
    35, // Automotive
    36, // Aviation & Space
    37, // Laboratory Protocols
    38, // Exam Preparation
    39, // Teaching Assistant & Socratic Mentor
    41, // Information Retrieval & Fact Checking
    48, // Interactive Applications & Simulators
    49, // News & Current Info
    50, // Complex Problem Solving (First-Principles)
    20, // Audio & Voice (SSML/Audiobooks)
    21, // Video Production (Screenplay/Shotlist)
    22, // Graphic Design
    23, // UI/UX & Design Systems
    18, // Data Visualization (Charts/Dashboards)
    17, // Documents & Office Work (PDF/Docx/Sheets)
    16, // Research & Literature Review
    19, // Writing & Content Creation
    25, // Career & Professional Development
    14, // Core Engineering (EE/Mech/Civil)
    13, // Mathematics (Calculus/Linear Algebra)
    12, // Science (Physics/Chemistry/Bio)
    11, // Education & Learning
    5,  // Web Development
    1   // General Programming & Software Engineering (Fallback umbrella)
];

/**
 * Detect the matching capability from user message using specificity-ranked evaluation
 * Returns matching capability object or null
 */
function detectMasterCapability(message) {
    if (!message || typeof message !== 'string') {
        return { isMatch: false, capability: null };
    }

    const cleanMsg = message.trim();

    // Evaluate in priority order
    for (const capId of DETECTION_PRIORITY) {
        const cap = CAPABILITY_CATALOG.find(c => c.id === capId);
        if (cap && cap.regex && cap.regex.test(cleanMsg)) {
            return {
                isMatch: true,
                capability: cap,
                matchedDomain: cap.title,
                directive: cap.directive
            };
        }
    }

    return { isMatch: false, capability: null };
}

/**
 * Get all capabilities for API serialization
 */
function getAllCapabilities() {
    return CAPABILITY_CATALOG.map(({ id, slug, title, icon, cluster, description, tags, samplePrompts }) => ({
        id,
        slug,
        title,
        icon,
        cluster,
        description,
        tags,
        samplePrompts
    }));
}

/**
 * Get capability by ID
 */
function getCapabilityById(id) {
    const numId = parseInt(id, 10);
    return CAPABILITY_CATALOG.find(c => c.id === numId) || null;
}

/**
 * Get capability by Slug
 */
function getCapabilityBySlug(slug) {
    return CAPABILITY_CATALOG.find(c => c.slug === slug.toLowerCase()) || null;
}

module.exports = {
    CAPABILITY_CLUSTERS,
    CAPABILITY_CATALOG,
    detectMasterCapability,
    getAllCapabilities,
    getCapabilityById,
    getCapabilityBySlug
};
