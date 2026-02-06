import axios, { AxiosInstance, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { env } from '@/config/env';

type CJAuthTokens = {
  accessToken: string;
  accessTokenExpiryDate: string;
  refreshToken: string;
  refreshTokenExpiryDate: string;
};

// CJ Product types
export interface CJProduct {
  pid: string;
  productName: string;
  productNameEn?: string;
  productImage?: string;
  productImages?: string | string[];
  description?: string;
  sellPoint?: string;
  sellPrice: number | string;
  sourcePrice?: number | string;
  productWeight?: number | string;
  categoryId: string;
  sourceFrom?: string;
  entryTime?: string;
  updateTime?: string;
  variants?: CJVariant[];
}

export interface CJVariant {
  vid: string;
  variantName?: string;
  variantNameEn?: string;
  variantValue?: string;
  variantValueEn?: string;
  variantSku?: string;
  variantImage?: string;
  sellPrice: number | string;
  quantity?: number;
}

// CJ Order types
export interface CJOrderProduct {
  vid: string;
  quantity: number;
}

export interface CJOrderAddress {
  countryCode: string;
  /** Full country name of destination (required for Create Order V2) */
  country?: string;
  province: string;
  city: string;
  address: string;
  /** Second line of address (optional) */
  address2?: string;
  zip: string;
  phone: string;
  fullName: string;
}

export interface CJCreateOrderRequest {
  orderNumber: string;
  shippingAddress: CJOrderAddress;
  products: CJOrderProduct[];
  remark?: string;
  logisticName?: string;
}

export interface CJOrderResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  trackingNumber?: string;
  logisticName?: string;
}

const GLOBAL_TOKENS_KEY = '__CJ_AUTH_TOKENS__';
const GLOBAL_AUTH_INFLIGHT_KEY = '__CJ_AUTH_INFLIGHT__';

class CJDropshippingAPI {
  private client: AxiosInstance;
  private authClient: AxiosInstance;

  private userId: string;
  private key: string;
  private secret: string;
  
  private email: string;
  private password: string;
  private tokens: CJAuthTokens | null;

