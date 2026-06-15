import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/products';
import type { Product, ProductFilters } from '@/types/product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import fs from 'fs/promises';
import path from 'path';

// Helper function to parse query parameters with type safety
function parseQueryParams(params: URLSearchParams): ProductFilters {
  const getParam = <T>(key: string, type: 'string' | 'number' | 'boolean' = 'string', defaultValue?: T): T | undefined => {
    const value = params.get(key);
    if (value === null) return defaultValue;
    try {
      switch (type) {
        case 'number': {
          const num = parseFloat(value);
          return (isNaN(num) ? defaultValue : num) as T;
        }
        case 'boolean':
          return (value === 'true') as T;
        default:
          return value as T;
      }
    } catch (error) {
      console.warn(`Failed to parse ${key} as ${type}:`, value);
      return defaultValue;
    }
  };

  return {
    // Category and search
    category: getParam('category'),
    product_category: getParam('product_category') || getParam('category'),
    product_type: getParam('product_type'),
    pdf_source: getParam('pdf_source') || getParam('pdf'),
    pdf: getParam('pdf'),
    searchTerm: getParam('searchTerm') || getParam('q'),
    sku: getParam('sku'),
    
    // Price range
    minPrice: getParam('minPrice', 'number'),
    maxPrice: getParam('maxPrice', 'number'),
    
    // Technical filters
    power_kw: getParam('power_kw', 'number'),
    minPower: getParam('minPower', 'number'),
    maxPower: getParam('maxPower', 'number'),
    voltage_v: getParam('voltage_v', 'number'),
    spanning_v: getParam('spanning_v', 'number'),
    minPressure: getParam('minPressure', 'number'),
    maxPressure: getParam('maxPressure', 'number'),
    pressure_max_bar: getParam('pressure_max_bar', 'number'),
    pressure_min_bar: getParam('pressure_min_bar', 'number'),
    flow_l_min_list: getParam('flow_l_min_list', 'number'),
    rpm: getParam('rpm', 'number'),
    size_inch: getParam('size_inch'),
    connection_types: getParam('connection_types'),
    aansluiting: getParam('aansluiting'),
    length_m: getParam('length_m', 'number'),
    materials: getParam('materials'),
    weight_kg: getParam('weight_kg', 'number'),
    volume_l: getParam('volume_l', 'number'),
    vlotter: getParam('vlotter', 'boolean'),
    debiet_m3_h: getParam('debiet_m3_h', 'number'),
    
    // Image filter
    hasImages: getParam('hasImages', 'boolean'),
    
    // Pagination
    limit: Math.min(100, Math.max(1, getParam('limit', 'number') || 24)),
    skip: Math.max(0, getParam('skip', 'number') || 0),
    
    // Sorting
    sortBy: getParam('sortBy') || 'name',
    sortOrder: (getParam('sortOrder') as 'asc' | 'desc') || 'asc',
  };
}

function matchesSearch(text: string | undefined, searchTerm: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(searchTerm.toLowerCase());
}

