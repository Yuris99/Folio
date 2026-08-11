const fs = require('fs');
const path = require('path');

const root = __dirname;
const outputDirectory = path.join(root, 'dist');
const frontendFiles = [
  'index.html',
  'styles.css',
  'config.js',
  'api.js',
  'app.js'
];

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const file of frontendFiles) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error(`Missing frontend asset: ${file}`);
  fs.copyFileSync(source, path.join(outputDirectory, file));
}

console.log(`Built ${frontendFiles.length} frontend files in ${outputDirectory}`);
