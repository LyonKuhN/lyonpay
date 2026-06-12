import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(path.join(dir, f));
    }
  });
}

function replaceInFile(filePath) {
  const ext = path.extname(filePath);
  if (!['.js', '.ts', '.tsx', '.html', '.css', '.json'].includes(ext)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/Lyonpay/g, 'Lyonk').replace(/lyonpay/g, 'lyonk');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Updated', filePath);
  }
}

walkDir('./src', replaceInFile);
walkDir('./server', replaceInFile);
replaceInFile('./index.html');
replaceInFile('./package.json');
console.log('Replacement finished.');
