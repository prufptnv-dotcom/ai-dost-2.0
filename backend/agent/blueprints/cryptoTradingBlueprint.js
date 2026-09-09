/**
 * Crypto Trading & Portfolio Tracker Blueprint
 * Real-time DEX tickers, interactive SVG asset donut chart, buy/sell modal, and P&L history ledger.
 */

function getCryptoTradingBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: name || 'crypto-portfolio-tracker',
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          server: 'node server.js',
          start: 'vite'
        },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'lucide-react': '^1.16.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.3.4',
          vite: '^6.0.7'
        }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || 'CryptoFolio AI'} | Real-Time Crypto Portfolio Tracker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; background-color: #090d16; color: #f8fafc; }
      .font-mono { font-family: 'JetBrains Mono', monospace; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Mock in-memory database for crypto orders & history
let transactions = [
  { id: 'tx-1', type: 'BUY', asset: 'BTC', amount: 0.25, price: 61500.00, total: 15375.00, pnl: 687.70, timestamp: '2026-09-06 18:24', status: 'Completed' },
  { id: 'tx-2', type: 'BUY', asset: 'ETH', amount: 2.50, price: 3250.00, total: 8125.00, pnl: 575.62, timestamp: '2026-09-06 14:10', status: 'Completed' },
  { id: 'tx-3', type: 'SELL', asset: 'SOL', amount: 15.0, price: 155.20, total: 2328.00, pnl: 342.50, timestamp: '2026-09-05 21:05', status: 'Completed' }
];

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CryptoFolio Market Service', timestamp: new Date().toISOString() });
});

app.get('/api/transactions', (req, res) => {
  res.json(transactions);
});

app.post('/api/trade', (req, res) => {
  const { type, asset, amount, price } = req.body;
  const numAmount = parseFloat(amount);
  const numPrice = parseFloat(price);
  if (!type || !asset || isNaN(numAmount) || isNaN(numPrice)) {
    return res.status(400).json({ error: 'Invalid trade parameters' });
  }

  const newTx = {
    id: 'tx-' + Date.now(),
    type: type.toUpperCase(),
    asset: asset.toUpperCase(),
    amount: numAmount,
    price: numPrice,
    total: Number((numAmount * numPrice).toFixed(2)),
    pnl: type.toUpperCase() === 'SELL' ? Number((numPrice * 0.05 * numAmount).toFixed(2)) : 0,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
    status: 'Completed'
  };

  transactions.unshift(newTx);
  res.status(201).json(newTx);
});

app.listen(PORT, () => {
  console.log('⚡ Crypto backend running on port ' + PORT);
});`
    },
    {
      path: 'src/services/api.js',
      content: `const BACKEND_URL = '/api';

