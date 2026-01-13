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

    // Fetch product to get CJ product ID
    const { data: product, error: fetchError } = await supabase
      .from('admin_products')
      .select('cj_product_id, name')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    console.log(`Fetching stock for product ${productId}, CJ ID: ${product.cj_product_id}`);

    // Fetch product details from CJ to get stock information
    const productResult = await cjDropshipping.getProduct(product.cj_product_id);

    if (!productResult.success || !productResult.data) {
      return NextResponse.json({ 
        success: false, 
        error: productResult.error || 'Failed to fetch product from CJ' 
      }, { status: 500 });
    }

    const cjProduct = productResult.data as any;

    // Also get variants for detailed stock info
    const variantsResult = await cjDropshipping.getProductVariants(product.cj_product_id);
    
    // Calculate total stock from variants
    let totalStock = 0;
    const variantStock: Array<{
      id: string;
      name: string;
      value: string;
      stock: number;
      sku: string;
    }> = [];

    if (variantsResult.success && variantsResult.data) {
      for (const variant of variantsResult.data) {
        const stock = variant.quantity || 0;
        totalStock += stock;
        variantStock.push({
          id: variant.vid,
          name: variant.variantNameEn || variant.variantName || '',
          value: variant.variantValueEn || variant.variantValue || '',
          stock: stock,
          sku: variant.variantSku || '',
        });
      }
    }

    // If no variants, try to get stock from main product
    if (variantStock.length === 0) {
      // Check various possible stock fields in CJ response
      const mainStock = cjProduct.stock || cjProduct.quantity || cjProduct.inventoryCount || 0;
      totalStock = mainStock;
    }

    // Determine stock status
    let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (totalStock === 0) {
      stockStatus = 'out_of_stock';
    } else if (totalStock < 10) {
      stockStatus = 'low_stock';
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        totalStock,
        stockStatus,
        variants: variantStock,
        lastChecked: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Stock fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}

