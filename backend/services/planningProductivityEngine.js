/**
 * planningProductivityEngine.js
 * 2030 Executive Life Architecture, Timetable & Productivity Engine for AI-Dost
 * Category 12: Planning aur Productivity
 *
 * Implements all 12 Planning & Productivity Capabilities:
 *  1. Daily timetable (Hour-by-hour deep work, energy matching, pomodoro, buffers)
 *  2. Weekly timetable (7-day theme-based distribution, balanced learning & rest)
 *  3. Semester study plan (16-week academic pacing, syllabus, mid-term & lab milestones)
 *  4. Exam preparation plan (Countdown D-60 to D-1, Pareto 80/20, mock tests)
 *  5. DSA roadmap (Zero to FAANG/Tier-1 master roadmap, topic phases & patterns)
 *  6. Career roadmap (Junior to Staff/Principal trajectory, portfolio & networking)
 *  7. Project roadmap (Sprint breakdown, M0 setup to M4 production launch)
 *  8. Habit tracker structure (Atomic habits, cue-routine-reward, streaks, 2-day rule)
 *  9. Revision schedule (Spaced Repetition System: Day 1, 3, 7, 21, 60 active recall)
 * 10. Skill-gap analysis (Current vs Target matrix, gap severity & bridge resources)
 * 11. Interview preparation plan (4-12 weeks: DSA, System Design, Core CS, Behavioral)
 * 12. Long-term learning strategy (1-3-5 year compounding T-shaped expertise)
 */

