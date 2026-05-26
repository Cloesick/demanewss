'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cartStore';
import { Product } from '@/types/product';
import Link from 'next/link';
import { useLocale } from '@/contexts/LocaleContext';
import ProductCard from '@/components/products/ProductCard';
import ProductSpecsWithIcons from '@/components/products/ProductSpecsWithIcons';
import { formatProductForCard } from '@/lib/formatProductForCard';

// This is a client component that will be hydrated on the client
export default function ProductPage() {
  const params = useParams();
  const { t, locale } = useLocale();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Product[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const searchParams = useSearchParams();
  const editMode = searchParams?.get('editImage') === '1';
  const [pendingCrop, setPendingCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Normalize incoming pdf_source values to a usable URL
  function makePdfUrl(src?: string | null): string | null {
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/')) return src; // already absolute within site
    // assume bare filename within public/documents/Product_pdfs
    return `/documents/Product_pdfs/${src}`;
  }

  function translateKnownPhrases(html: string, loc: string): string {
    if (!html) return html;
    const pattern = /<li>\s*VOOR\s+PARTICULIERE\s+GEBRUIKERS\s+HOGEDRUKREINIGER[\s\S]*?<\/li>/i;
    const replacements: Record<string, string> = {
      en: '<li>FOR PRIVATE USERS HIGH-PRESSURE CLEANER | COLD WATER | PRIVATE USERS K 1050 series COMFORTABLE HOSE REEL (TST) space-saving storage of the high-pressure hose - with foldable handle MODEL K 1050 P K 1050 TS K 1050 TST Item no. 49501 495051 495101 STORAGE SYSTEM TECHNICAL DATA practical storage of Model portable with hose holder with hose reel high-pressure gun and spray lances Working pressure bar | MPa 130 | 13 130 | 13 130 | 13 Flow rate l/min | l/h 7.5 | 450 7.5 | 450 7.5 | 450 PORTABLE VERSION Permissible overpressure bar | MPa 160 | 16 160 | 16 160 | 16 Motor speed rpm 2800 2800 2800 Connection V | ~ | Hz | A 230 | 1 | 50 | 9.6 230 | 1 | 50 | 9.6 230 | 1 | 50 | 9.6 Power input | output kW 2.2 | 1.65 2.2 | 1.65 2.2 | 1.65 Power cable m 5 5 5 Dimensions L | W | H mm 390 | 290 | 370 340 | 350 | 860 340 | 350 | 860 OFF-ROAD CHASSIS robust chassis for easy transport and high stability EQUIPMENT High-pressure hose m | Item no. 8 (DN6) | 410541 8 (DN6) | 410541 12 (DN6) | 49116 Gun with safety lock Model | Item no. M2001 | 12475 M2001 | 12475 M2001 | 12475 Lance with flat jet Nozzle | Item no.</li>',
      nl: '<li>VOOR PARTICULIERE GEBRUIKERS HOGEDRUKREINIGER | KOUDWATER | PARTICULIERE GEBRUIKERS K 1050-serie COMFORTABELE SLANGHASPEL (TST) plaatsbesparende opslag van de hogedrukslang - met inklapbare hendel MODEL K 1050 P K 1050 TS K 1050 TST Art.-nr. 49501 495051 495101 OPBERGSYSTEEM TECHNISCHE GEGEVENS praktische opslag van Model draagbaar met slangopname met slanghaspel hogedrukpistool en spuitlansen Werkdruk bar | MPa 130 | 13 130 | 13 130 | 13 Doorloopcapaciteit l/min | l/h 7.5 | 450 7.5 | 450 7.5 | 450 DRAAGBARE VERSIE Toegelaten overdruk bar | MPa 160 | 16 160 | 16 160 | 16 Motortoerental tpm 2800 2800 2800 Aansluiting V | ~ | Hz | A 230 | 1 | 50 | 9.6 230 | 1 | 50 | 9.6 230 | 1 | 50 | 9.6 Vermogenopname | afgifte kW 2.2 | 1.65 2.2 | 1.65 2.2 | 1.65 Aansluitkabel m 5 5 5 Afmetingen L | B | H mm 390 | 290 | 370 340 | 350 | 860 340 | 350 | 860 OFF-ROAD CHASSIS Gewicht kg 21 23 26 robuust chassis voor eenvoudig transport en hoge stabiliteit UITRUSTING Hogedrukslang m | Art.-nr. 8 (DN6) | 410541 8 (DN6) | 410541 12 (DN6) | 49116 Pistool met uitschakelbeveiliging Model | Art.-nr. M2001 | 12475 M2001 | 12475 M2001 | 12475 Lans met vlakstraal Nozzel | Art.-nr.</li>',
      fr: '<li>POUR UTILISATEURS PRIVÉS NETTOYEUR HAUTE PRESSION | EAU FROIDE | UTILISATEURS PRIVÉS SÉRIE K 1050 ENROULEUR DE TUYAU CONFORT (TST) rangement peu encombrant du tuyau haute pression - avec poignée rabattable MODÈLE K 1050 P K 1050 TS K 1050 TST Réf. 49501 495051 495101 SYSTÈME DE RANGEMENT DONNÉES TECHNIQUES rangement pratique du pistolet haute pression et des lances Modèle portable avec support de tuyau avec enrouleur de tuyau Pression de service bar | MPa 130 | 13 130 | 13 130 | 13 Débit l/min | l/h 7.5 | 450 7.5 | 450 7.5 | 450 VERSION PORTABLE Surpression admissible bar | MPa 160 | 16 160 | 16 160 | 16 Vitesse du moteur tr/min 2800 2800 2800 Raccordement V | ~ | Hz | A 230 | 1 | 50 | 9.6 230 | 1 | 50 | 9.6 230 | 1 | 50 | 9.6 Puissance absorbée | restituée kW 2.2 | 1.65 2.2 | 1.65 2.2 | 1.65 Câble d’alimentation m 5 5 5 Dimensions L | l | H mm 390 | 290 | 370 340 | 350 | 860 340 | 350 | 860 CHÂSSIS TOUT-TERRAIN châssis robuste pour un transport aisé et une grande stabilité ÉQUIPEMENT Tuyau haute pression m | Réf. 8 (DN6) | 410541 8 (DN6) | 410541 12 (DN6) | 49116 Pistolet avec sécurité Modèle | Réf. M2001 | 12475 M2001 | 12475 M2001 | 12475 Lance à jet plat Buse | Réf.</li>',
    };
    const repl = replacements[loc as keyof typeof replacements] || replacements.en;
    return html.replace(pattern, repl);
  }

  useEffect(() => {
    const sku = Array.isArray(params.sku) ? params.sku[0] : params.sku;
    
    if (!sku) {
      setError('No product SKU provided');
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/products?sku=${encodeURIComponent(String(sku))}&limit=1`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Not JSON response');
        }
        const data = await res.json();
        const productData: Product | undefined = data?.products?.[0];
        if (!productData) {
          setError('Product not found');
          setProduct(null);
          return;
        }
        setProduct(productData);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.sku]);

  // Reset active image when product changes
  useEffect(() => {
    setActiveImageIndex(0);
  }, [product?.sku]);

  useEffect(() => {
    const sku = Array.isArray(params.sku) ? params.sku[0] : params.sku;
    if (!sku) return;
    setRecsLoading(true);
    const fetchBySku = async () => {
      try {
        const r = await fetch(`/api/recommendations?sku=${encodeURIComponent(String(sku))}&limit=4`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`REC ${r.status}`);
        const contentType = r.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Not JSON response');
        }
        const data = await r.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (items.length > 0) {
          setRecs(items);
          return;
        }
        // Fallback by category if available
        if (product?.product_category) {
          const r2 = await fetch(`/api/recommendations?category=${encodeURIComponent(product.product_category)}&limit=4`, { cache: 'no-store' });
          if (r2.ok) {
            const contentType2 = r2.headers.get('content-type');
            if (contentType2 && contentType2.includes('application/json')) {
              const d2 = await r2.json();
              const catItems = Array.isArray(d2?.items) ? d2.items : [];
              if (catItems.length > 0) {
                setRecs(catItems);
                return;
              }
            }
          }
        }
        // Final fallback: top-rated/in-stock products
        const r3 = await fetch(`/api/products?limit=4`, { cache: 'no-store' });
        if (r3.ok) {
          const contentType3 = r3.headers.get('content-type');
          if (contentType3 && contentType3.includes('application/json')) {
            const d3 = await r3.json();
            const p3 = Array.isArray(d3?.products) ? d3.products : [];
            setRecs(p3);
            return;
          }
        }
        setRecs([]);
      } catch {
        // Fallback on error
        if (product?.product_category) {
          fetch(`/api/recommendations?category=${encodeURIComponent(product.product_category)}&limit=4`, { cache: 'no-store' })
            .then(async r2 => {
              if (!r2.ok) throw new Error('REC fallback');
              const contentType = r2.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Not JSON response');
              }
              const d2 = await r2.json();
              const catItems = Array.isArray(d2?.items) ? d2.items : [];
              if (catItems.length > 0) {
                setRecs(catItems);
                return;
              }
              // Final fallback
              return fetch(`/api/products?limit=4`, { cache: 'no-store' })
                .then(async r3 => {
                  if (!r3.ok) throw new Error('REC final');
                  const contentType3 = r3.headers.get('content-type');
                  if (!contentType3 || !contentType3.includes('application/json')) {
                    throw new Error('Not JSON response');
                  }
                  const d3 = await r3.json();
                  const p3 = Array.isArray(d3?.products) ? d3.products : [];
                  setRecs(p3);
                });
            })
            .catch(() => setRecs([]))
            .finally(() => setRecsLoading(false));
          return;
        }
        setRecs([]);
      } finally {
        setRecsLoading(false);
      }
    };
    fetchBySku();
  }, [params.sku, product?.product_category]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{t('product.error.title')}</h1>
          <p className="mt-2">{error || t('product.error.not_found')}</p>
        </div>
      </div>
    );
  }

  // Generate a placeholder color based on product SKU or category
  const getPlaceholderColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 90%)`;
  };

  const categoryForImage = product.product_category?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'product';
  const placeholderColor = getPlaceholderColor(product.sku || categoryForImage);
  const placeholderImageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='${encodeURIComponent(placeholderColor)}'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3E${encodeURIComponent(categoryForImage)}%3C/text%3E%3C/svg%3E`;
  const legacySkuImageUrl = product.sku ? `/product-images/${product.sku}.webp` : undefined;
  const imageUrl = product.imageUrl || legacySkuImageUrl || placeholderImageUrl;
  
  const priceNumber = product.dimensions_mm_list?.[0]
    ? product.dimensions_mm_list[0] * 0.5
    : 99.99;
  
  // Client component for cart functionality
  function AddToCart({ product }: { product: Product }) {
    const addToCart = useCartStore((state) => state.addToCart);
    
    return (
      <Button 
        onClick={() => addToCart(product)}
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
      >
        {t('product.add_to_cart')}
      </Button>
    );
  }

  // Simple crop overlay (kept for future use, currently not active)
  function CropOverlay({ canvasSize, initial, onChange }: { canvasSize: { w: number; h: number }; initial?: { x: number; y: number; width: number; height: number } | null; onChange: (c: { x: number; y: number; width: number; height: number } | null) => void }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [start, setStart] = useState<{ x: number; y: number } | null>(null);
    const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(initial || null);

    useEffect(() => { setCrop(initial || null); }, [initial?.x, initial?.y, initial?.width, initial?.height]);

    function normRect(a: number, b: number, c: number, d: number) {
      const x = Math.max(0, Math.min(a, c));
      const y = Math.max(0, Math.min(b, d));
      const w = Math.abs(c - a);
      const h = Math.abs(d - b);
      return { x, y, w, h };
    }

    const onMouseDown = (e: React.MouseEvent) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      setDragging(true);
      setStart({ x: px, y: py });
    };
    const onMouseMove = (e: React.MouseEvent) => {
      if (!dragging || !start) return;
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      const r = normRect(start.x, start.y, px, py);
      const n = { x: r.x / canvasSize.w, y: r.y / canvasSize.h, width: r.w / canvasSize.w, height: r.h / canvasSize.h };
      setCrop(n);
      onChange(n);
    };
    const onMouseUp = () => { setDragging(false); setStart(null); };

    const styleRect: React.CSSProperties | undefined = crop
      ? { position: 'absolute', left: `${(crop.x) * 100}%`, top: `${(crop.y) * 100}%`, width: `${(crop.width) * 100}%`, height: `${(crop.height) * 100}%`, border: '2px solid #2563eb', background: 'rgba(37,99,235,0.1)', pointerEvents: 'none' }
      : undefined;

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {crop && <div style={styleRect} />}
      </div>
    );
  }


  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back to results */}
        <div className="mb-3">
          <Link href="/products" className="text-sm text-primary hover:underline">
            ← {t('products.back_to_results')}
          </Link>
        </div>

        {/* Breadcrumbs */}
        <nav className="text-xs text-gray-500 mb-4" aria-label="Breadcrumb">
          <ol className="list-none p-0 inline-flex gap-1">
            <li>
              <Link href="/" className="hover:underline">{t('nav.home')}</Link>
              <span className="mx-1">/</span>
            </li>
            <li>
              <Link href="/products" className="hover:underline">{t('nav.products')}</Link>
              <span className="mx-1">/</span>
            </li>
            <li aria-current="page" className="text-gray-700 font-medium truncate max-w-[50ch]">
              {formatProductForCard(product).title}
            </li>
          </ol>
        </nav>
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Product Image: use server-resolved imageUrl (SKU/PDF/page) or placeholder */}
          <div className="mb-8 lg:mb-0">
            <div className="bg-gray-100 rounded-lg overflow-hidden">
              <div className="relative w-full h-[420px] sm:h-[480px] lg:h-[560px] flex flex-col bg-gray-100 p-2">
                <div className="relative flex-1 flex items-center justify-center">
                  <Image
                    src={imageUrl}
                    alt={product.description || product.sku}
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target && target.src !== placeholderImageUrl) {
                        target.src = placeholderImageUrl;
                      }
                    }}
                  />
                </div>

                {/* Thumbnail strip intentionally disabled while locking to server-resolved imageUrl */}
              </div>
            </div>
          </div>
          
          {/* Product Info */}
          <div className="lg:pl-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {(() => {
                const baseTitle = formatProductForCard(product).title;
                const skuText = product.sku || '';
                if (skuText && baseTitle && !baseTitle.toLowerCase().includes(skuText.toLowerCase())) {
                  return `${baseTitle} ${skuText}`;
                }
                return baseTitle || skuText;
              })()}
            </h1>
            <p className="text-gray-500 text-sm mb-4">{t('product.sku')}: {product.sku}</p>
            
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {formatCurrency(priceNumber)}
              </h2>
              <p className="text-green-600 text-sm mt-1">{t('product.in_stock')}</p>
            </div>
            
            {product.description && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900">{t('product.description')}</h3>
                <div className="prose prose-sm max-w-none text-gray-800">
                  {product.description.split('\n').map((paragraph, i) => (
                    <p key={i} className="mb-3">{paragraph}</p>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-6">
              {/* Use ProductSpecsWithIcons for Makita products with specs */}
              {(product.brand === 'Makita' || product.catalog?.toLowerCase().includes('makita')) && 
               product.specs && product.specs.length > 0 ? (
                <ProductSpecsWithIcons product={product as any} />
              ) : (
                <>
                  <h3 className="text-sm font-medium text-gray-900">{t('product.technical_specs')}</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-700">
                {product.product_category && (
                  <>
                    <dt className="font-medium">{t('filters.categories')}</dt>
                    <dd>{product.product_category}</dd>
                  </>
                )}
                {(product.pressure_min_bar || product.pressure_max_bar) && (
                  <>
                    <dt className="font-medium">{t('product.pressure_range')}</dt>
                    <dd>
                      {product.pressure_min_bar ? `${product.pressure_min_bar}–` : ''}
                      {product.pressure_max_bar ? `${product.pressure_max_bar}` : ''} bar
                    </dd>
                  </>
                )}
                {((product as any).overpressure_bar || (product as any).overpressure_mpa) && (
                  <>
                    <dt className="font-medium">{t('product.overpressure')}</dt>
                    <dd>
                      {typeof (product as any).overpressure_bar === 'number' ? `${(product as any).overpressure_bar} bar` : ''}
                      {(product as any).overpressure_bar && (product as any).overpressure_mpa ? ' • ' : ''}
                      {typeof (product as any).overpressure_mpa === 'number' ? `${(product as any).overpressure_mpa} MPa` : ''}
                    </dd>
                  </>
                )}
                {product.power_kw && (
                  <>
                    <dt className="font-medium">{t('product.power')}</dt>
                    <dd>{product.power_kw} kW</dd>
                  </>
                )}
                {((product as any).power_input_kw || (product as any).power_output_kw) && (
                  <>
                    <dt className="font-medium">Power In/Out</dt>
                    <dd>
                      {typeof (product as any).power_input_kw === 'number' ? `${(product as any).power_input_kw}` : ''}
                      {(product as any).power_input_kw && (product as any).power_output_kw ? ' / ' : ''}
                      {typeof (product as any).power_output_kw === 'number' ? `${(product as any).power_output_kw}` : ''} kW
                    </dd>
                  </>
                )}
                {product.voltage_v && (
                  <>
                    <dt className="font-medium">Voltage</dt>
                    <dd>{product.voltage_v} V</dd>
                  </>
                )}
                {(product.frequency_hz || (product as any).phase_count || (product as any).current_a) && (
                  <>
                    <dt className="font-medium">Electrical</dt>
                    <dd>
                      {product.voltage_v ? `${product.voltage_v}V ` : ''}
                      {(product as any).phase_count ? `~${(product as any).phase_count} ` : ''}
                      {product.frequency_hz ? `${product.frequency_hz}Hz ` : ''}
                      {(product as any).current_a ? `${(product as any).current_a}A` : ''}
                    </dd>
                  </>
                )}
                {(product.flow_l_min || (product as any).flow_l_h || product.debiet_m3_h) && (
                  <>
                    <dt className="font-medium">Flow</dt>
                    <dd>
                      {typeof product.flow_l_min === 'number' ? `${product.flow_l_min} L/min` : ''}
                      {product.flow_l_min && (product as any).flow_l_h ? ' • ' : ''}
                      {typeof (product as any).flow_l_h === 'number' ? `${(product as any).flow_l_h} L/h` : ''}
                      {!product.flow_l_min && !(product as any).flow_l_h && typeof product.debiet_m3_h === 'number' ? `${product.debiet_m3_h} m³/h` : ''}
                    </dd>
                  </>
                )}
                {product.absk_codes && product.absk_codes.length > 0 && (
                  <>
                    <dt className="font-medium">ABSK Codes</dt>
                    <dd className="break-words">{product.absk_codes.join(', ')}</dd>
                  </>
                )}
                {product.weight_kg && (
                  <>
                    <dt className="font-medium">Weight</dt>
                    <dd>{product.weight_kg} kg</dd>
                  </>
                )}
                {Array.isArray(product.materials) && product.materials.length > 0 && (
                  <>
                    <dt className="font-medium">Materials</dt>
                    <dd>{product.materials.join(', ')}</dd>
                  </>
                )}
                {(product.length_mm || product.width_mm || product.height_mm) && (
                  <>
                    <dt className="font-medium">Dimensions</dt>
                    <dd>
                      {product.length_mm ? `${product.length_mm}` : ''}
                      {(product.length_mm && product.width_mm) ? '×' : ''}
                      {product.width_mm ? `${product.width_mm}` : ''}
                      {(product.width_mm && product.height_mm) ? '×' : ''}
                      {product.height_mm ? `${product.height_mm}` : ''} mm
                    </dd>
                  </>
                )}
                {(product as any).rpm && (
                  <>
                    <dt className="font-medium">Motor Speed</dt>
                    <dd>{(product as any).rpm} rpm</dd>
                  </>
                )}
                {(product as any).cable_length_m && (
                  <>
                    <dt className="font-medium">Cable Length</dt>
                    <dd>{(product as any).cable_length_m} m</dd>
                  </>
                )}
                {product.dimensions_mm_list && product.dimensions_mm_list.length > 0 && (
                  <>
                    <dt className="font-medium">Available Sizes</dt>
                    <dd>{product.dimensions_mm_list.join('mm, ')}mm</dd>
                  </>
                )}
              </dl>
                </>
              )}
            </div>
            
            <div className="mt-6" id="pdf">
              <h3 className="text-sm font-medium text-gray-900">{t('product.details')}</h3>
              <div className="mt-2 space-y-3">
                {product.pdf_source && (
                  <div>
                    <p className="text-sm text-gray-500">{t('product.pdf_source')}</p>
                    <a
                      href={`${product.pdf_source}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline rounded"
                    >
                      <span>{(() => { try { const u = new URL(product.pdf_source); return decodeURIComponent(u.pathname.split('/').pop() || 'PDF'); } catch (e) { const p = product.pdf_source.split('?')[0]; return decodeURIComponent((p.split('/').pop() || 'PDF')); } })()}</span>
                      
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
                {product.pdf_source && product.source_pages && product.source_pages.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">{t('product.pdf_page')}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {product.source_pages.map((p) => (
                        <a
                          key={`page-${p}`}
                          href={`${product.pdf_source}#page=${p}&search=${encodeURIComponent(product.sku)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline rounded"
                        >
                          {t('product.page')} {p}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8">
              <AddToCart product={product} />
            </div>
            
            {(Array.isArray((product as any).features) && (product as any).features.length > 0) && (
              <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{t('product.features')}</h2>
                </div>
                <div className="p-6">
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {(product as any).features.slice(0, 12).map((f: string, i: number) => (
                      <li key={`pfeat-${i}`}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center text-sm text-gray-500">
              <svg className="flex-shrink-0 mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>{t('product.shipping.free_over_100')}</span>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <svg className="flex-shrink-0 mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{t('product.delivery.2_3_days')}</span>
            </div>
          </div>
        </div>
        
        {/* Related Products */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('product.related')}</h2>
          {recsLoading && (
            <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="group relative animate-pulse">
                  <div className="w-full min-h-80 bg-gray-200 rounded-md overflow-hidden"></div>
                  <div className="mt-4 flex justify-between">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!recsLoading && (
            <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
              {recs.length > 0 ? (
                recs.map((rp) => (
                  <ProductCard key={rp.sku} product={rp} viewMode="grid" />
                ))
              ) : (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="group relative animate-pulse">
                    <div className="w-full min-h-80 bg-gray-200 rounded-md overflow-hidden"></div>
                    <div className="mt-4 flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
