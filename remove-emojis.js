const fs = require('fs');

const files = [
  'c:/Users/sliml/.gemini/antigravity/scratch/agencyos/frontend/src/features/reports/pages/finance-report-form-page.tsx',
  'c:/Users/sliml/.gemini/antigravity/scratch/agencyos/frontend/src/features/reports/pages/hr-report-form-page.tsx',
  'c:/Users/sliml/.gemini/antigravity/scratch/agencyos/backend/src/modules/reports/reports.service.ts'
];

// Note: matching emojis can be tricky. This regex matches a lot of emoji blocks.
const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{1F400}-\u{1F4FF}]/gu;

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(emojiRegex, '');
    // Clean up empty icons or trailing spaces
    content = content.replace(/ icon=""/g, '');
    content = content.replace(/ icon=\{\"\"}/g, '');
    content = content.replace(/ icon=''/g, '');
    content = content.replace(/ icon=\{\'\'}/g, '');
    fs.writeFileSync(f, content);
    console.log('Cleaned ' + f);
  }
});
