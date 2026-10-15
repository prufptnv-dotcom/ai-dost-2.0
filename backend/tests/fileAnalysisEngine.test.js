const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectAnalysisMode,
  ANALYSIS_MODES,
  extractFileContent,
  FILE_ANALYSIS_STUDIO_DIRECTIVE,
} = require('../services/fileAnalysisEngine');

describe('Category 7: Universal File Analysis Engine Tests', () => {
  describe('Analytical Mode Detection', () => {
    test('detects summary mode from keywords', () => {
      assert.equal(detectAnalysisMode('is file ka brief summary ya nichod do'), ANALYSIS_MODES.SUMMARY);
      assert.equal(detectAnalysisMode('summarize the key highlights'), ANALYSIS_MODES.SUMMARY);
    });

    test('detects mistakes and error detection mode', () => {
      assert.equal(detectAnalysisMode('is code me kahan galti aur bugs hain check karo'), ANALYSIS_MODES.MISTAKES);
      assert.equal(detectAnalysisMode('find all security vulnerabilities and flaws'), ANALYSIS_MODES.MISTAKES);
    });

    test('detects marks and score estimation mode', () => {
      assert.equal(detectAnalysisMode('is paper me kitne marks aur grade milenge?'), ANALYSIS_MODES.MARKS_ANALYSIS);
      assert.equal(detectAnalysisMode('estimate the score out of 100'), ANALYSIS_MODES.MARKS_ANALYSIS);
    });

    test('detects assignment and rubric evaluation mode', () => {
      assert.equal(detectAnalysisMode('is homework assignment ko evaluate karo'), ANALYSIS_MODES.ASSIGNMENT_EVALUATE);
      assert.equal(detectAnalysisMode('check kardo assignment ka technical correctness'), ANALYSIS_MODES.ASSIGNMENT_EVALUATE);
    });

    test('detects missing concepts and curricular gap analysis', () => {
      assert.equal(detectAnalysisMode('is report me kya chhoot gaya hai aur recommendations kya hain?'), ANALYSIS_MODES.MISSING_CONCEPTS);
      assert.equal(detectAnalysisMode('perform gap analysis on what is missing'), ANALYSIS_MODES.MISSING_CONCEPTS);
    });

    test('detects table and structured data extraction', () => {
      assert.equal(detectAnalysisMode('extract all tables into json and csv'), ANALYSIS_MODES.EXTRACT_TABLES);
      assert.equal(detectAnalysisMode('structured data extract karo'), ANALYSIS_MODES.EXTRACT_TABLES);
    });

    test('detects multi-file comparative analysis', () => {
      assert.equal(detectAnalysisMode('dono files me kya fark hai compare karo'), ANALYSIS_MODES.MULTI_FILE_COMPARE);
      assert.equal(detectAnalysisMode('compare these versions', 2), ANALYSIS_MODES.MULTI_FILE_COMPARE);
    });

    test('detects rewrite, refactor and format conversion', () => {
      assert.equal(detectAnalysisMode('is legacy code ko modern python me convert aur refactor karo'), ANALYSIS_MODES.REWRITE_CONVERT);
      assert.equal(detectAnalysisMode('format badal do dubara likho'), ANALYSIS_MODES.REWRITE_CONVERT);
    });
  });

  describe('Universal Content Extraction', () => {
    test('extracts plain text file safely', async () => {
      const file = { name: 'notes.txt', text: 'AI-Dost system notes and test specifications.' };
      const res = await extractFileContent(file);
      assert.equal(res.name, 'notes.txt');
      assert.equal(res.ext, 'txt');
      assert.equal(res.text, 'AI-Dost system notes and test specifications.');
    });

    test('extracts CSV file from base64 safely', async () => {
      const csvData = 'id,name,role\n1,Alice,Engineer\n2,Bob,Architect';
      const file = {
        name: 'team.csv',
        base64: Buffer.from(csvData, 'utf-8').toString('base64'),
      };
      const res = await extractFileContent(file);
      assert.equal(res.name, 'team.csv');
      assert.equal(res.ext, 'csv');
      assert.ok(res.text.includes('Alice'));
      assert.ok(res.text.includes('Architect'));
    });

    test('handles empty file buffer safely without crashing', async () => {
      const file = { name: 'empty.txt', base64: '' };
      const res = await extractFileContent(file);
      assert.equal(res.text, '[Empty file data provided]');
    });
  });

  describe('Directive & Schema Verification', () => {
    test('directive contains all 10 analytical capabilities', () => {
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('1. 📖 READ & GENERAL ANALYSIS'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('2. 📌 EXECUTIVE SUMMARY'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('3. 🔍 IMPORTANT POINTS & KEY TAKEAWAYS'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('4. 🚨 MISTAKES & ERROR IDENTIFICATION'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('5. 🎓 ASSIGNMENT EVALUATION'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('6. 💯 MARKS & GRADE APPROXIMATE ANALYSIS'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('7. 🧩 MISSING CONCEPTS & GAP ANALYSIS'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('8. 🔄 REWRITE / CONVERT / REFACTOR'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('9. 📊 TABLES & STRUCTURED DATA EXTRACTION'));
      assert.ok(FILE_ANALYSIS_STUDIO_DIRECTIVE.includes('10. ⚖️ MULTI-FILE COMPARATIVE ANALYSIS'));
    });
  });
});
