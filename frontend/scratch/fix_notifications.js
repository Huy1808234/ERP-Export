const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetDir = path.join(process.cwd(), 'src');
console.log('Scanning directory:', targetDir);

walk(targetDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Regex to match notification.method({ message: ... })
    // and replace only the 'message:' key inside the object
    const regex = /notification\.(success|error|warning|info)\(\{([\s\S]*?)\}/g;
    
    let newContent = content.replace(regex, (match, method, objectContent) => {
      // Inside the object content, replace message: with title:
      // Only replace if it's a key at the start of a line or after a comma/space
      let updatedObject = objectContent.replace(/(\s|,|^)message:/g, '$1title:');
      return `notification.${method}({${updatedObject}})`;
    });

    if (content !== newContent) {
      console.log('Updating:', filePath);
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }
});

console.log('Project-wide notification upgrade complete.');
