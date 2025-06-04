const coins = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', krakenSymbol: 'XBTUSD' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', krakenSymbol: 'ETHUSD' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', krakenSymbol: null },
  { id: 'solana', symbol: 'SOL', name: 'Solana', krakenSymbol: 'SOLUSD' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', krakenSymbol: 'XRPUSD' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', krakenSymbol: 'ADAUSD' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', krakenSymbol: 'DOGEUSD' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', krakenSymbol: 'SHIBUSD' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', krakenSymbol: 'AVAXUSD' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', krakenSymbol: 'DOTUSD' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', krakenSymbol: 'LINKUSD' },
  { id: 'tron', symbol: 'TRX', name: 'Tron', krakenSymbol: 'TRXUSD' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', krakenSymbol: 'MATICUSD' },
  { id: 'near', symbol: 'NEAR', name: 'Near Protocol', krakenSymbol: 'NEARUSD' },
  { id: 'aptos', symbol: 'APT', name: 'Aptos', krakenSymbol: 'APTUSD' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar', krakenSymbol: 'XLMUSD' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', krakenSymbol: 'ATOMUSD' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', krakenSymbol: 'ARBUSD' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism', krakenSymbol: 'OPUSD' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera', krakenSymbol: 'HBARUSD' }
];

let currentCoin = coins.find(coin => coin.id === 'bitcoin');
let predictionHistory = [];
let ws = null;

async function fetchPriceData(coinId) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Lỗi mạng CoinGecko');
    const data = await response.json();
    if (!data.prices || data.prices.length < 12) throw new Error('Dữ liệu CoinGecko không đủ');
    return data.prices.map(([timestamp, price]) => ({ ds: new Date(timestamp).toISOString(), y: price }));
  } catch (error) {
    console.error(`Lỗi fetchPriceData ${coinId}:`, error);
    return await fetchPriceDataFallback(coinId);
  }
}

async function fetchPriceDataFallback(coinId) {
  const binanceSymbols = {
    bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', binancecoin: 'BNBUSDT', solana: 'SOLUSDT',
    ripple: 'XRPUSDT', cardano: 'ADAUSDT', dogecoin: 'DOGEUSDT', 'shiba-inu': 'SHIBUSDT',
    'avalanche-2': 'AVAXUSDT', polkadot: 'DOTUSDT', chainlink: 'LINKUSDT', tron: 'TRXUSDT',
    'matic-network': 'MATICUSDT', near: 'NEARUSDT', aptos: 'APTUSDT', stellar: 'XLMUSDT',
    cosmos: 'ATOMUSDT', arbitrum: 'ARBUSDT', optimism: 'OPUSDT', 'hedera-hashgraph': 'HBARUSDT'
  };
  const symbol = binanceSymbols[coinId];
  if (!symbol) throw new Error('Không hỗ trợ trên Binance');
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=168`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Lỗi mạng Binance');
    const data = await response.json();
    if (!data || data.length < 12) throw new Error('Dữ liệu Binance không đủ');
    return data.map(([timestamp, open, high, low, close]) => ({
      ds: new Date(parseInt(timestamp)).toISOString(),
      y: parseFloat(close)
    }));
  } catch (error) {
    console.error(`Lỗi fetchPriceDataFallback ${coinId}:`, error);
    return await fetchPriceDataKraken(coinId);
  }
}

async function fetchPriceDataKraken(coinId) {
  const coin = coins.find(c => c.id === coinId);
  const symbol = coin?.krakenSymbol;
  if (!symbol) throw new Error('Không hỗ trợ trên Kraken');
  const url = `https://api.kraken.com/0/public/OHLC?pair=${symbol}&interval=60`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Lỗi mạng Kraken');
    const data = await response.json();
    if (!data.result || !data.result[symbol] || data.result[symbol].length < 12) throw new Error('Dữ liệu Kraken không đủ');
    return data.result[symbol].map(([timestamp, open, high, low, close]) => ({
      ds: new Date(timestamp * 1000).toISOString(),
      y: parseFloat(close)
    }));
  } catch (error) {
    console.error(`Lỗi fetchPriceDataKraken ${coinId}:`, error);
    return await fetchPriceDataCoinbase(coinId);
  }
}

async function fetchPriceDataCoinbase(coinId) {
  const coinbaseSymbols = {
    bitcoin: 'BTC-USD', ethereum: 'ETH-USD', binancecoin: 'BNB-USD', solana: 'SOL-USD',
    ripple: 'XRP-USD', cardano: 'ADA-USD', dogecoin: 'DOGE-USD', 'shiba-inu': 'SHIB-USD',
    'avalanche-2': 'AVAX-USD', polkadot: 'DOT-USD', chainlink: 'LINK-USD', tron: 'TRX-USD',
    'matic-network': 'MATIC-USD', near: 'NEAR-USD', aptos: 'APT-USD', stellar: 'XLM-USD',
    cosmos: 'ATOM-USD', arbitrum: 'ARB-USD', optimism: 'OP-USD', 'hedera-hashgraph': 'HBAR-USD'
  };
  const symbol = coinbaseSymbols[coinId];
  if (!symbol) throw new Error('Không hỗ trợ trên Coinbase');
  const url = `https://api.pro.coinbase.com/products/${symbol}/candles?granularity=3600`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Lỗi mạng Coinbase');
    const data = await response.json();
    if (!data || data.length < 12) throw new Error('Dữ liệu Coinbase không đủ');
    return data.map(([timestamp, low, high, open, close]) => ({
      ds: new Date(timestamp * 1000).toISOString(),
      y: parseFloat(close)
    })).reverse();
  } catch (error) {
    console.error(`Lỗi fetchPriceDataCoinbase ${coinId}:`, error);
    throw error;
  }
}

