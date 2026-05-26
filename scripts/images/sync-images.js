const fs = require('fs');
const path = require('path');

// Source folder with experiment images
const SOURCE_DIR = path.resolve('c:/Users/prova/Documents/Projects/PDF_Analyzer/images_experiment');
// Target folder inside Next.js public directory
const TARGET_DIR = path.resolve(process.cwd(), 'public', 'product-images');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractSkusFromFilename(filename) {
  // Expect patterns like: PREFIX_12345+67890_IMG.webp or PREFIX_12345_IMG.webp
  const match = filename.match(/_([^_]+)_IMG\.[a-zA-Z0-9]+$/);
  if (!match) return [];

  const skuPart = match[1];
  return skuPart.split('+').map((sku) => sku.trim()).filter(Boolean);
}

function walkDir(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, cb);
    } else if (entry.isFile()) {
      cb(fullPath, entry.name);
    }
  }
}

function main() {
  console.log('Syncing product images by SKU...');
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Source directory does not exist:', SOURCE_DIR);
    process.exit(1);
  }

  ensureDir(TARGET_DIR);

  let countFiles = 0;
  let countLinks = 0;

  walkDir(SOURCE_DIR, (fullPath, name) => {
    // Only handle png files for now
    if (!name.toLowerCase().endsWith('.webp')) return;

    const skus = extractSkusFromFilename(name);
    if (skus.length === 0) return;

    countFiles += 1;

    for (const sku of skus) {
      const targetPath = path.join(TARGET_DIR, `${sku}.webp`);
      if (fs.existsSync(targetPath)) {
        // Already created for this SKU, skip to avoid overwriting
        continue;
      }
      // Copy file; on Windows hardlinks/symlinks can be tricky with permissions, so use copy
      fs.copyFileSync(fullPath, targetPath);
      countLinks += 1;
    }
  });

  console.log(`Processed source image files: ${countFiles}`);
  console.log(`Created/updated SKU images: ${countLinks}`);
  console.log('Done.');
}

main();