  constructor() {
    this.userId = env.cjDropshipping.userId;
    this.key = env.cjDropshipping.key;
    this.secret = env.cjDropshipping.secret;
    this.email = env.cjDropshipping.email;
    this.password = env.cjDropshipping.password;
    this.tokens = (globalThis as Record<string, unknown>)[GLOBAL_TOKENS_KEY] as CJAuthTokens | null || null;

    let baseUrl = (env.cjDropshipping.apiUrl || '').trim();
    if (!baseUrl) baseUrl = 'https://developers.cjdropshipping.com/api2.0';
    if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;
    try {
      const u = new URL(baseUrl);
      if (u.hostname === 'api.cjdropshipping.com' || u.hostname === 'api2.cjdropshipping.com') {
        u.hostname = 'developers.cjdropshipping.com';
        baseUrl = u.toString();
      }
    } catch {
      // Ignore URL parsing errors
    }
    if (!/\/api2\.0$/i.test(baseUrl)) baseUrl = baseUrl.replace(/\/$/, '') + '/api2.0';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DarkpointAdmin/1.0',
      },
    });

    this.authClient = axios.create({
      baseURL: baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DarkpointAdmin/1.0',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      await this.ensureAccessToken();

      if (config.headers && this.tokens?.accessToken) {
        config.headers['CJ-Access-Token'] = this.tokens.accessToken;
      }
      if (this.userId && this.key && this.secret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const sign = this.generateSignature(timestamp);
        if (config.headers) {
          config.headers['CJ-Access-Timestamp'] = timestamp;
          config.headers['CJ-Access-Sign'] = sign;
        }
      }
      if (config.headers) {
        config.headers['User-Agent'] = 'DarkpointAdmin/1.0';
      }

      return config;
    });
  }

  private generateSignature(timestamp: string): string {
    const message = `${this.userId}${timestamp}${this.key}${this.secret}`;
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  private isTokenExpired(iso: string | undefined | null): boolean {
    if (!iso) return true;
    const expires = new Date(iso).getTime() - 60 * 1000;
    return Date.now() >= expires;
  }

  private async ensureAccessToken(): Promise<void> {
    if (!this.tokens) {
      await this.login();
      return;
    }
    if (this.isTokenExpired(this.tokens.accessTokenExpiryDate) && !this.isTokenExpired(this.tokens.refreshTokenExpiryDate)) {
      await this.refreshAccessToken();
      return;
    }
    if (this.isTokenExpired(this.tokens.refreshTokenExpiryDate)) {
      await this.login();
    }
  }

  private async login(): Promise<void> {
    if (!this.email || !this.password) {
      throw new Error('CJDropshipping credentials are not configured.');
    }

    const existing = (globalThis as Record<string, unknown>)[GLOBAL_AUTH_INFLIGHT_KEY] as Promise<void> | undefined;
    if (existing) {
      await existing;
      this.tokens = (globalThis as Record<string, unknown>)[GLOBAL_TOKENS_KEY] as CJAuthTokens | null || this.tokens;
      return;
    }

    const inflight = (async () => {
      const { data } = await this.authClient.post('/v1/authentication/getAccessToken', {
        email: this.email,
        password: this.password,
      });
      if (data?.result && data?.data) {
        this.tokens = {
          accessToken: data.data.accessToken,
          accessTokenExpiryDate: data.data.accessTokenExpiryDate,
          refreshToken: data.data.refreshToken,
          refreshTokenExpiryDate: data.data.refreshTokenExpiryDate,
        };
        (globalThis as Record<string, unknown>)[GLOBAL_TOKENS_KEY] = this.tokens;
      } else {
        throw new Error(`CJ login failed: ${data?.message || 'Unknown error'}`);
      }
    })();
    (globalThis as Record<string, unknown>)[GLOBAL_AUTH_INFLIGHT_KEY] = inflight;
    try {
      await inflight;
    } finally {
      (globalThis as Record<string, unknown>)[GLOBAL_AUTH_INFLIGHT_KEY] = undefined;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      await this.login();
      return;
    }
    const { data } = await this.authClient.post('/v1/authentication/refreshAccessToken', {
      refreshToken: this.tokens.refreshToken,
    });
    if (data?.result && data?.data) {
      this.tokens = {
        accessToken: data.data.accessToken,
        accessTokenExpiryDate: data.data.accessTokenExpiryDate,
        refreshToken: data.data.refreshToken,
        refreshTokenExpiryDate: data.data.refreshTokenExpiryDate,
      };
      (globalThis as Record<string, unknown>)[GLOBAL_TOKENS_KEY] = this.tokens;
    } else {
      await this.login();
    }
  }

  // Get product list with pagination and filters
  async getProducts(params: {
    pageNum?: number;
    pageSize?: number;
    categoryId?: string;
    keywords?: string;
  } = {}): Promise<{ success: boolean; data?: CJProduct[]; total?: number; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/v1/product/list', {
        params: {
          pageNum: params.pageNum || 1,
          pageSize: params.pageSize || 20,
          categoryId: params.categoryId,
          productName: params.keywords,
        },
      });

      if (response.data.result || response.data.success) {
        const responseData = response.data.data;
        const list = responseData?.list || responseData || [];
        const total = responseData?.total || (Array.isArray(list) ? list.length : 0);
        return {
          success: true,
          data: Array.isArray(list) ? list : [],
          total,
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to fetch products',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Get user's added products (My Products) with pagination and filters
  // Documentation: https://developers.cjdropshipping.cn/en/api/api2/api/product.html#_1-3-my-product-list-get
  async getMyProducts(params: {
    pageNum?: number;
    pageSize?: number;
    keyword?: string;
    categoryId?: string;
  } = {}): Promise<{ success: boolean; data?: CJProduct[]; total?: number; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/v1/product/myProduct/query', {
        params: {
          pageNum: params.pageNum || 1,
          pageSize: params.pageSize || 20,
          keyword: params.keyword || undefined,
          categoryId: params.categoryId || undefined,
        },
      });

      if (response.data.result || response.data.success) {
        const responseData = response.data.data;
        // Response format: { pageSize, pageNumber, totalRecords, totalPages, content: [...] }
        const content = responseData?.content || [];
        const total = responseData?.totalRecords || content.length;
        
        // Transform the response to match CJProduct format
        const products = content.map((item: any) => ({
          pid: item.productId,
          productNameEn: item.nameEn,
          productName: item.productName,
          productSku: item.sku,
          productImage: item.bigImage,
          sellPrice: parseFloat(item.sellPrice) || parseFloat(item.totalPrice) || 0,
          productWeight: parseFloat(item.weight) || 0,
          categoryId: item.categoryId,
          variants: item.vid ? [{
            vid: item.vid,
            variantSku: item.sku,
            sellPrice: parseFloat(item.sellPrice) || 0,
          }] : [],
        }));
        
        return {
          success: true,
          data: products,
          total,
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to fetch user products',
        };
      }
    } catch (error: unknown) {
      console.error('CJ My Products API error:', error);
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Get single product details
  async getProduct(productId: string): Promise<{ success: boolean; data?: CJProduct; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/v1/product/query', {
        params: { pid: productId },
      });

      if (response.data.result || response.data.success) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Product not found',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Get product variants
  async getProductVariants(productId: string): Promise<{ success: boolean; data?: CJVariant[]; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/v1/product/variant/query', {
        params: { pid: productId },
      });

      if (response.data.result || response.data.success) {
        return {
          success: true,
          data: response.data.data || [],
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to fetch variants',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Get categories
  async getCategories(): Promise<{ success: boolean; data?: Array<{ categoryId: string; categoryName: string; parentId?: string; level: number }>; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/v1/product/getCategory');

      if (response.data.result || response.data.success) {
        const raw = response.data.data || [];
        const flattened: Array<{ categoryId: string; categoryName: string; parentId?: string; level: number }> = [];
        
        for (const first of raw) {
          const firstName = first.categoryFirstName;
          const firstList = first.categoryFirstList || [];
          for (const second of firstList) {
            const secondName = second.categorySecondName;
            const secondList = second.categorySecondList || [];
            for (const third of secondList) {
              flattened.push({
                categoryId: third.categoryId,
                categoryName: third.categoryName,
                parentId: secondName || firstName,
                level: 3,
              });
            }
          }
        }
        return { success: true, data: flattened };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to fetch categories',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  /**
   * Create order in CJ Dropshipping using Create Order V2 API.
   * @see https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2
   */
  async createOrder(orderData: CJCreateOrderRequest): Promise<{ success: boolean; data?: CJOrderResponse; error?: string }> {
    try {
      const addr = orderData.shippingAddress;
      const rawCode = String(addr?.countryCode ?? '').trim().toUpperCase();
      const shippingCountryCode = rawCode.length === 2 ? rawCode : 'ZA';
      const shippingCountry = (addr?.country ?? '').trim() || shippingCountryCode;

      // Consignee ID: CJ requires 13 digits, no special chars. Use phone digits if 13 digits, else placeholder.
      const phoneDigits = (addr?.phone ?? '').replace(/\D/g, '');
      const consigneeID =
        phoneDigits.length === 13
          ? phoneDigits
          : phoneDigits.length > 13
            ? phoneDigits.slice(0, 13)
            : phoneDigits.padStart(13, '0');

      const body: Record<string, unknown> = {
        orderNumber: orderData.orderNumber,
        shippingCountryCode,
        shippingCountry,
        shippingProvince: addr?.province ?? '',
        shippingCity: addr?.city ?? '',
        shippingAddress: addr?.address ?? '',
        shippingZip: addr?.zip ?? '',
        shippingPhone: addr?.phone ?? '',
        shippingCustomerName: addr?.fullName ?? '',
        fromCountryCode: 'CN',
        remark: orderData.remark ?? '',
        payType: 3, // No Balance Payment
        shopLogisticsType: 2, // Seller Logistics
        consigneeID,
        products: orderData.products.map((p, i) => ({
          vid: p.vid,
          quantity: p.quantity,
          storeLineItemId: `line-${orderData.orderNumber}-${i}`,
        })),
      };

      if (addr?.address2) body.shippingAddress2 = addr.address2;
      // V2 requires logisticName; send selected method or empty (API may reject if empty)
      body.logisticName = orderData.logisticName ?? '';

      const response: AxiosResponse = await this.client.post('/v1/shopping/order/createOrderV2', body);

      if (response.data.result || response.data.success) {
        const d = response.data.data;
        return {
          success: true,
          data: {
            orderId: d?.orderId,
            orderNumber: d?.orderNum ?? orderData.orderNumber,
            orderStatus: d?.orderStatus ?? 'Created',
            trackingNumber: d?.trackNumber,
            logisticName: d?.logisticName,
          },
        };
      }
      return {
        success: false,
        error: response.data.message || 'Failed to create order',
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Get order status from CJ
  async getOrderStatus(orderId: string): Promise<{ success: boolean; data?: CJOrderResponse; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.get('/v1/shopping/order/getOrderDetail', {
        params: { orderId },
      });

      if (response.data.result || response.data.success) {
        return {
          success: true,
          data: {
            orderId: response.data.data?.orderId,
            orderNumber: response.data.data?.orderNum,
            orderStatus: response.data.data?.orderStatus,
            trackingNumber: response.data.data?.trackNumber,
            logisticName: response.data.data?.logisticName,
          },
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to get order status',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Get shipping methods for a product using variant-based calculation
  async getShippingMethods(params: {
    startCountryCode?: string;
    endCountryCode: string;
    productWeight: number;
    productId?: string;
    variantId?: string;
    quantity?: number;
  }): Promise<{ success: boolean; data?: Array<{ logisticName: string; logisticPrice: number; logisticTime: string; logisticAging?: string }>; error?: string }> {
    try {
      // Try the product-based shipping calculation first
      if (params.productId) {
        const productResponse: AxiosResponse = await this.client.post('/v1/logistic/freightCalculate', {
          startCountryCode: params.startCountryCode || 'CN',
          endCountryCode: params.endCountryCode,
          products: [{
            quantity: params.quantity || 1,
            vid: params.variantId || params.productId,
          }],
        });

        if (productResponse.data.result || productResponse.data.success) {
          const data = productResponse.data.data;
          if (Array.isArray(data) && data.length > 0) {
            return {
              success: true,
              data: data.map((item: any) => ({
                logisticName: item.logisticName || item.logisticNameEn || 'Shipping',
                logisticPrice: parseFloat(item.logisticPrice || item.logisticPriceEn || '0'),
                logisticTime: item.logisticAging || item.logisticTime || '',
                logisticAging: item.logisticAging,
              })),
            };
          }
        }
      }

      // Fallback: Try weight-based calculation
      const weightResponse: AxiosResponse = await this.client.post('/v1/logistic/freightCalculate', {
        startCountryCode: params.startCountryCode || 'CN',
        endCountryCode: params.endCountryCode,
        weight: params.productWeight,
      });

      if (weightResponse.data.result || weightResponse.data.success) {
        const data = weightResponse.data.data;
        if (Array.isArray(data) && data.length > 0) {
          return {
            success: true,
            data: data.map((item: any) => ({
              logisticName: item.logisticName || item.logisticNameEn || 'Shipping',
              logisticPrice: parseFloat(item.logisticPrice || item.logisticPriceEn || '0'),
              logisticTime: item.logisticAging || item.logisticTime || '',
              logisticAging: item.logisticAging,
            })),
          };
        }
        return {
          success: true,
          data: [],
        };
      } else {
        return {
          success: false,
          error: weightResponse.data.message || 'Failed to get shipping methods',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  /** Get shipping methods for a full order (multiple products). Uses freightCalculate with products array. */
  async getShippingMethodsForOrder(params: {
    products: Array<{ vid: string; quantity: number }>;
    endCountryCode: string;
    startCountryCode?: string;
  }): Promise<{ success: boolean; data?: Array<{ logisticName: string; logisticPrice: number; logisticTime: string; logisticAging?: string }>; error?: string }> {
    try {
      if (!params.products?.length) {
        return { success: true, data: [] };
      }
      const response: AxiosResponse = await this.client.post('/v1/logistic/freightCalculate', {
        startCountryCode: params.startCountryCode || 'CN',
        endCountryCode: params.endCountryCode,
        products: params.products.map((p) => ({ vid: p.vid, quantity: p.quantity })),
      });
      if (response.data.result || response.data.success) {
        const data = response.data.data;
        if (Array.isArray(data) && data.length > 0) {
          return {
            success: true,
            data: data.map((item: { logisticName?: string; logisticNameEn?: string; logisticPrice?: string | number; logisticPriceEn?: string | number; logisticAging?: string; logisticTime?: string }) => ({
              logisticName: item.logisticName || item.logisticNameEn || 'Shipping',
              logisticPrice: parseFloat(String(item.logisticPrice ?? item.logisticPriceEn ?? '0')) || 0,
              logisticTime: item.logisticAging || item.logisticTime || '',
              logisticAging: item.logisticAging,
            })),
          };
        }
        return { success: true, data: [] };
      }
      return {
        success: false,
        error: response.data.message || 'Failed to get shipping methods',
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }

  // Confirm order payment (tells CJ to process the order)
  async confirmOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response: AxiosResponse = await this.client.post('/v1/shopping/order/confirmOrder', {
        orderId,
      });

      if (response.data.result || response.data.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to confirm order',
        };
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      return {
        success: false,
        error: err?.response?.data?.message || err?.message || 'API request failed',
      };
    }
  }
}

// Create singleton instance
export const cjDropshipping = new CJDropshippingAPI();

// Helper function to transform CJ product to our format
export const transformCJProduct = (cjProduct: CJProduct) => {
  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v ?? '0'));
    return Number.isFinite(n) ? n : 0;
  };

  const productName = cjProduct.productNameEn || cjProduct.productName || 'Unnamed Product';
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-' + cjProduct.pid;

  // Parse images
  const parseImages = (rawImages: unknown): string[] => {
    if (!rawImages) return [];
    if (Array.isArray(rawImages)) {
      return rawImages.flatMap((img) => parseImages(img));
    }
    if (typeof rawImages === 'string') {
      const trimmed = rawImages.trim();
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
      if (trimmed.includes(',') && trimmed.includes('http')) {
        return trimmed.split(',').map((url) => url.trim()).filter((url) => url.startsWith('http'));
      }
      if (trimmed.startsWith('http')) {
        return [trimmed];
      }
    }
    return [];
  };
  
  let allImages: string[] = [];
  if (cjProduct.productImages) {
    allImages = [...allImages, ...parseImages(cjProduct.productImages)];
  }
  if (cjProduct.productImage) {
    allImages = [...allImages, ...parseImages(cjProduct.productImage)];
  }
  
  const uniqueImages = [...new Set(allImages)].filter((url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
  
  const images = uniqueImages.map((src: string, index: number) => ({
    id: `${cjProduct.pid}-${index}`,
    src,
    alt: `${productName} - Image ${index + 1}`,
  }));

  const basePrice = toNum(cjProduct.sellPrice);
  const price = Math.ceil(basePrice * 2.5 * 100) / 100;
  const originalPrice = toNum(cjProduct.sourcePrice);
  const compareAtPrice = originalPrice > basePrice ? Math.ceil(originalPrice * 3 * 100) / 100 : undefined;

  return {
    id: cjProduct.pid,
    slug,
    name: productName,
    description: cjProduct.description || cjProduct.sellPoint || productName,
    shortDescription: cjProduct.sellPoint || cjProduct.description?.slice(0, 150) || productName,
    basePrice,
    price,
    compareAtPrice,
    categoryId: cjProduct.categoryId,
    images: images.length > 0 ? images : [{ id: `${cjProduct.pid}-0`, src: '/placeholder.png', alt: productName }],
    weight: toNum(cjProduct.productWeight) || 0,
    sourceFrom: cjProduct.sourceFrom || 'China',
    variants: (cjProduct.variants || []).map((v) => ({
      id: v.vid,
      name: v.variantNameEn || v.variantName || '',
      value: v.variantValueEn || v.variantValue || '',
      price: Math.ceil(toNum(v.sellPrice) * 2.5 * 100) / 100,
      stock: v.quantity || 100,
      sku: v.variantSku || '',
      image: v.variantImage,
    })),
    createdAt: cjProduct.entryTime || new Date().toISOString(),
    updatedAt: cjProduct.updateTime || new Date().toISOString(),
  };
};

