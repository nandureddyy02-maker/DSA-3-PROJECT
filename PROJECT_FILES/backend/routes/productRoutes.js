import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { matchProducts } from '../utils/dsaMatcher.js';
import { initialProducts } from '../data/mockProductsData.js';
import { retailerService } from '../services/retailerService.js';

const router = express.Router();

/**
 * @route   GET /api/products/retailers/status or /api/retailers/status
 * @desc    Get configuration status of Flipkart, Croma, and other providers
 */
router.get('/retailers/status', (req, res) => {
  const statuses = retailerService.getProviderStatuses();
  return res.status(200).json({
    success: true,
    data: statuses
  });
});

/**
 * @route   POST /api/products/retailers/sync or /api/retailers/sync
 * @desc    Trigger live product query across configured retailer providers
 */
router.post('/retailers/sync', async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required to sync retailers'
      });
    }

    const freshProducts = await retailerService.syncRetailers(query.trim());
    return res.status(200).json({
      success: true,
      query: query.trim(),
      syncedCount: freshProducts.length,
      data: freshProducts,
      statuses: retailerService.getProviderStatuses()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/products/verify-url
 * @desc    Safely record a manually verified genuine retailer URL for a listing
 */
router.post('/verify-url', async (req, res, next) => {
  try {
    const { id, name, seller, productUrl, retailer, verifiedPrice } = req.body;
    if (!productUrl || !productUrl.trim()) {
      return res.status(400).json({ success: false, error: 'Valid productUrl is required' });
    }

    const filter = id ? { _id: id } : { name, seller };
    const update = {
      productUrl: productUrl.trim(),
      dataSource: 'verified_manual',
      lastCheckedAt: new Date(),
      isLive: false,
      ...(retailer && { retailer: retailer.trim() }),
      ...(verifiedPrice && { price: Number(verifiedPrice) })
    };

    const updated = await Product.findOneAndUpdate(filter, update, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Product matching filter not found in catalog' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product URL verified and updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products
 * @desc    Return all products from MongoDB (or demo catalog fallback)
 */
router.get('/', async (req, res, next) => {
  try {
    const products = await retailerService.getCandidateCatalog();
    return res.status(200).json({
      success: true,
      count: products.length,
      providersStatus: retailerService.getProviderStatuses(),
      data: products
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/products/search?q=
 * @desc    Search products by keyword in name, brand, or category
 */
router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q;

    // Error handling: Empty search validation
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" cannot be empty'
      });
    }

    const cleanQuery = query.trim().toLowerCase();
    const allProducts = await retailerService.getCandidateCatalog(cleanQuery);

    // Search filter across name, brand, and category
    const matched = allProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(cleanQuery) || brand.includes(cleanQuery) || cat.includes(cleanQuery);
    });

    return res.status(200).json({
      success: true,
      query: query.trim(),
      count: matched.length,
      providersStatus: retailerService.getProviderStatuses(),
      data: matched
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/match
 * @desc    Find products matching the requested product using DSA pipeline
 *          (Tokenization -> Jaccard Similarity -> Levenshtein Distance -> Weighted Score)
 */
router.post('/match', async (req, res, next) => {
  try {
    const targetProduct = req.body;

    // Error handling: Empty product name validation
    if (!targetProduct || !targetProduct.name || !targetProduct.name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Product "name" is required in request body to perform entity matching'
      });
    }

    // Retrieve candidate catalog (triggering live sync if providers are configured)
    const allCandidates = await retailerService.getCandidateCatalog(targetProduct.name);

    // Execute DSA Matching Engine
    // Calculates Tokenization -> Jaccard -> Levenshtein DP -> Weighted Score
    // Returns results sorted by matchingScore descending
    const matchedProducts = matchProducts(targetProduct, allCandidates, 50);

    const providerStatuses = retailerService.getProviderStatuses();

    // Error handling / Notice when no matching products meet threshold
    if (!matchedProducts || matchedProducts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No matching products found above confidence threshold (50%)',
        count: 0,
        query: {
          name: targetProduct.name,
          brand: targetProduct.brand,
          seller: targetProduct.seller,
          price: targetProduct.price
        },
        providersStatus: providerStatuses,
        data: []
      });
    }

    // Return matched products with name, seller, price, matching score, match status, and retailer metadata
    return res.status(200).json({
      success: true,
      count: matchedProducts.length,
      query: {
        id: targetProduct.id || targetProduct._id,
        name: targetProduct.name,
        brand: targetProduct.brand,
        seller: targetProduct.seller,
        price: targetProduct.price
      },
      providersStatus: providerStatuses,
      data: matchedProducts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/seed
 * @desc    Direct seed endpoint to populate MongoDB from API
 */
router.post('/seed', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: 'MongoDB is not currently connected. Please ensure MongoDB is running.'
      });
    }

    await Product.deleteMany({});
    const inserted = await Product.insertMany(initialProducts);

    return res.status(201).json({
      success: true,
      message: `Successfully seeded ${inserted.length} products into MongoDB!`,
      count: inserted.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;
