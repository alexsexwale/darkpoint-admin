import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    
    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch product to get weight and CJ product ID
    const { data: product, error: fetchError } = await supabase
      .from('admin_products')
      .select('weight, package_weight, name, cj_product_id, variants')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Use package weight if available, otherwise product weight, default to 0.5kg
    const weight = product.package_weight || product.weight || 0.5;
    
    // Get variant ID if available
    const variants = product.variants || [];
    const firstVariantId = variants.length > 0 ? variants[0]?.id : null;
    
    console.log(`Fetching shipping for product ${productId}, CJ ID: ${product.cj_product_id}, weight: ${weight}kg`);

    // Fetch shipping methods to South Africa
    const shippingResult = await cjDropshipping.getShippingMethods({
      startCountryCode: 'CN', // China
      endCountryCode: 'ZA',   // South Africa
      productWeight: weight,
      productId: product.cj_product_id,
      variantId: firstVariantId,
      quantity: 1,
    });

    if (!shippingResult.success || !shippingResult.data) {
      return NextResponse.json({ 
        success: false, 
        error: shippingResult.error || 'Failed to fetch shipping methods' 
      }, { status: 500 });
    }

    // Parse and format shipping options
    const shippingOptions = shippingResult.data.map((option: any) => {
      // Parse delivery time - CJ returns strings like "7-15 Days" or "15-25"
      let minDays = 0;
      let maxDays = 0;
      const timeStr = option.logisticTime || option.aging || '';
      const timeMatch = timeStr.match(/(\d+)\s*[-~]\s*(\d+)/);
      if (timeMatch) {
        minDays = parseInt(timeMatch[1], 10);
        maxDays = parseInt(timeMatch[2], 10);
      } else {
        const singleMatch = timeStr.match(/(\d+)/);
        if (singleMatch) {
          minDays = maxDays = parseInt(singleMatch[1], 10);
        }
      }

      return {
        name: option.logisticName || option.logisticNameEn || 'Standard Shipping',
        price: parseFloat(option.logisticPrice || option.logisticPriceEn || 0),
        currency: 'USD',
        minDays,
        maxDays,
        deliveryTime: timeStr || `${minDays}-${maxDays} Days`,
      };
    });

    // Sort by price (cheapest first)
    shippingOptions.sort((a: any, b: any) => a.price - b.price);

    return NextResponse.json({ 
      success: true, 
      data: shippingOptions,
      productWeight: weight,
      destination: 'South Africa',
    });
  } catch (error) {
    console.error('Shipping fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch shipping' },
      { status: 500 }
    );
  }
}

