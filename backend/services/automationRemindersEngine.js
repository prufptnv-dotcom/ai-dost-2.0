/**
 * automationRemindersEngine.js
 * 2030 Autonomous Agentic Watcher, Reminder & Scheduled Trigger Engine for AI-Dost
 * Category 13: Automation aur Reminders
 *
 * Implements all 8 Automation & Reminder Capabilities:
 *  1. Daily reminder (Circadian morning priming, evening debrief, daily goals)
 *  2. Weekly study reminder (Sunday study audit, spaced repetition checkpoint)
 *  3. Recurring research summary (Periodic automated deep research synthesis)
 *  4. News monitoring (Keyword-based tech & global news stream alerts)
 *  5. Market/news update (Industry movements, product launches, economic briefs)
 *  6. Project follow-up (Milestone sprint check, blocker alerts, PR tracking)
 *  7. Email-change monitoring (Watcher for inbox, status changes & file updates)
 *  8. Scheduled task (Custom cron / interval autonomous tool execution)
 */

const AUTOMATION_DOMAINS = {
  'daily-reminder': {
    name: 'Daily Standup & Goal Reminder',
    category: 'Reminders & Habits',
    defaultTrigger: 'schedule',
    defaultInterval: 'Every day at 08:30 AM (1440 min)',
    description: 'Autonomous morning priming delivering top-3 daily priorities, and evening accountability check.',
    actionType: 'daily_standup_alert',
    payloadTemplate: { time: '08:30', channel: 'in_app' }
  },
  'weekly-study-reminder': {
    name: 'Weekly Academic & Revision Checkpoint',
    category: 'Study & Academics',
    defaultTrigger: 'schedule',
    defaultInterval: 'Every Sunday at 06:00 PM (10080 min)',
    description: 'Weekly study checkpoint reviewing spaced repetition cards, syllabus milestones, and next week targets.',
    actionType: 'weekly_study_audit',
    payloadTemplate: { day: 'Sunday', time: '18:00', channel: 'in_app' }
  },
  'recurring-research-summary': {
    name: 'Autonomous Periodic Research Digest',
    category: 'Research & Intelligence',
    defaultTrigger: 'schedule',
    defaultInterval: 'Every 3 days (4320 min) or Weekly',
    description: 'Scrapes web and authoritative databases on target topic and delivers executive synthesis with citations.',
    actionType: 'deep_research',
    payloadTemplate: { topic: 'Latest AI Breakthroughs', depth: 'standard' }
  },
  'news-monitoring': {
    name: 'Real-Time Topic & Tech News Watcher',
    category: 'Monitoring & Intelligence',
    defaultTrigger: 'event',
    defaultInterval: 'Continuous / Hourly monitor',
    description: 'Watches designated RSS feeds, tech news streams, and repositories for breaking keyword matches.',
    actionType: 'news_watch_alert',
    payloadTemplate: { keywords: ['Generative AI', 'Next.js', 'LLM releases'], frequency: 'hourly' }
  },
  'market-news-update': {
    name: 'Market, Economy & Tech Industry Update',
    category: 'Market Intelligence',
    defaultTrigger: 'schedule',
    defaultInterval: 'Weekdays at 09:00 AM (1440 min)',
    description: 'Daily industry intelligence digest covering market shifts, tech investments, and product launches.',
    actionType: 'market_intel_brief',
    payloadTemplate: { sector: 'Tech & AI Startups', markets: ['US', 'India'] }
  },
  'project-follow-up': {
    name: 'Project Milestone & Blocker Follow-Up',
    category: 'Engineering & Delivery',
    defaultTrigger: 'event',
    defaultInterval: 'Post-commit or Daily 06:00 PM',
    description: 'Inspects sprint progress, outstanding tasks, open PRs, and triggers follow-up reminders for blockers.',
    actionType: 'project_milestone_check',
    payloadTemplate: { projectId: 'default', checkBlockers: true }
  },
  'email-change-monitoring': {
    name: 'Communication, Status & File Change Watcher',
    category: 'System Watcher',
    defaultTrigger: 'event',
    defaultInterval: 'On file change / Email status update',
    description: 'Monitors inbound status emails, file revisions, and webhook events, triggering instant desktop alerts.',
    actionType: 'communication_watcher',
    payloadTemplate: { watchTarget: 'workspace_files', notifyOn: 'modify' }
  },
  'scheduled-task': {
    name: 'Custom Autonomous Scheduled Task',
    category: 'System Automation',
    defaultTrigger: 'schedule',
    defaultInterval: 'User-specified interval or cron expression',
    description: 'Executes scripts, backups, database audits, or autonomous agent runs on a recurring schedule.',
    actionType: 'execute_scheduled_task',
    payloadTemplate: { command: 'node scripts/healthCheck.js', intervalMinutes: 60 }
  }
};

