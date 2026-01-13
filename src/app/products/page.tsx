'use client';

import { useEffect, useState, useCallback } from 'react';
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

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // CJ Product import states
  const [cjSearchQuery, setCJSearchQuery] = useState('');
  const [cjProducts, setCJProducts] = useState<any[]>([]);
  const [isSearchingCJ, setIsSearchingCJ] = useState(false);

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
  }, [page, categoryFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const searchCJProducts = async () => {
    if (!cjSearchQuery.trim()) return;
    setIsSearchingCJ(true);
    
    try {
      const response = await fetch(`/api/products/search-cj?q=${encodeURIComponent(cjSearchQuery)}`);
      const result = await response.json();
      
      if (result.success) {
        setCJProducts(result.data || []);
      } else {
        console.error('CJ search error:', result.error);
      }
    } catch (err) {
      console.error('CJ search error:', err);
    } finally {
      setIsSearchingCJ(false);
    }
  };

  const importCJProduct = async (cjProduct: any) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cjProduct }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchProducts();
        setShowAddModal(false);
        setCJProducts([]);
        setCJSearchQuery('');
      } else {
        alert(`Failed to import: ${result.error}`);
      }
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setIsSaving(false);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

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
              {/* Image */}
              <div className="relative aspect-square bg-dark-3">
                {product.images && product.images[0] ? (
                  <img 
                    src={product.images[0].src}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-5">
                    No Image
                  </div>
                )}
                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-2">
                  {product.is_featured && (
                    <Badge variant="primary">Featured</Badge>
                  )}
                  {!product.is_active && (
                    <Badge variant="danger">Inactive</Badge>
                  )}
                </div>
                {/* Quick Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                  <button
                    onClick={() => toggleProductStatus(product, 'is_active')}
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
                    onClick={() => toggleProductStatus(product, 'is_featured')}
                    className="p-2 bg-dark-2/90 rounded-lg hover:bg-dark-3 transition-colors"
                    title={product.is_featured ? 'Remove Featured' : 'Set Featured'}
                  >
                    <HiOutlineStar className={`w-4 h-4 ${product.is_featured ? 'text-main-1 fill-main-1' : 'text-gray-5'}`} />
                  </button>
                  <button
                    onClick={() => {
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
              
              {/* Content */}
              <div className="p-4">
                <p className="text-xs text-gray-5 uppercase mb-1">{product.category}</p>
                <h3 className="font-medium text-gray-1 line-clamp-2 mb-2 min-h-[2.5rem]">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-heading text-main-1">
                      {formatCurrency(product.sell_price)}
                    </p>
                    <p className="text-xs text-gray-5">
                      Cost: {formatCurrency(product.base_price)}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-5 px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setCJProducts([]);
          setCJSearchQuery('');
        }}
        title="Add Product from CJ Dropshipping"
        size="3xl"
      >
        <div className="space-y-6">
          {/* Search CJ */}
          <div className="flex gap-3">
            <Input
              placeholder="Search CJ Dropshipping catalog..."
              value={cjSearchQuery}
              onChange={(e) => setCJSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchCJProducts()}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
              className="flex-1"
            />
            <Button onClick={searchCJProducts} isLoading={isSearchingCJ}>
              Search
            </Button>
          </div>

          {/* CJ Products Results */}
          {cjProducts.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cjProducts.map((product) => (
                  <div 
                    key={product.id}
                    className="p-4 bg-dark-3 rounded-lg border border-dark-4 hover:border-main-1/30 transition-colors"
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="w-24 h-24 bg-dark-4 rounded-lg overflow-hidden flex-shrink-0">
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
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-1 line-clamp-2 mb-2">
                          {product.name}
                        </h4>
                        
                        {/* Description */}
                        {product.shortDescription && (
                          <p className="text-xs text-gray-5 line-clamp-2 mb-2">
                            {product.shortDescription}
                          </p>
                        )}
                        
                        {/* Pricing */}
                        <div className="flex items-center gap-4 text-xs">
                          <div>
                            <span className="text-gray-5">Cost: </span>
                            <span className="text-red-400 font-medium">{formatCurrency(product.basePrice)}</span>
                          </div>
                          <div>
                            <span className="text-gray-5">Sell: </span>
                            <span className="text-green-400 font-medium">{formatCurrency(product.price)}</span>
                          </div>
                          <div>
                            <span className="text-gray-5">Profit: </span>
                            <span className="text-main-1 font-medium">
                              {formatCurrency(product.price - product.basePrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-4">
                      <a
                        href={`https://www.cjdropshipping.com/product/${product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-p-${product.id}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-main-1 hover:text-main-1/80 transition-colors"
                      >
                        <HiOutlineExternalLink className="w-4 h-4" />
                        View on CJ Dropshipping
                      </a>
                      <Button 
                        size="sm" 
                        onClick={() => importCJProduct(product)}
                        disabled={isSaving}
                        leftIcon={<HiOutlineCloudDownload className="w-4 h-4" />}
                      >
                        Import Product
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cjProducts.length === 0 && cjSearchQuery && !isSearchingCJ && (
            <p className="text-center text-gray-5 py-8">
              No products found. Try a different search term.
            </p>
          )}
          
          {!cjSearchQuery && !isSearchingCJ && (
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

