'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuote } from '@/contexts/QuoteContext';
import { useProductTranslation } from '@/hooks/useProductTranslation';
import { getSkuImagePath } from '@/lib/skuImageMap';
import UniversalSpecifications from './UniversalSpecifications';

interface CatalogProductCardProps {
  product: any;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export default function CatalogProductCard({ 
  product, 
  viewMode = 'grid',
  className = '' 
}: CatalogProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [skuImagePath, setSkuImagePath] = useState<string | null>(null);
  const { addToQuote } = useQuote();
  const { productName: getProductName, categoryName, uiText } = useProductTranslation();

  const pdfHref = (() => {
    const src = String(product?.pdf_source || '').trim();
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('/')) return src;
    return `/documents/${src}`;
  })();

  // Load SKU-specific image from extracted PDFs
  useEffect(() => {
    if (product?.sku) {
      getSkuImagePath(product.sku).then(path => {
        setSkuImagePath(path);
        if (path) setImageError(false);
      });
    }
  }, [product?.sku]);

  // Get image URL from various possible sources (SKU image takes priority)
  const imageUrl = skuImagePath ||
                   product.imageUrl || 
                   product.media?.find((m: any) => m.role === 'main')?.url ||
                   product.image_paths?.[0];

  // Product name/title - with multi-language support
  const productName = getProductName(product);
  const category = product.catalog || product.category || product.product_category || '';
  const translatedCategory = category ? categoryName(category) : '';
  
  // Check if Makita product
  const isMakita = product.brand === 'Makita' || product.catalog === 'makita' || category.toLowerCase().includes('makita');
  
  // Check if request quote
  const isRequestQuote = product.priceMode === 'request_quote' || !product.price;

  if (viewMode === 'list') {
    return (
      <div className={`flex flex-col sm:flex-row bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${
        isMakita ? 'border-2 border-teal-500 ring-2 ring-teal-100' : 'border border-gray-200'
      } ${className}`}>
        {/* Image */}
        <Link 
          href={`/catalog/${product.seo?.slug || product.sku.toLowerCase()}`}
          className={`w-full sm:w-56 h-56 sm:h-full flex-shrink-0 flex items-center justify-center p-4 relative ${
            isMakita ? 'bg-gradient-to-br from-teal-50 to-teal-100' : 'bg-white'
          }`}
        >
          {isMakita && (
            <div className="absolute top-2 left-2 bg-teal-600 text-white px-2 py-1 rounded-md text-xs font-bold z-10">
              MAKITA
            </div>
          )}
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={productName}
              className="w-full h-full object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col">
          <Link 
            href={`/catalog/${product.seo?.slug || product.sku.toLowerCase()}`}
            className="block"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2 transition hover:text-[#00ADEF]">
              {productName}
            </h3>
          </Link>
          
          {translatedCategory && (
            <p className="text-sm text-gray-600 mb-2">📁 {translatedCategory}</p>
          )}
          
          {product.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {product.description}
            </p>
          )}

          {/* Universal Technical Specifications - All Catalogs */}
          <UniversalSpecifications product={product} compact={false} />

          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              {product.images?.length > 1 && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  🖼️ {product.images.length} images
                </span>
              )}
              {product.pages?.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  📄 Page {product.pages.join(', ')}
                </span>
              )}
            </div>
            
