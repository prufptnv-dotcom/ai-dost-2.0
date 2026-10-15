const logger = require('../logger');

/**
 * VisualAssetsService: Transforms raw data into professional visual assets (Charts, Graphs, Diagrams).
 * This allows AI-Dost to move beyond text and provide "Researcher-Grade" visual evidence.
 */
class VisualAssetsService {
    constructor() {
        this.chartBaseUrl = 'https://quickchart.io/chart';
    }

    /**
     * Generates a professional chart URL based on provided data.
     * @param {Object} options { type, labels, datasets, title, colors }
     */
    async generateChartUrl(options) {
        try {
            const { type = 'bar', labels, datasets, title = 'Data Analysis', colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'] } = options;

            if (!labels || !datasets || !datasets[0]?.data) {
                throw new Error('Missing labels or datasets for chart generation');
            }

            const chartConfig = {
                type: type,
                data: {
                    labels: labels,
                    datasets: datasets.map((ds, i) => ({
                        label: ds.label || 'Value',
                        data: ds.data,
                        backgroundColor: colors[i % colors.length],
                        borderColor: colors[i % colors.length],
                        borderWidth: 1
                    }))
                },
                options: {
                    title: {
                        display: true,
                        text: title,
                        fontSize: 18,
                        fontColor: '#1f2937'
                    },
                    legend: {
                        position: 'bottom'
                    },
                    scales: {
                        yAxes: [{
                            ticks: { beginAtZero: true }
                        }]
                    }
                }
            };

            const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
            const finalUrl = `${this.chartBaseUrl}?c=${encodedConfig}&b=1`;
            
            logger.info(`📊 [VisualAssets] Generated ${type} chart: ${title}`);
            return finalUrl;

        } catch (e) {
            logger.error(`❌ [VisualAssets] Chart generation error: ${e.message}`);
            return null;
        }
    }

    /**
     * Generates a conceptual "Infographic" or "Diagram" prompt for the Image Studio.
     */
    generateDiagramPrompt(topic, dataPoints) {
        return `A professional high-resolution corporate infographic diagram about ${topic}. 
                The diagram should represent these key data points: ${dataPoints.join(', ')}. 
                Style: Modern, clean, vector art, white background, blue and grey professional color palette, 4k, highly detailed, technical layout.`;
    }
}

module.exports = new VisualAssetsService();
