import { BaseProvider } from './BaseProvider.js';

/**
 * Flipkart Retailer Provider
 * 
 * Interacts with authorized Flipkart Affiliate REST API when credentials are provided.
 * Does NOT fabricate live prices or product URLs if credentials are missing.
 */
export class FlipkartProvider extends BaseProvider {
  constructor() {
    super('flipkart', 'Flipkart');
    this.apiBase = process.env.FLIPKART_API_ENDPOINT || 'https://affiliate-api.flipkart.net/affiliate/1.0';
    this.affiliateId = process.env.FLIPKART_AFFILIATE_ID || null;
    this.affiliateToken = process.env.FLIPKART_AFFILIATE_TOKEN || null;
  }

  isConfigured() {
    return Boolean(
      this.affiliateId && 
      this.affiliateId.trim() && 
      this.affiliateToken && 
      this.affiliateToken.trim()
    );
  }

  getStatus() {
    const configured = this.isConfigured();
    return {
      retailer: this.name,
      displayName: this.displayName,
      configured,
      mode: configured ? 'live_api' : 'awaiting_credentials',
      lastCheckedAt: this.lastCheckedAt,
      message: configured
        ? 'Flipkart Affiliate API active and ready for live product queries.'
        : 'Flipkart integration requires FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN in backend/.env. No live queries will be sent until credentials are provided.',
      requiredEnv: ['FLIPKART_AFFILIATE_ID', 'FLIPKART_AFFILIATE_TOKEN']
    };
  }

  /**
   * Search Flipkart for live products using authorized Affiliate Search API
   */
  async searchProducts(query, limit = 10) {
    if (!this.isConfigured()) {
      return [];
    }

    if (!query || !query.trim()) return [];

    const url = `${this.apiBase}/search.json?query=${encodeURIComponent(query.trim())}&resultCount=${Math.min(limit, 20)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Fk-Affiliate-Id': this.affiliateId,
          'Fk-Affiliate-Token': this.affiliateToken,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(6000)
      });

      this.lastCheckedAt = new Date();

      if (response.status === 401 || response.status === 403) {
        console.warn('[Flipkart Provider] Unauthorized (401/403): Invalid affiliate credentials or expired token.');
        return [];
      }

      if (response.status === 429) {
        console.warn('[Flipkart Provider] Rate limit reached (429) on Flipkart Affiliate API.');
        return [];
      }

      if (!response.ok) {
        console.warn(`[Flipkart Provider] HTTP Error ${response.status}: Failed to retrieve products.`);
        return [];
      }

      const json = await response.json();
      const rawProducts = json.products || json.productInfoList || [];

      return rawProducts.map((p) => {
        const info = p.productBaseInfoV1 || p;
        const sellingPrice = info.flipkartSellingPrice?.amount || info.sellingPrice || 0;
        const mrp = info.flipkartSpecialPrice?.amount || info.maximumRetailPrice?.amount || sellingPrice;
        
        // Pick best available image
        let imageUrl = null;
        if (info.imageUrls) {
          imageUrl = info.imageUrls['800x800'] || info.imageUrls['400x400'] || Object.values(info.imageUrls)[0];
        }

        return this.standardizeListing({
          name: info.title || info.productName,
          brand: info.productBrand || 'Flipkart Seller',
          category: info.categoryPaths?.categoryPath?.[0]?.[0]?.title || 'Electronics',
          description: info.productDescription || '',
          seller: 'Flipkart',
          price: sellingPrice,
          originalPrice: mrp,
          productUrl: info.productUrl || null, // Genuine Flipkart product URL
          image: imageUrl,
          specs: info.attributes || {},
          lastCheckedAt: this.lastCheckedAt,
          isLive: true,
          dataSource: 'live_api',
          availability: info.inStock ? 'In Stock' : 'Out of Stock',
          retailerSku: info.productId || null
        });
      });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.warn('[Flipkart Provider] Request timed out after 6 seconds.');
      } else {
        console.warn('[Flipkart Provider] Error querying Flipkart Affiliate API:', err.message);
      }
      return [];
    }
  }
}

export default FlipkartProvider;
