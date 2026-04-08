export const BEST_SELLING_PRODUCTS_QUERY = `
  query BestSellingProducts($collectionHandle: String!, $first: Int!) {
    collectionByHandle(handle: $collectionHandle) {
      id
      title
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            handle
            description
            onlineStoreUrl
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            compareAtPriceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
              altText
            }
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;
