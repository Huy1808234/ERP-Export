import fs from 'fs';

try {
  const vi = JSON.parse(fs.readFileSync('./messages/vi/vi.json', 'utf8'));
  const en = JSON.parse(fs.readFileSync('./messages/en/en.json', 'utf8'));

  const diff = [];
  for (let key in en) {
    if (!vi[key]) diff.push(`Missing root key: ${key}`);
  }
  
  // also check keys in AdminSupport
  if (vi.AdminSupport && en.AdminSupport) {
    for (let key in en.AdminSupport) {
      if (!vi.AdminSupport[key]) diff.push(`Missing AdminSupport key: ${key}`);
    }
  }
  
  if (diff.length === 0) diff.push("All root keys match!");
  fs.writeFileSync('./json-diff.txt', diff.join('\n'));
} catch (e) {
  fs.writeFileSync('./json-diff.txt', "Error: " + e.message);
}
