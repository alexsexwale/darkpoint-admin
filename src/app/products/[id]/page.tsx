'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { 
  HiOutlineArrowLeft, 
  HiOutlinePencil, 
  HiOutlineTrash, 
  HiOutlineExternalLink,
  HiOutlinePhotograph,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineColorSwatch,
  HiOutlineGlobe,
  HiOutlineClock,
  HiOutlineScale,
  HiOutlineTrendingUp,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineStar,
  HiOutlineRefresh,
  HiOutlineClipboardCopy,
  HiOutlineCube,
  HiOutlineSparkles,
  HiOutlineClipboardList,
  HiOutlineDocumentText,
  HiOutlineLightBulb,
  HiOutlineCollection,
  HiOutlineTruck,
  HiOutlineArchive,
} from 'react-icons/hi';
import clsx from 'clsx';

interface ProductImage {
  src: string;
  alt?: string;
}

interface ProductVariant {
  id: string;
  name: string;
  price?: number;
  sku?: string;
  inStock?: boolean;
}

interface AdminProduct {
  id: string;
  cj_product_id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  base_price: number;
  sell_price: number;
  compare_at_price: number | null;
  markup_percent: number;
  original_price_usd: number | null;
  exchange_rate_used: number | null;
  category: string | null;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  weight: number;
  source_from: string;
  is_active: boolean;
  is_featured: boolean;
  stock_quantity: number | null;
  low_stock_threshold: number;
  sort_order: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Additional detailed fields
  sell_point: string | null;
  raw_description: string | null;
  package_contents: string | null;
  specifications: Record<string, string> | null;
  features: string[] | null;
  remark: string | null;
  package_weight: number | null;
  product_sku: string | null;
}

