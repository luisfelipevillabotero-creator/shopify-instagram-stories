import { BEST_SELLING_PRODUCTS_QUERY } from './queries.js';

export async function fetchBestSellingProducts(config, { first = 10 } = {}) {
  const url = `https://${config.shopifyStoreDomain}/admin/api/${config.shopifyApiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.shopifyAccessToken,
    },
    body: JSON.stringify({
      query: BEST_SELLING_PRODUCTS_QUERY,
      variables: {
        collectionHandle: config.shopifyCollectionHandle,
        first,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(
      `Shopify GraphQL errors: ${JSON.stringify(data.errors)}`
    );
  }

  const collection = data.data.collectionByHandle;
  if (!collection) {
    throw new Error(
      `Coleccion "${config.shopifyCollectionHandle}" no encontrada`
    );
  }

  return collection.products.edges.map((edge) => {
    const node = edge.node;
    const price = parseFloat(node.priceRangeV2.minVariantPrice.amount);
    const compareAtPrice = node.compareAtPriceRange?.minVariantPrice?.amount
      ? parseFloat(node.compareAtPriceRange.minVariantPrice.amount)
      : null;

    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      description: node.description,
      url: `${config.shopifyStoreUrl}/products/${node.handle}`,
      price,
      compareAtPrice,
      currency: node.priceRangeV2.minVariantPrice.currencyCode,
      discount:
        compareAtPrice && compareAtPrice > price
          ? Math.round((1 - price / compareAtPrice) * 100)
          : null,
      imageUrl:
        node.featuredImage?.url || node.images.edges[0]?.node.url || null,
    };
  });
}
