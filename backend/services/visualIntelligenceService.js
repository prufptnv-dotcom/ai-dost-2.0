const logger = require('../logger');
const fs = require('fs');
const path = require('path');

/**
 * VisualIntelligenceService: Handles the generation of structural diagrams 
 * and visual audits of the generated UI.
 */
class VisualIntelligenceService {
    /**
     * Generates a Mermaid.js diagram based on a description of a process, 
     * architecture, or data flow.
     * @param {string} description - The textual description of the system.
     * @param {string} type - 'flowchart', 'sequence', 'er', 'state', 'class'.
     */
    async generateDiagram(description, type = 'flowchart') {
        try {
            logger.info(`🎨 [VisualIntel] Generating ${type} diagram for: ${description.slice(0, 50)}...`);
            
            // We call the LLM to translate the description into a valid Mermaid.js syntax
            // In a real scenario, we'd use a specialized prompt for Mermaid.js
            const MoERouterService = require('./moeRouterService');
            const prompt = `You are a Mermaid.js expert. Translate the following description into a valid Mermaid.js ${type} diagram. 
            Return ONLY the mermaid code block starting with ${type} TD or similar. No explanation.
            
            DESCRIPTION: ${description}`;
            
            const result = await MoERouterService.executeExpert({ expert: 'auto-cascade', reason: 'Visual representation' }, prompt, '', [], '', 'chat', {});
            
            // Clean the output to ensure only mermaid code is returned
            const cleanCode = result.response.replace(/```mermaid/g, '').replace(/```/g, '').trim();
            
            return {
                success: true,
                mermaidCode: cleanCode,
                type: type
            };
        } catch (e) {
            logger.error(`❌ [VisualIntel] Diagram generation failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Analyzes a UI screenshot to find layout anomalies or bugs.
     * @param {string} screenshotUrl - URL to the captured screenshot.
     * @param {string} spec - The technical specification the UI should match.
     */
    async auditUI(screenshotUrl, spec) {
        try {
            logger.info(`👁️ [VisualIntel] Auditing UI screenshot against spec...`);
            
            // Use a Vision-capable model (Gemini/GPT-4V) to analyze the image
            const GeminiService = require('./geminiService');
            const prompt = `Analyze this screenshot of a UI. Compare it against the following specification: ${spec}. 
            Identify any alignment issues, missing elements, or color mismatches. 
            Provide a list of specific "Visual Bugs" and "Fix Suggestions".`;
            
            const result = await GeminiService.chat({
                text: prompt,
                images: [screenshotUrl]
            }, [], 'agent');

            return {
                success: true,
                auditReport: result
            };
        } catch (e) {
            logger.error(`❌ [VisualIntel] UI Audit failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }
}

module.exports = new VisualIntelligenceService();