// Currency formatters
const formatZAR = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatUSD = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Shipping state
  const [shippingOptions, setShippingOptions] = useState<Array<{
    name: string;
    price: number;
    currency: string;
    minDays: number;
    maxDays: number;
    deliveryTime: string;
  }>>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  
  // Stock state
  const [stockInfo, setStockInfo] = useState<{
    totalStock: number;
    stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
    variants: Array<{
      id: string;
      name: string;
      value: string;
      stock: number;
      sku: string;
    }>;
    lastChecked: string;
  } | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  
  // Inline pricing edit state
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    sell_price: 0,
    markup_percent: 0,
  });
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [currentExchangeRate, setCurrentExchangeRate] = useState<number | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    short_description: '',
    sell_price: 0,
    markup_percent: 0,
    category: '',
    tags: '',
    is_active: true,
    is_featured: false,
  });

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  // Fetch shipping and stock when product is loaded
  useEffect(() => {
    if (product) {
      fetchShipping();
      fetchStock();
    }
  }, [product?.id]);

  const fetchStock = async () => {
    if (!product) return;
    setIsLoadingStock(true);
    setStockError(null);
    
    try {
      const response = await fetch(`/api/products/${product.id}/stock`);
      const result = await response.json();
      
      if (result.success) {
        setStockInfo(result.data);
      } else {
        setStockError(result.error || 'Failed to fetch stock');
      }
    } catch (err) {
      console.error('Error fetching stock:', err);
      setStockError('Failed to fetch stock information');
    } finally {
      setIsLoadingStock(false);
    }
  };

  const fetchShipping = async () => {
    if (!product) return;
    setIsLoadingShipping(true);
    setShippingError(null);
    
    try {
      const response = await fetch(`/api/products/${product.id}/shipping`);
      const result = await response.json();
      
      if (result.success) {
        setShippingOptions(result.data || []);
      } else {
        setShippingError(result.error || 'Failed to fetch shipping');
      }
    } catch (err) {
      console.error('Error fetching shipping:', err);
      setShippingError('Failed to fetch shipping information');
    } finally {
      setIsLoadingShipping(false);
    }
  };

  const fetchProduct = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_products')
        .select('*')
        .eq('id', productId)
        .single();
      
      if (error) throw error;
      
      setProduct(data);
      setEditForm({
        name: data.name,
        description: data.description || '',
        short_description: data.short_description || '',
        sell_price: data.sell_price,
        markup_percent: data.markup_percent,
        category: data.category || '',
        tags: data.tags?.join(', ') || '',
        is_active: data.is_active,
        is_featured: data.is_featured,
      });
      setPricingForm({
        sell_price: data.sell_price,
        markup_percent: data.markup_percent,
      });
    } catch (err) {
      console.error('Error fetching product:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch('/api/exchange-rate');
      const result = await response.json();
      if (result.success) {
        setCurrentExchangeRate(result.rate);
      }
    } catch (err) {
      console.error('Error fetching exchange rate:', err);
    }
  };

  const handlePricingSave = async () => {
    if (!product) return;
    setIsSavingPricing(true);
    
    try {
      const { error } = await supabase
        .from('admin_products')
        .update({
          sell_price: pricingForm.sell_price,
          markup_percent: pricingForm.markup_percent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);
      
      if (error) throw error;
      
      await fetchProduct();
      setIsEditingPricing(false);
    } catch (err) {
      console.error('Error saving pricing:', err);
      alert('Failed to save pricing');
    } finally {
      setIsSavingPricing(false);
    }
  };

  const recalculatePriceFromMarkup = (markup: number) => {
    if (!product) return;
    const costZAR = product.base_price;
    const newSellPrice = Math.ceil(costZAR * (1 + markup / 100));
    setPricingForm(prev => ({ ...prev, markup_percent: markup, sell_price: newSellPrice }));
  };

  const recalculateMarkupFromPrice = (sellPrice: number) => {
    if (!product) return;
    const costZAR = product.base_price;
    const newMarkup = Math.round(((sellPrice - costZAR) / costZAR) * 100);
    setPricingForm(prev => ({ ...prev, sell_price: sellPrice, markup_percent: Math.max(0, newMarkup) }));
  };

  const handleSave = async () => {
    if (!product) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('admin_products')
        .update({
          name: editForm.name,
          description: editForm.description,
          short_description: editForm.short_description,
          sell_price: editForm.sell_price,
          markup_percent: editForm.markup_percent,
          category: editForm.category,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          is_active: editForm.is_active,
          is_featured: editForm.is_featured,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);
      
      if (error) throw error;
      
      await fetchProduct();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('admin_products')
        .delete()
        .eq('id', product.id);
      
      if (error) throw error;
      
      router.push('/products');
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSync = async () => {
    if (!product) return;
    setIsSyncing(true);
    setSyncMessage(null);
    
    try {
      const response = await fetch(`/api/products/${product.id}/sync`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSyncMessage({ 
          type: 'success', 
          text: `Synced! ${result.imagesCount} images, ${result.variantsCount || 0} variants loaded.` 
        });
        // Refresh product data
        await fetchProduct();
        setSelectedImage(0); // Reset to first image
      } else {
        setSyncMessage({ type: 'error', text: result.error || 'Sync failed' });
      }
    } catch (err) {
      console.error('Sync error:', err);
      setSyncMessage({ type: 'error', text: 'Failed to sync with CJ Dropshipping' });
    } finally {
      setIsSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main-1"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-5">Product not found</p>
        <Button onClick={() => router.push('/products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  const profitZAR = product.sell_price - product.base_price;
  const profitMargin = product.sell_price > 0 ? (profitZAR / product.sell_price) * 100 : 0;
  const images = product.images || [];
  const variants = product.variants || [];

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.push('/products')}
        leftIcon={<HiOutlineArrowLeft className="w-4 h-4" />}
      >
        Back to Products
      </Button>

      {/* Product Header Card */}
      <div className="bg-dark-2 rounded-xl border border-dark-4 p-6">
        {/* Title and ID */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-heading text-gray-1 leading-tight mb-2">
            {product.name}
          </h1>
          <p className="text-sm text-gray-5">
            Product ID: <span className="font-mono text-gray-3">{product.id.slice(0, 8)}...</span>
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className={clsx(
            'px-3 py-1.5 rounded-full text-xs font-medium',
            product.is_active 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          )}>
            {product.is_active ? '● Active' : '○ Inactive'}
          </span>
          {product.is_featured && (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              ★ Featured
            </span>
          )}
          {product.category && (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {product.category}
            </span>
          )}
          <a
            href={`https://www.cjdropshipping.com/product/${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-p-${product.cj_product_id}.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-main-1/10 text-main-1 border border-main-1/30 hover:bg-main-1/20 transition-colors inline-flex items-center gap-1.5"
          >
            <HiOutlineExternalLink className="w-3.5 h-3.5" />
            View on CJ
          </a>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-dark-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copyToClipboard(product.id)}
            leftIcon={<HiOutlineClipboardCopy className="w-4 h-4" />}
            className="min-w-[100px]"
          >
            {copied ? 'Copied!' : 'Copy ID'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSync}
            isLoading={isSyncing}
            leftIcon={!isSyncing ? <HiOutlineRefresh className="w-4 h-4" /> : undefined}
            className="min-w-[130px]"
          >
            {isSyncing ? 'Syncing...' : 'Sync from CJ'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={<HiOutlinePencil className="w-4 h-4" />}
          >
            Edit Product
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<HiOutlineTrash className="w-4 h-4" />}
          >
            Delete
          </Button>
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div className={clsx(
            'mt-4 px-4 py-3 rounded-lg flex items-center gap-2 text-sm',
            syncMessage.type === 'success' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          )}>
            {syncMessage.type === 'success' ? (
              <HiOutlineCheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <HiOutlineXCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{syncMessage.text}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Images */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="bg-dark-3 rounded-xl border border-dark-4 overflow-hidden aspect-square">
            {images.length > 0 ? (
              <img
                src={images[selectedImage]?.src}
                alt={product.name}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-5 gap-2">
                <HiOutlinePhotograph className="w-16 h-16" />
                <span>No images available</span>
              </div>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={clsx(
                    'w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
                    selectedImage === index
                      ? 'border-main-1 ring-2 ring-main-1/30'
                      : 'border-dark-4 hover:border-gray-5'
                  )}
                >
                  <img
                    src={img.src}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Image Count & Info */}
          <div className="flex items-center justify-between p-3 bg-dark-4/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-1">
              <HiOutlinePhotograph className="w-5 h-5 text-main-1" />
              <span className="font-medium">{images.length} image{images.length !== 1 ? 's' : ''}</span>
              <span className="text-gray-5">available for website</span>
            </div>
            {images.length > 0 && (
              <span className="text-xs text-gray-5 bg-dark-3 px-2 py-1 rounded">
                Viewing {selectedImage + 1} of {images.length}
              </span>
            )}
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Pricing Card */}
          <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider flex items-center gap-2">
                <HiOutlineCurrencyDollar className="w-4 h-4" />
                Pricing Information
              </h3>
              {!isEditingPricing ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsEditingPricing(true);
                    fetchExchangeRate();
                  }}
                  leftIcon={<HiOutlinePencil className="w-3.5 h-3.5" />}
                  className="!py-1 !px-2 text-xs"
                >
                  Edit Pricing
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIsEditingPricing(false);
                      setPricingForm({
                        sell_price: product.sell_price,
                        markup_percent: product.markup_percent,
                      });
                    }}
                    className="!py-1 !px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePricingSave}
                    isLoading={isSavingPricing}
                    className="!py-1 !px-2 text-xs"
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {/* Price Flow - Stacked on mobile, grid on larger screens */}
              <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
                {product.original_price_usd && (
                  <div className="p-3 bg-dark-4/50 rounded-lg flex sm:flex-col items-center sm:items-center justify-between sm:justify-center sm:text-center">
                    <p className="text-xs text-gray-5 sm:order-2 sm:mt-1">CJ Cost (USD)</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-400 font-mono sm:order-1">
                      {formatUSD(product.original_price_usd)}
                    </p>
                  </div>
                )}
                <div className="p-3 bg-dark-4/50 rounded-lg flex sm:flex-col items-center sm:items-center justify-between sm:justify-center sm:text-center">
                  <p className="text-xs text-gray-5 sm:order-2 sm:mt-1">Your Cost (ZAR)</p>
                  <p className="text-lg sm:text-xl font-bold text-red-400 font-mono sm:order-1">
                    {formatZAR(product.base_price)}
                  </p>
                </div>
                <div className="p-3 bg-dark-4/50 rounded-lg flex sm:flex-col items-center sm:items-center justify-between sm:justify-center sm:text-center">
                  <p className="text-xs text-gray-5 sm:order-2 sm:mt-1">Sell Price (ZAR)</p>
                  {isEditingPricing ? (
                    <input
                      type="number"
                      value={pricingForm.sell_price}
                      onChange={(e) => recalculateMarkupFromPrice(parseFloat(e.target.value) || 0)}
                      className="w-full text-lg sm:text-xl font-bold text-green-400 font-mono text-center bg-dark-3 border border-dark-4 rounded px-2 py-1 focus:border-main-1 focus:outline-none sm:order-1"
                      min="0"
                    />
                  ) : (
                    <p className="text-lg sm:text-xl font-bold text-green-400 font-mono sm:order-1">
                      {formatZAR(product.sell_price)}
                    </p>
                  )}
                </div>
              </div>

              {/* Inline Editing Section */}
              {isEditingPricing && (
                <div className="p-4 bg-main-1/5 border border-main-1/20 rounded-lg space-y-4">
                  <div>
                    <label className="block text-xs text-gray-5 mb-2">Quick Markup Selection</label>
                    <div className="flex flex-wrap gap-2">
                      {[50, 100, 150, 200, 250, 300].map((markup) => (
                        <button
                          key={markup}
                          onClick={() => recalculatePriceFromMarkup(markup)}
                          className={clsx(
                            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                            pricingForm.markup_percent === markup
                              ? 'bg-main-1 text-white'
                              : 'bg-dark-4 text-gray-3 hover:bg-dark-4/80'
                          )}
                        >
                          {markup}%
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-5 mb-2">Custom Markup %</label>
                      <input
                        type="number"
                        value={pricingForm.markup_percent}
                        onChange={(e) => recalculatePriceFromMarkup(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-dark-3 border border-dark-4 rounded text-gray-1 focus:border-main-1 focus:outline-none"
                        min="0"
                        placeholder="Enter markup %"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-5 mb-2">Custom Sell Price (ZAR)</label>
                      <input
                        type="number"
                        value={pricingForm.sell_price}
                        onChange={(e) => recalculateMarkupFromPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 bg-dark-3 border border-dark-4 rounded text-gray-1 focus:border-main-1 focus:outline-none"
                        min="0"
                        placeholder="Enter sell price"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="pt-3 border-t border-dark-4/50">
                    <p className="text-xs text-gray-5 mb-2">Preview:</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-3">New Profit:</span>
                      <span className="text-lg font-bold text-main-1">
                        {formatZAR(pricingForm.sell_price - product.base_price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-gray-3">New Margin:</span>
                      <span className={clsx(
                        'text-lg font-bold',
                        ((pricingForm.sell_price - product.base_price) / pricingForm.sell_price * 100) >= 60 ? 'text-green-400' :
                        ((pricingForm.sell_price - product.base_price) / pricingForm.sell_price * 100) >= 40 ? 'text-yellow-400' : 'text-red-400'
                      )}>
                        {pricingForm.sell_price > 0 
                          ? ((pricingForm.sell_price - product.base_price) / pricingForm.sell_price * 100).toFixed(1) 
                          : 0}%
                      </span>
                    </div>
                  </div>

                  {/* Current Exchange Rate */}
                  {currentExchangeRate && (
                    <div className="pt-3 border-t border-dark-4/50">
                      <p className="text-xs text-gray-5">
                        Current exchange rate: <span className="text-gray-3">1 USD = R{currentExchangeRate.toFixed(2)}</span>
                        {product.exchange_rate_used && currentExchangeRate !== product.exchange_rate_used && (
                          <span className={clsx(
                            'ml-2',
                            currentExchangeRate > product.exchange_rate_used ? 'text-red-400' : 'text-green-400'
                          )}>
                            ({currentExchangeRate > product.exchange_rate_used ? '↑' : '↓'} 
                            {Math.abs(((currentExchangeRate - product.exchange_rate_used) / product.exchange_rate_used) * 100).toFixed(1)}% 
                            since import)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Profit Summary */}
              {!isEditingPricing && (
                <div className="pt-4 border-t border-dark-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-5">Profit per Sale</span>
                    <span className="text-base sm:text-lg font-bold text-main-1">{formatZAR(profitZAR)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-5">Markup</span>
                    <span className="text-base sm:text-lg font-bold text-gray-1">{product.markup_percent}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-5">Profit Margin</span>
                    <span className={clsx(
                      'text-base sm:text-lg font-bold',
                      profitMargin >= 60 ? 'text-green-400' :
                      profitMargin >= 40 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {profitMargin.toFixed(1)}%
                    </span>
                  </div>

                  {/* Margin Bar */}
                  <div className="mt-3 h-3 bg-dark-4 rounded-full overflow-hidden">
                    <div 
                      className={clsx(
                        'h-full rounded-full transition-all',
                        profitMargin >= 60 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                        profitMargin >= 40 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                        'bg-gradient-to-r from-red-500 to-orange-400'
                      )}
                      style={{ width: `${Math.min(profitMargin, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Exchange Rate Info */}
              {product.exchange_rate_used && !isEditingPricing && (
                <div className="pt-3 border-t border-dark-4 text-xs text-gray-5">
                  <p>Exchange rate at import: 1 USD = R{product.exchange_rate_used.toFixed(2)}</p>
                </div>
              )}

              {/* Compare At Price */}
              {product.compare_at_price && !isEditingPricing && (
                <div className="pt-3 border-t border-dark-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-5">Compare at Price</span>
                    <span className="text-lg line-through text-gray-5">{formatZAR(product.compare_at_price)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stock Information Card */}
          <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider flex items-center gap-2">
                <HiOutlineArchive className="w-4 h-4" />
                CJ Dropshipping Stock
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchStock}
                isLoading={isLoadingStock}
                leftIcon={!isLoadingStock ? <HiOutlineRefresh className="w-3.5 h-3.5" /> : undefined}
                className="!py-1 !px-2 text-xs"
              >
                Refresh
              </Button>
            </div>

            {isLoadingStock ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-main-1"></div>
              </div>
            ) : stockError ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{stockError}</p>
                <button 
                  onClick={fetchStock}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Try again
                </button>
              </div>
            ) : stockInfo ? (
              <div className="space-y-4">
                {/* Total Stock Display */}
                <div className={clsx(
                  'p-4 rounded-lg border text-center',
                  stockInfo.stockStatus === 'out_of_stock' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : stockInfo.stockStatus === 'low_stock'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                )}>
                  <p className={clsx(
                    'text-4xl font-bold font-mono',
                    stockInfo.stockStatus === 'out_of_stock' 
                      ? 'text-red-400' 
                      : stockInfo.stockStatus === 'low_stock'
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  )}>
                    {stockInfo.totalStock.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-5 mt-1">Total Units Available</p>
                  <span className={clsx(
                    'inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium',
                    stockInfo.stockStatus === 'out_of_stock' 
                      ? 'bg-red-500/20 text-red-400' 
                      : stockInfo.stockStatus === 'low_stock'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
                  )}>
                    {stockInfo.stockStatus === 'out_of_stock' 
                      ? '⚠ Out of Stock' 
                      : stockInfo.stockStatus === 'low_stock'
                      ? '⚠ Low Stock'
                      : '✓ In Stock'}
                  </span>
                </div>

                {/* Variant Stock Breakdown */}
                {stockInfo.variants.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-5 mb-2">Stock by Variant:</p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {stockInfo.variants.map((variant, index) => (
                        <div 
                          key={variant.id || index}
                          className="flex items-center justify-between p-2 bg-dark-4/50 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-gray-3 truncate">
                              {variant.name ? `${variant.name}: ${variant.value}` : variant.value || variant.sku || `Variant ${index + 1}`}
                            </span>
                            {variant.sku && (
                              <span className="text-xs text-gray-5 font-mono hidden sm:inline">
                                ({variant.sku})
                              </span>
                            )}
                          </div>
                          <span className={clsx(
                            'font-bold font-mono ml-2',
                            variant.stock === 0 
                              ? 'text-red-400' 
                              : variant.stock < 10
                              ? 'text-yellow-400'
                              : 'text-green-400'
                          )}>
                            {variant.stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last Checked */}
                <div className="pt-3 border-t border-dark-4 text-xs text-gray-5">
                  <p>Last checked: {new Date(stockInfo.lastChecked).toLocaleString('en-ZA')}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-5">
                <HiOutlineArchive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No stock information available</p>
              </div>
            )}
          </div>

          {/* Shipping Information Card */}
          <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider flex items-center gap-2">
                <HiOutlineTruck className="w-4 h-4" />
                Shipping to South Africa
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchShipping}
                isLoading={isLoadingShipping}
                leftIcon={!isLoadingShipping ? <HiOutlineRefresh className="w-3.5 h-3.5" /> : undefined}
                className="!py-1 !px-2 text-xs"
              >
                Refresh
              </Button>
            </div>

            {isLoadingShipping ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-main-1"></div>
              </div>
            ) : shippingError ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{shippingError}</p>
                <button 
                  onClick={fetchShipping}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Try again
                </button>
              </div>
            ) : shippingOptions.length === 0 ? (
              <div className="text-center py-6 text-gray-5">
                <HiOutlineTruck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No shipping options available</p>
                <p className="text-xs mt-1">Product weight may not be set</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shippingOptions.slice(0, 5).map((option, index) => (
                  <div 
                    key={index}
                    className={clsx(
                      'p-3 rounded-lg border transition-all',
                      index === 0 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-dark-4/50 border-dark-4 hover:border-dark-4/80'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded">
                            CHEAPEST
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-1">{option.name}</span>
                      </div>
                      <span className="text-sm font-bold text-main-1">
                        {formatUSD(option.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-5">
                      <div className="flex items-center gap-1">
                        <HiOutlineClock className="w-3.5 h-3.5" />
                        <span>
                          {option.minDays === option.maxDays 
                            ? `${option.minDays} days` 
                            : `${option.minDays}-${option.maxDays} days`}
                        </span>
                      </div>
                      {option.price > 0 && (
                        <span className="text-gray-5/70">
                          ~{formatZAR(option.price * (product.exchange_rate_used || 18))} ZAR
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {shippingOptions.length > 5 && (
                  <p className="text-xs text-gray-5 text-center pt-2">
                    +{shippingOptions.length - 5} more shipping options available
                  </p>
                )}
                
                {/* Shipping Summary */}
                <div className="pt-3 mt-3 border-t border-dark-4">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2 bg-dark-4/30 rounded-lg">
                      <p className="text-xs text-gray-5">Cheapest</p>
                      <p className="text-sm font-bold text-green-400">
                        {formatUSD(shippingOptions[0]?.price || 0)}
                      </p>
                    </div>
                    <div className="p-2 bg-dark-4/30 rounded-lg">
                      <p className="text-xs text-gray-5">Fastest</p>
                      <p className="text-sm font-bold text-blue-400">
                        {shippingOptions.reduce((fastest, opt) => 
                          opt.minDays < fastest.minDays ? opt : fastest, 
                          shippingOptions[0]
                        )?.minDays || '?'} days
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product Details Card */}
          <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
            <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HiOutlineTag className="w-4 h-4" />
              Product Details
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <HiOutlineGlobe className="w-5 h-5 text-gray-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-5">Source</p>
                  <p className="text-sm text-gray-1">{product.source_from}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <HiOutlineScale className="w-5 h-5 text-gray-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-5">Product Weight</p>
                  <p className="text-sm text-gray-1">{product.weight > 0 ? `${product.weight} kg` : 'Not specified'}</p>
                </div>
              </div>

              {product.package_weight !== null && product.package_weight > 0 && (
                <div className="flex items-start gap-3">
                  <HiOutlineCube className="w-5 h-5 text-gray-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-5">Package Weight</p>
                    <p className="text-sm text-gray-1">{product.package_weight} kg</p>
                  </div>
                </div>
              )}

              {product.product_sku && (
                <div className="flex items-start gap-3">
                  <HiOutlineTag className="w-5 h-5 text-gray-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-5">Product SKU</p>
                    <p className="text-sm text-gray-1 font-mono">{product.product_sku}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <HiOutlineClock className="w-5 h-5 text-gray-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-5">Added</p>
                  <p className="text-sm text-gray-1">{new Date(product.created_at).toLocaleDateString('en-ZA', { dateStyle: 'full' })}</p>
                </div>
              </div>

              {product.last_synced_at && (
                <div className="flex items-start gap-3">
                  <HiOutlineRefresh className="w-5 h-5 text-gray-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-5">Last Synced</p>
                    <p className="text-sm text-gray-1">{new Date(product.last_synced_at).toLocaleString('en-ZA')}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 text-gray-5 flex-shrink-0 text-center text-xs">ID</span>
                <div>
                  <p className="text-xs text-gray-5">CJ Product ID</p>
                  <p className="text-sm text-gray-1 font-mono break-all">{product.cj_product_id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
              <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-dark-4 rounded-full text-sm text-gray-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selling Points / Features Highlight */}
      {product.sell_point && (
        <div className="bg-gradient-to-r from-main-1/10 to-amber-500/10 rounded-xl border border-main-1/20 p-5">
          <h3 className="text-sm font-medium text-main-1 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineSparkles className="w-4 h-4" />
            Key Selling Points
          </h3>
          <div className="text-gray-1 leading-relaxed">
            {product.sell_point.split(/[\n•·\-]/).filter(p => p.trim()).map((point, index) => (
              <div key={index} className="flex items-start gap-2 mb-2">
                <HiOutlineCheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                <span>{point.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Section */}
      {product.features && product.features.length > 0 && (
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineLightBulb className="w-4 h-4" />
            Features ({product.features.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {product.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-dark-4/50 rounded-lg">
                <span className="w-6 h-6 rounded-full bg-main-1/20 text-main-1 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-1">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specifications Section */}
      {product.specifications && Object.keys(product.specifications).length > 0 && (
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineClipboardList className="w-4 h-4" />
            Specifications
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(product.specifications).map(([key, value]) => (
              <div key={key} className="flex flex-col p-3 bg-dark-4/50 rounded-lg">
                <span className="text-xs text-gray-5 uppercase tracking-wider">{key}</span>
                <span className="text-sm text-gray-1 font-medium mt-1">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Package Contents Section */}
      {product.package_contents && (
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineCube className="w-4 h-4" />
            What&apos;s In The Box
          </h3>
          <div className="space-y-2">
            {product.package_contents.split('\n').filter(line => line.trim()).map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-dark-4/30 rounded-lg">
                <HiOutlineCollection className="w-4 h-4 text-main-1 flex-shrink-0" />
                <span className="text-sm text-gray-1">{item.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Descriptions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Short Description */}
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineDocumentText className="w-4 h-4" />
            Short Description (Website Preview)
          </h3>
          <p className="text-gray-1 leading-relaxed">
            {product.short_description || <span className="text-gray-5 italic">No short description available</span>}
          </p>
        </div>

        {/* Full Description */}
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineDocumentText className="w-4 h-4" />
            Full Description (Product Page)
          </h3>
          <div className="text-gray-1 leading-relaxed prose prose-invert prose-sm max-w-none max-h-[400px] overflow-y-auto">
            {product.description ? (
              <div dangerouslySetInnerHTML={{ __html: product.description.replace(/\n/g, '<br />') }} />
            ) : (
              <span className="text-gray-5 italic">No description available</span>
            )}
          </div>
        </div>
      </div>

      {/* Raw Description (Full CJ Data) */}
      {product.raw_description && product.raw_description !== product.description && (
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineDocumentText className="w-4 h-4" />
            Full Raw Description from CJ (Original Data)
          </h3>
          <div className="text-gray-1 leading-relaxed prose prose-invert prose-sm max-w-none max-h-[500px] overflow-y-auto bg-dark-4/30 p-4 rounded-lg">
            <div dangerouslySetInnerHTML={{ __html: product.raw_description }} />
          </div>
        </div>
      )}

      {/* Additional Notes/Remarks */}
      {product.remark && (
        <div className="bg-yellow-500/10 rounded-xl border border-yellow-500/20 p-5">
          <h3 className="text-sm font-medium text-yellow-400 uppercase tracking-wider mb-4">
            Supplier Notes / Remarks
          </h3>
          <p className="text-gray-1 leading-relaxed">{product.remark}</p>
        </div>
      )}

      {/* Variants Section */}
      {variants.length > 0 && (
        <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
          <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HiOutlineColorSwatch className="w-4 h-4" />
            Variants ({variants.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {variants.map((variant, index) => (
              <div
                key={variant.id || index}
                className="p-3 bg-dark-4/50 rounded-lg border border-dark-4"
              >
                <p className="text-sm text-gray-1 font-medium truncate">{variant.name}</p>
                {variant.sku && (
                  <p className="text-xs text-gray-5 mt-1 truncate">SKU: {variant.sku}</p>
                )}
                {variant.price && (
                  <p className="text-xs text-main-1 mt-1">{formatZAR(variant.price)}</p>
                )}
                <div className="flex items-center gap-1 mt-2">
                  {variant.inStock !== false ? (
                    <>
                      <HiOutlineCheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">In Stock</span>
                    </>
                  ) : (
                    <>
                      <HiOutlineXCircle className="w-3 h-3 text-red-400" />
                      <span className="text-xs text-red-400">Out of Stock</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Website Preview Section */}
      <div className="bg-dark-3 rounded-xl border border-dark-4 p-5">
        <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4">
          How It Will Appear on Website
        </h3>
        <div className="bg-dark-2 rounded-lg p-6 border border-dark-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Preview Image */}
            <div className="w-full md:w-48 h-48 bg-dark-4 rounded-lg overflow-hidden flex-shrink-0">
              {images.length > 0 ? (
                <img
                  src={images[0].src}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-5">
                  No image
                </div>
              )}
            </div>
            
            {/* Preview Content */}
            <div className="flex-1">
              <span className="text-xs text-main-1 uppercase tracking-wider">{product.category}</span>
              <h4 className="text-lg font-heading text-gray-1 mt-1">{product.name}</h4>
              <p className="text-sm text-gray-5 mt-2 line-clamp-2">
                {product.short_description || product.description?.slice(0, 150)}
              </p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-2xl font-bold text-gray-1">{formatZAR(product.sell_price)}</span>
                {product.compare_at_price && (
                  <span className="text-lg line-through text-gray-5">{formatZAR(product.compare_at_price)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-2 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <HiOutlineStar key={i} className="w-4 h-4" />
                ))}
                <span className="text-xs text-gray-5 ml-2">No reviews yet</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Product"
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-5 mb-1">Product Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-5 mb-1">Short Description</label>
            <textarea
              value={editForm.short_description}
              onChange={(e) => setEditForm({ ...editForm, short_description: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-5 mb-1">Full Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-5 mb-1">Sell Price (ZAR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.sell_price}
                onChange={(e) => setEditForm({ ...editForm, sell_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-5 mb-1">Markup %</label>
              <input
                type="number"
                min="0"
                value={editForm.markup_percent}
                onChange={(e) => setEditForm({ ...editForm, markup_percent: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-5 mb-1">Category</label>
              <input
                type="text"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-5 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                className="w-full px-4 py-2 bg-dark-3 border border-dark-4 rounded-lg text-gray-1 focus:outline-none focus:border-main-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-dark-4 bg-dark-3 text-main-1 focus:ring-main-1"
              />
              <span className="text-sm text-gray-1">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.is_featured}
                onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
                className="w-4 h-4 rounded border-dark-4 bg-dark-3 text-main-1 focus:ring-main-1"
              />
              <span className="text-sm text-gray-1">Featured</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-4">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Product"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-1">
            Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