function linearRegressionFallback(data) {
  const times = data.map((d, i) => i);
  const prices = data.map(d => d.y);
  const n = times.length;
  if (n < 2) throw new Error('Dữ liệu không đủ để tính hồi quy');
  const xMean = times.reduce((a, b) => a + b, 0) / n;
  const yMean = prices.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (times[i] - xMean) * (prices[i] - yMean);
    den += (times[i] - xMean) ** 2;
  }
  if (den === 0) throw new Error('Dữ liệu không hợp lệ để tính hồi quy');
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return intercept + slope * (n + 24);
}

async function predictPrice(data) {
  try {
    const model = new Prophet({
      growth: 'linear',
      daily_seasonality: true,
      weekly_seasonality: true,
      yearly_seasonality: false
    });
    await model.fit(data);
    const future = model.make_future_dataframe({ periods: 24, freq: 'H' });
    const forecast = await model.predict(future);
    const predictedPrice = forecast.yhat[forecast.yhat.length - 1];
    if (isNaN(predictedPrice) || predictedPrice <= 0) throw new Error('Dự đoán không hợp lệ');
    return predictedPrice;
  } catch (error) {
    console.error('Lỗi dự đoán Prophet:', error);
    return linearRegressionFallback(data);
  }
}

async function updateCoin() {
  if (!currentCoin) return;
  try {
    const data = await fetchPriceData(currentCoin.id);
    if (data.some(d => isNaN(d.y) || d.y <= 0)) throw new Error('Giá không hợp lệ');
    const predictedPrice = await predictPrice(data);
    const lastPrice = data[data.length - 1].y;
    const trend = predictedPrice > lastPrice ? 'Tăng' : 'Giảm';
    const percentageChange = ((predictedPrice - lastPrice) / lastPrice) * 100;

    document.getElementById('predicted-price').textContent = `$${predictedPrice.toFixed(2)}`;
    document.getElementById('trend').textContent = `${trend} (${percentageChange.toFixed(2)}%)`;

    predictionHistory.unshift({
      time: new Date().toLocaleString('vi-VN'),
      price: predictedPrice.toFixed(2),
      trend: `${trend} (${percentageChange.toFixed(2)}%)`
    });

    if (predictionHistory.length > 10) predictionHistory.pop();

    const historyList = document.getElementById('prediction-history');
    historyList.innerHTML = predictionHistory.map(item => 
      `<li>${item.time}: $${item.price} - ${item.trend}</li>`
    ).join('');
  } catch (error) {
    console.error(`Lỗi updateCoin ${currentCoin.id}:`, error);
    document.getElementById('predicted-price').textContent = 'Lỗi tải dữ liệu';
    document.getElementById('trend').textContent = 'Lỗi tải dữ liệu';
  }
}

function updateCurrentPrice() {
  if (!currentCoin) return;
  if (ws) ws.close();
  ws = new WebSocket(`wss://stream.binance.com:9443/ws/${currentCoin.symbol.toLowerCase()}usdt@ticker`);
  ws.onopen = () => {
    document.getElementById('current-price').textContent = 'Đang tải...';
  };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const lastPrice = parseFloat(data.c);
      if (!isNaN(lastPrice) && lastPrice > 0) {
        document.getElementById('current-price').textContent = `$${lastPrice.toFixed(2)}`;
      }
    } catch (error) {
      console.error('Lỗi xử lý WebSocket:', error);
      document.getElementById('current-price').textContent = 'Lỗi dữ liệu';
    }
  };
  ws.onerror = () => {
    document.getElementById('current-price').textContent = 'Lỗi kết nối';
    ws.close();
  };
  ws.onclose = () => {
    setTimeout(updateCurrentPrice, 5000);
  };
}

function changeCoin() {
  const selector = document.getElementById('coin-selector');
  const coinId = selector.value;
  currentCoin = coins.find(coin => coin.id === coinId);
  if (currentCoin) {
    document.getElementById('coin-data').style.display = 'block';
    document.getElementById('coin-name').textContent = `${currentCoin.name} (${currentCoin.symbol})`;
    predictionHistory = [];
    document.getElementById('prediction-history').innerHTML = '';
    updateCoin();
    updateCurrentPrice();
  } else {
    document.getElementById('coin-data').style.display = 'none';
  }
}

// Khởi tạo với Bitcoin
document.getElementById('coin-data').style.display = 'block';
updateCoin();
updateCurrentPrice();
