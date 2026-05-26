let cache: any = null;
let loading: Promise<any> | null = null;

export async function getSkuImagePath(sku: string): Promise<string | null> {
  if (!sku) return null;
  if (cache) {
    const entry = (cache as any).sku_images?.[sku];
    const path = entry?.image_path as string | undefined;
    return path ? normalizeWebPath(path) : null;
  }
  if (!loading) {
    loading = fetch('/data/Product_images.json', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load Product_images.json');
        const contentType = r.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Not JSON response');
        }
        return r.json();
      })
      .then((j) => {
        cache = j || {};
        return cache;
      })
      .catch(() => {
        cache = null as any;
        return cache;
      });
  }
  const data = await loading;
  const entry = (data as any).sku_images?.[sku];
  const path = entry?.image_path as string | undefined;
  return path ? normalizeWebPath(path) : null;
}

function normalizeWebPath(p: string): string {
  // The mapping may use absolute OS paths like
  //   "C:\\...\\public\\images\\pdf_pages\\foo.webp"
  // or relative ones like
  //   "public/images/pdf_pages/foo.webp" or "images/pdf_pages/foo.webp".
  // Convert these into clean web paths rooted at "/".
  const cleaned = p.replace(/\\/g, '/');

  // If we can find a /public/ segment, strip everything up to and including it
  const marker = '/public/';
  const idx = cleaned.toLowerCase().lastIndexOf(marker);
  let webPath = cleaned;
  if (idx !== -1) {
    webPath = cleaned.slice(idx + marker.length);
  }

  // Strip any leading "public/" if present
  webPath = webPath.replace(/^public\//i, '');

  // Ensure leading slash
  if (!webPath.startsWith('/')) {
    webPath = '/' + webPath;
  }

  return webPath;
}
