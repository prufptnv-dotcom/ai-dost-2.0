'use strict';

const SPEC_VERSION = '1.0';
const MAX_PROMPT_LENGTH = 4000;
const MAX_REQUIREMENTS = 60;
const MAX_ACCEPTANCE_CRITERIA = 75;

const ACTION_RE = /\b(build|create|make|generate|develop|design|scaffold|implement|add|fix|update|upgrade|improve|modify|refactor|enhance|integrate|wire|change|banao|banaye|banado|bana|lagao|jodo|badlo|sudhar|theek|likho|likh|taiyaar|tayyar)\b/i;
const SOFTWARE_SCOPE_RE = /\b(app|application|website|web ?app|site|platform|dashboard|admin panel|portal|tool|software|system|api|backend|frontend|server|route|module|function|component|page|screen|form|button|feature|project|code|repository|repo|algorithm|database|schema|service|workflow|automation|game|assistant|agent|landing page|portfolio|store|shop|booking)\b|एल्गोरिदम|एल्गोरिथम|वेबसाइट|ऐप|डैशबोर्ड|प्रोजेक्ट|बैकएंड|फ्रंटएंड|डेटाबेस|(?:^|\s)[\w./-]+\.(?:js|jsx|ts|tsx|py|css|html|json)(?:$|\s)/i;
const UI_SCOPE_RE = /\b(app|application|website|web ?app|web|site|platform|assistant|learning|course|quiz|game|todo app|to-do app|ui|ux|frontend|front-end|landing page|dashboard|admin panel|portal|screen|page|component|layout|design system|responsive|mobile-first|portfolio|storefront|shop|e-?commerce|booking|form|button|navigation|navbar|sidebar|visual|styling|theme|dark mode|light mode)\b|वेबसाइट|ऐप|डैशबोर्ड|पेज|इंटरफेस/i;
const NEW_PROJECT_RE = /\b(new|brand new|from scratch|scratch se|naya|nayi|fresh|greenfield)\b|नया|नई|शुरू से/i;
const MODIFY_RE = /\b(add|fix|update|upgrade|improve|modify|refactor|enhance|integrate|wire|change|debug|repair|lagao|jodo|badlo|sudhar|theek|existing|current)\b|सुधारो|बदलो|जोड़ो|ठीक करो/i;
const CREATE_RE = /\b(build|create|generate|scaffold|start from scratch|scratch se|banao|banado|naya|nayi)\b|बनाओ|बना दो|तैयार करो/i;

const ARCHETYPES = [
  { id: 'ecommerce', label: 'E-commerce / Marketplace', pattern: /\b(e-?commerce|online store|storefront|shop|shopping cart|checkout|marketplace|product catalog)\b/i, pages: ['Home', 'Product listing', 'Product details', 'Cart', 'Checkout', 'Orders'] },
  { id: 'education', label: 'Education / Learning', pattern: /\b(education|learning|course|quiz|exam|school|student|lesson|study platform|lms)\b/i, pages: ['Home', 'Course listing', 'Learning workspace', 'Progress', 'Profile'] },
  { id: 'booking', label: 'Booking / Scheduling', pattern: /\b(booking|appointment|reservation|schedule|calendar|hotel|doctor|clinic|ticket)\b/i, pages: ['Home', 'Search/listing', 'Details', 'Booking flow', 'My bookings'] },
  { id: 'saas-dashboard', label: 'SaaS / Analytics Dashboard', pattern: /\b(saas|dashboard|analytics|admin panel|admin dashboard|crm|metrics|reporting)\b/i, pages: ['Overview', 'Workspace', 'Reports/analytics', 'Settings'] },
  { id: 'portfolio-landing', label: 'Portfolio / Marketing Website', pattern: /\b(portfolio|landing page|personal website|agency website|marketing website|showcase)\b/i, pages: ['Home', 'About', 'Work/services', 'Testimonials', 'Contact'] },
  { id: 'content-platform', label: 'Content / Publishing', pattern: /\b(blog|article|news|publishing|documentation site|knowledge base)\b/i, pages: ['Home', 'Content listing', 'Content detail', 'Search', 'About'] },
  { id: 'collaboration', label: 'Collaboration / Task Management', pattern: /\b(kanban|task manager|project management|collaboration|team workspace|todo app|to-do app)\b/i, pages: ['Workspace', 'Board/list', 'Task details', 'Activity', 'Settings'] },
];

