import { useEffect, useState } from 'react'
import { Alert, Button, Spinner, Table } from 'react-bootstrap'
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
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadMarkets() {
      try {
        const marketData = await getMarkets(controller.signal)

        if (!Array.isArray(marketData)) {
          throw new Error('CoinGecko returned an unexpected market response.')
        }

        setCoins(marketData)
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

    loadMarkets()

    return () => controller.abort()
  }, [retryCount])

  function handleRetry() {
    setError(null)
    setIsLoading(true)
    setRetryCount((count) => count + 1)
  }

  return (
    <main className="container py-5">
      <h1>Market dashboard</h1>
      <p className="lead">Top cryptocurrency prices by market capitalization.</p>
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
        <Table responsive hover>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Coin</th>
              <th scope="col">Price</th>
              <th scope="col">24h change</th>
              <th scope="col">Market cap</th>
            </tr>
          </thead>
          <tbody>
            {coins.map((coin) => (
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
    </main>
  )
}

export default DashboardPage
