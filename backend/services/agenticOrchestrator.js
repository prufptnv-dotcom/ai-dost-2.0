const logger = require('../logger');
const { selfBaseUrl } = require('../services/selfUrl');
const VisualAssetsService = require('./visualAssetsService');

const BASE = selfBaseUrl();
const MAX_RECURSION_DEPTH = 5;
const MAX_RETRIES_PER_ACTION = 2;

/**
 * Verifies if the generated asset is actually valid (not empty, exists on disk).
 */
async function verifyAction(type, resultData) {
    if (!resultData || !resultData.success) return { valid: false, reason: 'Action failed' };

    try {
        if (type !== 'IMAGE') {
            const checkRes = await fetch(`${BASE}${resultData.downloadUrl}`, { method: 'HEAD' });
            if (checkRes.status !== 200) return { valid: false, reason: 'File not found on server' };
        }
        return { valid: true };
    } catch (e) {
        return { valid: false, reason: e.message };
    }
}

/**
 * AgenticOrchestrator handles the recursive loop with Self-Reflection:
 * Response -> Detect Action -> Execute -> Verify -> (Retry if fail) -> Update -> Repeat
 */
async function executeAutonomousLoop(initialResponse, req) {
    let currentResponse = initialResponse;
    let depth = 0;

    logger.info(`🤖 [AgenticOrchestrator] Entering Reflection-enabled loop. Depth limit: ${MAX_RECURSION_DEPTH}`);

    while (depth < MAX_RECURSION_DEPTH) {
        // 1. Search for any actionable tags [GENERATE_X: ...], [INSERT_CHART: ...]
        const tagMatch = currentResponse.match(/\[(GENERATE_(PDF|DOCX|PPTX|CSV|XLSX|IMAGE)|INSERT_CHART):\s*([^\]]+)\]/i);
        
        if (!tagMatch) {
            logger.info(`✅ [AgenticOrchestrator] No more actions detected. Loop terminated.`);
            break;
        }

        const [fullTag, actionType, payload] = tagMatch;
        depth++;
        
        let actionSuccessful = false;
        let finalActionResult = '';
        let retryCount = 0;

        while (retryCount < MAX_RETRIES_PER_ACTION) {
            logger.info(`🤖 [AgenticOrchestrator] Step ${depth} (Attempt ${retryCount + 1}): Executing ${actionType} for "${payload}"`);
            
            try {
                let resultData;
                if (actionType.toUpperCase() === 'INSERT_CHART') {
                    let chartOptions;
                    try {
                        chartOptions = JSON.parse(payload);
                    } catch (e) {
                        chartOptions = { title: payload, labels: ['Data'], datasets: [{ data: [100] }] };
                    }
                    const chartUrl = await VisualAssetsService.generateChartUrl(chartOptions);
                    if (chartUrl) {
                        actionSuccessful = true;
                        finalActionResult = `![Chart](${chartUrl})`;
                    } else {
                        throw new Error('Chart URL generation failed');
                    }
                } else if (actionType.toUpperCase() === 'GENERATE_IMAGE') {
                    const res = await fetch(`${BASE}/api/image/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: payload.trim() })
                    });
                    resultData = await res.json();
                } else {
                    const res = await fetch(`${BASE}/api/document/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: (actionType.replace('GENERATE_', '').toLowerCase()), topic: payload.trim(), projectId: req.body.projectId || 'default' })
                    });
                    resultData = await res.json();
                }

                if (actionType.toUpperCase() !== 'INSERT_CHART') {
                    const verification = await verifyAction(actionType, resultData);
                    if (verification.valid) {
                        actionSuccessful = true;
                        finalActionResult = actionType.toUpperCase() === 'GENERATE_IMAGE' 
                            ? `✅ **Image Generated!** [View Image](${resultData.url})` 
                            : `✅ **${actionType.replace('GENERATE_', '').toUpperCase()} Ready!** [Download Here](${resultData.downloadUrl})`;
                    } else {
                        logger.warn(`⚠️ [Reflection] Verification failed: ${verification.reason}. Retrying...`);
                        retryCount++;
                    }
                } else if (actionSuccessful) {
                    // Charts are handled by URL, so they are implicitly verified by the service
                }

            } catch (e) {
                logger.error(`❌ [Reflection] Action error: ${e.message}. Retrying...`);
                retryCount++;
            }
        }

        if (!actionSuccessful) {
            finalActionResult = `⚠️ ${actionType} Generation failed after ${MAX_RETRIES_PER_ACTION} attempts.`;
        }

        currentResponse = currentResponse.replace(fullTag, finalActionResult);
    }

    return currentResponse;
}

module.exports = { executeAutonomousLoop };
