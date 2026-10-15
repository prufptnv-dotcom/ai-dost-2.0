import { generateLiveAppHtml } from '../frontend/components/ide/PreviewEngine.js';
import fs from 'fs';

const html = generateLiveAppHtml([], {}, true);
const lines = html.split('\n');
console.log('total lines:', lines.length);
const target = 1588;
for (let i = target - 3; i <= target + 2; i++) {
  const ln = lines[i - 1] || '';
  const mark = i === target ? '>>>' : '   ';
  console.log(`${mark} ${i}: ${ln.slice(0, 200)}`);
}
console.log('\n--- col 106 of line', target, '---');
console.log((lines[target - 1] || '').slice(60, 160));
fs.writeFileSync('temp_ui_audit/preview_empty.html', html);
console.log('\nwritten temp_ui_audit/preview_empty.html');