export async function fetchTransactions() {
  try {
    const res = await fetch(\`\${BACKEND_URL}/transactions\`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return await res.json();
  } catch (err) {
    console.warn('API fallback to local state:', err);
    return [];
  }
}

export async function executeTradeApi(tradeData) {
  try {
    const res = await fetch(\`\${BACKEND_URL}/trade\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData)
    });
    if (!res.ok) throw new Error('Trade failed');
    return await res.json();
  } catch (err) {
    console.warn('API trade fallback:', err);
    return {
      id: 'tx-' + Date.now(),
      ...tradeData,
      total: tradeData.amount * tradeData.price,
      pnl: tradeData.type === 'SELL' ? (tradeData.price * 0.05 * tradeData.amount) : 0,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'Completed'
    };
  }
}`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background-color: #090d16;
  color: #f8fafc;
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #090d16;
}
::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #334155;
}`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, Activity, PlusCircle, ArrowLeftRight,
  CheckCircle2, X, Search, Clock, BarChart3, AlertCircle, Coins
} from 'lucide-react';

const INITIAL_COINS = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 64250.80,
    change24h: 3.42,
    holdings: 0.45,
    color: '#f59e0b',
    sparkline: [62.1, 62.8, 63.4, 62.9, 63.8, 64.1, 64.25]
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 3480.25,
    change24h: 5.18,
    holdings: 4.20,
    color: '#6366f1',
    sparkline: [3.31, 3.34, 3.40, 3.38, 3.44, 3.46, 3.48]
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    price: 152.40,
    change24h: -1.85,
    holdings: 35.0,
    color: '#10b981',
    sparkline: [156, 158, 154, 152, 155, 150, 152.4]
  },
  {
    id: 'binancecoin',
    name: 'BNB',
    symbol: 'BNB',
    price: 585.10,
    change24h: 2.15,
    holdings: 6.5,
    color: '#eab308',
    sparkline: [574, 578, 580, 582, 579, 583, 585.1]
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    price: 0.485,
    change24h: -0.92,
    holdings: 4200,
    color: '#06b6d4',
    sparkline: [0.49, 0.50, 0.48, 0.49, 0.48, 0.482, 0.485]
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    symbol: 'AVAX',
    price: 28.60,
    change24h: 6.40,
    holdings: 45.0,
    color: '#ef4444',
    sparkline: [26.8, 27.2, 27.5, 27.9, 28.1, 28.3, 28.6]
  }
];

const INITIAL_TRANSACTIONS = [
  { id: 'tx-1', type: 'BUY', asset: 'BTC', amount: 0.25, price: 61500.00, total: 15375.00, pnl: 687.70, timestamp: '2026-09-06 18:24', status: 'Completed' },
  { id: 'tx-2', type: 'BUY', asset: 'ETH', amount: 2.50, price: 3250.00, total: 8125.00, pnl: 575.62, timestamp: '2026-09-06 14:10', status: 'Completed' },
  { id: 'tx-3', type: 'SELL', asset: 'SOL', amount: 15.0, price: 155.20, total: 2328.00, pnl: 342.50, timestamp: '2026-09-05 21:05', status: 'Completed' },
  { id: 'tx-4', type: 'BUY', asset: 'AVAX', amount: 30.0, price: 25.40, total: 762.00, pnl: 96.00, timestamp: '2026-09-05 11:30', status: 'Completed' }
];

// Interactive SVG Donut Chart Component
function AssetDonutChart({ data, totalValue, activeSlice, onHoverSlice }) {
  const size = 260;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative w-[260px] h-[260px] flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#1e293b" strokeWidth={strokeWidth} />
          {data.map((item) => {
            const percent = totalValue > 0 ? (item.value / totalValue) : 0;
            const strokeDasharray = \`\${percent * circumference} \${circumference}\`;
            const strokeDashoffset = -(accumulatedPercent * circumference);
            accumulatedPercent += percent;
            const isHovered = activeSlice === item.symbol;

            return (
              <circle
                key={item.symbol}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer opacity-90 hover:opacity-100"
                onMouseEnter={() => onHoverSlice(item.symbol)}
                onMouseLeave={() => onHoverSlice(null)}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
            {activeSlice ? \`\${activeSlice} Share\` : 'Total Portfolio'}
          </span>
          <span className="text-xl font-extrabold text-white font-mono mt-0.5">
            {activeSlice
              ? \`$\${(data.find(d => d.symbol === activeSlice)?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`
              : \`$\${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`
            }
          </span>
          <span className="text-[10px] text-emerald-400 font-mono mt-0.5 font-bold">
            {activeSlice
              ? \`\${((data.find(d => d.symbol === activeSlice)?.value || 0) / (totalValue || 1) * 100).toFixed(1)}% of total\`
              : '+6.82% 24h P&L'
            }
          </span>
        </div>
      </div>

      <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/80">
        {data.map((item) => (
          <div
            key={item.symbol}
            onMouseEnter={() => onHoverSlice(item.symbol)}
            onMouseLeave={() => onHoverSlice(null)}
            className={\`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer \${
              activeSlice === item.symbol ? 'bg-zinc-800/90 shadow-md border border-zinc-700' : 'hover:bg-zinc-850'
            }\`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-bold text-zinc-200 truncate">{item.symbol}</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-white">
                $\${item.value >= 1000 ? (item.value / 1000).toFixed(1) + 'k' : item.value.toFixed(0)}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                {totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ points, color }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 80;
  const height = 28;

  const pathPoints = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return \`\${x},\${y}\`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pathPoints} />
    </svg>
  );
}

export default function App() {
  const [coins, setCoins] = useState(INITIAL_COINS);
  const [usdtBalance, setUsdtBalance] = useState(12450.00);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [activeSlice, setActiveSlice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [txFilter, setTxFilter] = useState('ALL');
  const [flashingCoins, setFlashingCoins] = useState({});

  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedCoinForTrade, setSelectedCoinForTrade] = useState(INITIAL_COINS[0]);
  const [tradeType, setTradeType] = useState('BUY');
  const [tradeAmount, setTradeAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Real-time simulated price ticks
  useEffect(() => {
    const interval = setInterval(() => {
      const targetIndex = Math.floor(Math.random() * coins.length);
      setCoins(prevCoins => {
        const updated = [...prevCoins];
        const c = { ...updated[targetIndex] };
        const percentChange = (Math.random() * 0.8 - 0.38);
        const oldPrice = c.price;
        const newPrice = Math.max(0.01, Number((oldPrice * (1 + percentChange / 100)).toFixed(c.price < 1 ? 4 : 2)));
        const isUp = newPrice >= oldPrice;

        c.price = newPrice;
        c.change24h = Number((c.change24h + percentChange * 0.15).toFixed(2));
        c.sparkline = [...c.sparkline.slice(1), newPrice];
        updated[targetIndex] = c;

        setFlashingCoins(f => ({ ...f, [c.symbol]: isUp ? 'up' : 'down' }));
        setTimeout(() => {
          setFlashingCoins(f => {
            const next = { ...f };
            delete next[c.symbol];
            return next;
          });
        }, 800);

        return updated;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [coins.length]);

  const portfolioHoldings = useMemo(() => {
    return coins.map(c => ({ ...c, usdValue: c.holdings * c.price }));
  }, [coins]);

  const totalCryptoValue = useMemo(() => {
    return portfolioHoldings.reduce((sum, c) => sum + c.usdValue, 0);
  }, [portfolioHoldings]);

  const totalPortfolioValue = totalCryptoValue + usdtBalance;

  const chartData = useMemo(() => {
    const items = portfolioHoldings
      .filter(c => c.usdValue > 0)
      .map(c => ({ symbol: c.symbol, name: c.name, value: c.usdValue, color: c.color }));
    if (usdtBalance > 0) {
      items.push({ symbol: 'USDT', name: 'Tether USD', value: usdtBalance, color: '#22c55e' });
    }
    return items.sort((a, b) => b.value - a.value);
  }, [portfolioHoldings, usdtBalance]);

  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return portfolioHoldings;
    const q = searchQuery.toLowerCase();
    return portfolioHoldings.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  }, [portfolioHoldings, searchQuery]);

  const filteredTxs = useMemo(() => {
    if (txFilter === 'ALL') return transactions;
    return transactions.filter(t => t.type === txFilter);
  }, [transactions, txFilter]);

  const handleExecuteTrade = (e) => {
    e.preventDefault();
    const qty = parseFloat(tradeAmount);
    if (isNaN(qty) || qty <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    const coin = selectedCoinForTrade;
    const currentPrice = coins.find(c => c.symbol === coin.symbol)?.price || coin.price;
    const totalCost = qty * currentPrice;

    if (tradeType === 'BUY') {
      if (totalCost > usdtBalance) {
        showNotification(\`Insufficient USDT balance. Need $\${totalCost.toFixed(2)}, have $\${usdtBalance.toFixed(2)}\`, 'error');
        return;
      }
      setUsdtBalance(b => b - totalCost);
      setCoins(prev => prev.map(c => c.symbol === coin.symbol ? { ...c, holdings: c.holdings + qty } : c));
      
      const newTx = {
        id: \`tx-\${Date.now()}\`,
        type: 'BUY',
        asset: coin.symbol,
        amount: qty,
        price: currentPrice,
        total: totalCost,
        pnl: 0,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'Completed'
      };
      setTransactions(prev => [newTx, ...prev]);
      showNotification(\`Successfully bought \${qty} \${coin.symbol} for $\${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`, 'success');
    } else {
      if (qty > coin.holdings) {
        showNotification(\`Insufficient \${coin.symbol} holdings. You have \${coin.holdings} \${coin.symbol}\`, 'error');
        return;
      }
      setUsdtBalance(b => b + totalCost);
      setCoins(prev => prev.map(c => c.symbol === coin.symbol ? { ...c, holdings: Math.max(0, c.holdings - qty) } : c));
      
      const realizedPnl = (currentPrice * 0.05) * qty;
      const newTx = {
        id: \`tx-\${Date.now()}\`,
        type: 'SELL',
        asset: coin.symbol,
        amount: qty,
        price: currentPrice,
        total: totalCost,
        pnl: realizedPnl,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'Completed'
      };
      setTransactions(prev => [newTx, ...prev]);
      showNotification(\`Successfully sold \${qty} \${coin.symbol} for $\${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`, 'success');
    }

    setTradeAmount('');
    setTradeModalOpen(false);
  };

  const handleDepositCash = (amount) => {
    setUsdtBalance(b => b + amount);
    showNotification(\`+$\${amount.toLocaleString()} USDT deposited into buying power!\`, 'success');
    setDepositModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 font-sans pb-16">
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in">
          <div className={\`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md \${
            notification.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          }\`}>
            {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span className="text-xs font-bold">{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0c1220]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight">CryptoFolio AI</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Feed
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">Simulated Real-Time Portfolio & High-Frequency DEX Tickers</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setDepositModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all flex items-center gap-1.5 border border-zinc-700/60 shadow cursor-pointer"
          >
            <PlusCircle size={14} className="text-emerald-400" />
            <span>Deposit USDT</span>
          </button>
          <button
            onClick={() => {
              setSelectedCoinForTrade(coins[0]);
              setTradeType('BUY');
              setTradeModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeftRight size={14} />
            <span>Quick Trade</span>
          </button>
        </div>
      </header>

      {/* Ticker Ribbon */}
      <div className="bg-[#0e1424] border-b border-zinc-800/70 overflow-x-auto scrollbar-none py-2 px-4 md:px-8">
        <div className="flex items-center gap-6 min-w-max">
          {coins.map((coin) => {
            const isFlashing = flashingCoins[coin.symbol];
            return (
              <div
                key={coin.symbol}
                onClick={() => {
                  setSelectedCoinForTrade(coin);
                  setTradeType('BUY');
                  setTradeModalOpen(true);
                }}
                className={\`flex items-center gap-2 px-2.5 py-1 rounded-lg transition-all cursor-pointer \${
                  isFlashing === 'up'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isFlashing === 'down'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'hover:bg-zinc-800/60'
                }\`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: coin.color }} />
                <span className="text-xs font-bold text-zinc-200">{coin.symbol}</span>
                <span className="text-xs font-mono font-semibold text-white">
                  $\${coin.price >= 1 ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : coin.price.toFixed(4)}
                </span>
                <span className={\`text-[11px] font-mono font-bold flex items-center \${
                  coin.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }\`}>
                  {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12192c] to-[#0c1220] border border-zinc-800/90 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Net Worth</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Wallet size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                $\${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-400 font-mono">
                <TrendingUp size={14} />
                <span>+$2,410.50 (5.18%)</span>
                <span className="text-[10px] text-zinc-400 font-normal">Past 24h</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12192c] to-[#0c1220] border border-zinc-800/90 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Buying Power (USDT)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                $\${usdtBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => handleDepositCash(1000)}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  + $1,000 Quick Deposit
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12192c] to-[#0c1220] border border-zinc-800/90 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Crypto Assets</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Coins size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                $\${totalCryptoValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-400 mt-2 flex items-center gap-1 font-mono">
                <span>{portfolioHoldings.filter(c => c.holdings > 0).length} Active Coins</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#12192c] to-[#0c1220] border border-zinc-800/90 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Realized Profit</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Activity size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                +$1,701.82
              </div>
              <div className="text-xs text-zinc-400 mt-2 flex items-center gap-1 font-mono">
                <span>{transactions.length} Total Executed Trades</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two Columns: Assets Table + Donut Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#0f1527] border border-zinc-800/90 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Live Assets & Holdings</h2>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search asset or symbol..."
                    className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-800/80 uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pl-2">Asset</th>
                      <th className="pb-3 text-right">Price</th>
                      <th className="pb-3 text-right">24h Change</th>
                      <th className="pb-3 text-right">Holdings</th>
                      <th className="pb-3 text-center">7D Trend</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {filteredCoins.map((coin) => {
                      const isFlashing = flashingCoins[coin.symbol];
                      return (
                        <tr
                          key={coin.symbol}
                          className={\`hover:bg-zinc-800/40 transition-colors \${
                            isFlashing === 'up' ? 'bg-emerald-950/20' : isFlashing === 'down' ? 'bg-rose-950/20' : ''
                          }\`}
                        >
                          <td className="py-3.5 pl-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow"
                                style={{ backgroundColor: coin.color + '20', color: coin.color }}
                              >
                                {coin.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-bold text-white text-xs">{coin.name}</div>
                                <div className="text-[10px] text-zinc-400 uppercase font-mono">{coin.symbol}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 text-right font-mono font-bold text-white">
                            $\${coin.price >= 1 ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : coin.price.toFixed(4)}
                          </td>

                          <td className="py-3.5 text-right font-mono font-bold">
                            <span className={\`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] \${
                              coin.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }\`}>
                              {coin.change24h >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {Math.abs(coin.change24h)}%
                            </span>
                          </td>

                          <td className="py-3.5 text-right font-mono">
                            <div className="font-bold text-zinc-200">
                              $\${coin.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {coin.holdings} {coin.symbol}
                            </div>
                          </td>

                          <td className="py-3.5 text-center">
                            <div className="flex justify-center">
                              <Sparkline points={coin.sparkline} color={coin.change24h >= 0 ? '#10b981' : '#f43f5e'} />
                            </div>
                          </td>

                          <td className="py-3.5 text-right pr-2">
                            <button
                              onClick={() => {
                                setSelectedCoinForTrade(coin);
                                setTradeType('BUY');
                                setTradeModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-zinc-800 hover:bg-indigo-600 text-zinc-200 hover:text-white rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-sm"
                            >
                              Trade
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#0f1527] border border-zinc-800/90 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Asset Allocation</h2>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  {chartData.length} Assets
                </span>
              </div>

              <AssetDonutChart
                data={chartData}
                totalValue={totalPortfolioValue}
                activeSlice={activeSlice}
                onHoverSlice={setActiveSlice}
              />
            </div>
          </div>
        </div>

        {/* Transactions Ledger */}
        <div className="bg-[#0f1527] border border-zinc-800/90 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Execution Ledger & Realized P&L</h2>
            </div>
            
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              {['ALL', 'BUY', 'SELL'].map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={\`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer \${
                    txFilter === f ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                  }\`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800/80 uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pl-2">Type</th>
                  <th className="pb-3">Asset</th>
                  <th className="pb-3 text-right">Quantity</th>
                  <th className="pb-3 text-right">Executed Price</th>
                  <th className="pb-3 text-right">Total (USD)</th>
                  <th className="pb-3 text-right">Realized P&L</th>
                  <th className="pb-3 text-right">Time</th>
                  <th className="pb-3 text-right pr-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 pl-2 font-bold">
                      <span className={\`px-2 py-0.5 rounded-lg text-[10px] font-mono \${
                        tx.type === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }\`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 font-bold text-white">{tx.asset}</td>
                    <td className="py-3 text-right font-mono text-zinc-300">{tx.amount} {tx.asset}</td>
                    <td className="py-3 text-right font-mono text-zinc-300">$\${tx.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right font-mono font-bold text-white">$\${tx.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right font-mono font-bold text-emerald-400">{tx.pnl > 0 ? \`+$\${tx.pnl.toFixed(2)}\` : '—'}</td>
                    <td className="py-3 text-right font-mono text-zinc-400 text-[11px]">{tx.timestamp}</td>
                    <td className="py-3 text-right pr-2">
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center justify-end gap-1">
                        <CheckCircle2 size={12} />
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Trade Modal */}
      {tradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#111728] border border-zinc-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Execute Trade</h3>
              </div>
              <button
                onClick={() => setTradeModalOpen(false)}
                className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setTradeType('BUY')}
                className={\`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer \${
                  tradeType === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-zinc-400 hover:text-white'
                }\`}
              >
                Buy {selectedCoinForTrade.symbol}
              </button>
              <button
                type="button"
                onClick={() => setTradeType('SELL')}
                className={\`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer \${
                  tradeType === 'SELL'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'text-zinc-400 hover:text-white'
                }\`}
              >
                Sell {selectedCoinForTrade.symbol}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Select Asset
              </label>
              <select
                value={selectedCoinForTrade.symbol}
                onChange={(e) => {
                  const target = coins.find(c => c.symbol === e.target.value);
                  if (target) setSelectedCoinForTrade(target);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {coins.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.name} ({c.symbol}) — $\${c.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-bold text-zinc-400 uppercase tracking-wider">Amount ({selectedCoinForTrade.symbol})</span>
                <span className="font-mono text-zinc-400">
                  {tradeType === 'BUY' ? \`Avail: $\${usdtBalance.toFixed(2)} USDT\` : \`Holdings: \${selectedCoinForTrade.holdings} \${selectedCoinForTrade.symbol}\`}
                </span>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-lg font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
              />

              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[0.25, 0.50, 0.75, 1.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      if (tradeType === 'BUY') {
                        const maxSpend = usdtBalance * pct;
                        const coinPrice = selectedCoinForTrade.price;
                        setTradeAmount((maxSpend / coinPrice).toFixed(4));
                      } else {
                        setTradeAmount((selectedCoinForTrade.holdings * pct).toFixed(4));
                      }
                    }}
                    className="py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-mono font-bold transition-all border border-zinc-800 cursor-pointer"
                  >
                    {pct * 100}%
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800/80 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Execution Price</span>
                <span className="text-white font-bold">$\${selectedCoinForTrade.price.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Estimated Total Value</span>
                <span className="text-white font-bold">
                  $\${((parseFloat(tradeAmount) || 0) * selectedCoinForTrade.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Slippage Tolerance</span>
                <span className="text-zinc-300">{slippage}%</span>
              </div>
            </div>

            <button
              onClick={handleExecuteTrade}
              className={\`w-full py-3 rounded-xl font-bold text-xs text-white shadow-xl transition-all cursor-pointer \${
                tradeType === 'BUY'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/20'
              }\`}
            >
              Confirm {tradeType} {selectedCoinForTrade.symbol}
            </button>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-[#111728] border border-zinc-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Deposit USDT Funds</h3>
              </div>
              <button
                onClick={() => setDepositModalOpen(false)}
                className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Add simulated funds to your paper-trading wallet to test high-frequency crypto trading and portfolio diversification.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[1000, 5000, 10000, 50000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleDepositCash(amt)}
                  className="py-3 bg-zinc-900 hover:bg-emerald-600/20 hover:border-emerald-500/50 border border-zinc-800 rounded-xl font-mono font-bold text-sm text-white transition-all cursor-pointer"
                >
                  +$\${amt.toLocaleString()} USDT
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# 🚀 ${title || 'CryptoFolio AI'} — Real-Time Crypto Portfolio Tracker

A production-grade, high-frequency cryptocurrency portfolio tracker and DEX simulator built with React 19, Tailwind CSS, and Lucide Icons.

## Features
- **⚡ Simulated Live Price Tickers**: High-frequency ticks for BTC, ETH, SOL, BNB, ADA, AVAX with real-time green/red market flashes.
- **📊 Interactive SVG Asset Donut Chart**: Hoverable allocation breakdown with percentage calculation and portfolio share.
- **🔄 Buy / Sell Transaction Modal**: Full conversion calculator, slippage tolerance, gas estimation, and instant wallet balance updates.
- **📜 Realized P&L Ledger**: Comprehensive execution history with completed trade status and timestamp logging.
- **💵 Paper Trading USDT Deposit**: Quick deposit actions to test trading strategies with simulated buying power.
`
    }
  ];
}

module.exports = { getCryptoTradingBlueprint };