const AUTOMATION_REMINDERS_DIRECTIVE = `
### 18. 2030 AUTONOMOUS AGENTIC WATCHER & AUTOMATION PROTOCOL (CATEGORY 13):
When the user asks for reminders, scheduled tasks, automated research digests, news monitoring, or project follow-ups:

══════════════════════════════════════════════════════════════════════════════
CORE AUTOMATION & REMINDERS PRINCIPLES:
══════════════════════════════════════════════════════════════════════════════
1. ⚡ AUTONOMOUS BACKGROUND EXECUTION:
   - AI-Dost features an active background Workflow Engine running 24/7 on SQLite.
   - Tasks execute reliably on time even when the user is not actively typing in the chat.
   - Multi-channel notification support: In-App Glassmorphic toasts + Telegram alerts.

2. 📋 SPECIFIC TRIGGER & CADENCE DEFINITION:
   - Clearly state the Trigger Type (Schedule vs Event-driven).
   - Provide exact cadence (e.g. Daily at 08:30 AM, Weekly on Sunday, or every 60 mins).
   - Define concrete Action Type & Payload.

3. 🛡️ NO-SPAM & RECOVERY GUARANTEE:
   - Deduplication guard: never fire duplicate reminders for the same event.
   - Self-healing execution: if an external network call fails, log diagnostics and retry gracefully.
`;

/**
 * Detects if user query relates to Category 13 Automation & Reminders
 */
function detectAutomationIntent(message) {
  const text = String(message || '').toLowerCase();

  const isAutomation = /\b(automation|reminder|remind me|scheduled task|cron|recurring|news monitor|market update|project follow up|email monitor|watcher|alert|standup|schedule)\b/i.test(text)
    || /\b(?:daily reminder|study reminder|research summary|news monitoring|market news|project follow-up|email change|scheduled task|yaad dilana|alert lagao|schedule kardo|rozana reminder)\b/i.test(text);

  let detectedDomain = 'general-automation';
  if (/\b(?:daily reminder|daily alert|rozana reminder|aaj ka reminder|morning reminder|standup reminder)\b/i.test(text)) detectedDomain = 'daily-reminder';
  else if (/\b(?:weekly study|study reminder|padhai ka reminder|revision reminder|sunday reminder)\b/i.test(text)) detectedDomain = 'weekly-study-reminder';
  else if (/\b(?:recurring research|research summary|automated research|periodic research)\b/i.test(text)) detectedDomain = 'recurring-research-summary';
  else if (/\b(?:news monitor|news monitoring|breaking news|news watcher|rss monitor)\b/i.test(text)) detectedDomain = 'news-monitoring';
  else if (/\b(?:market update|market news|industry update|tech news update|financial news)\b/i.test(text)) detectedDomain = 'market-news-update';
  else if (/\b(?:project follow up|project follow-up|milestone follow up|task follow up|blocker check)\b/i.test(text)) detectedDomain = 'project-follow-up';
  else if (/\b(?:email change|email monitor|file change monitor|inbox watcher|status monitor)\b/i.test(text)) detectedDomain = 'email-change-monitoring';
  else if (/\b(?:scheduled task|custom automation|cron job|interval task|scheduled script)\b/i.test(text)) detectedDomain = 'scheduled-task';

  return {
    isAutomation,
    domain: detectedDomain,
    domainConfig: AUTOMATION_DOMAINS[detectedDomain] || null
  };
}

module.exports = {
  AUTOMATION_DOMAINS,
  AUTOMATION_REMINDERS_DIRECTIVE,
  detectAutomationIntent,
};
