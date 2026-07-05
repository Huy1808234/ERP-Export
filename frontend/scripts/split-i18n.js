const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');
const locales = ['en', 'vi'];

locales.forEach((locale) => {
  const filePath = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  const outputDir = path.join(messagesDir, locale);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Each top-level key becomes a file
    for (const [key, value] of Object.entries(data)) {
      const outFilePath = path.join(outputDir, `${key}.json`);
      fs.writeFileSync(outFilePath, JSON.stringify(value, null, 2), 'utf8');
      console.log(`Created: ${outFilePath}`);
    }
    
    console.log(`Successfully split ${locale}.json into ${outputDir}`);
  } catch (error) {
    console.error(`Error processing ${locale}.json:`, error);
  }
});
