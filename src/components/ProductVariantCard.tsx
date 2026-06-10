'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiChevronDown } from 'react-icons/fi';
import { useQuote } from '@/contexts/QuoteContext';
import { getSkuImagePath } from '@/lib/skuImageMap';
import UniversalSpecifications from '@/components/UniversalSpecifications';

// Use full Product type - no modifications to data
interface Product {
  sku: string;
  name: string;
  category?: string;
  catalog?: string;
  price?: {
    amount?: number;
    display?: string;
  };
  specs?: any[];
  description?: string;
  brand?: string;
  imageUrl?: string;
  media?: Array<{ url: string }>;
  pdf_source?: string;
  source?: {
    pages?: number[];
  };
  // Keep all other product properties intact (pressure_max_bar, length_m, etc.)
  [key: string]: any;
}

interface ProductVariantCardProps {
  imageUrl: string;
  variants: Product[]; // Full product objects, unmodified
  primarySku: string;
  viewMode?: 'grid' | 'list';
}

export default function ProductVariantCard({
  imageUrl,
  variants,
  primarySku,
  viewMode = 'grid'
}: ProductVariantCardProps) {
  const [selectedSku, setSelectedSku] = useState(primarySku);
  const [justAdded, setJustAdded] = useState(false);
  const [skuImagePath, setSkuImagePath] = useState<string | null>(null);
  const { addToQuote } = useQuote();
  
  // Load SKU-specific image from extracted PDFs
  useEffect(() => {
    if (selectedSku) {
      getSkuImagePath(selectedSku).then(path => {
        setSkuImagePath(path);
      });
    }
  }, [selectedSku]);
  
  // Find selected product
  const selectedVariant = useMemo(
    () => variants.find((v: Product) => v.sku === selectedSku) || variants[0],
    [selectedSku, variants]
  );
  
  // Helper to format variant label
  const getVariantLabel = (product: Product) => {
    return `${product.sku}${product.name !== product.sku ? ` - ${product.name}` : ''}`;
  };
  
  // Use SKU-specific image if available, otherwise fallback to passed imageUrl
  const displayImageUrl = skuImagePath || imageUrl;

  const pdfViewerHref = (pdfSource?: string, page?: number, sku?: string) => {
    const src = String(pdfSource || '').trim();
    if (!src) return null;
    const params = new URLSearchParams();
    params.set('file', src);
    if (page) params.set('page', String(page));
    if (sku) params.set('sku', sku);
    return `/pdf-viewer?${params.toString()}`;
  };
  
  const formatPrice = (priceObj?: { amount?: number; display?: string } | null) => {
    if (!priceObj) return 'Price on request';
    if (priceObj.display) return priceObj.display;
    if (priceObj.amount) return `€${priceObj.amount.toFixed(2)}`;
    return 'Price on request';
  };
  
  // Handle add to quote
  const handleAddToQuote = () => {
    addToQuote(selectedVariant);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };
  
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col sm:flex-row bg-white border-2 border-teal-100 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200">
        <div className="w-full sm:w-56 h-56 sm:h-full flex-shrink-0 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center p-4 relative">
          <Image
            src={displayImageUrl}
            alt={selectedVariant.name || 'Product'}
            width={200}
            height={200}
            className="w-full h-full object-contain"
          />
          {variants.length > 1 && (
            <div className="absolute top-2 left-2 bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              {variants.length} Variants
            </div>
          )}
        </div>
        <div className="flex-1 p-4 flex flex-col">
          {variants.length > 1 && (
            <div className="mb-3">
              <label className="text-sm font-semibold text-gray-700 mb-1 block">Select Variant:</label>
              <div className="relative">
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-teal-200 rounded-lg bg-white text-sm font-medium hover:border-teal-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition appearance-none cursor-pointer"
                >
                  {variants.map(variant => (
                    <option key={variant.sku} value={variant.sku}>{getVariantLabel(variant)}</option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}
          <Link href={`/products/${selectedVariant.sku.toLowerCase()}`} className="block">
            <h3 className="text-lg font-bold text-gray-900 mb-2 hover:text-teal-600 transition">{selectedVariant.name}</h3>
          </Link>
          <div className="text-sm text-gray-600 mb-2">SKU: <span className="font-semibold">{selectedVariant.sku}</span></div>
          {selectedVariant.catalog && (
            <p className="text-sm text-gray-600 mb-2 truncate">
              <span className="inline-block">📁 {selectedVariant.catalog}</span>
            </p>
          )}
          
          {/* Technical Specifications with Icons */}
          <div className="mb-2">
            <UniversalSpecifications product={selectedVariant} compact={true} />
          </div>
          <div className="mt-auto pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <button
                  onClick={handleAddToQuote}
                  className={`w-full px-3 py-1.5 text-white text-xs font-semibold rounded transition ${
                    justAdded ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {justAdded ? '✓ Added!' : 'Request Quote'}
                </button>
              </div>
              <Link
                href={`/products/${selectedVariant.sku.toLowerCase()}`}
                className="px-3 py-1.5 text-white text-xs font-medium rounded transition"
                style={{ backgroundColor: '#00ADEF' }}
              >
                View
              </Link>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            {selectedVariant.pdf_source && (
              <button
                type="button"
                onClick={() => {
                  const href = pdfViewerHref(selectedVariant.pdf_source, undefined, selectedVariant.sku);
                  if (href) window.open(href, '_blank', 'noopener,noreferrer');
                }}
                className="text-xs text-blue-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0 w-full"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                View full catalog
              </button>
            )}
            {selectedVariant.source?.pages?.[0] && selectedVariant.pdf_source && (
              <button
                type="button"
                onClick={() => {
                  const href = pdfViewerHref(selectedVariant.pdf_source, selectedVariant.source?.pages?.[0], selectedVariant.sku);
                  if (href) window.open(href, '_blank', 'noopener,noreferrer');
                }}
                className="text-xs text-red-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0 w-full"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                🔍 View SKU on page {selectedVariant.source?.pages?.[0]}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Grid view (default)
  return (
    <div className="group bg-white border-2 border-teal-100 rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col">
      {/* Image */}
      <div className="relative">
        {variants.length > 1 && (
          <div className="absolute top-2 right-2 bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold z-10 shadow-lg">
            {variants.length} Variants
          </div>
        )}
        <Link 
          href={`/products/${selectedVariant.sku.toLowerCase()}`}
          className="w-full h-64 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center p-4"
        >
          <Image
            src={imageUrl}
            alt={selectedVariant.name || 'Product'}
            width={300}
            height={300}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
      </div>
      
      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Variant Selector */}
        {variants.length > 1 && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              Variant:
            </label>
            <div className="relative">
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full px-2 py-1.5 border-2 border-teal-200 rounded-md bg-white text-xs font-medium hover:border-teal-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition appearance-none cursor-pointer"
              >
                {variants.map(variant => (
                  <option key={variant.sku} value={variant.sku}>
                    {variant.sku}
                  </option>
                ))}
              </select>
              <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-sm" />
            </div>
          </div>
        )}
        
        {/* Product Name */}
        <Link 
          href={`/products/${selectedVariant.sku.toLowerCase()}`}
          className="block mb-2"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition line-clamp-2 text-sm">
            {selectedVariant.name}
          </h3>
        </Link>
        
        <div className="text-xs text-gray-500 mb-2">
          SKU: {selectedVariant.sku}
        </div>
        
        {/* Category Badge */}
        {selectedVariant.catalog && (
          <p className="text-sm text-gray-600 mb-2 truncate">
            <span className="inline-block">📁 {selectedVariant.catalog}</span>
          </p>
        )}
        
        {/* Technical Specifications with Icons */}
        <div className="flex-1 mb-3">
          <UniversalSpecifications product={selectedVariant} compact={true} />
        </div>
        
        {/* Action Buttons */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <button
                onClick={handleAddToQuote}
                className={`w-full px-3 py-1.5 text-white text-xs font-semibold rounded transition ${
                  justAdded ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {justAdded ? '✓ Added!' : 'Request Quote'}
              </button>
            </div>
            <Link
              href={`/products/${selectedVariant.sku.toLowerCase()}`}
              className="px-3 py-1.5 text-white text-xs font-medium rounded transition"
              style={{ backgroundColor: '#00ADEF' }}
            >
              View
            </Link>
          </div>
        </div>
        
        {/* PDF Links */}
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
          {selectedVariant.pdf_source && (
            <button
              type="button"
              onClick={() => {
                const href = pdfViewerHref(selectedVariant.pdf_source, undefined, selectedVariant.sku);
                if (href) window.open(href, '_blank', 'noopener,noreferrer');
              }}
              className="text-xs text-blue-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0 w-full"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              View full catalog
            </button>
          )}
          {selectedVariant.source?.pages?.[0] && selectedVariant.pdf_source && (
            <button
              type="button"
              onClick={() => {
                const href = pdfViewerHref(selectedVariant.pdf_source, selectedVariant.source?.pages?.[0], selectedVariant.sku);
                if (href) window.open(href, '_blank', 'noopener,noreferrer');
              }}
              className="text-xs text-red-600 hover:underline inline-flex items-center cursor-pointer bg-transparent border-0 p-0 w-full"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              🔍 View SKU on page {selectedVariant.source?.pages?.[0]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
