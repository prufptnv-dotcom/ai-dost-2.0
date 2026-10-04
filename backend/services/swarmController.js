const logger = require('../logger');
const { executeAutonomousLoop } = require('./agenticOrchestrator');
const MoERouterService = require('./moeRouterService');

/**
 * Agent Personas: Defining the specialized roles for the Swarm.
 */
const AGENT_PERSONAS = {
    DIRECTOR: {
        role: 'Project Director',
        prompt: 'You are the Strategic Director. Your goal is to decompose complex user requests into a structured plan. Break the task into: 1. Research Needs, 2. Structural Requirements, 3. Execution Steps. Be precise and demanding. Output your plan in a structured format.',
        tools: ['planner']
    },
    RESEARCHER: {
        role: 'Lead Researcher',
        prompt: 'You are an elite Research Analyst. Your goal is to find factual, data-driven evidence. Focus on numbers, dates, and verified sources. Do not summarize; provide raw, structured data points. ALWAYS provide a "Source List" for every claim.',
        tools: ['web_search', 'fetch_webpage']
    },
    ARCHITECT: {
        role: 'Document Architect',
        prompt: 'You are a Visual Information Designer. Your goal is to decide HOW the data should be presented. Decide which parts need a Table, which need a Chart (Bar/Line/Pie), and which need a conceptual Diagram. Provide a clear "Visual Blueprint".',
        tools: ['visual_assets_service']
    },
    EXECUTOR: {
        role: 'Technical Executor',
        prompt: 'You are a high-precision Implementation Engineer. Your goal is to take the research and architecture and produce the final asset (PDF/CSV/Code). Follow the layout exactly. No fluff. If you receive Critic feedback, address every single point specifically.',
        tools: ['document_engine', 'image_studio']
    },
    CRITIC: {
        role: 'Quality Assurance Critic',
        prompt: `You are a ruthless Editor. Your goal is to find flaws. 
        You MUST evaluate the output against this CHECKLIST:
        1. FACTUAL ACCURACY: Does it contradict the research data? (CROSS-REFERENCE with provided data).
        2. COMPLETENESS: Are all Director requirements met?
        3. VISUALS: Are the Architect\'s chart/table suggestions implemented?
        4. FORMATTING: Is the markdown/structure professional?
        
        If everything is perfect, reply ONLY with "STATUS: APPROVED".
        Otherwise, reply with "STATUS: REJECTED" followed by a numbered list of specific, actionable flaws. If you find a factual contradiction, mark it as [TRUTH_CONFLICT].`,
        tools: ['verification_service']
    }
};

class SwarmController {
    /**
     * coordinates a multi-agent workflow.
     * @param {string} userPrompt 
     * @param {object} req 
     * @param {function} emitEvent - Optional callback to stream events to frontend via SSE.
     */
    async coordinate(userPrompt, req, emitEvent = null) {
        logger.info(`🐝 [Swarm] Initializing stable swarm for prompt: "${userPrompt}"`);
        
        const state = {
            phase: 'PLANNING',
            iterations: 0,
            maxIterations: 3,
            history: [],
            conflictLog: [],
            context: {
                plan: '',
                data: '',
                layout: '',
                currentDraft: ''
            }
        };

        // Helper to send events to the frontend
        const sendEvent = async (type, payload) => {
            if (emitEvent) {
                try {
                    await emitEvent({ type: 'swarm_event', payload: { type, ...payload } });
                } catch (e) {
                    logger.warn(`⚠️ [Swarm] Failed to emit event ${type}: ${e.message}`);
                }
            }
        };

        try {
            // 1. THE DIRECTOR PHASE: Planning
            state.phase = 'PLANNING';
            await sendEvent('PHASE_START', { phase: state.phase, agent: 'DIRECTOR', message: 'Designing the strategic plan...' });
            state.context.plan = await this.callAgent('DIRECTOR', `Decompose this task into a detailed plan: ${userPrompt}`);
            await sendEvent('PHASE_COMPLETE', { phase: state.phase, agent: 'DIRECTOR', result: state.context.plan });
            
            // 2. THE RESEARCHER PHASE: Data Gathering
            state.phase = 'RESEARCHING';
            await sendEvent('PHASE_START', { phase: state.phase, agent: 'RESEARCHER', message: 'Mining factual data and sources...' });
            state.context.data = await this.callAgent('RESEARCHER', `Based on the plan: ${state.context.plan}, find all necessary data points and sources for: ${userPrompt}`);
            await sendEvent('PHASE_COMPLETE', { phase: state.phase, agent: 'RESEARCHER', result: state.context.data });
            
            // 3. THE ARCHITECT PHASE: Visual Strategy
            state.phase = 'ARCHITECTING';
            await sendEvent('PHASE_START', { phase: state.phase, agent: 'ARCHITECT', message: 'Designing the visual blueprint...' });
            state.context.layout = await this.callAgent('ARCHITECT', `Using this data: ${state.context.data}, design the visual structure. Specify where charts and tables go: ${userPrompt}`);
            await sendEvent('PHASE_COMPLETE', { phase: state.phase, agent: 'ARCHITECT', result: state.context.layout });
            
            // 4. THE EXECUTION & CRITIC LOOP
            state.phase = 'EXECUTION_REVIEW';
            let isApproved = false;
            
            while (state.iterations < state.maxIterations && !isApproved) {
                state.iterations++;
                
                // EXECUTOR
                await sendEvent('ITERATION_START', { iteration: state.iterations, agent: 'EXECUTOR', message: 'Implementing the draft...' });
                const executorPrompt = `
                    Task: ${userPrompt}
                    Plan: ${state.context.plan}
                    Data: ${state.context.data}
                    Layout: ${state.context.layout}
                    ${state.iterations > 1 ? `\n\nCRITIC FEEDBACK FROM PREVIOUS ATTEMPT:\n${state.history[state.history.length - 1]}` : ''}
                    
                    Produce the final high-quality output. Address all requirements and any feedback provided.
                `;
                
                state.context.currentDraft = await this.callAgent('EXECUTOR', executorPrompt);
                await sendEvent('DRAFT_CREATED', { draft: state.context.currentDraft });
                
                // CRITIC
                await sendEvent('ITERATION_REVIEW', { agent: 'CRITIC', message: 'Auditing for truth and quality...' });
                const review = await this.callAgent('CRITIC', `Review this output using the Checklist. \n\nDraft:\n${state.context.currentDraft}`);
                
                state.history.push(review);

                if (review.includes('STATUS: APPROVED')) {
                    isApproved = true;
                    await sendEvent('ITERATION_APPROVED', { agent: 'CRITIC', message: 'Draft approved. Finalizing output.' });
                } else {
                    await sendEvent('ITERATION_REJECTED', { agent: 'CRITIC', feedback: review });
                    if (review.includes('[TRUTH_CONFLICT]')) {
                        await sendEvent('TRUTH_CONFLICT', { feedback: review });
                    }
                }
            }

            return state.context.currentDraft;

        } catch (e) {
            logger.error(`❌ [Swarm] Coordination Error: ${e.message}`);
            throw e;
        }
    }

    async callAgent(personaKey, prompt) {
        const persona = AGENT_PERSONAS[personaKey];
        const systemPrompt = `${persona.prompt}\n\nYour role is ${persona.role}.`;
        
        const result = await MoERouterService.executeExpert(
            prompt, 
            systemPrompt, 
            [], 
            'chat', 
            {}
        );
        
        return result.response;
    }
}

module.exports = new SwarmController();
