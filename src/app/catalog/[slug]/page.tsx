'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import catalogProductsData from '@/data/catalog_products.json';

const catalogProducts = catalogProductsData as any[];

export default function CatalogProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Find product by SKU (slug) - use optional chaining for seo
    const found = catalogProducts.find((p: any) => 
      p.seo?.slug === slug || 
      p.sku?.toLowerCase() === slug.toLowerCase() ||
      p.id === slug
    );
    setProduct(found);
    setLoading(false);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#00ADEF', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  const pdfHref = (() => {
    const src = String(product?.pdf_source || '').trim();
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/')) return src;
    return `/documents/${src}`;
  })();

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Product Not Found</h1>
          <Link href="/catalog" className="hover:underline" style={{ color: '#00ADEF' }}>
            ← Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <Link href="/" className="hover:underline" style={{ color: '#00ADEF' }}>Home</Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link href="/catalog" className="hover:underline" style={{ color: '#00ADEF' }}>Catalog</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-600">{product.sku}</span>
        </nav>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            {/* Image Gallery */}
            <div>
              <div className="bg-gray-100 rounded-lg p-8 mb-4 aspect-square flex items-center justify-center">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.sku}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-gray-400 text-6xl">📦</div>
                )}
              </div>

              {/* Additional Images */}
              {product.image_paths && product.image_paths.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.image_paths.slice(1, 5).map((img: string, idx: number) => (
                    <div key={idx} className="bg-gray-100 rounded aspect-square p-2">
                      <img
                        src={img}
                        alt={`${product.sku} ${idx + 2}`}
                        className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {product.sku}
              </h1>
              
              <div className="mb-6">
                <span className="inline-block px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: '#00ADEF' }}>
                  📁 {product.catalog}
                </span>
              </div>

              <p className="text-gray-600 text-lg mb-6">
                {product.description}
              </p>

              {/* Product Attributes */}
              <div className="border-t pt-6 mb-6">
                <h3 className="font-semibold text-lg mb-4">📄 Source Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Catalog:</span>
                    <span className="font-medium">{product.pdf_source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pages:</span>
                    <span className="font-medium">{product.source_pages.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Images:</span>
                    <span className="font-medium">{product.image_paths?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* PDF Links */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-4">📑 View in Catalog</h3>
                <div className="flex flex-wrap gap-2">
                  {product.source_pages.map((page: number) => (
                    <a
                      key={page}
                      href={pdfHref ? `${pdfHref}#page=${page}` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-white rounded-lg transition"
                      style={{ backgroundColor: '#00ADEF' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0099D6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00ADEF'}
                    >
                      Page {page}
                    </a>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button className="flex-1 text-white px-6 py-3 rounded-lg font-semibold transition" style={{ backgroundColor: '#00ADEF' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0099D6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00ADEF'}>
                  Request Quote
                </button>
                <a
                  href={pdfHref || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 border-2 rounded-lg font-semibold transition"
                  style={{ borderColor: '#e5e7eb' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00ADEF'; e.currentTarget.style.color = '#00ADEF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = ''; }}
                >
                  📄 Download PDF
                </a>
              </div>
            </div>
          </div>

          {/* All Product Images */}
          {product.image_paths && product.image_paths.length > 0 && (
            <div className="border-t p-8">
              <h2 className="text-2xl font-bold mb-6">🖼️ All Product Images</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {product.image_paths.map((img: string, idx: number) => (
                  <div key={idx} className="bg-gray-100 rounded-lg p-4 aspect-square">
                    <img
                      src={img}
                      alt={`${product.sku} ${idx + 1}`}
                      className="w-full h-full object-contain cursor-pointer hover:scale-105 transition"
                      onClick={() => window.open(img, '_blank')}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Back to Catalog */}
        <div className="mt-8 text-center">
          <Link
            href="/catalog"
            className="inline-block hover:underline text-lg"
            style={{ color: '#00ADEF' }}
          >
            ← Back to Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