const PLANNING_DOMAINS = {
  'daily-timetable': {
    name: 'Optimized Daily Timetable',
    description: 'Circadian-rhythm aligned, hour-by-hour time-blocked schedule with deep work focus zones, breaks, and buffers.',
    sections: ['Morning Routine & Priming', 'Deep Work Block 1 (Highest cognitive load)', 'Midday Recharge & Lunch', 'Deep Work Block 2 / Skill Building Block', 'Shallow Work / Emails / Admin', 'Evening Decompression & Next-Day Planning'],
    guidelines: 'Never schedule 100% of the day. Leave 15-20% buffer for unexpected delays. Match hardest tasks to peak morning energy.'
  },
  'weekly-timetable': {
    name: 'Strategic Weekly Schedule',
    description: '7-day balanced operational rhythm distributing focus, projects, revision, fitness, and recovery.',
    sections: ['Monday-Wednesday: Heavy Execution & Deep Building', 'Thursday-Friday: Collaboration, Polishing & Testing', 'Saturday: Long-form Learning & Side Projects', 'Sunday: Review, Planning & Complete Mental Reset', 'Weekly Quota & KPI Metrics'],
    guidelines: 'Assign a clear theme to each day. Prevent mid-week burnout by scheduling mandatory active recovery.'
  },
  'semester-plan': {
    name: '16-Week Semester Academic Master Plan',
    description: 'Comprehensive college semester roadmap covering syllabus completion, mid-terms, lab assignments, and finals.',
    sections: ['Weeks 1-4: Foundation & Core Concepts Mastery', 'Weeks 5-8: Mid-Semester Exams & Lab Submissions', 'Weeks 9-12: Advanced Topics & Major Project Milestones', 'Weeks 13-15: Comprehensive Syllabus Wrap-up & Past Papers', 'Week 16: Final Examination Peak Readiness'],
    guidelines: 'Stay 1-2 weeks ahead of college lecture pace. Start assignments on the day they are assigned.'
  },
  'exam-prep-plan': {
    name: 'High-Yield Exam Preparation Plan',
    description: 'Reverse-engineered countdown revision strategy using Pareto 80/20 analysis, formula sheets, and mock tests.',
    sections: ['Syllabus Weightage & High-Yield Topic Audit', 'Phase 1: Concept Lockdown (D-45 to D-20)', 'Phase 2: Question Banks & Past 10 Years Papers (D-20 to D-7)', 'Phase 3: Timed Simulated Mock Exams (D-7 to D-2)', 'Phase 4: D-1 Calm Review & Formula Sheets (No new topics)'],
    guidelines: 'Focus 80% effort on the 20% topics carrying 80% marks. Active recall over passive re-reading.'
  },
  'dsa-roadmap': {
    name: 'Zero-to-Hero DSA Mastery Roadmap',
    description: 'Algorithmic progression from basic data structures to advanced competitive patterns with problem quotas.',
    sections: ['Phase 1: Language Fluency & Complexity Analysis (O(1) to O(N!))', 'Phase 2: Linear Structures (Arrays, Strings, 2-Pointers, Sliding Window)', 'Phase 3: Classic Structures (LinkedList, Stacks, Queues, HashMaps)', 'Phase 4: Trees & Graphs (BFS, DFS, Dijkstra, TopoSort)', 'Phase 5: Dynamic Programming & Greedy Patterns', 'Phase 6: Blind 75 / NeetCode 150 & Weekly Contests'],
    guidelines: 'Focus on identifying the underlying algorithm pattern rather than memorizing solutions.'
  },
  'career-roadmap': {
    name: 'High-Growth Career Trajectory Roadmap',
    description: 'Step-by-step career acceleration plan from learner to top 1% engineer, researcher, or creator.',
    sections: ['Target Role Definition & Industry Benchmark Standards', 'Phase 1 (Months 1-3): Core Technical Competence & Proof-of-Work', 'Phase 2 (Months 4-6): High-Impact Capstone Projects & Open Source', 'Phase 3 (Months 7-9): Personal Brand, LinkedIn Presence & Networking', 'Phase 4 (Months 10-12): Targeted Applications, Referrals & Negotiations'],
    guidelines: 'Proof of work beats credentials. Build in public and document every major learning milestone.'
  },
  'project-roadmap': {
    name: 'Production Project Delivery Roadmap',
    description: 'Sprint-based engineering delivery plan from architecture setup to global deployment.',
    sections: ['Milestone 0: Specs, DB Schema & Wireframes', 'Milestone 1: Core MVP Backend & Database Endpoints', 'Milestone 2: Frontend Glassmorphic UI & State Management', 'Milestone 3: Integration, E2E Testing & Security Hardening', 'Milestone 4: Production Deployment, CI/CD & Launch Monitoring'],
    guidelines: 'Ship an ugly working MVP first. Iterate based on real telemetry rather than premature optimization.'
  },
  'habit-tracker': {
    name: 'Atomic Habit Tracker System',
    description: 'Behavioral habit loop design incorporating identity-based habits, cue triggers, and streak protection.',
    sections: ['Habit Identity Statement ("I am someone who...")', 'Habit Matrix (Keystone Habits, Tiny 2-Minute Rules)', 'Trigger / Implementation Intentions (When [X] happens, I will [Y])', 'Daily Checkbox Tracking Grid (Mon-Sun)', 'Emergency Protocol: The "Never Miss Twice" Rule'],
    guidelines: 'Make it so easy you cannot say no (James Clear 2-minute rule). Celebrate small daily consistency.'
  },
  'revision-schedule': {
    name: 'Spaced Repetition Active Recall Schedule',
    description: 'Scientifically calibrated review intervals maximizing long-term memory retention without cramming.',
    sections: ['Day 0: Initial Learning & Cornell Note Synthesis', 'Day 1: First 15-Minute Recall & Self-Quiz', 'Day 3: Practice Questions Without Looking at Notes', 'Day 7: Summary Diagram & Flashcard Drill', 'Day 21: Cross-Topic Synoptic Problem Solving', 'Day 60: Permanent Long-Term Memory Lockdown'],
    guidelines: 'If you fail recall on Day 7, reset interval to Day 3. Never look at the answer before trying for 60 seconds.'
  },
  'skill-gap-analysis': {
    name: 'Strategic Skill-Gap Audit & Bridge Matrix',
    description: 'Rigorous diagnostic assessing current abilities against dream job requirements with concrete bridging steps.',
    sections: ['Target Job Spec / Role Requirements Baseline', 'Current Competency Audit (Proficient / Basic / Missing)', 'Gap Severity Ranking (Critical, High, Medium, Nice-to-have)', 'Targeted Bridging Projects (Real-world code exercises)', 'Estimated Hours to Bridge Each Gap'],
    guidelines: 'Prioritize gaps that block job interviews (e.g. System Design, Production Cloud Deployment).'
  },
  'interview-prep': {
    name: 'Intensive Interview Preparation Blueprint',
    description: '8-12 week structured battle plan covering technical coding, system design, and behavioral STAR stories.',
    sections: ['Weeks 1-4: DSA Patterns & Speed Solving (2-3 problems/day)', 'Weeks 5-8: Low-Level & High-Level System Design (Scalability, DBs, Caches)', 'Weeks 9-10: Core CS (OS, DBMS, Networks, Concurrency)', 'Weeks 11-12: Behavioral STAR Stories & Peer Mock Interviews', 'Interview Day Pre-Flight Checklist'],
    guidelines: 'Practice thinking aloud. An interview is a collaborative problem-solving session, not a silent test.'
  },
  'long-term-strategy': {
    name: '3-5 Year Compounding Learning Strategy',
    description: 'T-shaped mastery framework balancing deep specialization with wide multidisciplinary perspective.',
    sections: ['North Star Vision & 5-Year Impact Target', 'Deep Stem Specialization (Top 5% in one domain)', 'Broad Cross-Disciplinary Horizon (Adjacent domains)', 'Annual Milestones & Compounding Habits', 'Quarterly Review & Course Correction Retrospectives'],
    guidelines: 'Focus on evergreen fundamentals (Math, Systems, Algorithms, Communication) that never expire.'
  }
};

