const logger = require('../logger');
const { autoSelectModel } = require('../services/chatCascadeService');
const { detectResponseLanguage } = require('../services/languageDetector');
const webSearchService = require('../services/webSearchService');
const { buildCleanHistory, isValidResponse } = require('../utils/chatUtils');

exports.handleWebSearch = async (req, res) => {
    const { message, model, history } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'message is required' });
    }
    const query = message.trim();

    // Production-Grade Automatic Response-Language Matching for Web Search answers
    const cleanHistory = buildCleanHistory(history, 10, 12000);
    const langInfo = detectResponseLanguage(query, cleanHistory);

    try {
        const searchRes = await webSearchService.search(query, { maxResults: 6 });
        const sources = (searchRes.results || []).map((s, i) => ({
            citationId: i + 1,
            title: s.title,
            url: s.url,
            domain: s.domain,
            snippet: s.snippet,
            publishedDate: s.publishedDate,
            retrievalTimestamp: s.retrievalTimestamp,
            reliability: s.reliability
        }));

        if (sources.length === 0) {
            return res.json({
                success: true,
                reply: langInfo.detectedResponseLanguage === 'hindi'
                    ? 'इंटरनेट पर इस विषय पर कोई सत्यापित जानकारी नहीं मिली। कृपया अपने प्रश्न को थोड़ा और स्पष्ट करें।'
                    : 'Could not find verified live web results for this query. Please try again with more specific keywords.',
                sources: [],
                provider: searchRes.provider || 'none',
                status: 'NO_RESULTS',
                detectedResponseLanguage: langInfo.detectedResponseLanguage,
                languageName: langInfo.languageName
            });
        }

        // Synthesize response using LLM grounded with verified web sources and strict citation rules
        const sourcesContext = sources.map((s, i) => `[${i + 1}] "${s.title}" (${s.domain})\nURL: ${s.url}\nDate: ${s.publishedDate || 'N/A'}\nSnippet: ${s.snippet}`).join('\n\n');

        const prompt = `${langInfo.instruction}\n\nYou are AI-Dost with live web search access. Answer the user query factually based ONLY on the verified live web search results below.\n\nUSER QUERY:\n${query}\n\nVERIFIED LIVE WEB SOURCES:\n${sourcesContext}\n\nSTRICT CITATION DIRECTIVES:\n- Only assert facts directly substantiated by the sources above.\n- Embed numbered bracket citations [1], [2], etc., immediately following the facts they support.\n- Do not invent, hallucinate, or fabricate any facts or citations.\n- If information is missing or sources conflict, state this transparently.\n- Keep original URLs and proper names intact.\n- Respond in: ${langInfo.languageName} (${langInfo.detectedResponseLanguage}).`;

        let reply = '';
        try {
            const llmPromise = autoSelectModel(prompt, 'chat', null, cleanHistory, 'chat', null);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM synthesis timeout')), 8000));
            const llmRes = await Promise.race([llmPromise, timeoutPromise]);
            if (isValidResponse(llmRes.response)) {
                reply = llmRes.response;
            }
        } catch (llmErr) {
            logger.warn('[Search] LLM synthesis fallback:', llmErr.message);
        }

        if (!reply) {
            // Fallback synthesis directly from verified snippets in user language
            reply = sources.slice(0, 4).map((s, i) => `**[${i + 1}] ${s.title}**\n${s.snippet}\n🔗 [${s.domain}](${s.url})`).join('\n\n');
        }

        return res.json({
            success: true,
            reply,
            sources,
            provider: searchRes.provider,
            status: 'SUCCESS',
            retrievalTimestamp: new Date().toISOString(),
            detectedResponseLanguage: langInfo.detectedResponseLanguage,
            languageName: langInfo.languageName
        });
    } catch (e) {
        logger.error('[Search] Web search error:', e.message);
        return res.status(500).json({ success: false, error: 'Web search failed', detail: e.message });
    }
};
