/**
 * documentStudioEngine.js
 * 2030 Executive Document, PDF, PPT & Report Studio for AI-Dost
 * Category 6: PDF, Documents, PPT aur Reports
 *
 * Implements all 17 Document & Report Artifact Types:
 *  1. PDF notes
 *  2. Study syllabus
 *  3. Research report
 *  4. Resume
 *  5. Cover letter
 *  6. Project documentation
 *  7. PPT / Presentation
 *  8. Business proposal
 *  9. Technical design document (TDD / RFC)
 * 10. README
 * 11. API documentation
 * 12. Project report (Academic / Final year)
 * 13. Lab assignment explanation
 * 14. Comparison report
 * 15. Meeting notes (MoM)
 * 16. Professional letter
 * 17. Research paper draft (IEEE / APA)
 */

const DOCUMENT_TYPES = {
  'pdf-notes': {
    id: 'pdf-notes',
    name: 'PDF Notes / Revision Notes',
    defaultFormat: 'pdf',
    description: 'High-yield revision notes, key concepts, formulas, memory shortcuts, and rapid recap.',
    sections: ['Overview & Core Definitions', 'Key Theorems & Formulas Table', 'Visual Mental Model', 'Important Exam Points', 'Top 5 Practice Questions & Hints'],
  },
  'study-syllabus': {
    id: 'study-syllabus',
    name: 'Study Syllabus & Curriculum Roadmap',
    defaultFormat: 'pdf',
    description: 'Structured course syllabus, prerequisites, credit weightage, module breakdown, and recommended bibliography.',
    sections: ['Course Objectives & Prerequisites', 'Module-Wise Detailed Syllabus (Modules 1-5)', 'Practical / Lab Curriculum', 'Prescribed Textbooks & Online Resources', 'Assessment & Grading Rubric'],
  },
  'research-report': {
    id: 'research-report',
    name: 'Authoritative Research Report',
    defaultFormat: 'pdf',
    description: 'Multi-chapter deep-dive research with executive summary, data breakdown, SWOT analysis, and evidence-backed conclusions.',
    sections: ['Executive Summary', 'Problem Background & Literature Review', 'Methodology & Data Findings', 'SWOT / Comparative Analysis', 'Strategic Recommendations & Citations'],
  },
  'resume': {
    id: 'resume',
    name: 'ATS-Optimized Professional Resume',
    defaultFormat: 'docx',
    description: 'Industry-standard tech resume with high-impact metric-driven bullet points (XYZ framework) and clean layout.',
    sections: ['Contact Info & GitHub/LinkedIn', 'Professional Summary', 'Core Technical Competencies', 'Professional Experience (Impact-focused)', 'Education, Projects & Certifications'],
  },
  'cover-letter': {
    id: 'cover-letter',
    name: 'Compelling Job Cover Letter',
    defaultFormat: 'docx',
    description: 'Tailored application letter with strong hook, company mission alignment, key career highlights, and call to action.',
    sections: ['Header & Date', 'Target Role & Company Salutation', 'Compelling Opening Hook', 'Core Value Proposition & Relevant Wins', 'Closing & Interview Request'],
  },
  'project-documentation': {
    id: 'project-documentation',
    name: 'Comprehensive Project Documentation',
    defaultFormat: 'docx',
    description: 'Complete engineering documentation covering tech stack, architecture, deployment, and troubleshooting.',
    sections: ['System Architecture & Tech Stack', 'Prerequisites & Environment Setup', 'Configuration (.env) Specification', 'Directory Tree Breakdown', 'Deployment & Troubleshooting Guide'],
  },
  'presentation-ppt': {
    id: 'presentation-ppt',
    name: 'Executive PowerPoint Deck',
    defaultFormat: 'pptx',
    description: 'Slide-by-slide deck structure with crisp executive bullet points, takeaways, and speaker notes.',
    sections: ['Title Slide', 'Problem Statement', 'Market / Tech Overview', 'Proposed Architecture / Solution', 'Key Metrics & Proof', 'Roadmap & Conclusion'],
  },
  'business-proposal': {
    id: 'business-proposal',
    name: 'High-Conversion Business Proposal',
    defaultFormat: 'docx',
    description: 'Corporate proposal with problem statement, proposed scope of work, project milestones, deliverables, budget table, and ROI.',
    sections: ['Executive Brief', 'Client Needs & Business Objectives', 'Proposed Solution & Scope of Work', 'Milestones, Timeline & Deliverables', 'Commercials / Budget Table & Terms'],
  },
  'technical-design-doc': {
    id: 'technical-design-doc',
    name: 'Technical Design Document (TDD / RFC)',
    defaultFormat: 'docx',
    description: 'Principal engineer-grade design doc with non-goals, architecture diagrams, data schemas, API contracts, and trade-offs.',
    sections: ['Context & Scope (Goals & Non-Goals)', 'High-Level Architecture (Mermaid/ASCII)', 'Component Deep-Dive & Data Model', 'API Contracts & Network Topology', 'Security, Scalability, Trade-Offs & Fallbacks'],
  },
  'readme': {
    id: 'readme',
    name: 'Production GitHub README.md',
    defaultFormat: 'docx',
    description: 'Polished open-source README with badges, architecture overview, quickstart, API guide, and contribution guidelines.',
    sections: ['Hero Header & Badges', 'Feature Highlights', 'Quickstart & Installation', 'Usage & Code Examples', 'Architecture / Contributing / License'],
  },
  'api-documentation': {
    id: 'api-documentation',
    name: 'Comprehensive REST/GraphQL API Documentation',
    defaultFormat: 'docx',
    description: 'OpenAPI-style documentation with endpoints, auth headers, request/response JSON payloads, status codes, and curl snippets.',
    sections: ['Overview & Base URLs', 'Authentication & Rate Limiting', 'HTTP Status Codes & Error Envelope', 'Endpoints Catalog (GET/POST/PUT/DELETE)', 'Complete cURL Request/Response Examples'],
  },
  'project-report': {
    id: 'project-report',
    name: 'Academic Final Year Project Report',
    defaultFormat: 'pdf',
    description: 'Academic standard report with certificate, acknowledgements, abstract, architecture, implementation, and results.',
    sections: ['Title Page & Certificate Placeholder', 'Abstract & Problem Formulation', 'System Architecture & Data Flow', 'Implementation Details & Modules', 'Experimental Results, Snapshots & Future Scope'],
  },
  'lab-assignment': {
    id: 'lab-assignment',
    name: 'Lab Assignment Explanation & Solution',
    defaultFormat: 'pdf',
    description: 'Detailed practical assignment with aim, apparatus, theory, commented code, sample test cases, and viva questions.',
    sections: ['Aim / Problem Statement', 'Prerequisites & Mathematical Theory', 'Complete Documented Source Code', 'Sample Input & Output Runs', 'Viva Voce Questions with Model Answers'],
  },
  'comparison-report': {
    id: 'comparison-report',
    name: 'Deep Comparison & Evaluation Report',
    defaultFormat: 'pdf',
    description: 'Side-by-side benchmark matrix, architectural comparison, pros/cons, performance evaluation, and decisive final verdict.',
    sections: ['Evaluation Scope & Criteria', 'Side-by-Side Feature Matrix Table', 'Performance & Scalability Benchmarks', 'Pros and Cons Analysis', 'Final Verdict & Implementation Advice'],
  },
  'meeting-notes': {
    id: 'meeting-notes',
    name: 'Executive Meeting Notes / Minutes of Meeting (MoM)',
    defaultFormat: 'docx',
    description: 'Structured minutes of meeting with attendees, agenda, key discussions, consensus decisions, and action items table.',
    sections: ['Meeting Metadata (Date, Time, Attendees)', 'Meeting Agenda & Purpose', 'Key Discussion Points & Insights', 'Decisions Finalized', 'Action Items Table (Task | Owner | Deadline | Status)'],
  },
  'professional-letter': {
    id: 'professional-letter',
    name: 'Formal Professional Letter',
    defaultFormat: 'docx',
    description: 'Formal letter suitable for resignation, promotion inquiry, formal escalation, recommendation, or business collaboration.',
    sections: ['Sender & Recipient Coordinates', 'Date & Formal Subject Line', 'Salutation & Direct Opening Statement', 'Contextual Body Paragraphs', 'Action Request & Professional Sign-Off'],
  },
  'research-paper-draft': {
    id: 'research-paper-draft',
    name: 'Academic Research Paper Draft (IEEE / ACM Format)',
    defaultFormat: 'pdf',
    description: 'Publication-ready paper draft with abstract, introduction, literature review, mathematical formulation, results, and citations.',
    sections: ['Title, Authors & 250-Word Abstract', 'Index Terms / Keywords', 'Section I: Introduction', 'Section II: Related Work', 'Section III: Proposed Methodology', 'Section IV: Experimental Evaluation', 'Section V: Conclusion & References (IEEE)'],
  },
};