const FEATURE_RULES = [
  { id: 'authentication', name: 'Authentication and account access', pattern: /\b(auth(?:entication)?|login|log in|log-in|sign ?in|sign ?up|register|user account|password reset)\b|लॉग ?इन|लॉगिन|रजिस्टर/i, acceptance: 'Implement the requested account flow with validation and success/error feedback. Do not imply real identity verification unless a functioning provider/backend is configured.' },
  { id: 'search-filter', name: 'Search and filtering', pattern: /\b(search|filter|find|quick find|advanced search|khoj)\b|खोज|ढूंढ|ढूँढ/i, acceptance: 'Search/filter controls change displayed results, handle no matches, and can be cleared or reset.' },
  { id: 'charts-analytics', name: 'Charts and analytics', pattern: /\b(chart|charts|graph|graphs|analytics|trend|visuali[sz]ation|bar chart|line chart|pie chart)\b|ग्राफ|चार्ट/i, acceptance: 'Render a labeled responsive visualization based on available data; show a useful empty state when data is unavailable.' },
  { id: 'data-management', name: 'Create, read, update, and delete data', pattern: /\b(crud|create read update delete|manage (?:items|records|tasks|users|products|data|projects)|add (?:items|records|tasks|users|products|projects)|edit (?:items|records|tasks|users|products|projects)|delete (?:items|records|tasks|users|products|projects)|remove (?:items|records|tasks|users|products|projects)|task manager|todo app|to-do app|inventory management|user management)\b/i, acceptance: 'Create/edit/delete actions update application state or the configured store, validate input, and provide confirmation or recoverable error feedback.' },
  { id: 'csv-export', name: 'CSV/data export', pattern: /\b(export|csv|xlsx|excel export|spreadsheet|download report|download data|export report|download as)\b|डाउनलोड|निर्यात/i, acceptance: 'The export action produces a downloadable file with sensible headers and relevant data; empty data and export errors are handled clearly.' },
  { id: 'payments', name: 'Payments and checkout', pattern: /\b(payment|payments|checkout|stripe|razorpay|billing|subscription|invoice)\b|भुगतान|पेमेंट/i, acceptance: 'Implement a coherent checkout/billing flow with pending/success/failure states. Never fake a real charge; use a test provider or clearly labeled mock if credentials are absent.' },
  { id: 'cart', name: 'Shopping cart and product selection', pattern: /\b(cart|shopping cart|wishlist|wish list|product catalog|product listing|add to cart)\b|कार्ट/i, acceptance: 'Product selection updates cart/wishlist state, quantities and totals stay consistent, and empty/clear states are handled.' },
  { id: 'booking', name: 'Booking and scheduling', pattern: /\b(booking|book a|appointment|reservation|schedule|time slot|calendar picker|ticket booking)\b|आरक्षण|बुकिंग|अपॉइंटमेंट/i, acceptance: 'The user can select a valid date/time or item, review the selection, and receive confirmation or validation feedback; do not claim a real booking without a connected service.' },
  { id: 'notifications', name: 'Notifications and status feedback', pattern: /\b(notification|notifications|reminder|toast|alert center|push notification|reminders)\b|सूचना|नोटिफिकेशन/i, acceptance: 'State-changing actions surface timely understandable feedback and avoid duplicate or stale notifications.' },
  { id: 'chat', name: 'Messaging or chat', pattern: /\b(real.?time chat|messaging|chat room|direct message|conversation|inbox|messenger)\b|चैट|मैसेजिंग/i, acceptance: 'Messages are represented consistently, empty submissions are rejected, and loading/empty/error states are explicit. Claim real-time delivery only when backed by a working transport.' },
  { id: 'file-upload', name: 'File upload and attachment handling', pattern: /\b(file upload|upload files|upload image|image upload|attachment|drag.?and.?drop upload)\b|फ़ाइल अपलोड|फाइल अपलोड/i, acceptance: 'Accept supported file types/sizes only, show file and upload status, and handle cancellation or failure.' },
  { id: 'dark-mode', name: 'Dark/light theme switching', pattern: /\b(dark mode|light mode|theme toggle|dark theme|light theme)\b|डार्क मोड|लाइट मोड/i, acceptance: 'The theme control switches all relevant surfaces with readable contrast; persist preference when an existing persistence mechanism is available.' },
  { id: 'multi-language', name: 'Multi-language support', pattern: /\b(multi.?language|multilingual|internationali[sz]ation|i18n|hindi and english|english and hindi)\b|भाषा बदल|बहुभाषी/i, acceptance: 'Provide a working language selector for declared languages and keep navigation, labels, validation messages, and key content in sync.' },
  { id: 'forms-validation', name: 'Forms and input validation', pattern: /\b(contact form|feedback form|registration form|form validation|form|submit form|input validation)\b|संपर्क फॉर्म|फॉर्म/i, acceptance: 'Required fields and invalid values are clearly identified, invalid submissions are prevented, and success/error outcomes are shown.' },
  { id: 'sorting-pagination', name: 'Sorting and pagination', pattern: /\b(sort|sorting|pagination|paginate|page size|next page|previous page)\b|क्रमबद्ध|पेजिनेशन/i, acceptance: 'Sort or page changes update the visible records correctly and keep controls synchronized with the data.' },
  { id: 'responsive', name: 'Responsive/mobile layout', pattern: /\b(responsive|mobile.?first|mobile friendly|mobile.?responsive|tablet|small screen|responsive design)\b|मोबाइल फ्रेंडली|मोबाइल पर/i, acceptance: 'Core content and actions remain usable at narrow mobile, tablet, and desktop widths without unintended horizontal overflow.' },
  { id: 'accessibility', name: 'Accessibility requirements', pattern: /\b(accessibility|accessible|wcag|screen reader|keyboard navigation|aria)\b/i, acceptance: 'Use semantic elements, accessible names/labels, visible keyboard focus, logical heading order, and appropriate contrast.' },
  { id: 'persistent-data', name: 'Data persistence', pattern: /\b(persist|persistence|save data|saved after refresh|database|sqlite|postgres(?:ql)?|mongodb|supabase|firebase|localstorage|local storage)\b/i, acceptance: 'Data survives the promised lifecycle through the configured store; do not claim durable server persistence when data is only in memory.' },
  { id: 'api-integration', name: 'API/backend integration', pattern: /\b(api integration|rest api|backend|server.?side|api endpoint|connect to api|integrate api|webhook|fastapi|express server)\b/i, acceptance: 'Wire the UI to the declared API contract, handle loading and network/non-2xx errors, and avoid production UI depending on hard-coded mock responses.' },
];

const EXPLICIT_PAGE_RULES = [
  ['Home', /\b(home(?:page)?|landing page|homepage|मुख्य पेज|होम पेज)\b/i],
  ['About', /\b(about|our story|हमारे बारे में)\b/i],
  ['Products/services', /\b(products?|services?|catalog|destinations?|courses?)\b/i],
  ['Pricing', /\b(pricing|plans|subscription plans|कीमत|मूल्य)\b/i],
  ['Contact', /\b(contact|contact us|support page|संपर्क)\b/i],
  ['Login/signup', /\b(login|sign ?in|sign ?up|register|authentication)\b/i],
  ['Dashboard', /\b(dashboard|admin panel|control panel)\b/i],
  ['Profile/settings', /\b(profile|account settings|settings page|preferences)\b/i],
  ['Reports/analytics', /\b(reports?|analytics|insights)\b/i],
  ['Cart/checkout', /\b(cart|checkout|payment page)\b/i],
  ['Booking', /\b(booking page|appointment page|reservation page|calendar)\b/i],
];

function cleanPrompt(prompt) {
  return String(prompt || '').replace(/\u0000/g, '').trim().slice(0, MAX_PROMPT_LENGTH);
}

function shouldCreateAppSpecification(prompt) {
  const request = cleanPrompt(prompt);
  return Boolean(request && ACTION_RE.test(request) && SOFTWARE_SCOPE_RE.test(request));
}