// Helper function to filter products based on the provided filters
function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  if (!products || !Array.isArray(products)) {
    console.warn('No products array provided to filterProducts');
    return [];
  }

  return products.filter(product => {
    // Exact SKU match short-circuit
    if (filters.sku && product.sku !== filters.sku) {
      return false;
    }
    
    // Filter by category (case-insensitive, trimmed)
    const categoryFilter = filters.product_category || filters.category;
    const norm = (s: any) => (s === undefined || s === null) ? '' : String(s).trim().toLowerCase();
    if (categoryFilter && norm(product.product_category) !== norm(categoryFilter)) {
      return false;
    }

    // Filter by product type (exact match if present in data)
    if (filters.product_type && product['product_type'] !== filters.product_type) {
      return false;
    }

    // Filter by PDF source
    const pdfFilter = filters.pdf_source || filters.pdf;
    if (pdfFilter && product.pdf_source !== pdfFilter) {
      return false;
    }
    
    // Filter by price range
    const productPrice = product.price || 0;
    if (filters.minPrice !== undefined && productPrice < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice !== undefined && productPrice > filters.maxPrice) {
      return false;
    }
    
    // Filter by power range (kW)
    const productPower = product.power_kw || 0;
    if (filters.power_kw !== undefined && productPower !== filters.power_kw) {
      return false;
    }
    if (filters.minPower !== undefined && productPower < filters.minPower) {
      return false;
    }
    if (filters.maxPower !== undefined && productPower > filters.maxPower) {
      return false;
    }
    
    // Filter by pressure range (bar)
    const maxPressure = product.pressure_max_bar || 0;
    const minPressure = product.pressure_min_bar || 0;
    if (filters.pressure_max_bar !== undefined && maxPressure !== filters.pressure_max_bar) {
      return false;
    }
    if (filters.pressure_min_bar !== undefined && minPressure !== filters.pressure_min_bar) {
      return false;
    }
    
    if (filters.minPressure !== undefined && maxPressure < filters.minPressure) {
      return false;
    }
    if (filters.maxPressure !== undefined && minPressure > filters.maxPressure) {
      return false;
    }

    // Filter by voltage (support voltage_v and spanning_v alias)
    const productVoltage = product.voltage_v ?? product['spanning_v'];
    const voltageFilter = filters.voltage_v ?? filters.spanning_v;
    if (voltageFilter !== undefined && productVoltage !== voltageFilter) {
      return false;
    }

    // Flow list contains value
    if (filters.flow_l_min_list !== undefined) {
      const list = product.flow_l_min_list || [];
      if (!Array.isArray(list) || !list.includes(filters.flow_l_min_list)) {
        return false;
      }
    }

    // RPM
    if (filters.rpm !== undefined && product['rpm'] !== filters.rpm) {
      return false;
    }

    // Size in inch (string or number equality)
    if (filters.size_inch !== undefined) {
      const prodVal = product['size_inch'];
      if (
        prodVal === undefined ||
        String(prodVal).toLowerCase() !== String(filters.size_inch).toLowerCase()
      ) {
        return false;
      }
    }

    // Connection type includes
    if (filters.connection_types || filters.aansluiting) {
      const arr = product.connection_types || product['connection_types'] || [];
      const filterVal = String(filters.connection_types ?? filters.aansluiting);
      if (!Array.isArray(arr) || !arr.map(String).includes(filterVal)) {
        return false;
      }
    }

    // Length meters
    if (filters.length_m !== undefined && product['length_m'] !== filters.length_m) {
      return false;
    }

    // Materials includes string
    if (filters.materials) {
      const mats = product['materials'];
      if (!Array.isArray(mats) || !mats.map((m: any) => String(m).toLowerCase()).includes(String(filters.materials).toLowerCase())) {
        return false;
      }
    }

    // Weight
    if (filters.weight_kg !== undefined && product.weight_kg !== filters.weight_kg) {
      return false;
    }

    // Volume
    if (filters.volume_l !== undefined && product['volume_l'] !== filters.volume_l) {
      return false;
    }

    // Vlotter boolean
    if (filters.vlotter !== undefined) {
      const pv = product['vlotter'];
      if (Boolean(pv) !== Boolean(filters.vlotter)) {
        return false;
      }
    }

    // Debiet m3/h
    if (filters.debiet_m3_h !== undefined && product['debiet_m3_h'] !== filters.debiet_m3_h) {
      return false;
    }
    
    // Filter by image availability
    if (filters.hasImages === true) {
      const hasMedia = product.media && Array.isArray(product.media) && product.media.length > 0;
      const hasImagePaths = product.image_paths && Array.isArray(product.image_paths) && product.image_paths.length > 0;
      
      if (!hasMedia && !hasImagePaths) {
        return false;
      }
    }
    
    // Search in multiple fields (case-insensitive)
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      
      // Check multiple fields for search matches
      const searchFields = [
        product.name,
        product.description,
        product.sku,
        product.product_category,
        // Add any other fields you want to search in
      ];
      
      // Check if any field contains the search term
      const hasMatch = searchFields.some(field => 
        field && field.toString().toLowerCase().includes(searchLower)
      );
      
      if (!hasMatch) {
        return false;
      }
    }
    
    return true;
  });
}

