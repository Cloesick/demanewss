const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DATA_JSON = path.resolve(__dirname, '..', 'public', 'data', 'Product_pdfs_analysis_v2.json');
const PDF_DIR = path.resolve(__dirname, '..', 'public', 'documents', 'Product_pdfs');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'images', 'pdf_pages');
const MAP_OUT = path.resolve(__dirname, '..', 'public', 'data', 'Product_images.json');
const RENDER_HTML = path.resolve(__dirname, '..', 'public', 'pdf_render.html');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function fileUrl(p) { let u = p.replace(/\\/g, '/'); if (!u.startsWith('/')) u = '/' + u; return 'file://' + u; }

async function renderOne(page, pdfAbsPath, pageNum, outPng) {
  const htmlUrl = fileUrl(RENDER_HTML);
  await page.setViewport({ width: 1400, height: 2000, deviceScaleFactor: 2 });
  await page.goto(htmlUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const b64 = fs.readFileSync(pdfAbsPath).toString('base64');
  await page.evaluate(({ b64, pageNum }) => {
    // @ts-ignore
    window.__renderFromConfig && window.__renderFromConfig({ pdfBase64: b64, pageNumber: pageNum });
  }, { b64, pageNum });
  await page.waitForFunction(() => window.__RENDER_DONE__ === true || typeof window.__RENDER_ERROR__ === 'string', { timeout: 120000 });
  const err = await page.evaluate(() => window.__RENDER_ERROR__ || '');
  if (err) throw new Error('Render failed: ' + err);
  const canvas = await page.$('#pdf-canvas');
  if (!canvas) throw new Error('Canvas not found after render');
  await canvas.screenshot({ path: outPng });
}

async function main() {
  const skuArg = process.argv[2];
  const pageArg = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
  if (!skuArg) {
    console.error('Usage: node scripts/render_single.js <SKU> [pageNumber]');
    process.exit(1);
  }
  ensureDir(OUT_DIR);
  const items = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const item = items.find((it) => String(it.sku) === String(skuArg));
  if (!item) {
    console.error('SKU not found in data:', skuArg);
    process.exit(1);
  }
  const pageNum = pageArg || (Array.isArray(item.source_pages) && item.source_pages.length ? item.source_pages[0] : 1);
  const pdf = item.pdf_source;
  const pdfAbs = path.join(PDF_DIR, pdf);
  if (!fs.existsSync(pdfAbs)) {
    console.error('PDF missing at', pdfAbs);
    process.exit(1);
  }
  const base = path.parse(pdf).name;
  const out = path.join(OUT_DIR, `${base}_${pageNum}.webp`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    await renderOne(page, pdfAbs, pageNum, out);
    console.log('Rendered', out);
  } finally {
    await browser.close();
  }

  // Update mapping for this SKU
  let mapping = { rendered: [], sku_images: {} };
  if (fs.existsSync(MAP_OUT)) {
    try { mapping = JSON.parse(fs.readFileSync(MAP_OUT, 'utf8')); } catch {}
  }
  mapping.sku_images = mapping.sku_images || {};
  const rel = path.posix.join('public', 'images', 'pdf_pages', `${base}_${pageNum}.webp`).replace(/\\/g, '/');
  mapping.sku_images[item.sku] = {
    image_path: rel,
    image_type: 'page',
    pdf_source: item.pdf_source,
    page: pageNum,
  };
  fs.writeFileSync(MAP_OUT, JSON.stringify(mapping, null, 2), 'utf8');
  console.log('Updated mapping for', item.sku, '->', rel);
}

if (require.main === module) {
  main();
}
