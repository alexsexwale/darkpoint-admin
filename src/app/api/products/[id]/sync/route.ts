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
    
    if (trimmed.includes(',') && trimmed.includes('http')) {
      return trimmed.split(',').map((url) => url.trim()).filter((url) => url.startsWith('http'));
    }
    
    if (trimmed.startsWith('http')) {
      return [trimmed];
    }
  }
  
  return [];
}

// Extract specifications from description
function extractSpecifications(description: string): Record<string, string> {
  const specs: Record<string, string> = {};
  if (!description) return specs;
  
  const keyValuePattern = /([A-Za-z][A-Za-z\s]{2,30})\s*[：:]\s*([^\n<]{1,100})/g;
  let match;
  while ((match = keyValuePattern.exec(description)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value && !key.includes('http') && !value.includes('http')) {
      specs[key] = value;
    }
  }
  
  return specs;
}

// Extract features from description
function extractFeatures(description: string, sellPoint: string): string[] {
  const features: string[] = [];
  
  if (sellPoint) {
    const points = sellPoint
      .split(/[\n•·\-\d+\.]+/)
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 10 && p.length < 200);
    features.push(...points);
  }
  
  return features.slice(0, 20);
}

// Extract package contents
function extractPackageContents(description: string): string | null {
  if (!description) return null;
  
  const packagePatterns = [
    /(?:Package\s*(?:Includes?|Contents?)|What'?s?\s*in\s*(?:the\s*)?(?:Box|Package)|Includes?)[：:]\s*([^<]+?)(?=<br|<\/|Features?|Specifications?|Note|$)/gi,
  ];
  
  for (const pattern of packagePatterns) {
    const match = pattern.exec(description);
    if (match) {
      return match[1].replace(/<[^>]+>/g, '').trim();
    }
  }
  
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    
    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch existing product to get CJ product ID
    const { data: existingProduct, error: fetchError } = await supabase
      .from('admin_products')
      .select('cj_product_id, name')
      .eq('id', productId)
      .single();

    if (fetchError || !existingProduct) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const cjProductId = existingProduct.cj_product_id;
    console.log(`Syncing product ${productId} with CJ product ${cjProductId}...`);

    // Fetch fresh data from CJ
    const cjResult = await cjDropshipping.getProduct(cjProductId);

    if (!cjResult.success || !cjResult.data) {
      return NextResponse.json({ 
        success: false, 
        error: cjResult.error || 'Failed to fetch product from CJ Dropshipping' 
      }, { status: 500 });
    }

    const cjProduct = cjResult.data as any;
    const productName = cjProduct.productNameEn || cjProduct.productName || existingProduct.name;

    // Collect all images
    let allImages: string[] = [];
    
    if (cjProduct.productImages) {
      allImages = [...allImages, ...parseImages(cjProduct.productImages)];
    }
    if (cjProduct.productImage) {
      allImages = [...allImages, ...parseImages(cjProduct.productImage)];
    }
    
    // Also get variant images
    if (cjProduct.variants && Array.isArray(cjProduct.variants)) {
      for (const variant of cjProduct.variants) {
        if (variant.variantImage) {
          allImages = [...allImages, ...parseImages(variant.variantImage)];
        }
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
    
    // Format images
    const images = uniqueImageUrls.map((src, index) => ({
      id: `${cjProductId}-${index}`,
      src,
      alt: `${productName} - Image ${index + 1}`,
    }));

    // Extract additional data
    const description = cjProduct.description || '';
    const sellPoint = cjProduct.sellPoint || '';
    const specifications = extractSpecifications(description);
    const features = extractFeatures(description, sellPoint);
    const packageContents = extractPackageContents(description);

    // Prepare variants
    const variants = (cjProduct.variants || []).map((v: any) => ({
      id: v.vid,
      name: v.variantNameEn || v.variantName,
      value: v.variantValueEn || v.variantValue,
      sku: v.variantSku,
      price: parseFloat(v.sellPrice) || 0,
      image: v.variantImage,
      stock: v.quantity || 0,
    }));

    // Generate slug
    const slug = productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + cjProductId;

    // Update product with fresh data
    const updateData: Record<string, unknown> = {
      name: productName,
      slug: slug,
      description: description || null,
      short_description: sellPoint || description?.slice(0, 200) || null,
      images: images,
      variants: variants,
      weight: parseFloat(cjProduct.productWeight as string) || 0,
      source_from: cjProduct.sourceFrom || 'China',
      sell_point: sellPoint || null,
      raw_description: description || null,
      package_contents: packageContents,
      specifications: specifications,
      features: features,
      remark: cjProduct.remark || null,
      package_weight: parseFloat(cjProduct.packageWeight as string) || 0,
      product_sku: cjProduct.productSku || null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProduct, error: updateError } = await supabase
      .from('admin_products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      console.error('Sync update error:', updateError);
      
      // Try without optional columns if they don't exist
      if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
        delete updateData.sell_point;
        delete updateData.raw_description;
        delete updateData.package_contents;
        delete updateData.specifications;
        delete updateData.features;
        delete updateData.remark;
        delete updateData.package_weight;
        delete updateData.product_sku;
        delete updateData.slug;
        
        const { data: fallbackProduct, error: fallbackError } = await supabase
          .from('admin_products')
          .update(updateData)
          .eq('id', productId)
          .select()
          .single();
          
        if (fallbackError) {
          return NextResponse.json({ success: false, error: fallbackError.message }, { status: 500 });
        }
        
        return NextResponse.json({ 
          success: true, 
          data: fallbackProduct,
          imagesCount: images.length,
          warning: 'Synced without detailed fields. Run migrations to enable full data.'
        });
      }
      
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedProduct,
      imagesCount: images.length,
      variantsCount: variants.length,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

