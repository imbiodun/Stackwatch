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

function DashboardPage() {
  const [coins, setCoins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState({ field: null, direction: 'asc' })

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

  return (
    <main className="container py-5">
      <h1>Market dashboard</h1>
      <p className="lead">Top cryptocurrency prices by market capitalization.</p>
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
            <Table responsive hover>
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
                </tr>
              </thead>
              <tbody>
                {visibleCoins.map((coin) => (
                  <tr key={coin.id}>
                    <td>{coin.market_cap_rank}</td>
                    <td>
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
                    <td>{formatCurrency(coin.current_price)}</td>
                    <td
                      className={
                        coin.price_change_percentage_24h > 0
                          ? 'text-success'
                          : coin.price_change_percentage_24h < 0
                            ? 'text-danger'
                            : 'text-body-secondary'
                      }
                    >
                      {formatPercentage(coin.price_change_percentage_24h)}
                    </td>
                    <td>{formatMarketCap(coin.market_cap)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </main>
  )
}

export default DashboardPage
