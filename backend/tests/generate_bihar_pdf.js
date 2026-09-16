const fs = require('fs');
const path = require('path');
const { generatePdfFile } = require('../services/nodePdfService');

(async () => {
  try {
    const mdPath = path.join(__dirname, '../reports/bihar_sampoorna_research_report.md');
    const markdown = fs.readFileSync(mdPath, 'utf8');
    const outputPath = path.join(__dirname, '../../frontend/public/downloads/bihar_sampoorna_research_report.pdf');
    const title = 'Bihar: Sampoorna Research Report';

    console.log('Generating Bihar PDF from markdown (' + markdown.length + ' chars)...');
    const result = await generatePdfFile(markdown, title, outputPath);
    console.log('Result:', result);

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log('PDF generated successfully!');
      console.log('File:', outputPath);
      console.log('Size:', stats.size, 'bytes');
    } else {
      console.error('File does not exist at outputPath');
    }
  } catch (err) {
    console.error('Error generating PDF:', err);
  }
})();