const DOCUMENT_STUDIO_DIRECTIVE = `
### 11. 2030 EXECUTIVE DOCUMENT, REPORT & PUBLICATION PROTOCOL (CATEGORY 6):
When the user asks to create, draft, design, or export any of the 17 core document or report formats:

══════════════════════════════════════════════════════════════════════════════
17 CORE DOCUMENT, REPORT & PUBLICATION TYPES:
══════════════════════════════════════════════════════════════════════════════
1. PDF NOTES / REVISION NOTES:
   - Include high-yield bullet points, formula cheat sheet table, visual memory anchors, and 5 rapid self-check questions with hints.
2. STUDY SYLLABUS:
   - Break down into Course Overview, Credit Structure, 5 distinct Modules with unit topics, recommended textbooks, and evaluation rubric.
3. RESEARCH REPORT:
   - Executive-grade research monograph: Executive Summary, Background, Methodology, Data Findings, SWOT Matrix, Strategic Roadmap, and verified sources.
4. RESUME (ATS-OPTIMIZED):
   - Professional header, target summary, categorized technical skills, experience using the Google XYZ formula ("Accomplished [X] as measured by [Y] by doing [Z]"), education, and notable achievements.
5. COVER LETTER:
   - Hook paragraph tailored to the specific role and company, 2-3 quantifiable achievements, culture-fit alignment, and a confident, professional closing with CTA.
6. PROJECT DOCUMENTATION:
   - Architecture blueprint, prerequisites, step-by-step setup, environment variable dictionary, API overview, and troubleshooting runbook.
7. PPT / PRESENTATION (SLIDE DECK):
   - Structured 8-12 slide deck: Slide Title, Subtitle, 3-5 concise high-impact bullet points per slide, and speaker notes.
8. BUSINESS PROPOSAL:
   - Client problem statement, proposed scope of work, deliverables, milestone timeline, transparent budget/pricing table, and ROI justification.
9. TECHNICAL DESIGN DOCUMENT (TDD / RFC):
   - Context & Scope, Goals & Non-goals, High-level Architecture (ASCII/Mermaid), Data Model & Schema, API Contracts, Scalability/Security, and Trade-offs.
10. PRODUCTION README:
    - Badges, project description, visual architecture flow, quickstart commands, environment configuration, code examples, contribution guide, license.
11. API DOCUMENTATION:
    - Base URL, Auth headers, Error codes matrix, Endpoints with HTTP verb, URL params, Request/Response JSON schemas, and complete curl snippet.
12. PROJECT REPORT (ACADEMIC / FINAL YEAR):
    - Formal report format: Abstract, Chapter 1 (Introduction & Problem Statement), Chapter 2 (Literature Survey), Chapter 3 (System Architecture), Chapter 4 (Implementation), Chapter 5 (Results & Discussion), Chapter 6 (Conclusion & References).
13. LAB ASSIGNMENT EXPLANATION:
    - Aim / Objective, Apparatus & Environment, Core Theory / Algorithm, Clean Commented Code, Sample Test Cases with Outputs, and 5 Viva Voce Questions with Model Answers.
14. COMPARISON REPORT:
    - Comparison criteria, Side-by-side Feature Matrix table, Benchmark numbers, Pros & Cons breakdown for each candidate, and unambiguous final verdict.
15. MEETING NOTES (MINUTES OF MEETING - MoM):
    - Date, Time, Attendees, Agenda, Key discussions, Decisions reached, and Action Items Table with Task, Owner, Deadline, and Priority.
16. PROFESSIONAL LETTER:
    - Proper corporate letterhead styling, clear subject line, polite formal opening, crisp justification body, polite call to action, and formal sign-off.
17. RESEARCH PAPER DRAFT (IEEE / ACM):
    - Abstract (under 250 words), Index Terms, Introduction, Related Work, Mathematical / Algorithmic Formulation, Evaluation & Graphs, Conclusion, and IEEE-style References.

══════════════════════════════════════════════════════════════════════════════
EXECUTIVE FORMATTING RULES:
══════════════════════════════════════════════════════════════════════════════
- Always present the document with crystal-clear markdown hierarchy (#, ##, ###).
- Use tables for data, metrics, comparisons, and action items.
- Avoid superficial placeholders ("Lorem ipsum" or "...add details here"). Generate complete, informative, realistic text.
- If the user specifies export formats (e.g., "PDF me do", "Word file chahiye", "PPT bana do"), provide both the formatted in-chat document and announce that the downloadable file is ready.
`;

