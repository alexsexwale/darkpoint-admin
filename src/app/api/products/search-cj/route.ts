import { NextRequest, NextResponse } from 'next/server';
import { cjDropshipping, transformCJProduct } from '@/lib/cjdropshipping';

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

    const transformedProducts = (result.data || []).map(transformCJProduct);

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

