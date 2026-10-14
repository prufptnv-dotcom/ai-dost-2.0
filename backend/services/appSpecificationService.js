'use strict';

const SPEC_VERSION = '1.0';
const MAX_PROMPT_LENGTH = 4000;
const MAX_REQUIREMENTS = 60;
const MAX_ACCEPTANCE_CRITERIA = 75;

const ACTION_RE = /\b(build|create|make|generate|develop|design|scaffold|implement|add|fix|update|upgrade|improve|modify|refactor|enhance|integrate|wire|change|banao|banaye|banado|bana|lagao|jodo|badlo|sudhar|theek)\b/i;
const SOFTWARE_SCOPE_RE = /\b(app|application|website|web ?app|site|platform|dashboard|admin panel|portal|tool|software|system|api|backend|frontend|server|route|module|function|component|page|screen|form|button|feature|project|code|repository|repo|algorithm|database|schema|service|workflow|automation|game|assistant|agent|landing page|portfolio|store|shop|booking)\b|(?:^|\s)[\w./-]+\.(?:js|jsx|ts|tsx|py|css|html|json)(?:$|\s)/i;
const UI_SCOPE_RE = /\b(app|application|website|web ?app|web|site|platform|assistant|learning|course|quiz|game|todo app|to-do app|ui|ux|frontend|front-end|landing page|dashboard|admin panel|portal|screen|page|component|layout|design system|responsive|mobile-first|portfolio|storefront|shop|e-?commerce|booking|form|button|navigation|navbar|sidebar|visual|styling|theme|dark mode|light mode)\b/i;
const NEW_PROJECT_RE = /\b(new|brand new|from scratch|scratch se|naya|nayi|fresh|greenfield)\b/i;
const MODIFY_RE = /\b(add|fix|update|upgrade|improve|modify|refactor|enhance|integrate|wire|change|debug|repair|lagao|jodo|badlo|sudhar|theek|existing|current)\b/i;
const CREATE_RE = /\b(build|create|generate|scaffold|start from scratch|scratch se|banao|banado|naya|nayi)\b/i;

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

function buildAppSpecification(prompt, options = {}) {
  const request = cleanPrompt(prompt);
  if (!request || (!options.force && !shouldCreateAppSpecification(request))) return null;

  const isUi = UI_SCOPE_RE.test(request);
  const modification = MODIFY_RE.test(request) && !NEW_PROJECT_RE.test(request) && !CREATE_RE.test(request);
  const archetype = inferArchetype(request);
  const requestedPages = EXPLICIT_PAGE_RULES.filter((entry) => entry[1].test(request)).map((entry) => entry[0]);
  const explicitClauses = extractExplicitClauses(request);
  const matchedFeatures = FEATURE_RULES.filter((feature) => feature.pattern.test(request)).slice(0, MAX_REQUIREMENTS - 1);
  const explicitFeaturePatterns = matchedFeatures.map((feature) => feature.pattern);
  const unmatchedExplicitClauses = explicitClauses.filter((clause) =>
    !explicitFeaturePatterns.some((pattern) => pattern.test(clause))
  );
  const featureRequirements = matchedFeatures.map((feature, index) => {
    const sourceClause = explicitClauses.find((clause) => feature.pattern.test(clause));
    return {
      id: 'REQ-' + String(index + 2).padStart(3, '0'),
      name: feature.name,
      source: 'explicit-feature-signal',
      featureKey: feature.id,
      sourceText: (sourceClause || request).slice(0, 600),
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
  const spec = {
    schemaVersion: SPEC_VERSION,
    mode: modification ? 'modify-existing' : 'create-or-implement',
    scope: isUi ? 'application-ui' : 'software-change',
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
      representedClauseCount: representedClauses.length + unmatchedExplicitClauses.length - unrepresentedClauses.length,
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
    originalRequest: spec.originalRequest,
    archetype: spec.archetype,
    targetAudience: spec.targetAudience,
    stack: spec.stack,
    pages: spec.pages,
    requirements: spec.requirements,
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
    'The original request remains authoritative. Suggestions are optional. Map implementation and verification to the REQ-* and AC-* identifiers.',
    'For existing projects, inspect and preserve current conventions and unrelated working code.',
    'Do not claim integrations or checks are complete because a prompt, file, or tool call mentions them. Report unmet requirements and missing evidence explicitly.',
    JSON.stringify(concise, null, 2),
    '=== END AI-DOST APP SPECIFICATION ===',
  ].join('\n');
}

module.exports = {
  SPEC_VERSION,
  buildAppSpecification,
  formatAppSpecificationForPrompt,
  shouldCreateAppSpecification,
  validateAppSpecification,
};
