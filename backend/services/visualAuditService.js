'use strict';

const logger = require('../logger');
const { selfBaseUrl } = require('../services/selfUrl');
const OpenAIService = require('../services/openaiService'); // Or GeminiService

class VisualAuditService {
    constructor() {
        this.baseUrl = selfBaseUrl();
    }

    /**
     * Captures a screenshot of the running app and audits it using a Vision LLM.
     * @param {string} projectId - The ID of the project to audit.
     * @param {string} spec - The technical specification to compare against.
     */
    async auditProjectUI(projectId, spec) {
        logger.info(`👁️ [VisualAudit] Starting UI audit for project: ${projectId}`);

        try {
            // 1. Trigger Screenshot Capture
            // We call the sandbox API to take a screenshot of the current preview
            const screenshotRes = await fetch(`${this.baseUrl}/api/sandbox/screenshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });

            if (!screenshotRes.ok) {
                throw new Error(`Screenshot capture failed: ${screenshotRes.statusText}`);
            }

            const { screenshotUrl, timestamp } = await screenshotRes.json();
            logger.info(`📸 [VisualAudit] Screenshot captured: ${screenshotUrl}`);

            // 2. Vision-Based Analysis
            // We use Gemini 1.5 Flash (via aiService) because it is excellent at visual reasoning
            const visionPrompt = `
                ACT AS A SENIOR UI/UX AUDITOR.
                INPUT: You are provided with a screenshot of a web application and its technical specification.
                
                SPECIFICATION:
                ${spec}

                TASK:
                1. Analyze the screenshot for visual bugs (misalignment, overlapping elements, poor contrast, broken layouts).
                2. Compare the actual visual result with the specified requirements.
                3. Identify "Visual Regressions" (things that look wrong or unprofessional).

                OUTPUT FORMAT (Strict JSON):
                {
                    "status": "PASSED" | "FAILED",
                    "issues": [
                        {
                            "element": "Element name/description",
                            "issue": "What is wrong?",
                            "severity": "CRITICAL" | "MAJOR" | "MINOR",
                            "suggestedFix": "Exact CSS/HTML change to fix this"
                        }
                    ],
                    "overallScore": 0-100
                }
            `;

            // We call the aiService using the vision-capable model
            const auditResult = await OpenAIService.visionChat({
                prompt: visionPrompt,
                images: [screenshotUrl],
                model: 'gemini-1.5-flash' 
            });

            // Parse the JSON from the AI response
            const parsedAudit = this.parseAuditJson(auditResult);
            
            logger.info(`🎯 [VisualAudit] Audit Complete. Status: ${parsedAudit.status}. Score: ${parsedAudit.overallScore}/100`);
            
            return {
                success: true,
                screenshotUrl,
                audit: parsedAudit,
                timestamp
            };

        } catch (error) {
            logger.error(`❌ [VisualAudit] Audit failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    parseAuditJson(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('No JSON found in vision response');
        } catch (e) {
            return {
                status: 'FAILED',
                issues: [{ element: 'General', issue: 'Could not parse vision result', suggestedFix: 'Check logs' }],
                overallScore: 0
            };
        }
    }
}

module.exports = new VisualAuditService();
