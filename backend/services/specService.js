const { v4: uuidv4 } = require('uuid');
const PlannerService = require('./plannerService');

const SPEC_STEPS = [
  {
    id: 'overview',
    title: 'Project Overview',
    fields: [
      { key: 'name', label: 'Project Name', type: 'text', placeholder: 'e.g. Bihar Tourism', required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['E-commerce', 'Blog', 'Portfolio', 'Dashboard', 'Landing Page', 'SaaS', 'Social', 'Tourism', 'Education', 'Healthcare', 'Other'], required: true },
      { key: 'purpose', label: 'Why are you building this?', type: 'textarea', placeholder: 'Main goal or problem it solves', required: true },
      { key: 'audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. Tourists, Students, Professionals', required: true },
    ]
  },
  {
    id: 'features',
    title: 'Features & Requirements',
    fields: [
      { key: 'core', label: 'Core Features (Must Have)', type: 'multiselect', placeholder: 'Select or type features', options: ['User Authentication', 'Dashboard', 'Search/Filter', 'Payment Integration', 'Booking System', 'Contact Form', 'Blog/Articles', 'Admin Panel', 'Real-time Chat', 'File Upload', 'Notifications', 'Analytics', 'Multi-language', 'Dark Mode', 'Responsive Design', 'SEO Optimized', 'API Integration', 'Email System', 'User Profiles', 'Admin Dashboard'], required: true },
      { key: 'optional', label: 'Nice to Have', type: 'multiselect', placeholder: 'Optional features', options: ['Blog Section', 'Multi-language', 'Dark Mode', 'Analytics Dashboard', 'Export Data', 'Social Sharing', 'Comments/Reviews', 'Wishlist/Favorites', 'Compare Products', 'Live Chat Support', 'Push Notifications', 'Offline Support', 'PWA', 'Advanced Search', 'Custom Reports'], required: false },
      { key: 'integrations', label: 'Third-party Integrations', type: 'multiselect', placeholder: 'APIs or services to connect', options: ['Stripe/Payment', 'Firebase/Auth', 'Google Maps', 'SendGrid/Email', 'AWS S3/Storage', 'Twilio/SMS', 'OpenAI/API', 'Supabase', 'MongoDB', 'PostgreSQL', 'Redis', 'Cloudinary/Images', 'Algolia/Search', 'Sentry/Errors', 'Analytics/GA', 'Webhooks'], required: false },
    ]
  },
  {
    id: 'tech',
    title: 'Technology Stack',
    fields: [
      { key: 'language', label: 'Primary Language', type: 'select', options: ['JavaScript', 'TypeScript', 'Python'], default: 'JavaScript', required: true },
      { key: 'framework', label: 'Framework', type: 'select', options: ['React + Vite', 'Next.js', 'Astro', 'SvelteKit', 'Vue + Vite', 'Vanilla JS', 'Express.js', 'FastAPI', 'Django', 'Flask'], default: 'React + Vite', required: true },
      { key: 'database', label: 'Database', type: 'select', options: ['None (Static)', 'SQLite', 'PostgreSQL', 'MongoDB', 'Supabase', 'Firebase', 'PlanetScale', 'Prisma + PostgreSQL', 'Drizzle + SQLite'], default: 'None (Static)', required: true },
      { key: 'deploy', label: 'Deployment Target', type: 'select', options: ['Vercel', 'Netlify', 'Cloudflare Pages', 'GitHub Pages', 'Railway', 'Render', 'AWS', 'Docker/VPS', 'Local Only'], default: 'Vercel', required: true },
      { key: 'styling', label: 'Styling Approach', type: 'select', options: ['Tailwind CSS', 'CSS Modules', 'Styled Components', 'Plain CSS', 'Bootstrap', 'Material UI', 'Chakra UI', 'UnoCSS'], default: 'Tailwind CSS', required: true },
    ]
  },
  {
    id: 'design',
    title: 'Design & UX',
    fields: [
      { key: 'style', label: 'Design Style', type: 'select', options: ['Modern/Clean', 'Minimal', 'Bold/Colorful', 'Dark Theme', 'Corporate/Professional', 'Creative/Artistic', 'Retro/Vintage', 'Glassmorphism', 'Neumorphism'], default: 'Modern/Clean', required: true },
      { key: 'colors', label: 'Color Preference', type: 'text', placeholder: 'e.g. Green theme, Blue/White, Custom hex codes', required: false },
      { key: 'pages', label: 'Key Pages', type: 'multiselect', placeholder: 'Select pages needed', options: ['Home', 'About', 'Services/Products', 'Contact', 'Login/Signup', 'Dashboard', 'Profile', 'Settings', 'Blog', 'FAQ', 'Pricing', 'Portfolio', 'Gallery', 'Team', 'Testimonials', '404', 'Terms/Privacy'], required: true },
      { key: 'mobileFirst', label: 'Mobile First', type: 'boolean', default: true, required: false },
      { key: 'accessibility', label: 'Accessibility (WCAG)', type: 'boolean', default: true, required: false },
    ]
  },
  {
    id: 'constraints',
    title: 'Constraints & Extras',
    fields: [
      { key: 'budget', label: 'Budget Tier', type: 'select', options: ['Free ($0)', 'Low (<$50/mo)', 'Medium ($50-200/mo)', 'High (>$200/mo)', 'Enterprise'], default: 'Free ($0)', required: false },
      { key: 'timeline', label: 'Timeline', type: 'select', options: ['ASAP (1-2 days)', '1 Week', '2 Weeks', '1 Month', '2+ Months', 'No Rush'], default: '1 Week', required: false },
      { key: 'team', label: 'Team Size', type: 'select', options: ['Solo', '2-3 Devs', '4-8 Devs', 'Large Team'], default: 'Solo', required: false },
      { key: 'maintenance', label: 'Maintenance Plan', type: 'select', options: ['Self-maintained', 'Need docs only', 'Need CI/CD', 'Full managed'], default: 'Self-maintained', required: false },
      { key: 'notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Any special requirements, constraints, or ideas', required: false },
    ]
  }
];

