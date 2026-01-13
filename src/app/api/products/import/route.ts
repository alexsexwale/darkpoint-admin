import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

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

    // Build product data with ZAR prices
    const productData: Record<string, unknown> = {
      cj_product_id: cjProduct.id,
      name: cjProduct.name,
      description: cjProduct.description || cjProduct.shortDescription,
      short_description: cjProduct.shortDescription,
      base_price: basePrice, // Cost in ZAR
      sell_price: sellPrice, // Selling price in ZAR
      compare_at_price: cjProduct.compareAtPrice ? Math.ceil(cjProduct.compareAtPrice * rate * 1.5) : null,
      markup_percent: markupPercent,
      category: cjProduct.category || mapCategory(cjProduct.name),
      tags: cjProduct.tags || [],
      images: cjProduct.images || [],
      variants: cjProduct.variants || [],
      weight: cjProduct.weight || 0,
      source_from: cjProduct.sourceFrom || 'China',
      is_active: true,
      is_featured: false,
      last_synced_at: new Date().toISOString(),
    };

    // Add optional USD tracking fields (may not exist in older schemas)
    // These will be silently ignored if columns don't exist
    productData.original_price_usd = basePriceUSD;
    productData.exchange_rate_used = rate;

    // Insert product with ZAR prices
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

