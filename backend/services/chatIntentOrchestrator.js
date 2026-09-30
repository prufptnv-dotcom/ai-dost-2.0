const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const intentModules = [];
const intentsPath = path.join(__dirname, 'intents');

if (fs.existsSync(intentsPath)) {
    fs.readdirSync(intentsPath).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const intent = require('./intents/' + file);
                if (intent.name && intent.evaluate) {
                    intentModules.push(intent);
                }
            } catch(e) {
                logger.warn('Failed to load intent module ' + file, e);
            }
        }
    });
}
// Sort by priority if needed, but here we just use alphabetical order of files which is fine 
// as long as we name them with prefixes 01_, 02_, etc.
intentModules.sort((a, b) => (a.priority || 100) - (b.priority || 100));

async function processIntents(message, processedMessage, langInfo, bharatService) {
    try {
        for (const intent of intentModules) {
            try {
                const appendedText = await intent.evaluate(message, langInfo, bharatService);
                if (appendedText) {
                    processedMessage += appendedText;
                }
            } catch (err) {
                logger.warn(`Intent handler ${intent.name} failed:`, err.message);
            }
        }
    } catch (intentErr) {
        logger.warn(`⚠️ Bharat / Turbo chat intent matcher note: ${intentErr.message}`);
    }
    return processedMessage;
}

module.exports = { processIntents };
