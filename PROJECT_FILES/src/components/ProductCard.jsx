import React from 'react';
import { Store, ShieldCheck, Tag, ExternalLink, ArrowUpRight, Zap, CheckCircle2 } from 'lucide-react';
import MatchingScore from './MatchingScore';

export default function ProductCard({
  product,
  isBestPrice,
  onViewDetails,
  referencePrice
}) {
  const formatPrice = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Price difference vs reference
  const priceDiff = referencePrice ? product.price - referencePrice : 0;

  return (
    <div className={`matched-product-card glass-panel ${isBestPrice ? 'best-price-highlight' : ''}`}>
      {/* Best Price Ribbon */}
      {isBestPrice && (
        <div className="best-price-badge-banner">
          <Zap size={13} fill="currentColor" />
          <span>Cheapest Offer ({product.isLive ? 'Live' : 'Cached'})</span>
        </div>
      )}

      {/* Card Header & Media */}
      <div className="card-media-wrapper">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="card-product-img"
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';
          }}
        />
        
        {/* Floating Matching Score Badge */}
        <div className="card-score-overlay">
          <MatchingScore score={product.matchScore || 90} size="compact" />
        </div>

        {/* Brand Tag */}
        <div className="card-brand-overlay">
          <Tag size={11} />
          <span>{product.brand}</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body-content">
        {/* Seller Info & Match Status */}
        <div className="card-seller-row">
          <div className="seller-pill">
            <Store size={13} />
            <span className="seller-name-text">{product.seller}</span>
          </div>

          <div className="match-status-tag">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span>Matched</span>
          </div>
        </div>

        {/* Product Title */}
        <h4 className="card-product-name" title={product.name}>
          {product.name}
        </h4>

        {/* Price & Savings Row */}
        <div className="card-pricing-row">
          <div>
            <div className="card-current-price">{formatPrice(product.price)}</div>
            {priceDiff < 0 ? (
              <span className="price-savings-text">
                Save {formatPrice(Math.abs(priceDiff))}
              </span>
            ) : priceDiff > 0 ? (
              <span className="price-extra-text">
                +{formatPrice(priceDiff)} vs query
              </span>
            ) : (
              <span className="price-neutral-text">Same as query</span>
            )}
          </div>

          {product.freeDelivery && (
            <span className="delivery-perk-badge">Free Delivery</span>
          )}
        </div>

        {/* Delivery / Warranty & Last Checked meta */}
        <div className="card-mini-meta">
          <span className="meta-item">⚡ {product.deliveryDays || 2} Day Delivery</span>
          <span className="meta-dot">•</span>
          <span className="meta-item">🛡️ {product.warranty || 'Brand Warranty'}</span>
        </div>

        {/* Retailer Source & Timestamp Badge */}
        <div className="card-source-row">
          {product.dataSource === 'live_api' ? (
            <span className="source-status-pill live-badge" title="Retrieved via live retailer API">
              <span className="live-dot" /> Live Price (API)
            </span>
          ) : product.dataSource === 'verified_manual' ? (
            <span className="source-status-pill verified-badge" title={`Manually verified link from ${product.seller}`}>
              🔵 Verified Price ({product.lastCheckedAt ? new Date(product.lastCheckedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Checked'})
            </span>
          ) : product.dataSource === 'cached_api' || product.dataSource === 'partner_feed' ? (
            <span className="source-status-pill cached-badge" title={`Cached from ${product.seller}`}>
              🕒 Cached: {product.lastCheckedAt ? new Date(product.lastCheckedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Recently'}
            </span>
          ) : (
            <span className="source-status-pill demo-badge" title="Demo Catalog (Unverified)">
              ⚪ Demo Data (Unverified)
            </span>
          )}
        </div>

        {/* Action Buttons: Inspect Match & Visit Retailer */}
        <div className="card-actions-wrapper">
          <button
            type="button"
            className="view-details-btn"
            onClick={() => onViewDetails(product)}
          >
            <span>Inspect Match</span>
            <ArrowUpRight size={15} />
          </button>

          {product.productUrl ? (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="store-link-btn"
              title={`Open official listing on ${product.seller}`}
            >
              <span>Visit Store</span>
              <ExternalLink size={14} />
            </a>
          ) : (
            <span className="no-link-badge" title="No verified product link available for this listing">
              Link unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
