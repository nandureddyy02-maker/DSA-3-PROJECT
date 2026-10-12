import fs from 'fs';
import path from 'path';
import { BaseProvider } from './BaseProvider.js';

/**
 * Croma Retailer Provider
 * 
 * Supports authorized partner API endpoints and structured partner catalog feeds.
 * Does NOT fabricate live prices or product URLs if feeds/credentials are missing.
 */
export class CromaProvider extends BaseProvider {
  constructor() {
    super('croma', 'Croma');
    this.partnerApiUrl = process.env.CROMA_PARTNER_API_URL || null;
    this.partnerApiKey = process.env.CROMA_PARTNER_API_KEY || null;
    this.feedUrl = process.env.CROMA_FEED_URL || null;
    this.feedFilePath = process.env.CROMA_FEED_FILE || null;
  }

  isConfigured() {
    return Boolean(
      (this.partnerApiUrl && this.partnerApiKey) ||
      this.feedUrl ||
      (this.feedFilePath && fs.existsSync(this.feedFilePath))
    );
  }

  getStatus() {
    const configured = this.isConfigured();
    let mode = 'awaiting_feed';
    if (this.partnerApiUrl && this.partnerApiKey) {
      mode = 'partner_api';
    } else if (this.feedUrl || (this.feedFilePath && fs.existsSync(this.feedFilePath))) {
      mode = 'partner_feed';
    }

    return {
      retailer: this.name,
      displayName: this.displayName,
      configured,
      mode,
      lastCheckedAt: this.lastCheckedAt,
      message: configured
        ? `Croma integration active using ${mode}.`
        : 'Croma integration requires CROMA_PARTNER_API_KEY + CROMA_PARTNER_API_URL, or CROMA_FEED_URL / CROMA_FEED_FILE in backend/.env. Integration is ready for configuration.',
      supportedOptions: [
        'CROMA_PARTNER_API_URL and CROMA_PARTNER_API_KEY (Authorized Partner API)',
        'CROMA_FEED_URL (Authorized HTTP Partner Catalog Feed)',
        'CROMA_FEED_FILE (Local Authorized Partner Feed JSON)'
      ]
    };
  }

  /**
   * Search Croma for products using authorized partner API or structured feed
   */
  async searchProducts(query, limit = 10) {
    if (!this.isConfigured()) {
      return [];
    }

    if (!query || !query.trim()) return [];

    const cleanQuery = query.trim().toLowerCase();

    // Option A: Authorized Partner REST API
    if (this.partnerApiUrl && this.partnerApiKey) {
      try {
        const url = `${this.partnerApiUrl}?q=${encodeURIComponent(cleanQuery)}&limit=${limit}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.partnerApiKey}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(6000)
        });

        this.lastCheckedAt = new Date();

        if (response.status === 401 || response.status === 403) {
          console.warn('[Croma Provider] Unauthorized (401/403): Invalid partner API key.');
          return [];
        }

        if (!response.ok) {
          console.warn(`[Croma Provider] HTTP Error ${response.status} from partner API.`);
          return [];
        }

        const json = await response.json();
        const items = json.data || json.products || [];

        return items.map((item) => {
          return this.standardizeListing({
            name: item.name || item.title,
            brand: item.brand || 'Croma Retail',
            category: item.category || 'Electronics',
            description: item.description || '',
            seller: 'Croma Retail',
            price: Number(item.price) || 0,
            originalPrice: item.mrp ? Number(item.mrp) : undefined,
            productUrl: item.url || item.productUrl || null,
            image: item.image || item.imageUrl,
            specs: item.specs || {},
            lastCheckedAt: this.lastCheckedAt,
            isLive: true,
            dataSource: 'live_api',
            availability: item.inStock ? 'In Stock' : 'Out of Stock',
            retailerSku: item.sku || item.productId || null
          });
        });
      } catch (err) {
        console.warn('[Croma Provider] Partner API query failed:', err.message);
        return [];
      }
    }

    // Option B: Authorized HTTP or Local File Partner Feed
    try {
      let feedItems = [];

      if (this.feedUrl) {
        const feedRes = await fetch(this.feedUrl, { signal: AbortSignal.timeout(6000) });
        if (feedRes.ok) {
          const feedJson = await feedRes.json();
          feedItems = feedJson.products || feedJson;
        }
      } else if (this.feedFilePath && fs.existsSync(this.feedFilePath)) {
        const fileContent = fs.readFileSync(this.feedFilePath, 'utf8');
        const feedJson = JSON.parse(fileContent);
        feedItems = feedJson.products || feedJson;
      }

      this.lastCheckedAt = new Date();

      // Filter feed items by query matching name, brand, or category
      const matched = feedItems.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        return name.includes(cleanQuery) || brand.includes(cleanQuery);
      }).slice(0, limit);

      return matched.map((item) => {
        return this.standardizeListing({
          name: item.name,
          brand: item.brand,
          category: item.category || 'Electronics',
          description: item.description || '',
          seller: 'Croma Retail',
          price: Number(item.price) || 0,
          originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
          productUrl: item.productUrl || null,
          image: item.image,
          specs: item.specs || {},
          lastCheckedAt: this.lastCheckedAt,
          isLive: false,
          dataSource: 'partner_feed',
          availability: item.availability || 'In Stock',
          retailerSku: item.sku || null
        });
      });
    } catch (err) {
      console.warn('[Croma Provider] Feed processing failed:', err.message);
      return [];
    }
  }
}

export default CromaProvider;
