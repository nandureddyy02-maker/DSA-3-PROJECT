import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { applyVerifiedUrlsToDB, VERIFIED_LISTINGS } from './services/verifiedUrlService.js';
import Product from './models/Product.js';

dotenv.config();

async function run() {
  console.log('[Script] Connecting to MongoDB...');
  await connectDB();
  
  console.log(`[Script] Applying ${VERIFIED_LISTINGS.length} manually verified listings to MongoDB...`);
  const result = await applyVerifiedUrlsToDB();
  console.log('[Script Result]:', result);

  const updatedProducts = await Product.find({ productUrl: { $ne: null } }).select('name seller retailer productUrl dataSource lastCheckedAt').lean();
  console.log(`[Script] Current products with verified URLs in DB: ${updatedProducts.length}`);
  console.log(JSON.stringify(updatedProducts, null, 2));

  await mongoose.disconnect();
  console.log('[Script] Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
