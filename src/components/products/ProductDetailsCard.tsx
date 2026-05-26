import Image from 'next/image';
import { Product } from '@/types/product';
import { formatCurrency } from '@/lib/utils';
import { useLocale } from '@/contexts/LocaleContext';

interface ProductDetailsCardProps {
  product: Product;
  className?: string;
}

const renderSpecificationSection = (title: string, content: React.ReactNode, className = '') => (
  <div className={className}>
    <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
    <div className="text-sm text-gray-900">
      {content}
    </div>
  </div>
);

const renderList = (items: any[], key: string, unit: string = '') => (
  <div className="flex flex-wrap gap-2">
    {items.map((item, index) => (
      <span key={`${key}-${index}`} className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
        {item}{unit}
      </span>
    ))}
  </div>
);

export default function ProductDetailsCard({ product, className = '' }: ProductDetailsCardProps) {
  const { t } = useLocale();
  // Product title: SKU + product type/name
  const productType = product.name || product.description?.split('\n')[0] || '';
  const title = product.sku + (productType ? ` - ${productType}` : '');
  const categoryDisplay = product.category || product.product_category || '';
  
  // Generate a placeholder color based on product SKU or category
  const getPlaceholderColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 90%)`;
  };

  const categoryForImage = (product.category || product.product_category)?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'product';
  const placeholderColor = getPlaceholderColor(product.sku || categoryForImage);
  const placeholderImageUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='${encodeURIComponent(placeholderColor)}'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' text-anchor='middle' dominant-baseline='middle' fill='%23666'%3E${encodeURIComponent(categoryForImage)}%3C/text%3E%3C/svg%3E`;
  // Resolution order for images:
  // 1) product.imageUrl from server-side resolution
  // 2) product.media with 'main' role
  // 3) product.image_paths first item
  // 4) legacy sku-based path
  // 5) placeholder
  const legacySkuImage = product.sku ? `/product-images/${product.sku}.webp` : undefined;
  const imageUrl = product.imageUrl || 
                   product.media?.find(m => m.role === 'main')?.url ||
                   product.image_paths?.[0] ||
                   legacySkuImage || 
                   placeholderImageUrl;
  
  // Determine price display based on priceMode and price value
  const isRequestQuote = product.priceMode === 'request_quote';
  const hasPrice = product.price !== null && product.price !== undefined;
  const price = isRequestQuote || !hasPrice
    ? t('product.request_quote')
    : formatCurrency(product.price!);
  
  // Determine stock status
  const stockStatus = product.stock?.status || (product.inStock ? 'in_stock' : 'unknown');
  const isInStock = stockStatus === 'in_stock';

  // Check if there are any specifications to show (including structured parsed fields)
  const hasSpecifications = [
    product.pressure_min_bar,
    product.pressure_max_bar,
    (product as any).overpressure_bar,
    (product as any).overpressure_mpa,
    product.power_hp,
    product.power_kw,
    (product as any).power_input_kw,
    (product as any).power_output_kw,
    product.voltage_v,
    product.frequency_hz,
    (product as any).phase_count,
    (product as any).current_a,
    product.flow_l_min,
    (product as any).flow_l_h,
    product.debiet_m3_h,
    product.connection_types?.length,
    product.dimensions_mm_list?.length,
    product.length_mm,
    product.width_mm,
    product.height_mm,
    product.weight_kg,
    (product as any).rpm,
    (product as any).cable_length_m,
    product.noise_level_db,
    product.airflow_l_min,
    product.tank_capacity_l
  ].some(Boolean);

  return (
    <div className={`bg-white shadow-lg overflow-hidden rounded-xl ${className}`}>
      {/* Header with title and price */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              <a href={`/products/${product.sku}`} className="hover:text-primary">
                {title}
              </a>
            </h1>
            {categoryDisplay && (
              <p className="mt-2 text-base text-gray-700 font-medium">{categoryDisplay}</p>
            )}
            {(product.pdf_source || product.source?.pdf_sources?.[0]) && (
              <div className="mt-3">
                <a
                  href={product.pdf_source || product.source?.pdf_sources?.[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:underline"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {t('product.view_pdf')}
                </a>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-3xl font-bold text-primary">{price}</span>
            {isInStock && (
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                {t('product.in_stock')}
              </span>
            )}
            {stockStatus === 'out_of_stock' && (
              <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>
                {t('product.out_of_stock')}
              </span>
            )}
            <div className="mt-3 flex gap-3">
              {isRequestQuote || !hasPrice ? (
                <button className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors shadow-sm">
                  {t('product.request_quote')}
                </button>
              ) : (
                <button className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors shadow-sm">
                  {t('product.add_to_cart')}
                </button>
              )}
              <button className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors shadow-sm">
                {t('product.contact_us')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Image and basic info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200 p-4 flex items-center justify-center h-64">
              <Image
                src={imageUrl}
                alt={title}
                width={400}
                height={300}
                className="w-full h-full object-contain"
                priority
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target && target.src !== placeholderImageUrl) {
                    target.src = placeholderImageUrl;
                  }
                }}
              />
            </div>
            
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900">{t('product.details')}</h3>
              <div className="space-y-3">
                {(product.pdf_source || product.source?.pdf_sources?.[0]) && (
                  <div>
                    <p className="text-sm text-gray-500">{t('product.pdf_source')}</p>
                    <a 
                      href={product.pdf_source || product.source?.pdf_sources?.[0]} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline rounded"
                    >
                      <span>{t('product.view_pdf')}</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
                
                {((product.source_pages?.length ?? 0) > 0 || (product.source?.pages?.length ?? 0) > 0) && (
                  <div>
                    <p className="text-sm text-gray-500">{t('product.pdf_page')}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(product.source_pages || product.source?.pages || []).map((p) => (
                        <a
                          key={`page-${p}`}
                          href={`${product.pdf_source || product.source?.pdf_sources?.[0]}#page=${p}&search=${encodeURIComponent(product.sku)}`}
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
          </div>
          
          {/* Right column - Specifications */}
          <div className="lg:col-span-2">
            {hasSpecifications ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{t('product.technical_specs')}</h2>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pressure Range */}
                    {product.pressure_min_bar !== undefined && product.pressure_max_bar !== undefined && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-gray-500">{t('product.pressure_range')}</h4>
                        <p className="text-gray-900">
                          {product.pressure_min_bar} - {product.pressure_max_bar} bar
                        </p>
                      </div>
                    )}
                    
                    {/* Power */}
                    {(product.power_hp || product.power_kw) && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-500">{t('product.power')}</h4>
                        <div className="flex flex-wrap gap-4">
                          {product.power_hp && (
                            <div>
                              <span className="text-gray-900 font-medium">{product.power_hp} </span>
                              <span className="text-gray-500">HP</span>
                            </div>
                          )}
                          {product.power_kw && (
                            <div>
                              <span className="text-gray-900 font-medium">{product.power_kw} </span>
                              <span className="text-gray-500">kW</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Voltage & Frequency */}
                    {(product.voltage_v || product.frequency_hz || (product as any).phase_count || (product as any).current_a) && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-500">{t('product.electrical')}</h4>
                        <div className="flex flex-wrap gap-4">
                          {product.voltage_v && (
                            <div>
                              <span className="text-gray-900 font-medium">{product.voltage_v} </span>
                              <span className="text-gray-500">V</span>
                            </div>
                          )}
                          {product.frequency_hz && (
                            <div>
                              <span className="text-gray-900 font-medium">{product.frequency_hz} </span>
                              <span className="text-gray-500">Hz</span>
                            </div>
                          )}
                          {(product as any).phase_count && (
                            <div>
                              <span className="text-gray-900 font-medium">{(product as any).phase_count} </span>
                              <span className="text-gray-500">~</span>
                            </div>
                          )}
                          {(product as any).current_a && (
                            <div>
                              <span className="text-gray-900 font-medium">{(product as any).current_a} </span>
                              <span className="text-gray-500">A</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Flow */}
                    {(product.flow_l_min || (product as any).flow_l_h || product.debiet_m3_h) && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-gray-500">{t('product.flow')}</h4>
                        <p className="text-gray-900">
                          {typeof product.flow_l_min === 'number' ? `${product.flow_l_min} L/min` : ''}
                          {product.flow_l_min && (product as any).flow_l_h ? ' • ' : ''}
                          {typeof (product as any).flow_l_h === 'number' ? `${(product as any).flow_l_h} L/h` : ''}
                          {!product.flow_l_min && !(product as any).flow_l_h && typeof product.debiet_m3_h === 'number' ? `${product.debiet_m3_h} m³/h` : ''}
                        </p>
                      </div>
                    )}

                    {/* Overpressure */}
                    {((product as any).overpressure_bar || (product as any).overpressure_mpa) && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-gray-500">{t('product.overpressure')}</h4>
                        <p className="text-gray-900">
                          {typeof (product as any).overpressure_bar === 'number' ? `${(product as any).overpressure_bar} bar` : ''}
                          {(product as any).overpressure_bar && (product as any).overpressure_mpa ? ' • ' : ''}
                          {typeof (product as any).overpressure_mpa === 'number' ? `${(product as any).overpressure_mpa} MPa` : ''}
                        </p>
                      </div>
                    )}
                    
                    {/* Connection Types */}
                    {Array.isArray(product.connection_types) && product.connection_types.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">{t('product.connection_types')}</h4>
                        <div className="mt-1">
                          {renderList(product.connection_types || [], 'conn')}
                        </div>
                      </div>
                    )}
                    
                    {/* Dimensions */}
                    {(product.length_mm || product.width_mm || product.height_mm) && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-500">{t('product.dimensions_mm')}</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {product.length_mm && (
                            <div>
                              <p className="text-xs text-gray-500">{t('product.length')}</p>
                              <p className="text-gray-900">{product.length_mm} mm</p>
                            </div>
                          )}
                          {product.width_mm && (
                            <div>
                              <p className="text-xs text-gray-500">{t('product.width')}</p>
                              <p className="text-gray-900">{product.width_mm} mm</p>
                            </div>
                          )}
                          {product.height_mm && (
                            <div>
                              <p className="text-xs text-gray-500">{t('product.height')}</p>
                              <p className="text-gray-900">{product.height_mm} mm</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Available Sizes */}
                    {Array.isArray(product.dimensions_mm_list) && product.dimensions_mm_list.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">{t('product.available_sizes')}</h4>
                        <div className="mt-1">
                          {renderList(product.dimensions_mm_list || [], 'size', ' mm')}
                        </div>
                      </div>
                    )}
                    
                    {/* Additional Specifications */}
                    <div className="space-y-4 col-span-full pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-500">{t('product.additional_specs')}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {product.weight_kg && (
                          <div>
                            <p className="text-xs text-gray-500">{t('product.weight')}</p>
                            <p className="text-gray-900">{product.weight_kg} kg</p>
                          </div>
                        )}
                        {(product as any).rpm && (
                          <div>
                            <p className="text-xs text-gray-500">{t('product.motor_speed')}</p>
                            <p className="text-gray-900">{(product as any).rpm} rpm</p>
                          </div>
                        )}
                        {(product as any).cable_length_m && (
                          <div>
                            <p className="text-xs text-gray-500">{t('product.cable_length')}</p>
                            <p className="text-gray-900">{(product as any).cable_length_m} m</p>
                          </div>
                        )}
                        {product.noise_level_db && (
                          <div>
                            <p className="text-xs text-gray-500">{t('product.noise_level')}</p>
                            <p className="text-gray-900">{product.noise_level_db} dB</p>
                          </div>
                        )}
                        {product.airflow_l_min && (
                          <div>
                            <p className="text-xs text-gray-500">{t('product.airflow')}</p>
                            <p className="text-gray-900">{product.airflow_l_min} L/min</p>
                          </div>
                        )}
                        {product.tank_capacity_l && (
                          <div>
                            <p className="text-xs text-gray-500">{t('product.tank_capacity')}</p>
                            <p className="text-gray-900">{product.tank_capacity_l} L</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t('product.no_specs')}
              </div>
            )}
            
            {/* Full Description */}
            {product.description && (
              <div className="mt-8 bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{t('product.description')}</h2>
                </div>
                <div className="p-6">
                  <div className="prose max-w-none text-gray-700">
                    {product.description.split('\n').map((paragraph, i) => (
                      <p key={i} className="mb-4">{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
