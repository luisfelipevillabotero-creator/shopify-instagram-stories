export function loadConfig() {
  const config = {
    shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN,
    shopifyCollectionHandle: process.env.SHOPIFY_COLLECTION_HANDLE || 'all',
    shopifyStoreUrl: process.env.SHOPIFY_STORE_URL,
    instagramUserId: process.env.INSTAGRAM_USER_ID,
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    imgbbApiKey: process.env.IMGBB_API_KEY,
  };

  const required = [
    'shopifyStoreDomain',
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
