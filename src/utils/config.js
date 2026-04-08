export function loadConfig() {
  const config = {
    shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN,
    shopifyAccessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    shopifyCollectionHandle: process.env.SHOPIFY_COLLECTION_HANDLE || 'all',
    shopifyApiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
    shopifyStoreUrl: process.env.SHOPIFY_STORE_URL,
    instagramUserId: process.env.INSTAGRAM_USER_ID,
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    imgbbApiKey: process.env.IMGBB_API_KEY,
  };

  const required = [
    'shopifyStoreDomain',
    'shopifyAccessToken',
    'shopifyStoreUrl',
    'instagramUserId',
    'instagramAccessToken',
    'imgbbApiKey',
  ];

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}`
    );
  }

  return config;
}
