const axios = require('axios');
const logger = require('../logger');

/**
 * GenericApiConnector: Allows AI-Dost to interact with any REST API as a tool.
 * This eliminates the need to write a custom JS tool for every single API.
 */
class GenericApiConnector {
    /**
     * Executes a request to an external API.
     * @param {object} config - { url, method, headers, body, queryParams }
     */
    async callApi({ url, method = 'GET', headers = {}, body = null, queryParams = {} }) {
        try {
            logger.info(`🌐 [ApiConnector] Calling ${method} ${url}`);
            
            const response = await axios({
                url,
                method,
                headers,
                data: body,
                params: queryParams,
                timeout: 15000 // 15s timeout
            });

            return {
                success: true,
                data: response.data,
                status: response.status
            };
        } catch (e) {
            logger.error(`❌ [ApiConnector] API Call Failed: ${e.message}`);
            return {
                success: false,
                error: e.response ? JSON.stringify(e.response.data) : e.message,
                status: e.response ? e.response.status : 500
            };
        }
    }
}

module.exports = new GenericApiConnector();