function featureSignalIsRequested(prompt, pattern) {
  const source = String(prompt || '');
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const matcher = new RegExp(pattern.source, flags);
  const boundaries = ['\n', '.', '!', '?', ';'];
  let match;
  while ((match = matcher.exec(source)) !== null) {
    let clauseStart = -1;
    let clauseEnd = source.length;
    for (const boundary of boundaries) {
      clauseStart = Math.max(clauseStart, source.lastIndexOf(boundary, match.index - 1));
      const next = source.indexOf(boundary, matcher.lastIndex);
      if (next !== -1) clauseEnd = Math.min(clauseEnd, next);
    }
    const before = source.slice(clauseStart + 1, match.index)
      .split(/\b(?:but|however|except|instead|rather)\b/i).pop()
      // Normalize comma-separated exclusions ("no search, charts, or login")
      // before testing the negation scope.
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const after = source.slice(matcher.lastIndex, clauseEnd).replace(/^[\s,]+/g, '');
    const negatedPrefix = /\b(?:no|without|exclude|excluding|omit|omitting|avoid|avoiding|remove|removing|don't|do not|shouldn't|should not|must not|never|not(?!\s+only)|nahi|mat)\b(?:\s+[\w'-]+){0,24}\s*$/i;
    const negatedSuffix = /^(?:(?:is|are|was|were|should be|must be)\s+)?(?:not\s+(?:needed|required|necessary|wanted)|(?:isn't|aren't|wasn't|weren't)\s+(?:needed|required|necessary|wanted)|unnecessary|unwanted|nahi|na|mat)\b/i;
    const negationMarker = before.match(/\b(?:no|without|exclude|excluding|omit|omitting|avoid|avoiding|remove|removing|don't|do not|shouldn't|should not|must not|never|not(?!\s+only)|nahi|mat)\b/i);
    const exclusionStyle = negationMarker && /^(?:no|without|exclude|excluding|omit|omitting|avoid|avoiding|remove|removing|nahi|mat)$/i.test(negationMarker[0]);
    // A later positive verb can explicitly re-enable a feature: "without login and include search".
    const positiveOverride = exclusionStyle && /\b(?:and|also)\s+(?:include|add|enable|support|require)\b/i.test(before.slice(negationMarker.index + negationMarker[0].length));
    if ((negatedPrefix.test(before) && !positiveOverride) || negatedSuffix.test(after)) continue;
    return true;
  }
  return false;
}

function extractExplicitClauses(prompt) {
  const lines = String(prompt || '').split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  const hasList = String(prompt || '').split(/\r?\n/).some((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line));
  const candidates = hasList
    ? lines.filter((line) => line.length >= 4 && !/^#{1,6}\s/.test(line))
    : String(prompt || '').split(/(?<=[.!?])\s+|;\s+/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set();
  return candidates
    .map((clause) => clause.replace(/^#{1,6}\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((clause) => {
      const key = clause.toLowerCase();
      if (clause.length < 4 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_REQUIREMENTS);
}

function inferArchetype(prompt) {
  for (const archetype of ARCHETYPES) {
    if (archetype.pattern.test(prompt)) return { id: archetype.id, label: archetype.label, suggestedPages: archetype.pages.slice() };
  }
  return { id: 'general-app', label: 'General application', suggestedPages: ['Primary workspace', 'Settings/help when useful'] };
}

function inferStack(prompt) {
  const stackPatterns = [
    ['Next.js', /\b(next\.?js|nextjs)\b/i],
    ['React + Vite', /\b(react(?:\.?js)?\s*(?:\+\s*)?vite|vite\s*\+\s*react)\b/i],
    ['React', /\breact(?:\.?js)?\b/i],
    ['Vue', /\bvue(?:\.?js)?\b/i],
    ['SvelteKit', /\b(sveltekit|svelte)\b/i],
    ['Astro', /\bastro\b/i],
    ['Angular', /\bangular\b/i],
    ['Express.js', /\bexpress(?:\.?js)?\b/i],
    ['FastAPI', /\bfastapi\b/i],
    ['Django', /\bdjango\b/i],
    ['Flask', /\bflask\b/i],
    ['Python', /\bpython\b/i],
    ['TypeScript', /\btypescript\b/i],
  ];
  const match = stackPatterns.find((entry) => entry[1].test(prompt));
  return {
    requested: match ? match[0] : null,
    selectionPolicy: 'Respect an explicit stack request; when none is stated, inspect the existing workspace first and use its stack. For a new workspace, choose the simplest supported stack that meets the requirements.',
  };
}

function inferComponentArchitecture(isUi, archetype, requirements) {
  if (!isUi) {
    return {
      approach: 'Trace affected modules and follow the existing repository architecture.',
      boundaries: ['Keep changes local to the relevant module/service.', 'Separate I/O from pure business logic where useful.', 'Avoid broad rewrites of unrelated files.'],
      suggestedFiles: [],
    };
  }

  const featureKeys = new Set(requirements.map((item) => item.featureKey).filter(Boolean));
  const hasDataLayer = ['data-management', 'persistent-data', 'api-integration', 'authentication', 'csv-export', 'payments', 'booking'].some((key) => featureKeys.has(key));
  const suggestedFiles = ['src/App.jsx', 'src/styles/tokens.css', 'src/styles/global.css', 'src/components/ui/'];
  if (archetype.id === 'saas-dashboard') suggestedFiles.push('src/features/dashboard/');
  if (archetype.id === 'ecommerce') suggestedFiles.push('src/features/products/', 'src/features/cart/');
  if (archetype.id === 'education') suggestedFiles.push('src/features/courses/', 'src/features/progress/');
  if (archetype.id === 'booking') suggestedFiles.push('src/features/booking/');
  if (archetype.id === 'collaboration') suggestedFiles.push('src/features/tasks/');
  if (hasDataLayer) suggestedFiles.push('src/services/', 'src/data/');

  return {
    approach: 'Use a shared app shell and feature-oriented components; adapt file names to the existing stack instead of forcing a scaffold.',
    boundaries: [
      'Keep app shell/navigation separate from page-specific content.',
      'Extract repeated UI into reusable, accessible components; keep feature logic close to its feature.',
      'Separate API/storage access from presentation when data is loaded or mutated.',
      'Avoid a monolithic component when the request includes multiple pages or independent workflows.',
      'Suggested file paths are guidance only; preserve established workspace conventions.',
    ],
    suggestedFiles: [...new Set(suggestedFiles)],
  };
}

function inferDataModel(prompt, archetype, requirements) {
  const p = String(prompt || '').toLowerCase();
  const featureKeys = new Set(requirements.map((item) => item.featureKey).filter(Boolean));
  const entitiesByArchetype = {
    ecommerce: [
      { name: 'Product', fields: ['id', 'name', 'description', 'price', 'image', 'availability'] },
      { name: 'CartItem', fields: ['productId', 'quantity', 'unitPrice'] },
      { name: 'Order', fields: ['id', 'items', 'total', 'status', 'createdAt'] },
    ],
    education: [
      { name: 'Course', fields: ['id', 'title', 'description', 'level'] },
      { name: 'Lesson', fields: ['id', 'courseId', 'title', 'content', 'order'] },
      { name: 'Progress', fields: ['userId', 'lessonId', 'status', 'updatedAt'] },
    ],
    booking: [
      { name: 'Resource', fields: ['id', 'name', 'description', 'availability'] },
      { name: 'Booking', fields: ['id', 'resourceId', 'startAt', 'endAt', 'status', 'contact'] },
    ],
    'saas-dashboard': [
      { name: 'WorkspaceItem', fields: ['id', 'name', 'status', 'createdAt', 'updatedAt'] },
      { name: 'Metric', fields: ['id', 'label', 'value', 'period', 'source'] },
    ],
    'portfolio-landing': [
      { name: 'PortfolioItem', fields: ['id', 'title', 'summary', 'image', 'href', 'tags'] },
      { name: 'ContactMessage', fields: ['name', 'email', 'message', 'createdAt', 'status'] },
    ],
    'content-platform': [
      { name: 'Article', fields: ['id', 'title', 'slug', 'summary', 'body', 'publishedAt', 'status'] },
      { name: 'Category', fields: ['id', 'name', 'slug'] },
    ],
    collaboration: [
      { name: 'Project', fields: ['id', 'name', 'description', 'status'] },
      { name: 'Task', fields: ['id', 'projectId', 'title', 'description', 'status', 'assigneeId', 'dueAt'] },
    ],
  };
  let entities = entitiesByArchetype[archetype.id] || [];
  if (/\b(expense|finance|budget|transaction|income|wallet|ledger)\b/i.test(p)) {
    entities = [
      { name: 'Transaction', fields: ['id', 'date', 'description', 'amount', 'category', 'type'] },
      { name: 'Account', fields: ['id', 'name', 'balance', 'currency'] },
      { name: 'Budget', fields: ['id', 'category', 'limit', 'period'] },
    ];
  }
  if (featureKeys.has('authentication')) {
    entities.push({ name: 'User', fields: ['id', 'displayName', 'email', 'role', 'createdAt'] });
  }
  if (featureKeys.has('csv-export')) {
    entities.push({ name: 'ExportJob', fields: ['format', 'filters', 'createdAt', 'status'] });
  }

  return {
    entities: entities.slice(0, 8),
    storagePolicy: featureKeys.has('persistent-data')
      ? 'Use the requested/configured persistent store and document the schema/migration requirements.'
      : featureKeys.has('api-integration') || featureKeys.has('data-management')
        ? 'Use the configured API/store if present; otherwise clearly label demo data and isolate it behind a replaceable data-access layer.'
        : 'If this is a static presentation, local transient state is acceptable. Do not add a database unless the request or existing project requires it.',
    rules: [
      'Entity examples are suggestions, not extra required features; adjust fields and relationships to the original request.',
      'Keep one canonical source of truth for each record; derive totals/counts instead of keeping conflicting duplicate state.',
      'Validate user input before mutations and provide explicit success/error feedback.',
      'Do not claim persistence beyond the storage actually implemented.',
    ],
  };
}

function buildInteractionContracts(requirements) {
  const transitions = {
    'search-filter': ['idle -> searching', 'searching -> results', 'searching -> empty', 'results/empty -> idle when cleared'],
    'charts-analytics': ['loading -> rendered data', 'loading -> empty/error', 'period/filter change -> updated visualization'],
    'data-management': ['list -> create/edit form', 'form -> validation errors or save', 'save -> updated list/detail', 'delete -> confirmation -> updated list'],
    'csv-export': ['idle -> preparing file', 'preparing -> download ready or error'],
    payments: ['cart/summary -> pending checkout', 'pending -> success, declined, canceled, or unavailable'],
    cart: ['catalog -> item selected', 'quantity change -> recalculated totals', 'last item removed -> empty cart'],
    booking: ['availability -> selected slot', 'selection -> review', 'review -> confirmed, validation error, or unavailable'],
    notifications: ['action result -> visible feedback', 'dismiss -> feedback removed'],
    chat: ['idle -> message composed', 'valid submit -> sending -> message/error', 'empty submit -> validation feedback'],
    'file-upload': ['idle -> selected', 'selected -> uploading', 'uploading -> complete/error/canceled'],
    'dark-mode': ['current theme -> alternate theme -> consistent surface/text update'],
    'multi-language': ['current language -> selected language -> translated navigation/content/form messages'],
    'forms-validation': ['idle -> editing', 'submit -> field errors or submitting', 'submitting -> success/error'],
    'sorting-pagination': ['current order/page -> user selection -> updated visible records'],
    'persistent-data': ['edit -> save -> confirmed persistence', 'load -> populated/empty/error'],
    'api-integration': ['idle -> loading -> response data or recoverable error'],
  };
  const byKey = new Map(requirements.map((item) => [item.featureKey, item]));
  return Object.entries(transitions)
    .filter(([key]) => byKey.has(key))
    .map(([featureKey, stateTransitions]) => ({
      requirementId: byKey.get(featureKey).id,
      featureKey,
      name: byKey.get(featureKey).name,
      stateTransitions,
    }));
}

const APPLICATION_TYPES = [
  'frontend', 'backend', 'full-stack', 'library', 'script',
  'algorithm', 'data-pipeline', 'api', 'infrastructure'
];

function inferApplicationType(prompt, archetype, stack) {
  const p = String(prompt || '').toLowerCase();
  if (/\b(algorithm|data structure|binary search|leetcode|complexity|graph|dijkstra|tree|bst|dp|dynamic programming|sort|bfs|dfs|sliding window)\b|एल्गोरिदम|एल्गोरिथम/.test(p)) {
    return 'algorithm';
  }
  if (/\b(data pipeline|etl|batch processing|stream processing|pandas|spark|data ingestion)\b/i.test(p)) {
    return 'data-pipeline';
  }
  if (/\b(infrastructure|terraform|kubernetes|docker compose|k8s|ansible|helm|ci\/cd|github actions)\b/i.test(p)) {
    return 'infrastructure';
  }
  if (/\b(library|npm package|python package|pip package|shared utility|reusable module|sdk)\b/i.test(p)) {
    return 'library';
  }
  if (/\b(cli script|bash script|shell script|python script|automation script|cron job)\b/i.test(p)) {
    return 'script';
  }
  if (/\b(api|rest api|graphql|grpc|endpoints|routes|backend service|microservice)\b/i.test(p) && !/\b(frontend|ui|page|screen|react|vue|svelte|html)\b/i.test(p)) {
    return 'api';
  }
  if (/\b(backend|server|express server|fastapi server|database)\b/i.test(p) && !/\b(frontend|ui|page|screen|react|vue|svelte|css|html)\b/i.test(p)) {
    return 'backend';
  }
  if (/\b(full.?stack|fullstack|frontend and backend|express.*react|react.*express|next\.?js.*api)\b/i.test(p) || (/\b(frontend|ui|page|screen|client)\b/i.test(p) && /\b(backend|api|database|express|server)\b/i.test(p))) {
    return 'full-stack';
  }
  return 'frontend';
}

function inferFeatureDependencies(requirements) {
  const depMap = {
    payments: ['cart', 'authentication'],
    'csv-export': ['data-management'],
    booking: ['forms-validation'],
    chat: ['authentication'],
    'sorting-pagination': ['data-management']
  };
  const activeKeys = new Set(requirements.map(r => r.featureKey).filter(Boolean));
  const result = {};
  for (const [feat, deps] of Object.entries(depMap)) {
    if (activeKeys.has(feat)) {
      result[feat] = deps.filter(d => activeKeys.has(d));
    }
  }
  return result;
}

function inferInputOutputContracts(prompt, archetype, requirements) {
  const contracts = [];
  const featureKeys = new Set(requirements.map(r => r.featureKey).filter(Boolean));

  if (featureKeys.has('authentication')) {
    contracts.push({
      name: 'authLogin',
      type: 'api-endpoint',
      inputs: { email: 'string (valid email format)', password: 'string (min 8 chars)' },
      outputs: { success: 'boolean', token: 'string (optional JWT)', user: 'object (id, name, email)' },
      errorStates: ['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'VALIDATION_ERROR']
    });
  }
  if (featureKeys.has('data-management') || featureKeys.has('api-integration')) {
    contracts.push({
      name: 'getItems',
      type: 'api-endpoint',
      inputs: { query: 'string (optional search)', limit: 'number (pagination)', offset: 'number' },
      outputs: { items: 'array', total: 'number', hasMore: 'boolean' },
      errorStates: ['NETWORK_ERROR', 'UNAUTHORIZED', 'NOT_FOUND']
    });
    contracts.push({
      name: 'mutateItem',
      type: 'api-endpoint',
      inputs: { action: 'create | update | delete', payload: 'object' },
      outputs: { success: 'boolean', item: 'object' },
      errorStates: ['VALIDATION_ERROR', 'CONFLICT', 'FORBIDDEN']
    });
  }
  if (featureKeys.has('csv-export')) {
    contracts.push({
      name: 'exportCsv',
      type: 'utility-function',
      inputs: { records: 'array of objects', columns: 'array of string headers', filename: 'string' },
      outputs: { blob: 'Blob (text/csv)', downloadTriggered: 'boolean' },
      errorStates: ['EMPTY_DATASET', 'EXPORT_GENERATION_FAILED']
    });
  }

  return contracts;
}

function inferUnresolvedAssumptions(prompt, requirements, stack) {
  const assumptions = [];
  const p = String(prompt || '').toLowerCase();
  const featureKeys = new Set(requirements.map(r => r.featureKey).filter(Boolean));

  if (featureKeys.has('authentication') && !/(jwt|oauth|auth0|firebase|supabase|cognito|session|cookie)/i.test(p)) {
    assumptions.push('Authentication provider not explicitly specified; assuming token-based session auth with input validation.');
  }
  if (featureKeys.has('persistent-data') && !/(postgres|mysql|sqlite|mongo|dynamo|redis|prisma)/i.test(p)) {
    assumptions.push('Target database engine not specified; assuming SQLite or workspace-standard persistent store.');
  }
  if (featureKeys.has('payments') && !/(stripe|razorpay|paypal|square)/i.test(p)) {
    assumptions.push('Payment processor credentials not supplied; assuming sandboxed test checkout flow with simulated webhooks.');
  }
  if (featureKeys.has('chat') && !/(websocket|socket\.io|sse|polling)/i.test(p)) {
    assumptions.push('Real-time messaging transport unspecified; assuming WebSocket/SSE with resilient fallback.');
  }

  return assumptions;
}

function inferEvidenceContract(isUi, applicationType, requirements) {
  const checks = [
    { check: 'Syntax & Import Validation', requiredEvidence: 'Zero unresolvable imports, valid AST/syntax for all created/modified files.', target: 'all-files' },
    { check: 'Interface & Type Consistency', requiredEvidence: 'Exported function signatures match consuming call-sites across modules.', target: 'cross-file' },
    { check: 'Error Boundary & Empty State Handling', requiredEvidence: 'Graceful fallback rendering and actionable error states present for data operations.', target: 'error-handling' }
  ];

  if (applicationType === 'algorithm') {
    checks.push({ check: 'Invariant & Complexity Verification', requiredEvidence: 'Satisfies time/space complexity budget and passes boundary/falsification test cases.', target: 'algorithm-core' });
  }
  if (applicationType === 'full-stack' || applicationType === 'backend' || applicationType === 'api') {
    checks.push({ check: 'API Schema & Route Verification', requiredEvidence: 'Endpoints respond with structured JSON status and validated schema shapes.', target: 'api-routes' });
  }
  if (isUi) {
    checks.push({ check: 'Responsive & Interactive Controls', requiredEvidence: 'Interactive elements handle click/change events with observable DOM updates.', target: 'ui-components' });
  }

  return checks;
}

function buildAcceptanceCriteria(isUi, requirements) {
  const criteria = [
    { id: 'AC-01', title: 'Primary outcome', check: 'The implementation demonstrates the outcome requested in the original prompt. List blocked or incomplete parts explicitly rather than claiming completion.', requirementIds: ['REQ-001'], scope: ['overall'] },
    { id: 'AC-02', title: 'Functional controls', check: 'Every visible interactive control has a working action or is clearly presented as disabled/unavailable; no decorative control pretends to work.', scope: ['overall'] },
    { id: 'AC-03', title: 'Failure and empty states', check: 'Data-driven areas have understandable loading, empty, and error states where those states can occur.', scope: ['overall'] },
    { id: 'AC-04', title: 'Maintainability', check: 'Changes follow workspace conventions, remain modular, avoid unrelated rewrites, and contain no TODO placeholder or missing import/asset.', scope: ['overall'] },
  ];
  if (isUi) {
    criteria.push(
      { id: 'AC-05', title: 'Visual hierarchy and consistency', check: 'Use a deliberate type and spacing scale, coherent color/contrast tokens, consistent component states, and clear information hierarchy. Do not force a dark theme unless requested or already established.', scope: ['ui'] },
      { id: 'AC-06', title: 'Responsive layout', check: 'Validate the primary layout at approximately 360px, 768px, and 1280px widths; essential content and controls must not be clipped or require unintended horizontal scrolling.', scope: ['ui'] },
      { id: 'AC-07', title: 'Accessible interaction', check: 'Use semantic HTML, accessible labels for inputs and icon-only controls, visible focus, keyboard-operable interactions, and meaningful alt text for informative images.', scope: ['ui'] }
    );
  }
  for (const requirement of requirements.slice(1)) {
    criteria.push({
      id: 'AC-' + String(criteria.length + 1).padStart(2, '0'),
      title: requirement.name,
      check: requirement.acceptance[0],
      requirementIds: [requirement.id],
      scope: ['requirement'],
    });
  }
  return criteria.slice(0, MAX_ACCEPTANCE_CRITERIA);
}

/**
 * Find missing source-text signals for explicit, known feature requirements.
 * This is a preflight diagnostic used to trigger a bounded completion pass;
 * it is not proof that a feature is implemented or works at runtime.
 */
function findMissingFeatureSignals(spec, files) {
  if (!spec || !Array.isArray(spec.requirements) || !Array.isArray(files)) return [];
  const source = files
    .filter((file) => file && typeof file.path === 'string' && typeof file.content === 'string')
    .map((file) => '\n/* FILE: ' + file.path + ' */\n' + file.content)
    .join('\n');
  // Request-detection patterns are intentionally broad (for example, "export"
  // is a valid user request signal). Source diagnostics need stronger patterns:
  // JavaScript's ordinary `export default` must not satisfy a CSV export request.
  const sourceSignals = {
    'search-filter': /\b(search|searchTerm|searchQuery|filter|filteredItems|setSearch|onSearch|handleSearch)\b/i,
    'charts-analytics': /\b(chart|charts|ChartJS|recharts|victory|nivo|plotly|renderChart|series|dataKey)\b/i,
    'csv-export': /\b(csv|text\/csv|exportCsv|downloadCsv|downloadCSV|URL\.createObjectURL|createObjectURL|\.toCSV\s*\(|json2csv|papaparse|Papa\.unparse|spreadsheet|xlsx)\b/i,
    'authentication': /\b(signIn|signUp|login|logIn|authenticate|authProvider|passwordReset)\b/i,
    'data-management': /\b(createItem|updateItem|deleteItem|addItem|removeItem|handleSave|handleDelete|onSubmit|localStorage|\.insert\(|\.update\(|\.delete\()\b/i,
    'payments': /\b(stripe|razorpay|checkout|paymentIntent|createPayment|billing)\b/i,
    'cart': /\b(addToCart|removeFromCart|cartItems|cartTotal|shoppingCart)\b/i,
    'booking': /\b(bookAppointment|createBooking|selectedDate|timeSlot|reservation)\b/i,
    'notifications': /\b(notification|toast|notify|showAlert|reminder)\b/i,
    'chat': /\b(sendMessage|messages|chatMessages|conversation|websocket|socket\.io)\b/i,
    'file-upload': /\b(inputType=[\"']file|type=[\"']file|onDrop|dropzone|uploadFile|FormData)\b/i,
    'dark-mode': /\b(darkMode|themeMode|toggleTheme|setTheme|prefers-color-scheme)\b/i,
    'multi-language': /\b(i18n|useTranslation|changeLanguage|locale|translations)\b/i,
    'forms-validation': /\b(required|validationSchema|validateForm|setError|formErrors|aria-invalid)\b/i,
    'sorting-pagination': /\b(sortBy|sortOrder|sortedItems|currentPage|pageSize|pagination|nextPage|previousPage)\b/i,
    responsive: /@media|\b(sm:|md:|lg:|xl:|grid-template-columns|min-width|max-width)\b/i,
    accessibility: /\b(aria-[a-z-]+|ariaLabel|htmlFor|tabIndex|role=["']|alt=["'])|:focus-visible/i,
    'persistent-data': /\b(localStorage|sessionStorage|indexedDB|prisma|mongoose|sequelize|knex|sqlite|postgres|mongodb)\b/i,
    'api-integration': /\b(fetch\s*\(|axios|useSWR|useQuery|queryClient|apiClient)\b|\/api\//i,
  };
  return spec.requirements
    .filter((requirement) => requirement && requirement.featureKey)
    .map((requirement) => ({
      requirement,
      rule: FEATURE_RULES.find((feature) => feature.id === requirement.featureKey),
      sourceSignal: sourceSignals[requirement.featureKey],
    }))
    .filter(({ rule, sourceSignal }) => rule && !(sourceSignal || rule.pattern).test(source))
    .map(({ requirement, rule }) => ({
      requirementId: requirement.id,
      featureKey: requirement.featureKey,
      name: requirement.name || rule.name,
      sourceText: requirement.sourceText || '',
      diagnostic: 'No recognizable source-text signal found; inspect implementation and test behavior manually.',
    }));
}

function buildAppSpecification(prompt, options = {}) {
  const request = cleanPrompt(prompt);
  if (!request || (!options.force && !shouldCreateAppSpecification(request))) return null;

  const isUi = UI_SCOPE_RE.test(request);
  const modification = MODIFY_RE.test(request) && !NEW_PROJECT_RE.test(request) && !CREATE_RE.test(request);
  const archetype = inferArchetype(request);
  // Keep the explicit-page list consistent with feature negation handling: a page
  // mentioned only to exclude it (for example, "without login") is not requested.
  const requestedPages = EXPLICIT_PAGE_RULES
    .filter((entry) => featureSignalIsRequested(request, entry[1]))
    .map((entry) => entry[0]);
  const explicitClauses = extractExplicitClauses(request);
  const matchedFeatures = FEATURE_RULES.filter((feature) => featureSignalIsRequested(request, feature.pattern)).slice(0, MAX_REQUIREMENTS - 1);
  const explicitFeaturePatterns = matchedFeatures.map((feature) => feature.pattern);
  const unmatchedExplicitClauses = explicitClauses.filter((clause) =>
    !matchedFeatures.some((feature) => featureSignalIsRequested(clause, feature.pattern))
  );
  const featureRequirements = matchedFeatures.map((feature, index) => {
    const sourceClauses = explicitClauses.filter((clause) => featureSignalIsRequested(clause, feature.pattern));
    return {
      id: 'REQ-' + String(index + 2).padStart(3, '0'),
      name: feature.name,
      source: 'explicit-feature-signal',
      featureKey: feature.id,
      sourceText: (sourceClauses.length ? sourceClauses.join(' | ') : request).slice(0, MAX_PROMPT_LENGTH),
      acceptance: [feature.acceptance],
    };
  });
  const availableClauseSlots = Math.max(0, MAX_REQUIREMENTS - 1 - featureRequirements.length);
  const representedClauses = unmatchedExplicitClauses.slice(0, availableClauseSlots);
  const unrepresentedClauses = unmatchedExplicitClauses.slice(availableClauseSlots);
  const clauseRequirements = representedClauses.map((clause, index) => ({
    id: 'REQ-' + String(featureRequirements.length + index + 2).padStart(3, '0'),
    name: 'Explicit request: ' + clause.slice(0, 100),
    source: 'explicit-clause',
    sourceText: clause.slice(0, 600),
    acceptance: ['Implement and verify this user-stated requirement: ' + clause + '. If it is blocked, state the blocker and do not imply completion.'],
  }));
  const requirements = [
    {
      id: 'REQ-001',
      name: 'User-stated primary outcome',
      source: 'explicit',
      sourceText: request.slice(0, 600),
      acceptance: ['Demonstrate the primary outcome stated by the user; disclose any unimplemented or blocked sub-requirement.'],
    },
    ...featureRequirements,
    ...clauseRequirements,
  ];
  const appType = inferApplicationType(request, archetype, inferStack(request));
  const featureDependencies = inferFeatureDependencies(requirements);
  const inputOutputContracts = inferInputOutputContracts(request, archetype, requirements);
  const unresolvedAssumptions = inferUnresolvedAssumptions(request, requirements, inferStack(request));
  const evidenceContract = inferEvidenceContract(isUi, appType, requirements);

  const spec = {
    schemaVersion: SPEC_VERSION,
    mode: modification ? 'modify-existing' : 'create-or-implement',
    scope: isUi ? 'application-ui' : 'software-change',
    applicationType: appType,
    originalRequest: request,
    archetype: isUi ? archetype : { id: 'software-change', label: 'Existing software/change request', suggestedPages: [] },
    targetAudience: 'Infer from the user request and existing project context; do not invent a specific audience when none is stated.',
    stack: inferStack(request),
    pages: {
      explicitlyRequested: requestedPages,
      suggestions: isUi ? archetype.suggestedPages : [],
      rule: 'Suggestions are optional guidance, not new user requirements. Preserve existing pages unless the user asks to remove them.',
    },
    requirements,
    featureDependencies,
    inputOutputContracts,
    unresolvedAssumptions,
    evidenceContract,
    componentArchitecture: inferComponentArchitecture(isUi, isUi ? archetype : { id: 'software-change' }, requirements),
    dataModel: inferDataModel(request, isUi ? archetype : { id: 'software-change' }, requirements),
    interactions: buildInteractionContracts(requirements),
    nonFunctional: {
      security: ['Validate untrusted inputs at the boundary.', 'Keep secrets in configuration, never generated source.', 'Use authorization checks for protected data/actions.', 'Do not use eval or execute user-provided input as code.'],
      reliability: ['Handle asynchronous loading and expected errors.', 'Preserve existing behavior outside the requested change.', 'Use bounded retries and actionable failure messages where retries are used.'],
      performance: ['Avoid unnecessary dependencies and expensive repeated computations.', 'Keep large lists and visualizations responsive for expected data size.'],
    },
    designSystem: isUi ? {
      principles: [
        'Derive palette and density from the domain, prompt, and existing design system; do not force a theme that conflicts with the request.',
        'Define and consistently reuse semantic color, typography, spacing, radius, elevation, and focus-state tokens.',
        'Establish clear content hierarchy and a strong primary action; avoid a generic template when it does not fit the product.',
        'Use reusable components for repeated patterns and avoid duplicating page-level styling.',
        'Use realistic domain-appropriate sample data only when no real data source exists; make mock/demo behavior clear.',
      ],
      requiredStates: ['loading', 'empty', 'error', 'success/confirmation where applicable'],
      responsiveWidthsPx: [360, 768, 1280],
      accessibility: ['semantic HTML', 'labels and accessible names', 'keyboard operation', 'visible focus', 'sufficient contrast', 'meaningful image alt text'],
    } : null,
    explicitCoverage: {
      extractedClauseCount: explicitClauses.length,
      representedClauseCount: explicitClauses.length - unrepresentedClauses.length,
      unrepresentedClauses,
      note: unrepresentedClauses.length
        ? 'Some prompt clauses exceed the specification limit. They remain in originalRequest and require explicit handling before completion.'
        : 'Explicit clauses are represented directly or by a matching feature-specific requirement.',
    },
    acceptanceCriteria: [],
    rules: [
      'Treat this specification as a traceability contract, not permission to ignore the original request.',
      'Implement every REQ-* item or explicitly report why it is blocked; never silently drop a requirement.',
      'For existing projects, inspect and preserve existing architecture and unrelated working code.',
      'Do not claim integrations, persistence, authentication, payment, or booking are real unless the required implementation/configuration exists.',
      'Do not claim an acceptance check passed without evidence.',
    ],
  };
  spec.acceptanceCriteria = buildAcceptanceCriteria(isUi, requirements);
  const validation = validateAppSpecification(spec);
  if (!validation.valid) {
    const error = new Error('Generated app specification is invalid: ' + validation.errors.join('; '));
    error.code = 'INVALID_APP_SPECIFICATION';
    error.validation = validation;
    throw error;
  }
  return spec;
}

function validateAppSpecification(spec) {
  const errors = [];
  const warnings = [];
  if (!spec || typeof spec !== 'object') return { valid: false, errors: ['Specification must be an object'], warnings, requirementCoverage: 0 };
  if (spec.schemaVersion !== SPEC_VERSION) errors.push('schemaVersion must be ' + SPEC_VERSION);
  if (typeof spec.originalRequest !== 'string' || !spec.originalRequest.trim()) errors.push('originalRequest is required');
  if (!['create-or-implement', 'modify-existing'].includes(spec.mode)) errors.push('mode is invalid');
  if (!['application-ui', 'software-change'].includes(spec.scope)) errors.push('scope is invalid');
  if (spec.applicationType && !APPLICATION_TYPES.includes(spec.applicationType)) errors.push('applicationType is invalid');
  if (!Array.isArray(spec.requirements) || spec.requirements.length === 0) errors.push('at least one requirement is required');
  if (!Array.isArray(spec.acceptanceCriteria) || spec.acceptanceCriteria.length === 0) errors.push('acceptanceCriteria are required');

  const requirementIds = new Set((spec.requirements || []).map((item) => item && item.id).filter(Boolean));
  const criterionIds = new Set();
  for (const requirement of Array.isArray(spec.requirements) ? spec.requirements : []) {
    if (!requirement || typeof requirement.id !== 'string' || !/^REQ-\d{3}$/.test(requirement.id)) {
      errors.push('every requirement must have a valid REQ-### id');
      continue;
    }
    if (typeof requirement.name !== 'string' || !requirement.name.trim()) errors.push(requirement.id + ' needs a name');
    if (!Array.isArray(requirement.acceptance) || requirement.acceptance.length === 0 || requirement.acceptance.some((value) => typeof value !== 'string' || !value.trim())) {
      errors.push(requirement.id + ' needs at least one acceptance statement');
    }
  }
  const allRequirementIds = (spec.requirements || []).map((item) => item && item.id).filter(Boolean);
  if (new Set(allRequirementIds).size !== allRequirementIds.length) errors.push('duplicate requirement id');

  for (const criterion of Array.isArray(spec.acceptanceCriteria) ? spec.acceptanceCriteria : []) {
    if (!criterion || typeof criterion.id !== 'string' || !/^AC-\d{2}$/.test(criterion.id)) {
      errors.push('every acceptance criterion must have a valid AC-## id');
      continue;
    }
    if (criterionIds.has(criterion.id)) errors.push('duplicate acceptance criterion id: ' + criterion.id);
    criterionIds.add(criterion.id);
    if (typeof criterion.check !== 'string' || !criterion.check.trim()) errors.push(criterion.id + ' needs a verifiable check');
    for (const requirementId of criterion.requirementIds || []) {
      if (!requirementIds.has(requirementId)) errors.push(criterion.id + ' references unknown requirement ' + requirementId);
    }
  }

  const requirementsWithChecks = new Set((spec.acceptanceCriteria || []).flatMap((criterion) => criterion.requirementIds || []));
  const checkedCount = (spec.requirements || []).filter((requirement) => requirementsWithChecks.has(requirement.id)).length;
  const requirementCoverage = spec.requirements && spec.requirements.length ? checkedCount / spec.requirements.length : 0;
  if (requirementCoverage < 1) errors.push('acceptance coverage is ' + Math.round(requirementCoverage * 100) + '%; every requirement must have a check');
  if ((spec.requirements || []).length > MAX_REQUIREMENTS) errors.push('requirements exceed limit (' + MAX_REQUIREMENTS + ')');
  if ((spec.acceptanceCriteria || []).length > MAX_ACCEPTANCE_CRITERIA) warnings.push('acceptance criteria exceed cap (' + MAX_ACCEPTANCE_CRITERIA + ')');
  if (spec.explicitCoverage?.unrepresentedClauses?.length) warnings.push(spec.explicitCoverage.unrepresentedClauses.length + ' explicit prompt clause(s) exceed the requirement limit and need handling before completion.');
  if (spec.scope === 'application-ui' && (!spec.designSystem || !Array.isArray(spec.designSystem.responsiveWidthsPx))) {
    errors.push('application-ui specifications require designSystem and responsive widths');
  }
  if (spec.scope === 'application-ui' && (!spec.componentArchitecture || !Array.isArray(spec.componentArchitecture.boundaries) || !Array.isArray(spec.dataModel?.entities) || !Array.isArray(spec.interactions))) {
    errors.push('application-ui specifications require component architecture, data model, and interaction contracts');
  }
  for (const interaction of Array.isArray(spec.interactions) ? spec.interactions : []) {
    if (!requirementIds.has(interaction.requirementId)) errors.push('interaction references unknown requirement ' + interaction.requirementId);
    if (!Array.isArray(interaction.stateTransitions) || interaction.stateTransitions.length === 0) errors.push('interaction ' + interaction.featureKey + ' needs state transitions');
  }
  return { valid: errors.length === 0, errors, warnings, requirementCoverage };
}

function formatAppSpecificationForPrompt(spec) {
  if (!spec) return '';
  const validation = validateAppSpecification(spec);
  if (!validation.valid) throw new Error('Cannot pass an invalid specification to generation: ' + validation.errors.join('; '));
  const concise = {
    schemaVersion: spec.schemaVersion,
    mode: spec.mode,
    scope: spec.scope,
    applicationType: spec.applicationType,
    originalRequest: spec.originalRequest,
    archetype: spec.archetype,
    targetAudience: spec.targetAudience,
    stack: spec.stack,
    pages: spec.pages,
    requirements: spec.requirements,
    featureDependencies: spec.featureDependencies,
    inputOutputContracts: spec.inputOutputContracts,
    unresolvedAssumptions: spec.unresolvedAssumptions,
    evidenceContract: spec.evidenceContract,
    explicitCoverage: spec.explicitCoverage,
    componentArchitecture: spec.componentArchitecture,
    dataModel: spec.dataModel,
    interactions: spec.interactions,
    nonFunctional: spec.nonFunctional,
    designSystem: spec.designSystem,
    acceptanceCriteria: spec.acceptanceCriteria,
    rules: spec.rules,
  };
  return [
    '=== AI-DOST APP SPECIFICATION (validated implementation contract) ===',
    'The original request remains authoritative. Suggestions are optional. Map implementation and verification to the REQ-* and AC-* identifiers. If explicitCoverage.unrepresentedClauses is non-empty, handle those clauses explicitly or report why they are blocked.',
    'For existing projects, inspect and preserve current conventions and unrelated working code.',
    'Do not claim integrations or checks are complete because a prompt, file, or tool call mentions them. Report unmet requirements and missing evidence explicitly.',
    JSON.stringify(concise, null, 2),
    '=== END AI-DOST APP SPECIFICATION ===',
  ].join('\n');
}

module.exports = {
  SPEC_VERSION,
  APPLICATION_TYPES,
  buildAppSpecification,
  formatAppSpecificationForPrompt,
  shouldCreateAppSpecification,
  validateAppSpecification,
  findMissingFeatureSignals,
};
