import mongoose from 'mongoose';
import Product from '../models/Product.js';
import FlipkartProvider from './providers/FlipkartProvider.js';
import CromaProvider from './providers/CromaProvider.js';
import { initialProducts } from '../data/mockProductsData.js';
import { getVerifiedListing, applyVerifiedUrlsToDB } from './verifiedUrlService.js';

class RetailerService {
  constructor() {
    this.providers = [
      new FlipkartProvider(),
      new CromaProvider()
    ];
  }

  /**
   * Return status for all retailer providers
   */
  getProviderStatuses() {
    const statuses = {};
    for (const provider of this.providers) {
      statuses[provider.name] = provider.getStatus();
    }
    return statuses;
  }

  /**
   * Check if any external retailer provider is configured
   */
  hasConfiguredProviders() {
    return this.providers.some(p => p.isConfigured());
  }

  /**
   * Query all configured retailer providers in parallel
   * Saves newly retrieved products into MongoDB Atlas
   */
  async syncRetailers(query) {
    if (!query || !query.trim()) return [];

    const configuredProviders = this.providers.filter(p => p.isConfigured());
    if (configuredProviders.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      configuredProviders.map(p => p.searchProducts(query, 5))
    );

    const freshProducts = [];
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        freshProducts.push(...res.value);
      } else if (res.status === 'rejected') {
        console.warn(`[RetailerService] Provider ${configuredProviders[idx].name} failed:`, res.reason?.message);
      }
    });

    // Upsert fresh products into MongoDB if DB is connected
    if (freshProducts.length > 0 && mongoose.connection.readyState === 1) {
      try {
        for (const item of freshProducts) {
          const filter = item.retailerSku 
            ? { retailer: item.retailer, retailerSku: item.retailerSku }
            : { name: item.name, retailer: item.retailer };

          await Product.findOneAndUpdate(
            filter,
            { ...item, updatedAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      } catch (dbErr) {
        console.warn('[RetailerService] Failed to cache fresh retailer products to MongoDB:', dbErr.message);
      }
    }

    return freshProducts;
  }

  /**
   * Retrieve candidate products for the DSA matching engine.
   * Clearly stamps checked time and distinguishes verified vs demo vs live data.
   */
  async getCandidateCatalog(queryText = '') {
    // 1. If live providers are configured and query is present, attempt live sync
    if (queryText && this.hasConfiguredProviders()) {
      try {
        await this.syncRetailers(queryText);
      } catch (syncErr) {
        console.warn('[RetailerService] Live sync warning:', syncErr.message);
      }
    }

    // 2. Read catalog from MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const dbProducts = await Product.find({}).lean();
        if (dbProducts && dbProducts.length > 0) {
          return dbProducts.map(p => {
            const hasUrl = Boolean(p.productUrl && p.productUrl.trim());
            const lastChecked = p.lastCheckedAt ? new Date(p.lastCheckedAt) : p.updatedAt || p.createdAt;
            const isFresh = lastChecked && (Date.now() - new Date(lastChecked).getTime() < 30 * 60 * 1000); // 30 min
            
            let source = p.dataSource;
            if (!source) {
              source = hasUrl ? 'verified_manual' : 'demo_catalog';
            } else if (source === 'live_api' && !isFresh) {
              source = 'cached_api';
            }

            return {
              ...p,
              id: p._id ? String(p._id) : p.id,
              lastCheckedAt: lastChecked,
              isLive: Boolean(p.isLive && isFresh),
              dataSource: source,
              productUrl: hasUrl ? p.productUrl.trim() : null
            };
          });
        }
      } catch (err) {
        console.warn('[RetailerService] Error reading from DB, falling back to local catalog:', err.message);
      }
    }

    // 3. Fallback to initialProducts with verified checks mapped
    return initialProducts.map((p, idx) => {
      const verified = getVerifiedListing(p.name, p.seller);
      if (verified) {
        return {
          ...p,
          id: p.id || `PROD-${idx + 1}`,
          productUrl: verified.verifiedProductUrl,
          retailer: verified.retailer,
          lastCheckedAt: verified.lastCheckedAt,
          isLive: false,
          dataSource: 'verified_manual',
          availability: 'In Stock'
        };
      }

      return {
        ...p,
        id: p.id || `DEMO-${idx + 1}`,
        productUrl: null, // No fake URL
        retailer: p.retailer || (p.seller ? p.seller.toLowerCase().split(' ')[0] : 'demo'),
        lastCheckedAt: new Date('2026-10-12T00:00:00.000Z'),
        isLive: false,
        dataSource: 'demo_catalog',
        availability: 'Demo Catalog'
      };
    });
  }
}

export const retailerService = new RetailerService();
export default retailerService;
