export async function fetchBestSellingProducts(config, { first = 10 } = {}) {
  const collectionHandle = config.shopifyCollectionHandle;
  const url = `https://${config.shopifyStoreDomain}/collections/${collectionHandle}/products.json?limit=${first}&sort_by=best-selling`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StoryBot/1.0)',
      'Accept': 'application/json',
    },
  });

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
    const fallbackImage = product.images?.[0]?.src || null;
    const colorImages = extractColorImages(product);

    return {
      id: String(product.id),
      title: product.title,
      handle: product.handle,
      description: product.body_html?.replace(/<[^>]*>/g, '') || '',
      url: `${config.shopifyStoreUrl}/products/${product.handle}?utm_source=instagram&utm_medium=organico&utm_campaign=post&utm_content=story`,
      price,
      compareAtPrice,
      currency: 'COP',
      discount:
        compareAtPrice && compareAtPrice > price
          ? Math.round((1 - price / compareAtPrice) * 100)
          : null,
      imageUrl: fallbackImage,
      colorImages,
    };
  });
}

function extractColorImages(product) {
  const options = product.options || [];
  const colorOptionIndex = options.findIndex(
    (opt) => opt.name?.toLowerCase() === 'color'
  );

  const allImages = (product.images || []).map((img) => img.src);

  if (colorOptionIndex === -1) {
    return allImages.length > 0 ? [{ color: null, imageUrls: allImages }] : [];
  }

  const colorOptionKey = `option${colorOptionIndex + 1}`;

  const variantColorMap = {};
  for (const variant of product.variants || []) {
    const color = variant[colorOptionKey];
    if (color) variantColorMap[variant.id] = color;
  }

  const colorGroups = {};
  for (const image of product.images || []) {
    const linkedColors = new Set();
    for (const vid of image.variant_ids || []) {
      const color = variantColorMap[vid];
      if (color) linkedColors.add(color);
    }
    for (const color of linkedColors) {
      if (!colorGroups[color]) colorGroups[color] = [];
      colorGroups[color].push(image.src);
    }
  }

  const groupEntries = Object.entries(colorGroups);

  if (groupEntries.length === 0) {
    return allImages.length > 0 ? [{ color: null, imageUrls: allImages }] : [];
  }

  return groupEntries.map(([color, imageUrls]) => ({ color, imageUrls }));
}