/**
 * Detects which of the 17 document types is requested, what the subject/topic is,
 * and what file format is best suited.
 */
function detectDocumentRequest(message) {
  const text = String(message || '').trim().toLowerCase();

  let detectedType = null;
  let detectedFormat = null;

  // 1. Explicit File Format Intent
  if (/\b(?:pptx?|powerpoint|presentation|slides?|deck)\b/i.test(text)) {
    detectedFormat = 'pptx';
  } else if (/\b(?:xlsx|excel|spreadsheet|sheet)\b/i.test(text)) {
    detectedFormat = 'xlsx';
  } else if (/\b(?:csv)\b/i.test(text)) {
    detectedFormat = 'csv';
  } else if (/\b(?:pdf)\b/i.test(text)) {
    detectedFormat = 'pdf';
  } else if (/\b(?:docx?|word\s*(?:file|document)?)\b/i.test(text)) {
    detectedFormat = 'docx';
  }

  // 2. 17 Document Types Pattern Matching
  if (/\b(?:pdf\s*notes|revision\s*notes|cheat\s*sheet|quick\s*notes|notes\s*pdf)\b/i.test(text)) {
    detectedType = 'pdf-notes';
  } else if (/\b(?:syllabus|curriculum|course\s*outline|study\s*plan|semester\s*syllabus)\b/i.test(text)) {
    detectedType = 'study-syllabus';
  } else if (/\b(?:research\s*report|market\s*report|feasibility\s*report|investigation\s*report)\b/i.test(text)) {
    detectedType = 'research-report';
  } else if (/\b(?:resume|cv|biodata|curriculum\s*vitae)\b/i.test(text)) {
    detectedType = 'resume';
  } else if (/\b(?:cover\s*letter|job\s*application\s*letter|application\s*letter)\b/i.test(text)) {
    detectedType = 'cover-letter';
  } else if (/\b(?:project\s*doc(?:umentation)?|technical\s*doc(?:umentation)?|system\s*doc(?:umentation)?)\b/i.test(text)) {
    detectedType = 'project-documentation';
  } else if (/\b(?:ppt|presentation|slide\s*deck|slides|pitch\s*deck)\b/i.test(text)) {
    detectedType = 'presentation-ppt';
  } else if (/\b(?:business\s*proposal|project\s*proposal|commercial\s*proposal|proposal\s*doc)\b/i.test(text)) {
    detectedType = 'business-proposal';
  } else if (/\b(?:technical\s*design\s*doc(?:ument)?|tdd|rfc|architecture\s*design\s*doc)\b/i.test(text)) {
    detectedType = 'technical-design-doc';
  } else if (/\b(?:readme(?:\.md)?|github\s*readme)\b/i.test(text)) {
    detectedType = 'readme';
  } else if (/\b(?:api\s*doc(?:umentation)?|rest\s*api\s*doc|api\s*spec)\b/i.test(text)) {
    detectedType = 'api-documentation';
  } else if (/\b(?:project\s*report|final\s*year\s*report|academic\s*report|college\s*project\s*report)\b/i.test(text)) {
    detectedType = 'project-report';
  } else if (/\b(?:lab\s*assignment|practical\s*assignment|lab\s*experiment|lab\s*manual|lab\s*file)\b/i.test(text)) {
    detectedType = 'lab-assignment';
  } else if (/\b(?:comparison\s*report|comparison|benchmark\s*report|tool\s*comparison)\b/i.test(text)) {
    detectedType = 'comparison-report';
  } else if (/\b(?:meeting\s*notes|mom|minutes\s*of\s*meeting|minutes\s*of\s*the\s*meeting)\b/i.test(text)) {
    detectedType = 'meeting-notes';
  } else if (/\b(?:professional\s*letter|formal\s*letter|resignation\s*letter|recommendation\s*letter|official\s*letter)\b/i.test(text)) {
    detectedType = 'professional-letter';
  } else if (/\b(?:research\s*paper\s*draft|research\s*paper|ieee\s*paper|paper\s*draft)\b/i.test(text)) {
    detectedType = 'research-paper-draft';
  }

  // 3. Clean topic extraction
  let topic = text
    .replace(/\b(pdf\s*notes|study\s*syllabus|syllabus|research\s*report|resume|cover\s*letter|project\s*doc(?:umentation)?|ppt|presentation|slide\s*deck|business\s*proposal|technical\s*design\s*doc|tdd|rfc|readme|api\s*doc(?:umentation)?|project\s*report|lab\s*assignment|comparison\s*report|meeting\s*notes|mom|professional\s*letter|research\s*paper\s*draft)\b/gi, '')
    .replace(/\b(banao|bana\s*do|bana\s*de|likho|likh\s*do|chahiye|generate|create|draft|write|make|prepare|taiyar\s*karo|export|download|format\s*me|chahiye)\b/gi, '')
    .replace(/\b(pdf|docx?|pptx?|csv|xlsx|word|excel|powerpoint)\b/gi, '')
    .replace(/\b(for|on|about|ka|ki|ke|par|pe|ek|mera|meri|mujhe|please|kripya)\b/gi, '')
    .trim();

  if (!topic || topic.length < 3) {
    topic = 'Comprehensive Project & Technology Overview';
  }

  const isDocumentIntent = Boolean(detectedType || detectedFormat || /\b(report|document|presentation|syllabus|notes|resume|proposal)\b/i.test(text));

  const finalFormat = detectedFormat || (detectedType ? DOCUMENT_TYPES[detectedType]?.defaultFormat : 'pdf');

  return {
    isDocumentIntent,
    type: detectedType || 'research-report',
    format: finalFormat,
    typeName: detectedType ? DOCUMENT_TYPES[detectedType]?.name : 'Document / Report',
    topic,
  };
}

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_STUDIO_DIRECTIVE,
  detectDocumentRequest,
};
