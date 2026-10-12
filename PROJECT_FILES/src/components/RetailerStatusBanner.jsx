import React, { useState } from 'react';
import { Radio, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, Key, Database, RefreshCw } from 'lucide-react';

export default function RetailerStatusBanner({ 
  statuses = null, 
  backendStatus = 'connected',
  onRefresh
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const flipkart = statuses?.flipkart || { configured: false, mode: 'awaiting_credentials' };
  const croma = statuses?.croma || { configured: false, mode: 'awaiting_feed' };

  const handleSyncClick = async () => {
    if (onRefresh) {
      setIsSyncing(true);
      try {
        await onRefresh();
      } finally {
        setIsSyncing(false);
      }
    }
  };

  return (
    <div className="retailer-status-banner glass-panel">
      <div className="banner-top-row">
        <div className="banner-title-area">
          <div className="banner-live-indicator">
            <Radio size={14} className={backendStatus === 'connected' ? 'text-indigo-400' : 'text-amber-400'} />
            <span className="font-semibold text-sm">Retailer Provider Layer</span>
          </div>

          <div className="provider-chips-row">
            {/* Flipkart Chip */}
            <div className={`provider-chip ${flipkart.configured ? 'chip-live' : 'chip-pending'}`}>
              <span className="chip-dot" />
              <span className="chip-name">Flipkart:</span>
              <span className="chip-status">
                {flipkart.configured ? 'Live Affiliate API' : 'Awaiting API Keys'}
              </span>
            </div>

            {/* Croma Chip */}
            <div className={`provider-chip ${croma.configured ? 'chip-live' : 'chip-pending'}`}>
              <span className="chip-dot" />
              <span className="chip-name">Croma:</span>
              <span className="chip-status">
                {croma.configured ? 'Partner Feed Active' : 'Awaiting Partner Feed'}
              </span>
            </div>
          </div>
        </div>

        <div className="banner-controls">
          <button
            type="button"
            className="banner-sync-btn"
            onClick={handleSyncClick}
            disabled={isSyncing}
            title="Refresh Provider Status"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>Check Feeds</span>
          </button>

          <button
            type="button"
            className="banner-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>{isExpanded ? 'Hide Setup' : 'API Setup Info'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable Setup & Transparency Guide */}
      {isExpanded && (
        <div className="banner-details-drawer animate-fade-in">
          <div className="transparency-callout">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <p className="text-xs text-slate-300">
              <strong>Ground-Truth Guarantee:</strong> This platform never fabricates live retailer prices or product URLs.
              When credentials are not yet entered, items are explicitly marked as <em>Demo Catalog</em> with their cached time.
            </p>
          </div>

          <div className="setup-grid">
            <div className="setup-card">
              <div className="setup-card-header">
                <Key size={14} className="text-indigo-400" />
                <span className="font-medium text-xs text-white">Flipkart Affiliate API Setup</span>
              </div>
              <p className="setup-desc">
                Configure your authorized Affiliate ID and Token in <code>backend/.env</code>:
              </p>
              <pre className="env-snippet font-mono">
                {`FLIPKART_AFFILIATE_ID=your_affiliate_id\nFLIPKART_AFFILIATE_TOKEN=your_token`}
              </pre>
            </div>

            <div className="setup-card">
              <div className="setup-card-header">
                <Database size={14} className="text-cyan-400" />
                <span className="font-medium text-xs text-white">Croma Partner Feed Setup</span>
              </div>
              <p className="setup-desc">
                Configure an authorized partner API key or catalog feed in <code>backend/.env</code>:
              </p>
              <pre className="env-snippet font-mono">
                {`CROMA_PARTNER_API_KEY=your_partner_key\nCROMA_FEED_URL=https://partner.feeds/croma.json`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
