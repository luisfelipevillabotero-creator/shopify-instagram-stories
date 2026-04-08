export async function fetchBestSellingProducts(config, { first = 10 } = {}) {
  const collectionHandle = config.shopifyCollectionHandle;
  const url = `https://${config.shopifyStoreDomain}/collections/${collectionHandle}/products.json?limit=${first}&sort_by=best-selling`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data.products || data.products.length === 0) {
    throw new Error(
      `No se encontraron productos en la coleccion "${collectionHandle}"`
    );
  }

  return data.products.map((product) => {
    const variant = product.variants?.[0];
    const price = parseFloat(variant?.price || '0');
    const compareAtPrice = variant?.compare_at_price
      ? parseFloat(variant.compare_at_price)
      : null;
    const image = product.images?.[0];

    return {
      id: String(product.id),
      title: product.title,
      handle: product.handle,
      description: product.body_html?.replace(/<[^>]*>/g, '') || '',
      url: `${config.shopifyStoreUrl}/products/${product.handle}`,
      price,
      compareAtPrice,
      currency: 'COP',
      discount:
        compareAtPrice && compareAtPrice > price
          ? Math.round((1 - price / compareAtPrice) * 100)
          : null,
      imageUrl: image?.src || null,
    };
  });
}
