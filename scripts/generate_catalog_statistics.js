const fs = require('fs');
const path = require('path');

/**
 * Generate catalog statistics for the StatsBanner component
 * This script analyzes all product data and generates a statistics JSON file
 */

// Paths
const publicDataDir = path.join(__dirname, '..', 'public', 'data');
const outputFile = path.join(__dirname, '..', 'public', 'catalog_statistics.json');

// Catalog definitions (from generate_catalog_pages.js)
const catalogs = [
  'abs-persluchtbuizen',
  'airpress-catalogus-eng',
  'airpress-catalogus-nl-fr',
  'bronpompen',
  'catalogus-aandrijftechniek-150922',
  'centrifugaalpompen',
  'digitale-versie-pompentoebehoren-compressed',
  'dompelpompen',
  'drukbuizen',
  'kranzle-catalogus-2021-nl-1',
  'kunststof-afvoerleidingen',
  'makita-catalogus-2022-nl',
  'makita-tuinfolder-2022-nl',
  'messing-draadfittingen',
  'pe-buizen',
  'plat-oprolbare-slangen',
  'pomp-specials',
  'pu-afzuigslangen',
  'rubber-slangen',
  'rvs-draadfittingen',
  'slangklemmen',
  'slangkoppelingen',
  'verzinkte-buizen',
  'zuigerpompen',
  'zwarte-draad-en-lasfittingen',
];

function generateStatistics() {
  console.log('Generating catalog statistics...\n');

  let totalProducts = 0;
  let totalCategories = new Set();
  let productsWithImages = 0;
  let totalImageCount = 0;

  // Count products and categories from each catalog
  catalogs.forEach(catalog => {
    const fileName = catalog.replace(/-/g, '_') + '_products.json';
    const filePath = path.join(publicDataDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${catalog} - file not found`);
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Count products (each item can have multiple products/SKUs)
      data.forEach(item => {
        if (item.products && Array.isArray(item.products)) {
          totalProducts += item.products.length;
          
          // Track if this item has images
          if (item.image || (item.all_images && item.all_images.length > 0)) {
            productsWithImages += item.products.length;
            // Count images
            if (item.all_images && item.all_images.length > 0) {
              totalImageCount += item.all_images.length;
            } else if (item.image) {
              totalImageCount += 1;
            }
          }
          
          // Collect categories
          item.products.forEach(product => {
            if (product.properties?.catalog_group) {
              totalCategories.add(product.properties.catalog_group);
            }
            if (product.raw?._enriched?.catalog_group) {
              totalCategories.add(product.raw._enriched.catalog_group);
            }
          });
        }
      });

      console.log(`✓ ${catalog}: ${data.length} items`);
    } catch (error) {
      console.error(`❌ Error reading ${catalog}:`, error.message);
    }
  });

  // Try to get more accurate image data from Product_images.json
  const productImagesPath = path.join(publicDataDir, 'Product_images.json');
  if (fs.existsSync(productImagesPath)) {
    try {
      const imageData = JSON.parse(fs.readFileSync(productImagesPath, 'utf8'));
      if (imageData.total_images) {
        totalImageCount = imageData.total_images;
      }
      if (imageData.total_unique_skus) {
        productsWithImages = imageData.total_unique_skus;
      }
      console.log(`\n✓ Loaded image statistics from Product_images.json`);
    } catch (error) {
      console.log(`⚠️  Could not load Product_images.json:`, error.message);
    }
  }

  // Calculate statistics
  const imageCoverage = totalProducts > 0 
    ? Math.round((productsWithImages / totalProducts) * 100) 
    : 0;
  
  const avgImagesPerProduct = productsWithImages > 0 
    ? parseFloat((totalImageCount / productsWithImages).toFixed(1))
    : 0;

  const statistics = {
    generated: new Date().toISOString(),
    totalProducts,
    catalogs: catalogs.length,
    categories: totalCategories.size,
    productsWithImages,
    totalImages: totalImageCount,
    imageCoverage,
    avgImagesPerProduct
  };

  // Write to file
  fs.writeFileSync(outputFile, JSON.stringify(statistics, null, 2), 'utf8');

  console.log('\n📊 Statistics Generated:');
  console.log('========================');
  console.log(`Total Catalogs: ${statistics.catalogs}`);
  console.log(`Total Products: ${statistics.totalProducts}`);
  console.log(`Total Categories: ${statistics.categories}`);
  console.log(`Products with Images: ${statistics.productsWithImages}`);
  console.log(`Total Images: ${statistics.totalImages}`);
  console.log(`Image Coverage: ${statistics.imageCoverage}%`);
  console.log(`Avg Images per Product: ${statistics.avgImagesPerProduct}x`);
  console.log(`\n✅ Statistics saved to: ${outputFile}`);

  return statistics;
}

// Run the script
if (require.main === module) {
  generateStatistics();
}

module.exports = { generateStatistics };
