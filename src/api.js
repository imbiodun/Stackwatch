const API_BASE_URL = 'https://api.coingecko.com/api/v3'
const CACHE_DURATION_MS = 60 * 1000
const responseCache = new Map()

export class CoinGeckoApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'CoinGeckoApiError'
    this.status = status
  }
}

async function request(endpoint, signal) {
  const cachedResponse = responseCache.get(endpoint)
  const now = Date.now()

  if (cachedResponse && now - cachedResponse.timestamp < CACHE_DURATION_MS) {
    return cachedResponse.data
  }

  const headers = {}
  const apiKey = import.meta.env.VITE_COINGECKO_KEY

  if (apiKey) {
    headers['x-cg-demo-api-key'] = apiKey
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers,
    signal,
  })

  if (response.status === 429) {
    throw new CoinGeckoApiError(
      'CoinGecko is temporarily rate-limiting requests. Please try again shortly.',
      response.status,
    )
  }

  if (!response.ok) {
    throw new CoinGeckoApiError(
      `CoinGecko request failed with status ${response.status}.`,
      response.status,
    )
  }

  const data = await response.json()
  responseCache.set(endpoint, { data, timestamp: now })
  return data
}

export function getMarkets(signal) {
  const query = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '20',
    page: '1',
    sparkline: 'false',
  })

  return request(`/coins/markets?${query}`, signal)
}

export function getCoinDetails(coinId, signal) {
  return request(`/coins/${encodeURIComponent(coinId)}`, signal)
}

export function getMarketChart(coinId, days = 30, signal) {
  const query = new URLSearchParams({
    vs_currency: 'usd',
    days: String(days),
  })

  return request(
    `/coins/${encodeURIComponent(coinId)}/market_chart?${query}`,
    signal,
  )
}