const PLANNING_PRODUCTIVITY_DIRECTIVE = `
### 17. 2030 PRINCIPAL LIFE ARCHITECT & PRODUCTIVITY DIRECTOR (CATEGORY 12):
When the user asks for timetables, study plans, roadmaps, exam strategies, habit trackers, or interview prep:

══════════════════════════════════════════════════════════════════════════════
CORE PLANNING & PRODUCTIVITY PRINCIPLES:
══════════════════════════════════════════════════════════════════════════════
1. ⏰ REALISTIC & BUFFER-AWARE SCHEDULING:
   - Never generate impossible 16-hour grinding schedules that lead to burnout.
   - Strictly build in buffers (15-20%), sleep hygiene (7-8 hours), meals, and mental decompression.
   - Use time-blocking (e.g. 09:00 AM - 11:30 AM: Deep Work on DSA).

2. 📊 SCIENTIFIC PRODUCTIVITY FRAMEWORKS:
   - Spaced Repetition (Day 1, 3, 7, 21, 60) for revision.
   - Pareto Principle (80/20 rule) for exams and skill acquisition.
   - Atomic Habits (Cue, Craving, Response, Reward + 2-Minute Rule).
   - Pomodoro Cycles (50m work / 10m break or 25m/5m).

3. 🎯 ACTIONABLE MARKDOWN OUTPUTS:
   - Provide crisp tables with specific time slots, checkboxes \`- [ ]\`, and milestones.
   - Include specific curated topics, recommended resources, and measurable deliverables.
   - If Hindi or Hinglish is preferred, provide natural motivating advice in their language.
`;

/**
 * Detects if user query relates to Category 12 Planning & Productivity
 */
function detectPlanningIntent(message) {
  const text = String(message || '').toLowerCase();

  const isPlanning = /\b(timetable|study plan|schedule|roadmap|habit tracker|revision schedule|skill gap|interview prep|exam prep|learning strategy|routine|daily routine|weekly routine|time table|time management|productivity)\b/i.test(text)
    || /\b(?:daily timetable|weekly timetable|semester plan|exam plan|dsa roadmap|career roadmap|project roadmap|habit tracker|revision plan|interview preparation|tayari plan|padhai ka timetable)\b/i.test(text);

  let detectedDomain = 'general-planning';
  if (/\b(?:daily timetable|daily routine|aaj ka timetable|din ka schedule|hour by hour)\b/i.test(text)) detectedDomain = 'daily-timetable';
  else if (/\b(?:weekly timetable|weekly routine|hafte ka timetable|weekly schedule)\b/i.test(text)) detectedDomain = 'weekly-timetable';
  else if (/\b(?:semester|semester plan|college study plan|semester syllabus)\b/i.test(text)) detectedDomain = 'semester-plan';
  else if (/\b(?:exam prep|exam preparation|pariksha|gate prep|upsc prep|board exam|test preparation)\b/i.test(text)) detectedDomain = 'exam-prep-plan';
  else if (/\b(?:dsa roadmap|dsa plan|data structures and algorithms|leetcode roadmap)\b/i.test(text)) detectedDomain = 'dsa-roadmap';
  else if (/\b(?:career roadmap|career plan|software engineer career|future plan)\b/i.test(text)) detectedDomain = 'career-roadmap';
  else if (/\b(?:project roadmap|project plan|development roadmap|mvp roadmap)\b/i.test(text)) detectedDomain = 'project-roadmap';
  else if (/\b(?:habit tracker|habits|aadat|habit system|streak)\b/i.test(text)) detectedDomain = 'habit-tracker';
  else if (/\b(?:revision schedule|spaced repetition|revision plan|dohrana)\b/i.test(text)) detectedDomain = 'revision-schedule';
  else if (/\b(?:skill gap|skill-gap|skills analysis|swot analysis)\b/i.test(text)) detectedDomain = 'skill-gap-analysis';
  else if (/\b(?:interview prep|interview preparation|mock interview|job interview plan)\b/i.test(text)) detectedDomain = 'interview-prep';
  else if (/\b(?:long term|long-term|5 year plan|learning strategy|compounding knowledge)\b/i.test(text)) detectedDomain = 'long-term-strategy';

  return {
    isPlanning,
    domain: detectedDomain,
    domainConfig: PLANNING_DOMAINS[detectedDomain] || null
  };
}

module.exports = {
  PLANNING_DOMAINS,
  PLANNING_PRODUCTIVITY_DIRECTIVE,
  detectPlanningIntent,
};
