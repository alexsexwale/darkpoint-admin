import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

// Parse images from various CJ formats
function parseImages(rawImages: unknown): string[] {
  if (!rawImages) return [];
  
  if (Array.isArray(rawImages)) {
    return rawImages.flatMap((img) => parseImages(img));
  }
  
  if (typeof rawImages === 'string') {
    const trimmed = rawImages.trim();
    
    // Check if it's a JSON stringified array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
        }
      } catch {
        // Not valid JSON
      }
    }
    
    // Check if it's comma-separated URLs
    if (trimmed.includes(',') && trimmed.includes('http')) {
      return trimmed.split(',').map((url) => url.trim()).filter((url) => url.startsWith('http'));
    }
    
    // Single URL
    if (trimmed.startsWith('http')) {
      return [trimmed];
    }
  }
  
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const { 
      cjProduct, 
      exchangeRate, 
      markupPercent: customMarkup, 
      costZAR: providedCostZAR, 
      sellZAR: providedSellZAR 
    } = await request.json();

    if (!cjProduct || !cjProduct.id) {
      return NextResponse.json({ success: false, error: 'Product data required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if product already exists
    const { data: existing } = await supabase
      .from('admin_products')
      .select('id')
      .eq('cj_product_id', cjProduct.id)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Product already imported' }, { status: 400 });
    }

    // Fetch full product details from CJ to get all images
    // The list endpoint might only return a single productImage
    console.log(`Fetching full product details for ${cjProduct.id}...`);
    const fullProductResult = await cjDropshipping.getProduct(cjProduct.id);
    
    let allImages: string[] = [];
    const productName = cjProduct.name;
    
    if (fullProductResult.success && fullProductResult.data) {
      const fullProduct = fullProductResult.data;
      
      // Collect images from the full product data
      if (fullProduct.productImages) {
        allImages = [...allImages, ...parseImages(fullProduct.productImages)];
      }
      if (fullProduct.productImage) {
        allImages = [...allImages, ...parseImages(fullProduct.productImage)];
      }
      
      // Also get variant images
      if (fullProduct.variants && Array.isArray(fullProduct.variants)) {
        for (const variant of fullProduct.variants) {
          if (variant.variantImage) {
            allImages = [...allImages, ...parseImages(variant.variantImage)];
          }
        }
      }
      
      console.log(`Found ${allImages.length} images from CJ product detail API`);
    } else {
      // Fallback to images from search result if detail fetch fails
      console.log('Could not fetch full product details, using search result images');
      if (cjProduct.images && Array.isArray(cjProduct.images)) {
        allImages = cjProduct.images.map((img: { src?: string } | string) => 
          typeof img === 'string' ? img : img.src
        ).filter(Boolean);
      }
    }
    
    // Deduplicate images
    const uniqueImageUrls = [...new Set(allImages)].filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
    
    // Format images as array of { id, src, alt }
    const images = uniqueImageUrls.map((src, index) => ({
      id: `${cjProduct.id}-${index}`,
      src,
      alt: `${productName} - Image ${index + 1}`,
    }));
    
    console.log(`Importing product with ${images.length} images`);

    // Use provided values or calculate with defaults
    const rate = exchangeRate || 18.5; // Default fallback rate
    const markupPercent = customMarkup || 150;
    
    // Original CJ price in USD
    const basePriceUSD = cjProduct.basePrice || 0;
    
    // Calculate ZAR prices
    // Cost price = USD price × exchange rate
    const basePrice = providedCostZAR || Math.ceil(basePriceUSD * rate);
    
    // Sell price = Cost price × (1 + markup/100)
    const sellPrice = providedSellZAR || Math.ceil(basePrice * (1 + markupPercent / 100));

    // Generate slug matching darkpoint format: product-name-{fullProductId}
    const slug = productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + cjProduct.id;

    // Build product data with all available fields
    const productData: Record<string, unknown> = {
      cj_product_id: cjProduct.id,
      name: productName,
      slug: slug,
      description: cjProduct.description || cjProduct.shortDescription,
      short_description: cjProduct.shortDescription,
      base_price: basePrice, // Cost in ZAR
      sell_price: sellPrice, // Selling price in ZAR
      compare_at_price: cjProduct.sourcePrice ? Math.ceil(cjProduct.sourcePrice * rate * 1.5) : null,
      markup_percent: markupPercent,
      category: cjProduct.category || mapCategory(cjProduct.name),
      tags: cjProduct.tags || extractTags(cjProduct.name, cjProduct.description || ''),
      images: images,
      variants: cjProduct.variants || [],
      weight: cjProduct.weight || 0,
      source_from: cjProduct.sourceFrom || 'China',
      is_active: true,
      is_featured: false,
      last_synced_at: new Date().toISOString(),
      
      // Additional detailed information
      sell_point: cjProduct.sellPoint || null,
      raw_description: cjProduct.rawDescription || cjProduct.description || null,
      package_contents: cjProduct.packageContents || null,
      specifications: cjProduct.specifications || {},
      features: cjProduct.features || [],
      remark: cjProduct.remark || null,
      package_weight: cjProduct.packageWeight || 0,
      product_sku: cjProduct.productSku || null,
      
      // USD tracking fields
      original_price_usd: basePriceUSD,
      exchange_rate_used: rate,
    };

    // Insert product with all data
    const { data: product, error } = await supabase
      .from('admin_products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      console.error('Import error:', error);
      console.error('Import error details:', { code: error.code, details: error.details, hint: error.hint });
      
      // Check for RLS error specifically
      if (error.message?.includes('row-level security') || error.code === '42501') {
        return NextResponse.json({ 
          success: false, 
          error: 'Permission denied. Please ensure SUPABASE_SERVICE_ROLE_KEY is correctly configured in .env.local (not the anon key).' 
        }, { status: 403 });
      }
      
      // If column doesn't exist, try without the new columns
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.log('Trying import without new columns...');
        
        // Remove potentially missing columns
        delete productData.sell_point;
        delete productData.raw_description;
        delete productData.package_contents;
        delete productData.specifications;
        delete productData.features;
        delete productData.remark;
        delete productData.package_weight;
        delete productData.product_sku;
        
        const { data: fallbackProduct, error: fallbackError } = await supabase
          .from('admin_products')
          .insert(productData)
          .select()
          .single();
          
        if (fallbackError) {
          return NextResponse.json({ success: false, error: fallbackError.message }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          data: fallbackProduct,
          warning: 'Imported without detailed fields. Run migration 057 to enable full data storage.'
        });
      }
      
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

// Extract tags from product name and description
function extractTags(name: string, description: string): string[] {
  const tags: string[] = [];
  const text = `${name} ${description}`.toLowerCase();
  
  const tagKeywords = [
    'gaming', 'rgb', 'wireless', 'bluetooth', 'usb', 'led', 'portable',
    'mini', 'pro', 'smart', 'mechanical', 'ergonomic', 'adjustable',
    'waterproof', 'rechargeable', 'foldable', 'lightweight'
  ];
  
  for (const keyword of tagKeywords) {
    if (text.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword);
    }
  }
  
  return tags.slice(0, 10);
}

// Simple category mapping based on product name
function mapCategory(name: string): string {
  const text = name.toLowerCase();
  
  if (/gaming|game|controller|gamepad|joystick|console|rgb.*keyboard/i.test(text)) {
    return 'gaming';
  }
  if (/headset|headphone|earphone|earbud|speaker|microphone|audio/i.test(text)) {
    return 'audio';
  }
  if (/keyboard|mouse|webcam|monitor|laptop|computer|hub/i.test(text)) {
    return 'hardware';
  }
  if (/watch|band|bracelet|fitness|tracker/i.test(text)) {
    return 'wearables';
  }
  if (/led|light|lamp|smart|portable|mini|gadget/i.test(text)) {
    return 'gadgets';
  }
  if (/case|cover|cable|charger|stand|holder/i.test(text)) {
    return 'accessories';
  }
  if (/hoodie|shirt|cap|hat|mug|backpack/i.test(text)) {
    return 'merchandise';
  }
  
  return 'gadgets';
}

