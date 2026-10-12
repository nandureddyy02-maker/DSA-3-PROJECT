/**
 * BaseProvider: Abstract Retailer Data-Provider
 * 
 * Standardizes outbound interaction with external retailer APIs and partner feeds.
 * Ensures strict separation between retailer retrieval and the DSA matching engine.
 */

export class BaseProvider {
  constructor(name, displayName) {
    if (this.constructor === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly.');
    }
    this.name = name;
    this.displayName = displayName;
    this.lastCheckedAt = null;
  }

  /**
   * Check if necessary environment credentials or feed sources are configured
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by subclass');
  }

  /**
   * Return human-readable integration status and readiness
   * @returns {object}
   */
  getStatus() {
    return {
      retailer: this.name,
      displayName: this.displayName,
      configured: this.isConfigured(),
      lastCheckedAt: this.lastCheckedAt
    };
  }

  /**
   * Search retailer catalog for products matching a query
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<Array<object>>}
   */
  async searchProducts(query, limit = 10) {
    throw new Error('searchProducts() must be implemented by subclass');
  }

  /**
   * Standardize external retailer data into canonical platform schema
   * @param {object} raw
   * @returns {object}
   */
  standardizeListing(raw) {
    return {
      name: raw.name ? String(raw.name).trim() : 'Unknown Product',
      brand: raw.brand ? String(raw.brand).trim() : 'Generic',
      category: raw.category || 'General',
      description: raw.description || '',
      seller: raw.seller || this.displayName,
      retailer: this.name,
      price: Number(raw.price) || 0,
      originalPrice: raw.originalPrice ? Number(raw.originalPrice) : undefined,
      productUrl: raw.productUrl || null,
      image: raw.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
      specs: raw.specs || {},
      lastCheckedAt: raw.lastCheckedAt || new Date(),
      isLive: Boolean(raw.isLive),
      dataSource: raw.dataSource || 'cached_api',
      availability: raw.availability || 'In Stock',
      retailerSku: raw.retailerSku || null,
      rating: raw.rating || 4.5,
      reviewsCount: raw.reviewsCount || 0
    };
  }
}

export default BaseProvider;
