import fs from 'fs';
import path from 'path';

const itemsToDelete = [
  'src/middleware.ts',
  'src/app/[locale]/(guest)/auth'
];

console.log('🚀 Starting Final Architecture Cleanup...');

itemsToDelete.forEach(item => {
  const fullPath = path.join(process.cwd(), item);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`✅ Deleted: ${item}`);
  }
});

console.log('✨ Architecture is now clean and shared! Please restart your dev server.');
