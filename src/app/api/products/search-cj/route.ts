import { NextRequest, NextResponse } from 'next/server';
import { cjDropshipping, transformCJProduct } from '@/lib/cjdropshipping';

// Parse images from various formats CJ returns
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

// Extract specifications from description text
function extractSpecifications(description: string): Record<string, string> {
  const specs: Record<string, string> = {};
  
  if (!description) return specs;
  
  // Common spec patterns: "Key: Value" or "Key：Value"
  const patterns = [
    /(?:^|\n|<br\s*\/?>|<li>)\s*([^:<\n]+?)\s*[：:]\s*([^<\n]+?)(?=\n|<br|<\/li>|$)/gi,
    /(?:Material|Size|Color|Weight|Dimension|Length|Width|Height|Power|Voltage|Battery|Capacity)\s*[：:]\s*([^\n<]+)/gi,
  ];
  
  // Try to find key-value pairs
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
  
  // Extract from sell points (often bullet points or numbered list)
  if (sellPoint) {
    const points = sellPoint
      .split(/[\n•·\-\d+\.]+/)
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 10 && p.length < 200);
    features.push(...points);
  }
  
  // Look for feature patterns in description
  if (description) {
    // Match common feature patterns
    const featurePatterns = [
      /(?:Features?|Specifications?|Highlights?)[：:]\s*([^<]+)/gi,
      /<li>([^<]+)<\/li>/gi,
    ];
    
    for (const pattern of featurePatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        const feature = match[1].replace(/<[^>]+>/g, '').trim();
        if (feature.length > 10 && feature.length < 200 && !features.includes(feature)) {
          features.push(feature);
        }
      }
    }
  }
  
  return features.slice(0, 20); // Limit to 20 features
}

// Extract package contents from description
function extractPackageContents(description: string): string | null {
  if (!description) return null;
  
  // Look for package/includes section
  const packagePatterns = [
    /(?:Package\s*(?:Includes?|Contents?)|What'?s?\s*in\s*(?:the\s*)?(?:Box|Package)|Includes?)[：:]\s*([^<]+?)(?=<br|<\/|Features?|Specifications?|Note|$)/gi,
    /(?:<p>|<li>)?\s*(\d+\s*[xX×]\s*[^<\n]+)/g,
  ];
  
  let contents = '';
  for (const pattern of packagePatterns) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const item = match[1].replace(/<[^>]+>/g, '').trim();
      if (item && item.length > 3) {
        contents += (contents ? '\n' : '') + item;
      }
    }
    if (contents) break;
  }
  
  return contents || null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');

    if (!query) {
      return NextResponse.json({ success: false, error: 'Search query required' }, { status: 400 });
    }

    const result = await cjDropshipping.getProducts({
      keywords: query,
      pageNum: page,
      pageSize: 20,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // Transform products with all available data
    const transformedProducts = (result.data || []).map((cjProduct: any) => {
      const productName = cjProduct.productNameEn || cjProduct.productName || 'Unnamed Product';
      
      // Collect all images
      let allImages: string[] = [];
      if (cjProduct.productImages) {
        allImages = [...allImages, ...parseImages(cjProduct.productImages)];
      }
      if (cjProduct.productImage) {
        allImages = [...allImages, ...parseImages(cjProduct.productImage)];
      }
      
      // Add variant images
      if (cjProduct.variants && Array.isArray(cjProduct.variants)) {
        for (const variant of cjProduct.variants) {
          if (variant.variantImage) {
            const variantImages = parseImages(variant.variantImage);
            allImages = [...allImages, ...variantImages];
          }
        }
      }
      
      // Deduplicate images
      const uniqueImages = [...new Set(allImages)].filter(url => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      });
      
      const images = uniqueImages.map((src, index) => ({
        id: `${cjProduct.pid}-${index}`,
        src,
        alt: `${productName} - Image ${index + 1}`,
      }));

      // Extract additional data
      const description = cjProduct.description || '';
      const sellPoint = cjProduct.sellPoint || '';
      const specifications = extractSpecifications(description);
      const features = extractFeatures(description, sellPoint);
      const packageContents = extractPackageContents(description);

      return {
        id: cjProduct.pid,
        name: productName,
        description: description,
        shortDescription: sellPoint || description?.slice(0, 200) || productName,
        basePrice: parseFloat(cjProduct.sellPrice) || 0,
        sourcePrice: parseFloat(cjProduct.sourcePrice) || 0,
        images,
        variants: (cjProduct.variants || []).map((v: any) => ({
          id: v.vid,
          name: v.variantNameEn || v.variantName,
          value: v.variantValueEn || v.variantValue,
          sku: v.variantSku,
          price: parseFloat(v.sellPrice) || 0,
          image: v.variantImage,
          stock: v.quantity || 0,
        })),
        weight: parseFloat(cjProduct.productWeight) || 0,
        packageWeight: parseFloat(cjProduct.packageWeight) || 0,
        sourceFrom: cjProduct.sourceFrom || 'China',
        categoryId: cjProduct.categoryId,
        // Additional detailed info
        sellPoint,
        rawDescription: description,
        specifications,
        features,
        packageContents,
        remark: cjProduct.remark || '',
        productSku: cjProduct.productSku || '',
        entryTime: cjProduct.entryTime,
        updateTime: cjProduct.updateTime,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedProducts,
    });
  } catch (error) {
    console.error('CJ search error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}

