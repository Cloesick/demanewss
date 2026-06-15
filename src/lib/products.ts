import { Product, ProductFilters } from '@/types/product';
import fs from 'fs/promises';
import path from 'path';

// Cache for products data
let productsCache: Product[] = [];
let productsCacheMtimeMs: number | null = null;

// Cache for pdf+page -> rendered image (from Product_images.json)
interface RenderedPageImage {
  pdf: string;
  page: number;
  ok: boolean;
  out: string;
}

let renderedPageImagesCache: RenderedPageImage[] | null = null;

async function loadRenderedPageImages(): Promise<RenderedPageImage[]> {
  if (renderedPageImagesCache) return renderedPageImagesCache;
  try {
    const filePath = path.resolve(process.cwd(), 'public', 'data', 'Product_images.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { rendered?: RenderedPageImage[] };
    renderedPageImagesCache = Array.isArray(parsed.rendered) ? parsed.rendered : [];
  } catch {
    renderedPageImagesCache = [];
  }
  return renderedPageImagesCache;
}

// Mapping from input_pdfs_analysis_v5.json: sku -> best image/page/pdf
interface AnalysisImageMapping {
  sku: string;
  pdf_source: string; // e.g. 'abs-persluchtbuizen.pdf'
  page: number;
  imageWebPath: string; // e.g. /product-images/abs-persluchtbuizen.pdf/ABSBU040_abs-persluchtbuizen_p005_img000.webp
}

let analysisBySku: Map<string, AnalysisImageMapping[]> | null = null;

async function loadAnalysisMapping(): Promise<Map<string, AnalysisImageMapping[]>> {
  if (analysisBySku) return analysisBySku;
  const map = new Map<string, AnalysisImageMapping[]>();
  try {
    const filePath = path.resolve(process.cwd(), 'public', 'data', 'input_pdfs_analysis_v5.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const arr = JSON.parse(raw) as any[];

    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') continue;
      const sku = String(entry.sku || '').trim().toUpperCase();
      if (!sku) continue;
      const images = Array.isArray(entry.images) ? entry.images : [];
      if (!images.length) continue;

      for (const img of images) {
        if (!img || typeof img !== 'object') continue;
        const pdf = String(img.pdf_source || entry.pdf_source || '').trim();
        const page = typeof img.page === 'number'
          ? img.page
          : (Array.isArray(entry.merged_pdf_page) && entry.merged_pdf_page[0]) || null;
        const srcPath = String(img.image_path || '').trim();
        if (!pdf || page == null || !srcPath) continue;

        const fileName = path.basename(srcPath); // ABSBU040_abs-persluchtbuizen_p005_img000.webp
        const pdfName = pdf; // e.g. abs-persluchtbuizen.pdf
        const webPath = `/product-images/${encodeURIComponent(pdfName)}/${encodeURIComponent(fileName)}`;

        const key = sku;
        const list = map.get(key) || [];
        list.push({
          sku: key,
          pdf_source: pdfName,
          page: Number(page),
          imageWebPath: webPath,
        });
        map.set(key, list);
      }
    }
  } catch {
    // If mapping fails, leave map empty and fall back to other resolvers
  }

  analysisBySku = map;
  return map;
}

// Cache for sku/pdf -> image mapping, built from public/product-images
// We keep a rich index so we can prefer images that match both SKU and PDF page.
interface SkuImageEntry {
  sku: string;
  page: number | null;
  imgIndex: number | null;
  webPath: string;
}

type SkuImageIndex = Record<string, SkuImageEntry[]>; // skuUpper -> entries
const pdfSkuImageCache: Map<string, SkuImageIndex> = new Map();

const PRODUCTS_IMAGES_ROOT = path.resolve(process.cwd(), 'public', 'product-images');

async function buildPdfSkuImageIndex(pdfFileName: string): Promise<SkuImageIndex> {
  const existing = pdfSkuImageCache.get(pdfFileName);
  if (existing) return existing;

  const index: SkuImageIndex = {};

  try {
    const pdfDir = path.join(PRODUCTS_IMAGES_ROOT, pdfFileName);
    const entries = await fs.readdir(pdfDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.webp', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;

      const base = path.basename(entry.name, ext);

      // Example patterns:
      //   airpress-catalogus-eng_PNEUMATIC_TOOLS_Impact_wrench_11000+12000+45406_p075_img000
      //   bronpompen_BRONPOMPEN_4_BRONPOMPEN_4_BRONPOMP_SERIE_p006_img000
      // We search for the last segment that contains a '+' as a group of SKUs.
      const parts = base.split('_');
      const skuGroup = parts.findLast((p) => p.includes('+'));

      // Extract page number from pattern like `_p027_`
      let page: number | null = null;
      const pageMatch = base.match(/_p(\d{1,3})_/i);
      if (pageMatch) {
        const pn = parseInt(pageMatch[1], 10);
        if (!Number.isNaN(pn)) page = pn;
      }

      // Extract image index from pattern like `_img000`
      let imgIndex: number | null = null;
      const imgMatch = base.match(/_img(\d{1,4})$/i);
      if (imgMatch) {
        const inum = parseInt(imgMatch[1], 10);
        if (!Number.isNaN(inum)) imgIndex = inum;
      }

      if (skuGroup) {
        const candidates = skuGroup.split('+').map(s => s.trim()).filter(Boolean);
        for (const c of candidates) {
          const key = c.toUpperCase();
          if (!index[key]) index[key] = [];
          index[key].push({
            sku: key,
            page,
            imgIndex,
            webPath: `/product-images/${encodeURIComponent(pdfFileName)}/${encodeURIComponent(entry.name)}`,
          });
        }
      }
    }
  } catch {
    // If directory doesn't exist or fails, leave index empty
  }

  pdfSkuImageCache.set(pdfFileName, index);
  return index;
}

async function resolveImageForProduct(product: Product): Promise<string | undefined> {
  const sku = (product.sku || '').toString().trim();
  if (!sku) return undefined;

  // pdf_source is normalized to something like /documents/Product_pdfs/<name>.pdf
  const pdfSource = product.pdf_source || '';
  const pdfName = (() => {
    try {
      const url = new URL(pdfSource, 'http://localhost');
      return url.pathname.split('/').pop() || '';
    } catch {
      const pathPart = pdfSource.split('?')[0];
      return pathPart.split('/').pop() || '';
    }
  })();

  if (!pdfName) return undefined;

  const index = await buildPdfSkuImageIndex(pdfName);
  const skuUpper = sku.toUpperCase();
  const entries = index[skuUpper] || [];

  // Prefer images whose filename matches the first source page when available.
  const firstPage = Array.isArray(product.source_pages) && product.source_pages.length
    ? product.source_pages[0]
    : null;

  let candidates: SkuImageEntry[] = entries;

  if (firstPage !== null) {
    const pageMatches = entries.filter(e => e.page === firstPage);
    if (pageMatches.length) {
      candidates = pageMatches;
    }
  }

  if (candidates.length) {
    // Prefer highest imgIndex when available; fall back to first entry otherwise.
    const withIndex = candidates.filter(e => typeof e.imgIndex === 'number');
    if (withIndex.length) {
      const best = withIndex.reduce((a, b) => (a.imgIndex! >= b.imgIndex! ? a : b));
      return best.webPath;
    }
    return candidates[0].webPath;
  }

  // Fallback: some SKUs might appear with minor variations; try substring match.
  for (const [key, value] of Object.entries(index)) {
    if (key.includes(skuUpper) || skuUpper.includes(key)) {
      if (!value.length) continue;
      const withIndex = value.filter(e => typeof e.imgIndex === 'number');
      if (withIndex.length) {
        const best = withIndex.reduce((a, b) => (a.imgIndex! >= b.imgIndex! ? a : b));
        return best.webPath;
      }
      return value[0].webPath;
    }
  }

  return undefined;
}

// Load products from the JSON file (server-side) and cache in memory
export async function getProducts(_filters?: ProductFilters): Promise<Product[]> {
  try {
    const filePath = path.resolve(process.cwd(), 'public', 'data', 'products_for_shop.json');
    const catalogPath = path.resolve(process.cwd(), 'src', 'data', 'catalog_products.json');
    // Invalidate cache when the shop file changes; tolerate it being absent
    let mtimeMs: number | null = null;
    try {
      mtimeMs = (await fs.stat(filePath)).mtimeMs;
    } catch {
      mtimeMs = null; // products_for_shop.json may not exist; fall back to catalog data
    }
    const shouldReload =
      !productsCache ||
      productsCache.length === 0 ||
      process.env.NODE_ENV === 'development' ||
      (mtimeMs !== null && mtimeMs !== productsCacheMtimeMs);

    if (shouldReload) {
      // Load catalog products first
      let catalogProducts: any[] = [];
      try {
        const catalogFile = await fs.readFile(catalogPath, 'utf-8');
        catalogProducts = JSON.parse(catalogFile);
        console.log(`✅ Loaded ${catalogProducts.length} catalog products`);
      } catch (catalogError) {
        console.log('ℹ️ No catalog products found, using shop products only');
      }

      // Shop products are optional — fall back to catalog-only when the file is absent
      let shopProducts: any[] = [];
      try {
        const file = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(file);
        shopProducts = Array.isArray(data) ? data : (data.products || []);
      } catch {
        console.log('ℹ️ No products_for_shop.json found, using catalog products only');
      }
      productsCacheMtimeMs = mtimeMs;
      
      // Create a map to deduplicate by SKU (shop products take priority)
      const productsBySku = new Map<string, any>();
      
      // Add shop products first (higher priority)
      shopProducts.forEach((product: any) => {
        const sku = product.sku || product.id;
        if (sku) {
          productsBySku.set(sku, product);
        }
      });
      
      // Add catalog products only if SKU doesn't exist
      catalogProducts.forEach((product: any) => {
        const sku = product.sku || product.id;
        if (sku && !productsBySku.has(sku)) {
          productsBySku.set(sku, product);
        }
      });
      
      const productsArray = Array.from(productsBySku.values());
      if (!Array.isArray(productsArray)) {
        console.error('Expected an array of products but got:', typeof productsArray);
        productsCache = [];
      } else {
        const duplicatesRemoved = (shopProducts.length + catalogProducts.length) - productsArray.length;
        console.log(`📦 Total products loaded: ${productsArray.length} (${shopProducts.length} shop + ${catalogProducts.length} catalog - ${duplicatesRemoved} duplicates)`);

        const firstSentence = (text?: string, maxLen = 200) => {
          if (!text) return '';
          const s = String(text).split(/\.|\n|\r/)[0].trim();
          return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
        };

        const toNum = (v: any): number | undefined => {
          const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
          return typeof n === 'number' && !Number.isNaN(n) ? n : undefined;
        };

        const toNumArray = (arr: any): number[] | undefined => {
          if (!Array.isArray(arr)) return undefined;
          const out = arr.map(toNum).filter((n): n is number => typeof n === 'number');
          return out.length ? out : undefined;
        };

        // Extract product intel from free-text description using regexes
        const parseFromDescription = (desc?: string) => {
          const out: Partial<Product> = {};
          if (!desc) return out;
          // Strip HTML then normalize; keep both original case and lower
          const clean = String(desc).replace(/<[^>]*>/g, ' ');
          const text = clean.replace(/\s+/g, ' ').trim();
          const lower = text.toLowerCase();

          const number = (s: string) => {
            const n = parseFloat(s.replace(',', '.'));
            return !Number.isNaN(n) ? n : undefined;
          };

          // Pressure in bar: pick reasonable range or max
          const barMatches = Array.from(lower.matchAll(/(\d{1,3}(?:[.,]\d)?)\s*bar\b/g)).map(m => number(m[1])).filter((v): v is number => v !== undefined);
          if (barMatches.length) {
            const maxBar = Math.max(...barMatches);
            const minBar = Math.min(...barMatches);
            out.pressure_max_bar = maxBar;
            if (maxBar !== minBar) out.pressure_min_bar = minBar;
          }

          // Explicit overpressure (e.g., Toegelaten overdruk bar | MPa 160 | 16)
          const overMatch = lower.match(/overdruk[^\d]*bar\s*\|\s*mpa\s*(\d{1,3}(?:[.,]\d)?)\s*\|\s*(\d{1,3}(?:[.,]\d)?)/i);
          if (overMatch) {
            out.overpressure_bar = number(overMatch[1]);
            out.overpressure_mpa = number(overMatch[2]);
          }

          // Voltage V
          const vMatch = lower.match(/\b(\d{2,3})\s*v\b/);
          if (vMatch) out.voltage_v = number(vMatch[1]);

          // Electrical block: V | ~ | Hz | A  (e.g., 230 | 1 | 50 | 9.6)
          const elec = lower.match(/aansluiting[^\d]*([\d.,]{2,3})\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)/i);
          if (elec) {
            out.voltage_v = out.voltage_v ?? number(elec[1]);
            out.phase_count = number(elec[2]);
            out.frequency_hz = number(elec[3]);
            out.current_a = number(elec[4]);
          }

          // Power kW and HP
          const kwMatch = lower.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*k\s*w\b|\b(\d{1,2}(?:[.,]\d+)?)\s*kw\b/);
          if (kwMatch) out.power_kw = number(kwMatch[1] || kwMatch[2] || '');
          const hpMatch = lower.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*hp\b/);
          if (hpMatch) out.power_hp = number(hpMatch[1]);

          // Power input | output kW  e.g. Vermogenopname | afgifte kW 2.2 | 1.65
          const pio = lower.match(/vermogen\s*opname\s*\|\s*afgifte\s*k?w?\s*([\d.,]+)\s*\|\s*([\d.,]+)/i) ||
                      lower.match(/vermogenopname\s*\|\s*afgifte\s*k?w?\s*([\d.,]+)\s*\|\s*([\d.,]+)/i);
          if (pio) {
            out.power_input_kw = number(pio[1]);
            out.power_output_kw = number(pio[2]);
          }

          // Flow L/min and L/h e.g. Doorloopcapaciteit l/min | l/h 7.5 | 450
          const flowBlock = lower.match(/doorloopcapaciteit[^\d]*l\s*\/\s*min\s*\|\s*l\s*\/?\s*h\s*([\d.,]+)\s*\|\s*([\d.,]+)/i);
          if (flowBlock) {
            out.flow_l_min = number(flowBlock[1]);
            out.flow_l_h = number(flowBlock[2]);
          } else {
            // Fallback: any L/min mention
            const flowMatch = lower.match(/\b(\d{1,4}(?:[.,]\d+)?)\s*(?:l\/?min|l\s*\/\s*min|lpm)\b/);
            if (flowMatch) out.flow_l_min = out.flow_l_min ?? number(flowMatch[1]);
          }

          // RPM e.g. Motortoerental tpm 2800
          const rpm = lower.match(/(motortoerental|toerental)[^\d]*([\d.,]{2,})/i);
          if (rpm) out.rpm = number(rpm[2]);

          // Cable length e.g. Aansluitkabel m 5
          const cable = lower.match(/aansluitkabel[^\d]*m[^\d]*([\d.,]+)/i);
          if (cable) out.cable_length_m = number(cable[1]);

          // Dimensions L | B | H mm 390 | 290 | 370
          const dims = lower.match(/afmetingen[^\d]*l\s*\|\s*b\s*\|\s*h\s*mm\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)/i);
          if (dims) {
            out.length_mm = number(dims[1]);
            out.width_mm = number(dims[2]);
            out.height_mm = number(dims[3]);
          }

          // Dimensions list like "32 mm" occurrences (unique few dozen)
          const sizeMatches = Array.from(lower.matchAll(/\b(\d{1,3})\s*mm\b/g)).map(m => parseInt(m[1], 10));
          if (sizeMatches.length) {
            const unique = Array.from(new Set(sizeMatches));
            // Keep reasonable bounds 1..1000
            const filtered = unique.filter(n => n > 0 && n <= 1000);
            if (filtered.length) out.dimensions_mm_list = filtered.sort((a,b) => a-b);
          }

          // Weight kg
          const weightMatch = lower.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*kg\b/);
          if (weightMatch) out.weight_kg = number(weightMatch[1]);

          // Materials keywords
          const materials: string[] = [];
          if (/(?:\b|\s)(abs|a\.?b\.?s\.?)(?:\b|\s)/.test(lower)) materials.push('ABS');
          if (/(?:\b|\s)pvc(?:\b|\s)/.test(lower)) materials.push('PVC');
          if (/(?:\b|\s)hdpe(?:\b|\s)/.test(lower)) materials.push('HDPE');
          if (materials.length) out.materials = Array.from(new Set(materials));

          // Feature bullets following ►, ■, ●
          const featureMatches = Array.from(text.matchAll(/[►■●]\s*([^#\n\r]+?)(?=(?:[►■●#]|$))/g)).map(m => m[1].trim()).filter(Boolean);
          if (featureMatches.length) out.features = Array.from(new Set(featureMatches));

          return out;
        };

        const resolvePdfSource = (v: any): string => {
          if (!v) return '';
          const s = String(v).trim();
          // Absolute URL
          if (/^(?:https?:)?\/\//i.test(s)) return s;
          // Already an absolute path
          if (s.startsWith('/')) return s;
          // Bare filename -> map to uploaded public path
          if (/\.pdf$/i.test(s)) return `/documents/Product_pdfs/${encodeURIComponent(s)}`;
          return s;
        };

        // Preload rendered page images once for this mapping pass
        const renderedPageImages = await loadRenderedPageImages();
        // Preload analysis-based image mapping from input_pdfs_analysis_v5.json
        const analysisMap = await loadAnalysisMapping();

        // Build products and attach normalized image URL where possible
        const mappedProducts = await Promise.all(productsArray.map(async (item: any, index: number): Promise<Product> => {
         try {
          const description: string = String(item.description || '');

          // Extract webshop-specific fields from products_for_shop.json
          const category: string = item.product_category || item.category || item.catalog || 'Uncategorized';

          // Map source information from webshop feed to PDF source/pages
          const sourceObj = item.source || {};
          const pdfSources: string[] = Array.isArray(sourceObj.pdf_sources) ? sourceObj.pdf_sources : [];
          const sourcePages: number[] = Array.isArray(sourceObj.pages) ? sourceObj.pages : [];

          // Prefer the first pdf source if present
          const rawPdfSource: string = pdfSources[0] || item.pdf_source || '';

          // Derive a simple image URL from media array if available
          let imageFromMedia: string | undefined;
          if (Array.isArray(item.media) && item.media.length > 0) {
            const mainMedia = item.media.find((m: any) => m && m.role === 'main') || item.media[0];
            if (mainMedia && typeof mainMedia.url === 'string') {
              imageFromMedia = mainMedia.url;
            }
          }

          // Derive media from rendered PDF page images when pdf_source + pages are known
          let mediaFromRenderedPages: { url: string; role?: string }[] | undefined;
          try {
            const logicalPdfName = (rawPdfSource || item.pdf_source || '').toString().trim();
            const pages = Array.isArray(sourcePages) ? sourcePages : [];
            if (logicalPdfName && pages.length && renderedPageImages.length) {
              const lowerPdf = logicalPdfName.toLowerCase();
              const urls: string[] = [];
              for (const p of pages) {
                const match = renderedPageImages.find(r =>
                  r.ok &&
                  r.pdf &&
                  r.pdf.toLowerCase() === lowerPdf &&
                  r.page === p
                );
                if (match && typeof match.out === 'string' && match.out.length) {
                  const marker = `${path.sep}public${path.sep}`;
                  const idx = match.out.indexOf(marker);
                  const rel = idx >= 0
                    ? match.out.substring(idx + marker.length).replace(/\\/g, '/').replace(/^[a-zA-Z]:\//, '')
                    : match.out.replace(/\\/g, '/');
                  const webPath = rel.startsWith('/') ? rel : `/${rel}`;
                  if (!urls.includes(webPath)) {
                    urls.push(webPath);
                  }
                }
              }
              if (urls.length) {
                mediaFromRenderedPages = urls.map((u, i) => ({
                  url: u,
                  role: i === 0 ? 'main' : 'gallery',
                }));
                if (!imageFromMedia) {
                  imageFromMedia = urls[0];
                }
              }
            }
          } catch {
            // Non-fatal; just skip rendered-page derived media
          }
          const parsed = parseFromDescription(description);

          const base: Product = {
            // Preserve any extra fields first so normalized fields override them
            ...item,

            // Core identity and labeling
            sku: item.sku || item.product_id || `product-${index}`,
            name: item.name || (description ? firstSentence(description, 60) : 'Unnamed Product'),
            description,
            product_category: category,

            // Normalized links/arrays
            pdf_source: resolvePdfSource(rawPdfSource || ''),
            source_pages: sourcePages,

            // Optional/technical fields (coerced)
            // products_for_shop.json has price as an object { amount, currency, ... }
            price: toNum(item.price?.amount ?? item.price),
            imageUrl:
              typeof item.imageUrl === 'string'
                ? item.imageUrl
                : typeof item.image === 'string'
                  ? item.image
                  : imageFromMedia,
            inStock: item.inStock !== false,
            rating: toNum(item.rating),
            reviewCount: toNum(item.reviewCount),
            pressure_max_bar: toNum(item.pressure_max_bar),
            pressure_min_bar: toNum(item.pressure_min_bar),
            power_kw: toNum(item.power_kw),
            power_hp: toNum(item.power_hp),
            voltage_v: toNum(item.voltage_v),
            flow_l_min: toNum(item.flow_l_min),
            flow_l_min_list: toNumArray(item.flow_l_min_list),
            dimensions_mm_list: toNumArray(item.dimensions_mm_list),
            length_mm: toNum(item.length_mm),
            width_mm: toNum(item.width_mm),
            height_mm: toNum(item.height_mm),
            weight_kg: toNum(item.weight_kg),
          } as Product;

          // Merge parsed fields without overwriting explicit values
          const merged: Product = {
            ...base,
            pressure_max_bar: base.pressure_max_bar ?? parsed.pressure_max_bar,
            pressure_min_bar: base.pressure_min_bar ?? parsed.pressure_min_bar,
            power_kw: base.power_kw ?? parsed.power_kw,
            power_hp: base.power_hp ?? parsed.power_hp,
            voltage_v: base.voltage_v ?? parsed.voltage_v,
            flow_l_min: base.flow_l_min ?? parsed.flow_l_min,
            flow_l_h: (base as any).flow_l_h ?? (parsed as any).flow_l_h,
            dimensions_mm_list: (base.dimensions_mm_list && base.dimensions_mm_list.length)
              ? base.dimensions_mm_list
              : (parsed.dimensions_mm_list as number[] | undefined) ?? [],
            weight_kg: base.weight_kg ?? parsed.weight_kg,
            materials: (Array.isArray(base.materials) && base.materials.length)
              ? base.materials
              : parsed.materials,
            // New parsed metrics (non-destructive merge)
            overpressure_bar: (base as any).overpressure_bar ?? (parsed as any).overpressure_bar,
            overpressure_mpa: (base as any).overpressure_mpa ?? (parsed as any).overpressure_mpa,
            rpm: base.rpm ?? parsed.rpm,
            phase_count: (base as any).phase_count ?? (parsed as any).phase_count,
            frequency_hz: (base as any).frequency_hz ?? (parsed as any).frequency_hz,
            current_a: (base as any).current_a ?? (parsed as any).current_a,
            power_input_kw: (base as any).power_input_kw ?? (parsed as any).power_input_kw,
            power_output_kw: (base as any).power_output_kw ?? (parsed as any).power_output_kw,
            cable_length_m: (base as any).cable_length_m ?? (parsed as any).cable_length_m,
            length_mm: base.length_mm ?? parsed.length_mm,
            width_mm: base.width_mm ?? parsed.width_mm,
            height_mm: base.height_mm ?? parsed.height_mm,
            features: (Array.isArray((base as any).features) && (base as any).features.length)
              ? (base as any).features
              : (parsed as any).features,
            // Attach media from rendered pages if no explicit media was provided
            media: Array.isArray((base as any).media) && (base as any).media.length
              ? (base as any).media
              : mediaFromRenderedPages,
          } as Product;

          // Apply analysis-based image mapping where available (strongest source of truth)
          try {
            const skuUpper = merged.sku.toUpperCase();
            const mapped = analysisMap.get(skuUpper);
            if (mapped && mapped.length) {
              // Prefer first mapping for now; could refine by page if needed
              const first = mapped[0];
              // Set pdf_source / source_pages if not already present
              if (!merged.pdf_source) {
                merged.pdf_source = `/documents/Product_pdfs/${encodeURIComponent(first.pdf_source)}`;
              }
              if (!Array.isArray(merged.source_pages) || !merged.source_pages.length) {
                merged.source_pages = [first.page];
              }
              merged.imageUrl = first.imageWebPath;
            }
          } catch {
            // Ignore mapping errors and continue
          }

          // Attach SKU/PDF based image as a final enhancement (fallback when
          // analysis-based mapping did not yield an image).
          try {
            if (!merged.imageUrl) {
              // Intentionally left blank: avoid runtime filesystem scanning under
              // public/product-images which can cause serverless bundle bloat.
            }
          } catch {
            // Ignore resolution errors and keep product as-is
          }

          return merged;
         } catch (itemErr) {
           // One malformed product must not zero-out the whole catalog
           console.warn(`Skipping product mapping for index ${index} (sku=${item?.sku ?? item?.id}):`, itemErr);
           return {
             sku: item?.sku || item?.id || `product-${index}`,
             name: item?.name || String(item?.description || 'Product').split('\n')[0].slice(0, 60) || 'Product',
             description: String(item?.description || ''),
             product_category: item?.product_category || item?.category || 'Uncategorized',
           } as Product;
         }
        }));

        productsCache = mappedProducts;
      }
    }
  } catch (error) {
    console.error('Error loading product data:', error);
    if (!productsCache) productsCache = []; // keep any previously-loaded data on transient errors
  }

  // Note: Filtering is applied in the API route; return all products here.
  return productsCache;
}

export async function getProductBySku(sku: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.sku === sku);
}

export async function getUniqueProductCategories(): Promise<string[]> {
  const products = await getProducts();
  const categories = new Set<string>();
  
  products.forEach((product) => {
    if (product.product_category) {
      categories.add(product.product_category);
    }
  });

  return Array.from(categories).sort();
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const products = await getProducts();
  return products.filter(p => p.product_category === category);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const products = await getProducts();
  const q = query.toLowerCase();
  return products.filter(p => 
    p.product_category?.toLowerCase().includes(q) || 
    p.description?.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q)
  );
}

export async function getProductCategories(): Promise<string[]> {
  const products = await getProducts();
  const categories = new Set<string>();
  
  products.forEach((product) => {
    if (product.product_category) {
      categories.add(product.product_category);
    }
  });

  return Array.from(categories).sort();
}
