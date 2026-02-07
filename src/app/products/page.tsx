'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineStar,
  HiOutlineTrash,
  HiOutlineCloudDownload,
  HiOutlineExternalLink,
  HiOutlineCurrencyDollar,
  HiOutlineAdjustments,
  HiOutlineTrendingUp,
  HiOutlineInformationCircle,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  Button, 
  Input,
  Select,
  Badge,
  Modal,
  ConfirmDialog,
} from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { supabase } from '@/lib/supabase';
import type { AdminProduct } from '@/types';

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Categories' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'audio', label: 'Audio' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'gadgets', label: 'Gadgets' },
  { value: 'wearables', label: 'Wearables' },
  { value: 'merchandise', label: 'Merchandise' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Products' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'featured', label: 'Featured' },
];

const MARKUP_PRESETS = [
  { label: '50%', value: 50, description: '1.5x cost' },
  { label: '100%', value: 100, description: '2x cost' },
  { label: '150%', value: 150, description: '2.5x cost' },
  { label: '200%', value: 200, description: '3x cost' },
  { label: '250%', value: 250, description: '3.5x cost' },
  { label: '300%', value: 300, description: '4x cost' },
];

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // CJ Product import states
  const [cjSearchQuery, setCJSearchQuery] = useState('');
  const [cjProducts, setCJProducts] = useState<any[]>([]);
  const [isSearchingCJ, setIsSearchingCJ] = useState(false);
  const [isLoadingMoreCJ, setIsLoadingMoreCJ] = useState(false);
  const [importingProductId, setImportingProductId] = useState<string | null>(null);
  const [cjSearchSource, setCJSearchSource] = useState<'catalog' | 'my-products'>('catalog');
  const [importedCJProductIds, setImportedCJProductIds] = useState<Set<string>>(new Set());
  const [cjPagination, setCJPagination] = useState<{ page: number; total: number; hasMore: boolean }>({ page: 1, total: 0, hasMore: false });
  
  // Per-product pricing overrides: { productId: { markup?: number, customPrice?: number } }
  const [productPricing, setProductPricing] = useState<Record<string, { markup?: number; customPrice?: number }>>({});
  
  // Exchange rate states
  const [exchangeRate, setExchangeRate] = useState<number>(18.5);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateInfo, setRateInfo] = useState<{ cached: boolean; fetchedAt?: string } | null>(null);
  const [defaultMarkup, setDefaultMarkup] = useState<number>(150);

  // Fetch exchange rate
  const fetchExchangeRate = useCallback(async () => {
    setIsLoadingRate(true);
    try {
      const response = await fetch('/api/exchange-rate');
      const result = await response.json();
      
      if (result.success && result.data) {
        setExchangeRate(result.data.rate);
        setRateInfo({
          cached: result.data.cached,
          fetchedAt: result.data.fetchedAt || result.data.cachedAt,
        });
      }
    } catch (err) {
      console.error('Failed to fetch exchange rate:', err);
    } finally {
      setIsLoadingRate(false);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('admin_products')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      } else if (statusFilter === 'featured') {
        query = query.eq('is_featured', true);
      }
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Products fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, categoryFilter, statusFilter, searchQuery]);

  // Fetch list of already-imported CJ product IDs
  const fetchImportedCJProductIds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_products')
        .select('cj_product_id');
      
      if (error) throw error;
      
      const ids = new Set<string>(data?.map(p => p.cj_product_id) || []);
      setImportedCJProductIds(ids);
    } catch (err) {
      console.error('Error fetching imported product IDs:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchImportedCJProductIds();
  }, [fetchProducts, fetchImportedCJProductIds]);

  const searchCJProducts = async (loadMore = false) => {
    // For catalog, query is required. For my-products, it's optional (can browse all)
    if (cjSearchSource === 'catalog' && !cjSearchQuery.trim()) return;
    
    if (loadMore) {
      setIsLoadingMoreCJ(true);
    } else {
      setIsSearchingCJ(true);
      setCJProducts([]); // Clear previous results for new search
    }
    
    try {
      const params = new URLSearchParams();
      if (cjSearchQuery.trim()) {
        params.set('q', cjSearchQuery);
      }
      params.set('source', cjSearchSource);
      params.set('page', loadMore ? String(cjPagination.page + 1) : '1');
      params.set('pageSize', '50'); // Fetch 50 at a time
      
      const response = await fetch(`/api/products/search-cj?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        // Filter out products that have already been imported
        const filteredProducts = (result.data || []).filter(
          (product: any) => !importedCJProductIds.has(product.id)
        );
        
        if (loadMore) {
          setCJProducts(prev => [...prev, ...filteredProducts]);
        } else {
          setCJProducts(filteredProducts);
        }
        
        // Update pagination info
        if (result.pagination) {
          setCJPagination({
            page: result.pagination.page,
            total: result.pagination.total,
            hasMore: result.pagination.hasMore,
          });
        }
      } else {
        console.error('CJ search error:', result.error);
      }
    } catch (err) {
      console.error('CJ search error:', err);
    } finally {
      setIsSearchingCJ(false);
      setIsLoadingMoreCJ(false);
    }
  };

  const importCJProduct = async (cjProduct: any) => {
    setImportingProductId(cjProduct.id);
    try {
      const pricing = calculatePricing(cjProduct.basePrice, cjProduct.id);
      const costZAR = pricing.costZAR;
      const sellZAR = pricing.sellZAR;
      const markup = pricing.effectiveMarkup;
      
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cjProduct,
          exchangeRate,
          markupPercent: Math.round(markup),
          costZAR,
          sellZAR,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove the imported product from the list and clear its pricing override
        setCJProducts(prev => prev.filter(p => p.id !== cjProduct.id));
        setProductPricing(prev => {
          const next = { ...prev };
          delete next[cjProduct.id];
          return next;
        });
        // Add to imported IDs set so it won't show up in future searches
        setImportedCJProductIds(prev => new Set([...prev, cjProduct.id]));
        await fetchProducts();
        // Don't close modal - allow importing more products
      } else {
        alert(`Failed to import: ${result.error}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import product. Please try again.');
    } finally {
      setImportingProductId(null);
    }
  };

  const toggleProductStatus = async (product: AdminProduct, field: 'is_active' | 'is_featured') => {
    try {
      const newValue = !product[field];
      const { error } = await supabase
        .from('admin_products')
        .update({ [field]: newValue, updated_at: new Date().toISOString() })
        .eq('id', product.id);

      if (error) throw error;
      
      setProducts(products.map(p => 
        p.id === product.id ? { ...p, [field]: newValue } : p
      ));
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const deleteProduct = async () => {
    if (!selectedProduct) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('admin_products')
        .delete()
        .eq('id', selectedProduct.id);

      if (error) throw error;
      
      setProducts(products.filter(p => p.id !== selectedProduct.id));
      setShowDeleteConfirm(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatZAR = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Calculate pricing for a product with optional overrides
  const calculatePricing = (usdCost: number, productId: string) => {
    const costZAR = usdCost * exchangeRate;
    const override = productPricing[productId];
    
    let sellZAR: number;
    let effectiveMarkup: number;
    
    if (override?.customPrice !== undefined && override.customPrice > 0) {
      // Custom price takes precedence
      sellZAR = override.customPrice;
      effectiveMarkup = costZAR > 0 ? ((sellZAR / costZAR) - 1) * 100 : 0;
    } else {
      // Use markup (either product-specific or default)
      effectiveMarkup = override?.markup ?? defaultMarkup;
      sellZAR = costZAR * (1 + effectiveMarkup / 100);
    }
    
    const profitZAR = sellZAR - costZAR;
    const profitMargin = sellZAR > 0 ? (profitZAR / sellZAR) * 100 : 0;
    
    return { costZAR, sellZAR, profitZAR, profitMargin, effectiveMarkup };
  };
  
  // Update product pricing override
  const updateProductPricing = (productId: string, field: 'markup' | 'customPrice', value: number | undefined) => {
    setProductPricing(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
        // Clear the other field when one is set
        ...(field === 'customPrice' ? { markup: undefined } : {}),
        ...(field === 'markup' ? { customPrice: undefined } : {}),
      },
    }));
  };
  
  // Get the effective markup for a product
  const getProductMarkup = (productId: string) => {
    return productPricing[productId]?.markup ?? defaultMarkup;
  };
  
  // Check if a product has a custom price set
  const hasCustomPrice = (productId: string) => {
    return productPricing[productId]?.customPrice !== undefined && productPricing[productId]?.customPrice! > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-1 tracking-wider">Products</h1>
          <p className="text-gray-5 text-sm mt-1">
            Manage products from CJ Dropshipping catalog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={fetchProducts} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-gray-1">{totalCount}</p>
            <p className="text-xs text-gray-5">Total Products</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-green-400">
              {products.filter(p => p.is_active).length}
            </p>
            <p className="text-xs text-gray-5">Active</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-main-1">
              {products.filter(p => p.is_featured).length}
            </p>
            <p className="text-xs text-gray-5">Featured</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-red-400">
              {products.filter(p => !p.is_active).length}
            </p>
            <p className="text-xs text-gray-5">Inactive</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
            />
          </div>
          <div className="w-48">
            <Select
              options={CATEGORY_OPTIONS}
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-80 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-5 mb-4">No products found</p>
          <Button onClick={() => setShowAddModal(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>
            Add Your First Product
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} padding="none" className="overflow-hidden group">
              {/* Clickable Image Area */}
              <div 
                className="relative aspect-square bg-dark-3 cursor-pointer"
                onClick={() => router.push(`/products/${product.id}`)}
              >
                {product.images && product.images[0] ? (
                  <img 
                    src={product.images[0].src}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-5">
                    No Image
                  </div>
                )}
                {/* View Details Overlay */}
                <div className="absolute inset-0 bg-dark-2/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="px-4 py-2 bg-main-1 rounded-lg text-sm font-medium text-white">
                    View Details
                  </span>
                </div>
                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-2 z-10">
                  {product.is_featured && (
                    <Badge variant="primary">Featured</Badge>
                  )}
                  {!product.is_active && (
                    <Badge variant="danger">Inactive</Badge>
                  )}
                </div>
                {/* Quick Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProductStatus(product, 'is_active');
                    }}
                    className="p-2 bg-dark-2/90 rounded-lg hover:bg-dark-3 transition-colors"
                    title={product.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {product.is_active ? (
                      <HiOutlineEyeOff className="w-4 h-4 text-gray-5" />
                    ) : (
                      <HiOutlineEye className="w-4 h-4 text-green-400" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProductStatus(product, 'is_featured');
                    }}
                    className="p-2 bg-dark-2/90 rounded-lg hover:bg-dark-3 transition-colors"
                    title={product.is_featured ? 'Remove Featured' : 'Set Featured'}
                  >
                    <HiOutlineStar className={`w-4 h-4 ${product.is_featured ? 'text-main-1 fill-main-1' : 'text-gray-5'}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduct(product);
                      setShowDeleteConfirm(true);
                    }}
                    className="p-2 bg-dark-2/90 rounded-lg hover:bg-dark-3 transition-colors"
                    title="Delete"
                  >
                    <HiOutlineTrash className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
              
              {/* Content - Also Clickable */}
              <div 
                className="p-4 cursor-pointer hover:bg-dark-3/50 transition-colors"
                onClick={() => router.push(`/products/${product.id}`)}
              >
                <p className="text-xs text-gray-5 uppercase mb-1">{product.category}</p>
                <h3 className="font-medium text-gray-1 line-clamp-2 mb-2 min-h-[2.5rem]">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-heading text-main-1">
                      {formatZAR(product.sell_price)}
                    </p>
                    <p className="text-xs text-gray-5">
                      Cost: {formatZAR(product.base_price)}
                    </p>
                  </div>
                  <Badge variant={product.markup_percent >= 150 ? 'success' : 'warning'}>
                    {product.markup_percent}% markup
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Card padding="none">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalCount}
          itemsPerPage={pageSize}
          onPageChange={(newPage) => setPage(newPage)}
          onItemsPerPageChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </Card>

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setCJProducts([]);
          setCJSearchQuery('');
          setCJSearchSource('catalog');
        }}
        title="Add Product from CJ Dropshipping"
        size="full"
      >
        <div className="space-y-6">
          {/* Exchange Rate & Markup Controls */}
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Exchange Rate */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <HiOutlineCurrencyDollar className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-gray-1">Exchange Rate:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-blue-400">1 USD = R {exchangeRate.toFixed(2)}</span>
                  <button
                    onClick={fetchExchangeRate}
                    disabled={isLoadingRate}
                    className="p-1.5 rounded-lg bg-dark-3 hover:bg-dark-4 transition-colors"
                    title="Refresh exchange rate"
                  >
                    <HiOutlineRefresh className={`w-4 h-4 text-gray-5 ${isLoadingRate ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {rateInfo?.cached && (
                  <span className="text-xs text-gray-5">(cached)</span>
                )}
              </div>

              {/* Default Markup */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <HiOutlineAdjustments className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-1">Default Markup:</span>
                </div>
                <div className="flex items-center gap-1">
                  {MARKUP_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setDefaultMarkup(preset.value)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        defaultMarkup === preset.value
                          ? 'bg-green-500 text-white'
                          : 'bg-dark-3 text-gray-5 hover:bg-dark-4 hover:text-gray-1'
                      }`}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={MARKUP_PRESETS.some(p => p.value === defaultMarkup) ? '' : defaultMarkup}
                    placeholder="Custom"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setDefaultMarkup(val);
                      }
                    }}
                    className="w-20 px-2 py-1.5 bg-dark-3 border border-dark-4 rounded-lg text-xs text-gray-1 focus:outline-none focus:border-green-500/50 placeholder:text-gray-5"
                  />
                </div>
              </div>
            </div>

            {/* Info tooltip */}
            <div className="flex items-start gap-2 mt-3 text-xs text-gray-5">
              <HiOutlineInformationCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                CJ prices are in <span className="text-blue-400 font-medium">USD</span>. 
                They will be converted to <span className="text-green-400 font-medium">ZAR</span> using the current exchange rate, 
                then your markup will be applied to calculate the selling price.
              </p>
            </div>
          </div>

          {/* Search CJ */}
          <div className="space-y-3">
            {/* Source Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-5">Search in:</span>
              <div className="flex rounded-lg overflow-hidden border border-dark-4">
                <button
                  onClick={() => {
                    setCJSearchSource('catalog');
                    setCJProducts([]);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    cjSearchSource === 'catalog'
                      ? 'bg-main-1 text-white'
                      : 'bg-dark-3 text-gray-5 hover:text-gray-1'
                  }`}
                >
                  CJ Catalog
                </button>
                <button
                  onClick={() => {
                    setCJSearchSource('my-products');
                    setCJProducts([]);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    cjSearchSource === 'my-products'
                      ? 'bg-main-1 text-white'
                      : 'bg-dark-3 text-gray-5 hover:text-gray-1'
                  }`}
                >
                  My Added Products
                </button>
              </div>
              {cjSearchSource === 'my-products' && (
                <span className="text-xs text-gray-5 ml-2">(Products you&apos;ve added to your CJ account)</span>
              )}
            </div>
            
            {/* Search Input */}
            <div className="flex gap-3">
              <Input
                placeholder={cjSearchSource === 'catalog' 
                  ? "Search CJ Dropshipping catalog..." 
                  : "Search your added products (or leave empty to browse all)..."
                }
                value={cjSearchQuery}
                onChange={(e) => setCJSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCJProducts(false)}
                leftIcon={<HiOutlineSearch className="w-4 h-4" />}
                className="flex-1"
              />
              <Button onClick={() => searchCJProducts(false)} isLoading={isSearchingCJ}>
                {cjSearchSource === 'my-products' && !cjSearchQuery.trim() ? 'Browse All' : 'Search'}
              </Button>
            </div>
          </div>

          {/* CJ Products Results */}
          {cjProducts.length > 0 && (
            <div>
              {/* Products count header */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-5">
                  Showing <span className="text-gray-1 font-medium">{cjProducts.length}</span>
                  {cjPagination.total > 0 && (
                    <> of <span className="text-gray-1 font-medium">{cjPagination.total}</span></>
                  )} products
                </p>
                {cjPagination.hasMore && (
                  <span className="text-xs text-main-1">More available</span>
                )}
              </div>
              
              <div className="max-h-[50vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cjProducts.map((product) => {
                  const pricing = calculatePricing(product.basePrice, product.id);
                  const hasCustom = hasCustomPrice(product.id);
                  const currentMarkup = getProductMarkup(product.id);
                  
                  return (
                    <div 
                      key={product.id}
                      className="p-4 bg-dark-3 rounded-xl border border-dark-4 hover:border-main-1/30 transition-all"
                    >
                      <div className="flex gap-4">
                        {/* Product Image */}
                        <div className="w-20 h-20 bg-dark-4 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {product.images?.[0] ? (
                            <img 
                              src={product.images[0].src}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-5 text-xs">
                              No image
                            </div>
                          )}
                          {/* Image count badge */}
                          {product.images && product.images.length > 1 && (
                            <div className="absolute bottom-1 right-1 bg-dark-2/90 px-1.5 py-0.5 rounded text-[10px] text-gray-1 font-medium">
                              +{product.images.length - 1}
                            </div>
                          )}
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-1 line-clamp-2 mb-1">
                            {product.name}
                          </h4>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-blue-400 font-mono">{formatUSD(product.basePrice)}</span>
                            <span className="text-gray-5">→</span>
                            <span className="text-red-400 font-mono">{formatZAR(pricing.costZAR)}</span>
                          </div>
                          {/* Additional info badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {product.images && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                {product.images.length} img{product.images.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {product.variants && product.variants.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                                {product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {product.features && product.features.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                                {product.features.length} feature{product.features.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {product.specifications && Object.keys(product.specifications).length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                {Object.keys(product.specifications).length} spec{Object.keys(product.specifications).length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Pricing Controls */}
                      <div className="mt-3 p-3 bg-dark-4/50 rounded-lg space-y-3">
                        {/* Markup Controls */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-gray-5">Markup %</label>
                            <div className="flex items-center gap-1">
                              {MARKUP_PRESETS.slice(0, 4).map((preset) => (
                                <button
                                  key={preset.value}
                                  onClick={() => updateProductPricing(product.id, 'markup', preset.value)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    !hasCustom && currentMarkup === preset.value
                                      ? 'bg-green-500 text-white'
                                      : 'bg-dark-3 text-gray-5 hover:bg-dark-4 hover:text-gray-1'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="1000"
                              placeholder="Custom %"
                              value={hasCustom ? '' : (productPricing[product.id]?.markup ?? '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  updateProductPricing(product.id, 'markup', undefined);
                                } else {
                                  const num = Math.max(0, parseInt(val) || 0);
                                  updateProductPricing(product.id, 'markup', num);
                                }
                              }}
                              className="flex-1 px-3 py-1.5 bg-dark-3 border border-dark-4 rounded-lg text-sm text-gray-1 focus:outline-none focus:border-main-1/50 placeholder:text-gray-5"
                            />
                            <span className="text-xs text-gray-5 w-20">
                              = {formatZAR(pricing.costZAR * (1 + (productPricing[product.id]?.markup ?? defaultMarkup) / 100))}
                            </span>
                          </div>
                        </div>
                        
                        {/* Or Custom Price */}
                        <div className="relative">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dark-4" />
                          <span className="relative bg-dark-4/50 px-2 text-xs text-gray-5 left-1/2 -translate-x-1/2 inline-block">
                            OR set price directly
                          </span>
                        </div>
                        
                        <div>
                          <label className="text-xs text-gray-5 mb-1 block">Custom Sell Price (ZAR)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-5">R</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder={`e.g. ${Math.round(pricing.costZAR * 2)}`}
                              value={productPricing[product.id]?.customPrice ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  updateProductPricing(product.id, 'customPrice', undefined);
                                } else {
                                  const num = Math.max(0, parseFloat(val) || 0);
                                  updateProductPricing(product.id, 'customPrice', num);
                                }
                              }}
                              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm text-gray-1 focus:outline-none placeholder:text-gray-5 ${
                                hasCustom 
                                  ? 'bg-green-500/10 border-green-500/30 focus:border-green-500/50' 
                                  : 'bg-dark-3 border-dark-4 focus:border-main-1/50'
                              }`}
                            />
                            {hasCustom && (
                              <button
                                onClick={() => updateProductPricing(product.id, 'customPrice', undefined)}
                                className="text-xs text-gray-5 hover:text-red-400"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Summary */}
                        <div className="pt-2 border-t border-dark-4 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold text-green-400">{formatZAR(pricing.sellZAR)}</p>
                            <p className="text-[10px] text-gray-5">Sell Price</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-main-1">{formatZAR(pricing.profitZAR)}</p>
                            <p className="text-[10px] text-gray-5">Profit</p>
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${
                              pricing.profitMargin >= 60 ? 'text-green-400' :
                              pricing.profitMargin >= 40 ? 'text-yellow-400' :
                              pricing.profitMargin < 0 ? 'text-red-500' : 'text-red-400'
                            }`}>
                              {pricing.profitMargin.toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-gray-5">Margin</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center justify-between mt-3">
                        <a
                          href={`https://www.cjdropshipping.com/product/${product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-p-${product.id}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-main-1 hover:text-main-1/80 transition-colors"
                        >
                          <HiOutlineExternalLink className="w-4 h-4" />
                          View on CJ
                        </a>
                        <Button 
                          size="sm" 
                          onClick={() => importCJProduct(product)}
                          disabled={importingProductId !== null || pricing.sellZAR <= 0}
                          isLoading={importingProductId === product.id}
                          leftIcon={importingProductId !== product.id ? <HiOutlineCloudDownload className="w-4 h-4" /> : undefined}
                        >
                          {importingProductId === product.id ? 'Importing...' : `Import @ ${formatZAR(pricing.sellZAR)}`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
              
              {/* Load More Button */}
              {cjPagination.hasMore && (
                <div className="mt-4 text-center">
                  <Button
                    variant="secondary"
                    onClick={() => searchCJProducts(true)}
                    isLoading={isLoadingMoreCJ}
                    disabled={isLoadingMoreCJ}
                  >
                    {isLoadingMoreCJ ? 'Loading...' : `Load More Products (${cjPagination.total - cjProducts.length} remaining)`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {cjProducts.length === 0 && !isSearchingCJ && (cjSearchQuery || cjSearchSource === 'my-products') && (
            <p className="text-center text-gray-5 py-8">
              {cjSearchSource === 'my-products' 
                ? 'No products found in your CJ account. Add products to your CJ account first.'
                : 'No products found. Try a different search term.'
              }
            </p>
          )}
          
          {cjProducts.length === 0 && !cjSearchQuery && cjSearchSource === 'catalog' && !isSearchingCJ && (
            <div className="text-center py-8 text-gray-5">
              <p>Search for products in the CJ Dropshipping catalog above.</p>
              <p className="text-xs mt-2">Try searches like: &quot;gaming mouse&quot;, &quot;LED lights&quot;, &quot;phone accessories&quot;</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedProduct(null);
        }}
        onConfirm={deleteProduct}
        title="Delete Product"
        message={`Are you sure you want to delete "${selectedProduct?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isSaving}
      />
    </div>
  );
}
