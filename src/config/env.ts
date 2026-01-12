export const env = {
  // CJDropshipping API Configuration
  cjDropshipping: {
    userId: process.env.CJ_DROPSHIPPING_USER_ID || process.env.CJDROPSHIPPING_USER_ID || '',
    key: process.env.CJ_DROPSHIPPING_KEY || process.env.CJDROPSHIPPING_KEY || '',
    secret: process.env.CJ_DROPSHIPPING_SECRET || process.env.CJDROPSHIPPING_SECRET || '',
    email: process.env.CJ_DROPSHIPPING_EMAIL || process.env.CJDROPSHIPPING_EMAIL || '',
    password: process.env.CJ_DROPSHIPPING_PASSWORD || process.env.CJDROPSHIPPING_PASSWORD || '',
    apiUrl:
      process.env.CJ_DROPSHIPPING_API_URL ||
      process.env.CJDROPSHIPPING_API_URL ||
      'https://developers.cjdropshipping.com/api2.0',
  },
  
  // Supabase Configuration
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  // App Configuration
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Darkpoint Admin',
    mainSiteUrl: process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://localhost:3000',
  },
} as const;

