import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { cjProduct } = await request.json();

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

    // Calculate markup (default 150%)
    const markupPercent = 150;
    const basePrice = cjProduct.basePrice || 0;
    const sellPrice = cjProduct.price || Math.ceil(basePrice * (markupPercent / 100 + 1));

    // Insert product
    const { data: product, error } = await supabase
      .from('admin_products')
      .insert({
        cj_product_id: cjProduct.id,
        name: cjProduct.name,
        description: cjProduct.description || cjProduct.shortDescription,
        short_description: cjProduct.shortDescription,
        base_price: basePrice,
        sell_price: sellPrice,
        compare_at_price: cjProduct.compareAtPrice,
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
      })
      .select()
      .single();

    if (error) {
      console.error('Import error:', error);
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

