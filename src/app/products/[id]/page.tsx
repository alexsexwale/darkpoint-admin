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
  const [copied, setCopied] = useState(false);
  
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
    } catch (err) {
      console.error('Error fetching product:', err);
    } finally {
      setIsLoading(false);
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/products')}
            leftIcon={<HiOutlineArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-gray-1">{product.name}</h1>
            <p className="text-sm text-gray-5 mt-1">
              Product ID: {product.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copyToClipboard(product.id)}
            leftIcon={<HiOutlineClipboardCopy className="w-4 h-4" />}
          >
            {copied ? 'Copied!' : 'Copy ID'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={<HiOutlinePencil className="w-4 h-4" />}
          >
            Edit
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
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={clsx(
          'px-3 py-1 rounded-full text-xs font-medium',
          product.is_active 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        )}>
          {product.is_active ? '● Active' : '○ Inactive'}
        </span>
        {product.is_featured && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            ★ Featured
          </span>
        )}
        {product.category && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {product.category}
          </span>
        )}
        <a
          href={`https://www.cjdropshipping.com/product/${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-p-${product.cj_product_id}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-main-1/20 text-main-1 border border-main-1/30 hover:bg-main-1/30 transition-colors"
        >
          <HiOutlineExternalLink className="w-3 h-3" />
          View on CJ
        </a>
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
            <h3 className="text-sm font-medium text-gray-5 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HiOutlineCurrencyDollar className="w-4 h-4" />
              Pricing Information
            </h3>
            
            <div className="space-y-4">
              {/* Price Flow */}
              <div className="grid grid-cols-3 gap-4 text-center">
                {product.original_price_usd && (
                  <div className="p-3 bg-dark-4/50 rounded-lg">
                    <p className="text-xl font-bold text-blue-400 font-mono">
                      {formatUSD(product.original_price_usd)}
                    </p>
                    <p className="text-xs text-gray-5 mt-1">CJ Cost (USD)</p>
                  </div>
                )}
                <div className="p-3 bg-dark-4/50 rounded-lg">
                  <p className="text-xl font-bold text-red-400 font-mono">
                    {formatZAR(product.base_price)}
                  </p>
                  <p className="text-xs text-gray-5 mt-1">Your Cost (ZAR)</p>
                </div>
                <div className="p-3 bg-dark-4/50 rounded-lg">
                  <p className="text-xl font-bold text-green-400 font-mono">
                    {formatZAR(product.sell_price)}
                  </p>
                  <p className="text-xs text-gray-5 mt-1">Sell Price (ZAR)</p>
                </div>
              </div>

              {/* Profit Summary */}
              <div className="pt-4 border-t border-dark-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-5">Profit per Sale</span>
                  <span className="text-lg font-bold text-main-1">{formatZAR(profitZAR)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-5">Markup</span>
                  <span className="text-lg font-bold text-gray-1">{product.markup_percent}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-5">Profit Margin</span>
                  <span className={clsx(
                    'text-lg font-bold',
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

              {/* Exchange Rate Info */}
              {product.exchange_rate_used && (
                <div className="pt-3 border-t border-dark-4 text-xs text-gray-5">
                  <p>Exchange rate at import: 1 USD = R{product.exchange_rate_used.toFixed(2)}</p>
                </div>
              )}

              {/* Compare At Price */}
              {product.compare_at_price && (
                <div className="pt-3 border-t border-dark-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-5">Compare at Price</span>
                    <span className="text-lg line-through text-gray-5">{formatZAR(product.compare_at_price)}</span>
                  </div>
                </div>
              )}
            </div>
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

