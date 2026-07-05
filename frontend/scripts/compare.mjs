import fs from 'fs';

try {
  const vi = JSON.parse(fs.readFileSync('./messages/vi.json', 'utf8'));
  const en = JSON.parse(fs.readFileSync('./messages/en.json', 'utf8'));

  const missingInVi = [];
  const missingInEn = [];

  function compareObjects(obj1, obj2, path, missingList1, missingList2) {
    for (let key in obj1) {
      const fullPath = path ? `${path}.${key}` : key;
      if (obj2[key] === undefined) {
        missingList2.push(fullPath);
      } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
        if (typeof obj2[key] === 'object' && obj2[key] !== null) {
          compareObjects(obj1[key], obj2[key], fullPath, missingList1, missingList2);
        } else {
          missingList2.push(`${fullPath} (type mismatch)`);
        }
      }
    }
    
    for (let key in obj2) {
      const fullPath = path ? `${path}.${key}` : key;
      if (obj1[key] === undefined) {
        missingList1.push(fullPath);
      }
    }
  }

  compareObjects(en, vi, '', missingInEn, missingInVi);

  fs.writeFileSync('./compare-result-root.json', JSON.stringify({ missingInVi, missingInEn }, null, 2));
} catch (e) {
  fs.writeFileSync('./compare-result-root.json', JSON.stringify({ error: e.message }));
}