            {isRequestQuote ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Request Quote clicked!', { sku: product.sku, name: productName });
                  try {
                    addToQuote({
                      sku: product.sku,
                      name: productName,
                      imageUrl,
                      category
                    });
                    console.log('Added to quote successfully');
                    // Visual feedback
                    setJustAdded(true);
                    setTimeout(() => setJustAdded(false), 1000);
                  } catch (error) {
                    console.error('Error adding to quote:', error);
                  }
                }}
                className={`px-3 py-1.5 text-white text-sm font-semibold rounded transition ${
                  justAdded 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {justAdded ? '✓ Added!' : 'Request Quote'}
              </button>
            ) : product.price ? (
              <span className="text-lg font-bold text-gray-900">€{product.price.toFixed(2)}</span>
            ) : null}
          </div>

          {/* PDF Links */}
          {pdfHref && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3">
              {/* Link to full PDF catalog */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(pdfHref, '_blank', 'noopener,noreferrer');
                }}
                className="text-xs text-blue-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Full catalog
              </button>
              
              {/* Link to specific page with SKU highlighted */}
              {product.source_pages && product.source_pages.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const page = product.source_pages[0];
                    const pdfUrl = `${pdfHref}#page=${page}&search=${encodeURIComponent(product.sku)}`;
                    console.log('Opening PDF to page with highlight:', {
                      sku: product.sku,
                      page: page,
                      url: pdfUrl
                    });
                    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="text-xs text-red-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  🔍 View SKU on page {product.source_pages[0]}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className={`group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col ${
      isMakita ? 'border-2 border-teal-500 ring-2 ring-teal-100' : 'border border-gray-200'
    } ${className}`}>
      {/* Image */}
      <div className="relative">
        {isMakita && (
          <div className="absolute top-2 right-2 bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold z-10 shadow-lg">
            🔋 MAKITA
          </div>
        )}
        {isMakita && (
          <div className="absolute top-2 left-2 bg-yellow-400 text-gray-900 px-2 py-1 rounded-md text-xs font-bold z-10 shadow-md">
            NEW
          </div>
        )}
        <Link 
          href={`/catalog/${product.seo?.slug || product.sku.toLowerCase()}`}
          className={`w-full h-64 flex items-center justify-center p-4 ${
            isMakita ? 'bg-gradient-to-br from-teal-50 to-teal-100' : 'bg-white'
          }`}
        >
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={productName}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </Link>
        
        {/* Image count badge */}
        {product.images?.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full z-10">
            +{product.images.length - 1} more
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <Link 
          href={`/catalog/${product.seo?.slug || product.sku.toLowerCase()}`}
          className="block mb-2"
        >
          <h3 className="text-base font-bold text-gray-900 line-clamp-2 transition hover:text-[#00ADEF]">
            {productName}
          </h3>
        </Link>
        
        {category && (
          <p className="text-sm text-gray-600 mb-2 truncate">
            <span className="inline-block">📁 {category}</span>
          </p>
        )}

        {/* Universal Technical Specifications - All Catalogs */}
        <UniversalSpecifications product={product} compact={true} />

        {/* Metadata */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            {product.pages?.length > 0 && (
              <span className="text-xs text-gray-500">
                📄 Page {product.pages.join(', ')}
              </span>
            )}
          </div>

          {/* Price or Request Quote */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              {isRequestQuote ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Request Quote clicked (Grid)!', { sku: product.sku, name: productName });
                    try {
                      addToQuote({
                        sku: product.sku,
                        name: productName,
                        imageUrl,
                        category
                      });
                      console.log('Added to quote successfully (Grid)');
                      // Visual feedback
                      setJustAdded(true);
                      setTimeout(() => setJustAdded(false), 1000);
                    } catch (error) {
                      console.error('Error adding to quote (Grid):', error);
                    }
                  }}
                  className={`w-full px-3 py-1.5 text-white text-xs font-semibold rounded transition ${
                    justAdded 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {justAdded ? '✓ Added!' : 'Request Quote'}
                </button>
              ) : product.price ? (
                <span className="text-lg font-bold text-gray-900">€{product.price.toFixed(2)}</span>
              ) : (
                <span className="text-sm text-gray-500">Price on request</span>
              )}
            </div>
            
            <button className="px-3 py-1.5 text-white text-xs font-medium rounded transition" style={{ backgroundColor: '#00ADEF' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0099D6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00ADEF'}>
              View
            </button>
          </div>
        </div>

        {/* PDF Links */}
        {pdfHref && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            {/* Link to full PDF catalog */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(pdfHref, '_blank', 'noopener,noreferrer');
              }}
              className="text-xs text-blue-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0 w-full"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              View full catalog
            </button>
            
            {/* Link to specific page with SKU highlighted */}
            {product.source_pages && product.source_pages.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const page = product.source_pages[0];
                  const pdfUrl = `${pdfHref}#page=${page}&search=${encodeURIComponent(product.sku)}`;
                  console.log('Opening PDF to page with highlight:', {
                    sku: product.sku,
                    page: page,
                    url: pdfUrl
                  });
                  window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                }}
                className="text-xs text-red-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0 w-full"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                🔍 View SKU on page {product.source_pages[0]}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
