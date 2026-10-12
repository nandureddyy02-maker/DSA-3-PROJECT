import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import Product from './models/Product.js';

dotenv.config();

async function inspectProducts() {
  await connectDB();
  const products = await Product.find({}).lean();
  console.log(`Total products in DB: ${products.length}`);
  
  const report = products.map((p, idx) => ({
    index: idx + 1,
    id: p._id.toString(),
    name: p.name,
    seller: p.seller,
    retailer: p.retailer,
    price: p.price,
    hasProductUrl: Boolean(p.productUrl && p.productUrl.trim()),
    productUrl: p.productUrl || 'NONE',
    dataSource: p.dataSource,
    isLive: p.isLive,
    lastCheckedAt: p.lastCheckedAt
  }));

  console.log('PRODUCTS_REPORT:' + JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

inspectProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
