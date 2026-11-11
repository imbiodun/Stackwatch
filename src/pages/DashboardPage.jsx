import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { getMarkets } from '../api'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const marketCapFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const percentageFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const REFRESH_INTERVAL_MS = 60 * 1000

function formatCurrency(value) {
  return typeof value === 'number' ? currencyFormatter.format(value) : '—'
}

function formatMarketCap(value) {
  return typeof value === 'number' ? marketCapFormatter.format(value) : '—'
}

function formatPercentage(value) {
  return typeof value === 'number'
    ? `${percentageFormatter.format(value)}%`
    : '—'
}

function MiniChart({ prices, isPositive, coinId }) {
  if (!Array.isArray(prices) || prices.length < 2) {
    return <span className="text-body-secondary">—</span>
  }

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const points = prices
    .map((price, index) => {
      const x = (index / (prices.length - 1)) * 100
      const y = 28 - ((price - min) / range) * 24
      return `${x},${y}`
    })
    .join(' ')
  const color = isPositive ? '#198754' : '#dc3545'

  return (
    <svg
      viewBox="0 0 100 32"
      width="120"
      height="40"
      role="img"
      aria-label={`${coinId} 7-day price trend`}
    >
      <polyline
        points={`${points} 100,32 0,32`}
        fill={isPositive ? 'rgba(25, 135, 84, 0.12)' : 'rgba(220, 53, 69, 0.12)'}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DashboardPage() {
  const [coins, setCoins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState({ field: null, direction: 'asc' })
  const [heroCoinId, setHeroCoinId] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadMarkets(showLoading = false) {
      if (showLoading) {
        setIsLoading(true)
      }

      try {
        const marketData = await getMarkets(controller.signal)

        if (!Array.isArray(marketData)) {
          throw new Error('CoinGecko returned an unexpected market response.')
        }

        setCoins(marketData)
        setLastUpdated(new Date())
        setError(null)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadMarkets(true)
    const refreshInterval = setInterval(() => loadMarkets(), REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(refreshInterval)
    }
  }, [retryCount])

  function handleRetry() {
    setError(null)
    setIsLoading(true)
    setRetryCount((count) => count + 1)
  }

  function handleSort(field) {
    setSort((currentSort) => ({
      field,
      direction:
        currentSort.field === field && currentSort.direction === 'asc'
          ? 'desc'
          : 'asc',
    }))
  }

  const visibleCoins = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const filteredCoins = coins.filter((coin) => {
      const name = typeof coin.name === 'string' ? coin.name : ''
      const symbol = typeof coin.symbol === 'string' ? coin.symbol : ''

      return (
        !normalizedSearch ||
        name.toLowerCase().includes(normalizedSearch) ||
        symbol.toLowerCase().includes(normalizedSearch)
      )
    })

    if (!sort.field) {
      return filteredCoins
    }

    return [...filteredCoins].sort((firstCoin, secondCoin) => {
      const firstValue = firstCoin[sort.field] ?? 0
      const secondValue = secondCoin[sort.field] ?? 0
      const comparison = firstValue - secondValue

      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [coins, searchTerm, sort])

  function sortLabel(field, label) {
    if (sort.field !== field) {
      return label
    }

    return `${label} ${sort.direction === 'asc' ? '^' : 'v'}`
  }

  const heroCoin = coins.find((coin) => coin.id === heroCoinId) || coins[0]
  const heroChartData = useMemo(
    () =>
      (heroCoin?.sparkline_in_7d?.price || []).map((price, index) => ({
        index,
        price,
      })),
    [heroCoin],
  )

  return (
    <main className="container py-5">
      <section className="dashboard-hero mb-4">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">STACKWATCH MARKET</p>
          <h1>Watch the market.</h1>
          <p className="lead mb-0">Track your stack.</p>
        </div>
        {heroCoin && (
          <div className="hero-market-card">
            <div className="hero-market-header">
              <div>
                <p className="hero-market-label">LIVE MARKET PULSE</p>
                <h2>
                  {heroCoin.name}{' '}
                  <span>{heroCoin.symbol.toUpperCase()}</span>
                </h2>
              </div>
              <img src={heroCoin.image} alt="" width="42" height="42" />
            </div>
            <div className="hero-market-stats">
              <strong>{formatCurrency(heroCoin.current_price)}</strong>
              <span
                className={
                  heroCoin.price_change_percentage_24h >= 0
                    ? 'hero-positive'
                    : 'hero-negative'
                }
              >
                {formatPercentage(heroCoin.price_change_percentage_24h)} 24h
              </span>
            </div>
            <div className="hero-chart" aria-label={`${heroCoin.name} 7-day chart`}>
              {heroChartData.length > 1 && (
                <svg viewBox="0 0 400 110" role="img">
                  <polyline
                    points={heroChartData
                      .map((point, index) => {
                        const prices = heroChartData.map((item) => item.price)
                        const min = Math.min(...prices)
                        const max = Math.max(...prices)
                        const x = (index / (prices.length - 1)) * 400
                        const y =
                          92 - ((point.price - min) / (max - min || 1)) * 74
                        return `${x},${y}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke={
                      heroCoin.price_change_percentage_24h >= 0
                        ? '#75e0a7'
                        : '#fda29b'
                    }
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div className="hero-market-controls">
              {coins.slice(0, 3).map((coin) => (
                <Button
                  key={coin.id}
                  variant={coin.id === heroCoin.id ? 'light' : 'outline-light'}
                  size="sm"
                  onClick={() => setHeroCoinId(coin.id)}
                >
                  {coin.symbol.toUpperCase()}
                </Button>
              ))}
              <span>7D trend</span>
            </div>
          </div>
        )}
      </section>
      {lastUpdated && (
        <p className="text-body-secondary">
          Last updated: {format(lastUpdated, 'MMM d, yyyy h:mm:ss a')}
        </p>
      )}
      {isLoading && (
        <div className="d-flex align-items-center gap-2" role="status">
          <Spinner animation="border" size="sm" />
          <span>Loading market data...</span>
        </div>
      )}
      {error && (
        <Alert variant="danger">
          <Alert.Heading>Market data unavailable</Alert.Heading>
          <p>{error.message}</p>
          <Button variant="outline-danger" onClick={handleRetry}>
            Try again
          </Button>
        </Alert>
      )}
      {!isLoading && !error && coins.length === 0 && (
        <Alert variant="info">No market data is available right now.</Alert>
      )}
      {!isLoading && !error && coins.length > 0 && (
        <>
          <Form.Group className="mb-3" controlId="market-search">
            <Form.Label>Search coins</Form.Label>
            <Form.Control
              type="search"
              placeholder="Search by name or symbol"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </Form.Group>
          {visibleCoins.length === 0 ? (
            <Alert variant="info">
              No coins match “{searchTerm}”. Try another search.
            </Alert>
          ) : (
            <section className="market-list-section">
              <div className="market-list-heading">
                <h2>Market listings</h2>
                <p>Live prices, market caps, and recent trends</p>
              </div>
            <Table responsive hover className="market-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Coin</th>
                  <th scope="col">
                    <Button
                      variant="link"
                      className="p-0 text-body fw-semibold text-decoration-none"
                      onClick={() => handleSort('current_price')}
                    >
                      {sortLabel('current_price', 'Price')}
                    </Button>
                  </th>
                  <th scope="col">24h change</th>
                  <th scope="col">
                    <Button
                      variant="link"
                      className="p-0 text-body fw-semibold text-decoration-none"
                      onClick={() => handleSort('market_cap')}
                    >
                      {sortLabel('market_cap', 'Market cap')}
                    </Button>
                  </th>
                  <th scope="col">7d trend</th>
                </tr>
              </thead>
              <tbody>
                {visibleCoins.map((coin) => (
                  <tr key={coin.id} className="market-row">
                    <td data-label="#"> {coin.market_cap_rank}</td>
                    <td data-label="Coin">
                      <Link to={`/coin/${coin.id}`}>
                        <img
                          src={coin.image}
                          alt=""
                          width="24"
                          height="24"
                          className="me-2"
                        />
                        {coin.name} ({coin.symbol.toUpperCase()})
                      </Link>
                    </td>
                    <td data-label="Price" className="market-value">
                      {formatCurrency(coin.current_price)}
                    </td>
                    <td
                      data-label="24h change"
                      className={
                        `market-number ${
                          coin.price_change_percentage_24h > 0
                            ? 'text-success'
                            : coin.price_change_percentage_24h < 0
                              ? 'text-danger'
                              : 'text-warning'
                        }`
                      }
                    >
                      {formatPercentage(coin.price_change_percentage_24h)}
                    </td>
                    <td data-label="Market cap" className="market-value">
                      {formatMarketCap(coin.market_cap)}
                    </td>
                    <td data-label="7d trend">
                      <MiniChart
                        prices={coin.sparkline_in_7d?.price}
                        isPositive={
                          coin.sparkline_in_7d?.price?.at(-1) >=
                          coin.sparkline_in_7d?.price?.[0]
                        }
                        coinId={coin.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default DashboardPage