const CATEGORY_SUGGESTIONS = {
  'E-commerce': { core: ['User Authentication', 'Payment Integration', 'Shopping Cart', 'Product Catalog', 'Order Management'], framework: 'Next.js', database: 'PostgreSQL', pages: ['Home', 'Products', 'Cart', 'Checkout', 'Login/Signup', 'Profile', 'Orders'] },
  'Blog': { core: ['Blog/Articles', 'SEO Optimized', 'Search/Filter', 'User Authentication'], framework: 'Next.js', database: 'SQLite', pages: ['Home', 'Blog', 'Article', 'About', 'Contact', 'Login/Signup'] },
  'Portfolio': { core: ['Responsive Design', 'Portfolio', 'Contact Form', 'SEO Optimized'], framework: 'React + Vite', database: 'None (Static)', pages: ['Home', 'About', 'Portfolio', 'Contact'] },
  'Dashboard': { core: ['User Authentication', 'Dashboard', 'Analytics', 'Admin Panel', 'Real-time Data'], framework: 'Next.js', database: 'PostgreSQL', pages: ['Login/Signup', 'Dashboard', 'Analytics', 'Settings', 'Profile', 'Reports'] },
  'Landing Page': { core: ['Responsive Design', 'Contact Form', 'SEO Optimized', 'Fast Loading'], framework: 'Astro', database: 'None (Static)', pages: ['Home', 'Features', 'Pricing', 'Testimonials', 'Contact', 'FAQ'] },
  'SaaS': { core: ['User Authentication', 'Dashboard', 'Payment Integration', 'Admin Panel', 'API Integration', 'Subscription Management'], framework: 'Next.js', database: 'PostgreSQL', pages: ['Home', 'Pricing', 'Login/Signup', 'Dashboard', 'Settings', 'Billing', 'Docs', 'API'] },
  'Social': { core: ['User Authentication', 'Real-time Chat', 'Notifications', 'User Profiles', 'Feed', 'File Upload'], framework: 'Next.js', database: 'PostgreSQL', pages: ['Home', 'Feed', 'Profile', 'Messages', 'Notifications', 'Settings', 'Search'] },
  'Tourism': { core: ['Booking System', 'Photo Gallery', 'Search/Filter', 'Contact Form', 'Map Integration', 'Multi-language'], framework: 'React + Vite', database: 'Supabase', pages: ['Home', 'Destinations', 'Gallery', 'Booking', 'About', 'Contact', 'Blog'] },
  'Education': { core: ['User Authentication', 'Dashboard', 'Video Player', 'Progress Tracking', 'Quiz/Assessment', 'Certificate'], framework: 'Next.js', database: 'PostgreSQL', pages: ['Home', 'Courses', 'Dashboard', 'Lesson', 'Profile', 'Certificates', 'Login/Signup'] },
  'Healthcare': { core: ['User Authentication', 'Booking System', 'Dashboard', 'Notifications', 'File Upload', 'Video Consultation'], framework: 'Next.js', database: 'PostgreSQL', pages: ['Home', 'Doctors', 'Booking', 'Dashboard', 'Records', 'Profile', 'Login/Signup'] },
};