// Helper function to sort products
function sortProducts(products: Product[], sortBy: string, sortOrder: 'asc' | 'desc'): Product[] {
  return [...products].sort((a, b) => {
    let valueA = a[sortBy as keyof Product] as any;
    let valueB = b[sortBy as keyof Product] as any;

    // Handle undefined/null values by pushing them last in asc, first in desc
    const aUndef = valueA === undefined || valueA === null;
    const bUndef = valueB === undefined || valueB === null;
    if (aUndef && bUndef) return 0;
    if (aUndef) return sortOrder === 'asc' ? 1 : -1;
    if (bUndef) return sortOrder === 'asc' ? -1 : 1;

    // Numeric compare if both are numbers
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    }

    // Try to parse numeric strings
    const numA = Number(valueA);
    const numB = Number(valueB);
    const bothNumeric = !isNaN(numA) && !isNaN(numB);
    if (bothNumeric) {
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    }

    // Fallback: string compare (case-insensitive)
    const strA = String(valueA).toLowerCase();
    const strB = String(valueB).toLowerCase();
    return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export async function writeProductsFile(products: Product[]) {
  const filePath = path.resolve(process.cwd(), 'public', 'data', 'products_for_shop.json');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(products, null, 2), 'utf-8');
}

async function logAdminActivity(entry: Record<string, any>) {
  try {
    const logDir = path.resolve(process.cwd(), 'public', 'data');
    await fs.mkdir(logDir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    await fs.appendFile(path.join(logDir, 'admin_activity.log'), line, 'utf-8');
  } catch {}
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseQueryParams(searchParams);

    console.log('Fetching products with filters:', JSON.stringify(filters, null, 2));
    
    // Load products from the data source
    const allProducts = await getProducts();
    
    // Apply filters
    const filteredProducts = filterProducts(allProducts, filters);
    
    // Apply sorting
    const sortedProducts = sortProducts(
      filteredProducts,
      filters.sortBy || 'name',
      filters.sortOrder || 'asc'
    );
    
    // Apply pagination
    const page = Math.floor((filters.skip || 0) / (filters.limit || 24)) + 1;
    const limit = filters.limit || 24;
    const skip = (page - 1) * limit;
    const total = sortedProducts.length;
    const totalPages = Math.ceil(total / limit);
    
    const paginatedProducts = sortedProducts.slice(skip, skip + limit);
    
    // Prepare and return the response
    return NextResponse.json({
      products: paginatedProducts,
      total,
      page,
      limit,
      totalPages,
      hasMore: skip + limit < total,
      filters,
    });
    
  } catch (error) {
    console.error('Error in /api/products:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.message : 'Unknown error',
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error instanceof Error ? error.stack : undefined 
        })
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};

    let incoming: any[] = [];
    if (Array.isArray(body)) incoming = body;
    else if (Array.isArray(body?.products)) incoming = body.products;
    else if (body && typeof body === 'object') incoming = [body];

    if (!incoming.length) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 });
    }

    const sanitize = (v: any, max = 500) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      return s.slice(0, max);
    };

    const normalized: any[] = [];
    for (const item of incoming) {
      if (!item || typeof item !== 'object') continue;
      const sku = sanitize(item.sku, 120);
      const name = sanitize(item.name, 200);
      const product_category = sanitize(item.product_category, 120);
      if (!sku || !name || !product_category) {
        return NextResponse.json({ error: 'Invalid product: requires sku, name, product_category' }, { status: 400 });
      }
      const out: any = { ...item, sku, name, product_category };
      if (typeof item.description !== 'undefined') out.description = sanitize(item.description, 5000);
      if (typeof item.pdf_source !== 'undefined') out.pdf_source = sanitize(item.pdf_source, 1000);
      if (typeof item.price !== 'undefined') {
        const p = typeof item.price === 'string' ? parseFloat(item.price.replace(',', '.')) : Number(item.price);
        if (!Number.isNaN(p) && Number.isFinite(p)) out.price = p;
        else delete out.price;
      }
      normalized.push(out);
    }

    const existing = await getProducts();
    const bySku = new Map(existing.map(p => [p.sku, p] as const));

    for (const item of normalized) {
      const sku = String(item.sku || '').trim();
      if (!sku) continue;
      const next: Product = {
        ...(bySku.get(sku) || {} as Product),
        ...item,
        sku,
      } as Product;
      bySku.set(sku, next);
    }

    const updated = Array.from(bySku.values());

    try {
      const dataDir = path.resolve(process.cwd(), 'public', 'data');
      const backupsDir = path.join(dataDir, 'backups');
      await fs.mkdir(backupsDir, { recursive: true });
      const currentPath = path.join(dataDir, 'Product_pdfs_analysis_v2.json');
      const backupPath = path.join(backupsDir, `products-${new Date().toISOString().replace(/[:]/g,'-')}.json`);
      try {
        const current = await fs.readFile(currentPath, 'utf-8');
        await fs.writeFile(backupPath, current, 'utf-8');
      } catch {}
    } catch {}

    await writeProductsFile(updated);

    await logAdminActivity({
      action: 'products_post',
      by: (session?.user as any)?.aliasEmail || session?.user?.email,
      count: normalized.length,
    });

    return NextResponse.json({ ok: true, count: normalized.length });
  } catch (error) {
    console.error('Error writing products:', error);
    return NextResponse.json({ error: 'Failed to write products' }, { status: 500 });
  }
}
