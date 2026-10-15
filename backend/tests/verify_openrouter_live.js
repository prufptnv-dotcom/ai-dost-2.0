const OpenRouterService = require('../services/openrouterService');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyLive() {
    console.log('====================================================');
    console.log('🤖 AI-Dost OpenRouter Free Models Live Verification');
    console.log('====================================================');
    console.log(`API Key configured: ${process.env.OPENROUTER_API_KEY ? 'YES (' + process.env.OPENROUTER_API_KEY.slice(0, 15) + '...)' : 'NO'}`);

    const catalog = OpenRouterService.getModelCatalog();
    console.log(`\n📋 Total Models in AI-Dost Catalog: ${catalog.length}\n`);

    const modelsToTest = [
        { key: 'auto', name: 'Auto Best Free' },
        { key: 'nemotron_3_super', name: 'Nemotron 3 Super (120B)' },
        { key: 'north_mini_code', name: 'Cohere North Mini Code' },
        { key: 'lfm_reasoning', name: 'Liquid LFM 2.5' },
        { key: 'ling_sante', name: 'Ling 3.0 Santé (Medical)' },
        { key: 'apodex_mini', name: 'Apodex 1.1 Mini (Research)' },
        { key: 'content_safety', name: 'Nemotron Content Safety' }
    ];

    for (const item of modelsToTest) {
        console.log(`\n----------------------------------------------------`);
        console.log(`Testing [${item.key}] -> ${item.name}`);
        const start = Date.now();
        try {
            const reply = await OpenRouterService.askAi(
                'Say hello to Vikash and confirm you are working in 1 short sentence.',
                item.key,
                'You are AI-Dost assistant.'
            );
            const latency = Date.now() - start;
            console.log(`✅ Status: SUCCESS (${latency}ms)`);
            console.log(`💬 Response: "${reply.trim().replace(/\n/g, ' ')}"`);
        } catch (e) {
            console.log(`❌ Status: FAILED: ${e.message}`);
        }
    }

    console.log('\n====================================================');
    console.log('🎉 Verification Complete!');
    console.log('====================================================');
}

verifyLive();