class SpecService {
  constructor() {
    this.specs = new Map();
    this._maxSpecs = 100;
  }

  sanitizeSpecId(id) {
    return String(id).replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 50);
  }

  createSpecFromIntent(intent, previousAnswers = {}) {
    if (this.specs.size >= this._maxSpecs) {
      const oldestKey = this.specs.keys().next().value;
      this.specs.delete(oldestKey);
    }

    const specId = uuidv4().substring(0, 8);
    const category = previousAnswers.category || this.detectCategory(intent);
    const suggestions = CATEGORY_SUGGESTIONS[category] || {};

    const spec = {
      specId,
      intent: String(intent).slice(0, 2000),
      steps: {},
      currentStep: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    SPEC_STEPS.forEach((step, idx) => {
      spec.steps[step.id] = {
        stepId: step.id,
        title: step.title,
        completed: idx === 0 ? false : false,
        data: {},
        suggestions: this.getStepSuggestions(step.id, category, suggestions, previousAnswers),
      };
    });

    if (previousAnswers.category) {
      spec.steps.overview.data.category = previousAnswers.category;
      spec.steps.overview.completed = true;
      spec.currentStep = 1;
    }

    this.specs.set(specId, spec);
    return this.getStepResponse(spec, 0);
  }

  getStepSuggestions(stepId, category, categorySuggestions, previousAnswers) {
    const suggestions = { fields: {} };

    switch (stepId) {
      case 'overview':
        if (category && categorySuggestions) {
          suggestions.fields.category = category;
        }
        break;
      case 'features':
        if (categorySuggestions.core) {
          suggestions.fields.core = categorySuggestions.core;
        }
        if (previousAnswers.framework === 'Next.js') {
          suggestions.fields.core = [...new Set([...(suggestions.fields.core || []), 'Server-side Rendering', 'API Routes'])];
        }
        break;
      case 'tech':
        if (categorySuggestions.framework) {
          suggestions.fields.framework = categorySuggestions.framework;
        }
        if (categorySuggestions.database) {
          suggestions.fields.database = categorySuggestions.database;
        }
        if (previousAnswers.core?.includes('User Authentication')) {
          suggestions.fields.framework = suggestions.fields.framework || 'Next.js';
        }
        if (previousAnswers.core?.includes('Real-time Chat') || previousAnswers.core?.includes('Real-time Data')) {
          suggestions.fields.framework = suggestions.fields.framework || 'Next.js';
        }
        break;
      case 'design':
        if (categorySuggestions.pages) {
          suggestions.fields.pages = categorySuggestions.pages;
        }
        if (category === 'Tourism') suggestions.fields.colors = 'Green theme (Bihar)';
        if (category === 'Healthcare') suggestions.fields.colors = 'Blue/White medical theme';
        if (category === 'E-commerce') suggestions.fields.colors = 'Trust colors (Blue/Green)';
        break;
      case 'constraints':
        if (previousAnswers.budget === 'Free ($0)') {
          suggestions.fields.deploy = 'Vercel';
          suggestions.fields.database = 'Supabase/Firebase';
        }
        break;
    }

    return suggestions;
  }

  detectCategory(intent) {
    const p = (intent || '').toLowerCase();
    if (p.includes('ecommerce') || p.includes('e-commerce') || p.includes('shop') || p.includes('store') || p.includes('cart') || p.includes('product') || p.includes('sell')) return 'E-commerce';
    if (p.includes('blog') || p.includes('article') || p.includes('post') || p.includes('news')) return 'Blog';
    if (p.includes('portfolio') || p.includes('showcase') || p.includes('cv') || p.includes('resume')) return 'Portfolio';
    if (p.includes('dashboard') || p.includes('admin') || p.includes('analytics') || p.includes('metric') || p.includes('chart')) return 'Dashboard';
    if (p.includes('landing') || p.includes('marketing') || p.includes('promo') || p.includes('launch')) return 'Landing Page';
    if (p.includes('saas') || p.includes('subscription') || p.includes('billing') || p.includes('multi-tenant')) return 'SaaS';
    if (p.includes('social') || p.includes('community') || p.includes('feed') || p.includes('chat') || p.includes('message')) return 'Social';
    if (p.includes('tourism') || p.includes('travel') || p.includes('booking') || p.includes('hotel') || p.includes('destination')) return 'Tourism';
    if (p.includes('education') || p.includes('course') || p.includes('learn') || p.includes('student') || p.includes('school') || p.includes('university')) return 'Education';
    if (p.includes('health') || p.includes('medical') || p.includes('doctor') || p.includes('hospital') || p.includes('clinic') || p.includes('patient')) return 'Healthcare';
    return 'Other';
  }

  getStepResponse(spec, stepIndex) {
    const step = SPEC_STEPS[stepIndex];
    if (!step) return { done: true, spec };

    const stepData = spec.steps[step.id];
    return {
      done: false,
      specId: spec.specId,
      step: {
        id: step.id,
        title: step.title,
        stepNumber: stepIndex + 1,
        totalSteps: SPEC_STEPS.length,
        fields: step.fields.map(f => ({
          ...f,
          value: stepData.data[f.key] ?? f.default ?? '',
          suggestions: stepData.suggestions.fields[f.key] || null,
        })),
        completed: stepData.completed,
      },
      canGoBack: stepIndex > 0,
      progress: Math.round(((stepIndex) / SPEC_STEPS.length) * 100),
    };
  }

  submitStep(specId, stepIndex, answers) {
    const spec = this.specs.get(specId);
    if (!spec) throw new Error('Spec not found');

    const step = SPEC_STEPS[stepIndex];
    if (!step) throw new Error('Invalid step');

    const stepData = spec.steps[step.id];
    stepData.data = { ...stepData.data, ...answers };
    stepData.completed = true;
    spec.currentStep = Math.max(spec.currentStep, stepIndex + 1);
    spec.updatedAt = new Date().toISOString();

    const nextIndex = stepIndex + 1;
    if (nextIndex >= SPEC_STEPS.length) {
      spec.status = 'review';
      return { done: true, spec, message: 'All steps completed. Ready for review.' };
    }

    return this.getStepResponse(spec, nextIndex);
  }

  getSpec(specId) {
    return this.specs.get(specId) || null;
  }

  updateStep(specId, stepId, data) {
    const spec = this.specs.get(specId);
    if (!spec) throw new Error('Spec not found');

    if (!spec.steps[stepId]) throw new Error('Invalid step');

    spec.steps[stepId].data = { ...spec.steps[stepId].data, ...data };
    spec.updatedAt = new Date().toISOString();
    return spec;
  }

  async specToPlan(spec) {
    const overview = spec.steps.overview.data;
    const features = spec.steps.features.data;
    const tech = spec.steps.tech.data;
    const design = spec.steps.design.data;
    const constraints = spec.steps.constraints.data;

    const prompt = this.buildPromptFromSpec(spec);

    const planOptions = {
      framework: this.mapFramework(tech.framework),
      projectName: overview.name || 'ai-dost-project',
    };

    const plan = await PlannerService.createPlan(prompt, planOptions);
    plan.specId = spec.specId;
    plan.spec = spec;

    return plan;
  }

  buildPromptFromSpec(spec) {
    const overview = spec.steps.overview.data;
    const features = spec.steps.features.data;
    const tech = spec.steps.tech.data;
    const design = spec.steps.design.data;
    const constraints = spec.steps.constraints.data;

    let prompt = `Build a ${overview.category?.toLowerCase() || 'web'} application called "${overview.name || 'AI-Dost Project'}". `;
    prompt += `Purpose: ${overview.purpose || 'Not specified'}. `;
    prompt += `Target audience: ${overview.audience || 'General'}. `;

    if (features.core?.length) {
      prompt += `Core features: ${features.core.join(', ')}. `;
    }
    if (features.optional?.length) {
      prompt += `Optional features: ${features.optional.join(', ')}. `;
    }
    if (features.integrations?.length) {
      prompt += `Integrations: ${features.integrations.join(', ')}. `;
    }

    prompt += `Tech stack: ${tech.language || 'JavaScript'} with ${tech.framework || 'React + Vite'}. `;
    if (tech.database && tech.database !== 'None (Static)') {
      prompt += `Database: ${tech.database}. `;
    }
    prompt += `Deploy to: ${tech.deploy || 'Vercel'}. `;
    prompt += `Styling: ${tech.styling || 'Tailwind CSS'}. `;

    prompt += `Design: ${design.style || 'Modern/Clean'} style. `;
    if (design.colors) prompt += `Colors: ${design.colors}. `;
    if (design.pages?.length) prompt += `Pages: ${design.pages.join(', ')}. `;
    if (design.mobileFirst) prompt += 'Mobile-first. ';
    if (design.accessibility) prompt += 'WCAG accessible. ';

    if (constraints.budget) prompt += `Budget: ${constraints.budget}. `;
    if (constraints.timeline) prompt += `Timeline: ${constraints.timeline}. `;
    if (constraints.notes) prompt += `Notes: ${constraints.notes}. `;

    return prompt;
  }

  mapFramework(framework) {
    const map = {
      'React + Vite': 'react-vite',
      'Next.js': 'nextjs',
      'Astro': 'astro',
      'SvelteKit': 'sveltekit',
      'Vue + Vite': 'react-vite',
      'Vanilla JS': 'react-vite',
      'Express.js': 'react-vite',
      'FastAPI': 'react-vite',
      'Django': 'react-vite',
      'Flask': 'react-vite',
    };
    return map[framework] || 'react-vite';
  }

  approveSpec(specId) {
    const spec = this.specs.get(specId);
    if (!spec) throw new Error('Spec not found');
    if (spec.status !== 'review') throw new Error('Spec not ready for approval');

    spec.status = 'approved';
    spec.updatedAt = new Date().toISOString();

    return this.specToPlan(spec).then(plan => ({ spec, plan }));
  }

  regenerateStep(specId, stepId, guidance) {
    const spec = this.specs.get(specId);
    if (!spec) throw new Error('Spec not found');

    if (!spec.steps[stepId]) throw new Error('Invalid step');

    const newSuggestions = this.generateGuidanceSuggestions(stepId, spec, guidance);
    spec.steps[stepId].suggestions = { fields: newSuggestions };
    spec.updatedAt = new Date().toISOString();

    return { stepId, suggestions: { fields: newSuggestions } };
  }

  generateGuidanceSuggestions(stepId, spec, guidance) {
    const suggestions = {};
    const lowerGuidance = (guidance || '').toLowerCase();

    if (stepId === 'features') {
      if (lowerGuidance.includes('simple') || lowerGuidance.includes('basic')) {
        suggestions.core = ['User Authentication', 'Contact Form', 'Responsive Design'];
        suggestions.optional = ['Dark Mode', 'Blog Section'];
      }
      if (lowerGuidance.includes('advanced') || lowerGuidance.includes('full')) {
        suggestions.core = ['User Authentication', 'Dashboard', 'Payment Integration', 'Admin Panel', 'Search/Filter', 'Notifications', 'Real-time Chat'];
        suggestions.optional = ['Analytics', 'Multi-language', 'Export Data', 'Push Notifications', 'PWA'];
      }
      if (lowerGuidance.includes('ecommerce') || lowerGuidance.includes('shop')) {
        suggestions.core = ['User Authentication', 'Payment Integration', 'Shopping Cart', 'Product Catalog', 'Order Management', 'Admin Panel'];
      }
    }

    if (stepId === 'tech') {
      if (lowerGuidance.includes('simple') || lowerGuidance.includes('static')) {
        suggestions.framework = 'React + Vite';
        suggestions.database = 'None (Static)';
        suggestions.styling = 'Tailwind CSS';
      }
      if (lowerGuidance.includes('fullstack') || lowerGuidance.includes('backend') || lowerGuidance.includes('api')) {
        suggestions.framework = 'Next.js';
        suggestions.database = 'PostgreSQL';
      }
      if (lowerGuidance.includes('python')) {
        suggestions.language = 'Python';
        suggestions.framework = 'FastAPI';
      }
    }

    if (stepId === 'design') {
      if (lowerGuidance.includes('dark')) suggestions.style = 'Dark Theme';
      if (lowerGuidance.includes('minimal')) suggestions.style = 'Minimal';
      if (lowerGuidance.includes('colorful') || lowerGuidance.includes('bold')) suggestions.style = 'Bold/Colorful';
      if (lowerGuidance.includes('professional') || lowerGuidance.includes('corporate')) suggestions.style = 'Corporate/Professional';
    }

    return suggestions;
  }

  listSpecs() {
    return Array.from(this.specs.values()).map(s => ({
      specId: s.specId,
      intent: s.intent,
      status: s.status,
      currentStep: s.currentStep,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  deleteSpec(specId) {
    return this.specs.delete(specId);
  }
}

module.exports = new SpecService();