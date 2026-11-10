import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  Row,
  Spinner,
} from 'react-bootstrap'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getCoinDetails, getMarketChart } from '../api'

const percentageFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const chartRanges = [
  { value: 365, label: '1 year' },
  { value: 90, label: '90 days' },
  { value: 30, label: '30 days' },
  { value: 7, label: '7 days' },
]

const currencies = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'gbp', label: 'GBP' },
  { value: 'jpy', label: 'JPY' },
]

function formatCurrency(value, currency, compact = false) {
  if (typeof value !== 'number') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 2 : undefined,
  }).format(value)
}

function formatPercentage(value) {
  return typeof value === 'number'
    ? `${percentageFormatter.format(value)}%`
    : '—'
}

function CoinDetailPage() {
  const { id } = useParams()
  const [coin, setCoin] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [chartData, setChartData] = useState([])
  const [chartIsLoading, setChartIsLoading] = useState(true)
  const [chartError, setChartError] = useState(null)
  const [chartRange, setChartRange] = useState(30)
  const [currency, setCurrency] = useState('usd')

  useEffect(() => {
    const controller = new AbortController()

    async function loadCoin() {
      setIsLoading(true)
      setError(null)

      try {
        const coinData = await getCoinDetails(id, controller.signal)

        if (!coinData || typeof coinData !== 'object') {
          throw new Error('CoinGecko returned an unexpected coin response.')
        }

        setCoin(coinData)
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

    loadCoin()

    return () => controller.abort()
  }, [id, retryCount])

  useEffect(() => {
    const controller = new AbortController()

    async function loadChart() {
      setChartIsLoading(true)
      setChartError(null)

      try {
        const chartResponse = await getMarketChart(
          id,
          chartRange,
          currency,
          controller.signal,
        )

        if (!Array.isArray(chartResponse?.prices)) {
          throw new Error('CoinGecko returned an unexpected chart response.')
        }

        setChartData(
          chartResponse.prices
            .filter(
              ([timestamp, price]) =>
                typeof timestamp === 'number' && typeof price === 'number',
            )
            .map(([timestamp, price]) => ({
              timestamp,
              price,
            })),
        )
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setChartError(requestError)
        }
      } finally {
        if (!controller.signal.aborted) {
          setChartIsLoading(false)
        }
      }
    }

    loadChart()

    return () => controller.abort()
  }, [chartRange, currency, id, retryCount])

  function handleRetry() {
    setRetryCount((count) => count + 1)
  }

  const marketData = coin?.market_data
  const currentPrice = marketData?.current_price?.[currency]
  const priceChange = marketData?.price_change_percentage_24h
  const chartDirection =
    chartData.length > 1
      ? chartData.at(-1).price >= chartData[0].price
        ? 'up'
        : 'down'
      : 'neutral'
  const chartColor =
    chartDirection === 'up'
      ? '#198754'
      : chartDirection === 'down'
        ? '#dc3545'
        : '#0d6efd'

  return (
    <main className="container py-5">
      <Link to="/" className="btn btn-link px-0 mb-3">
        Back to market
      </Link>
      {isLoading && (
        <div className="d-flex align-items-center gap-2" role="status">
          <Spinner animation="border" size="sm" />
          <span>Loading coin details...</span>
        </div>
      )}
      {error && (
        <Alert variant="danger">
          <Alert.Heading>Coin details unavailable</Alert.Heading>
          <p>{error.message}</p>
          <Button variant="outline-danger" onClick={handleRetry}>
            Try again
          </Button>
        </Alert>
      )}
      {!isLoading && !error && !coin && (
        <Alert variant="info">No details are available for this coin.</Alert>
      )}
      {!isLoading && !error && coin && (
        <>
          <div className="d-flex align-items-center gap-3 mb-4">
            <img src={coin.image?.large} alt="" width="64" height="64" />
            <div>
              <h1 className="mb-1">{coin.name}</h1>
              <p className="text-body-secondary mb-0">
                {coin.symbol?.toUpperCase()}
              </p>
            </div>
            <Form.Select
              aria-label="Display currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="ms-auto"
              style={{ maxWidth: '130px' }}
            >
              {currencies.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </div>
          <Row className="g-3">
            <Col xs={12} md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Current price</Card.Title>
                  <Card.Text className="fs-3">
                    {formatCurrency(currentPrice, currency)}
                  </Card.Text>
                  <Card.Text
                    className={
                      priceChange > 0
                        ? 'text-success'
                        : priceChange < 0
                          ? 'text-danger'
                          : 'text-body-secondary'
                    }
                  >
                    {formatPercentage(priceChange)} in the last 24 hours
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>Market statistics</Card.Title>
                  <dl className="mb-0">
                    <dt>Market cap</dt>
                    <dd>
                      {formatCurrency(
                        marketData?.market_cap?.[currency],
                        currency,
                        true,
                      )}
                    </dd>
                    <dt>24h volume</dt>
                    <dd>
                      {formatCurrency(
                        marketData?.total_volume?.[currency],
                        currency,
                        true,
                      )}
                    </dd>
                    <dt>Market cap rank</dt>
                    <dd>{coin.market_cap_rank ?? '—'}</dd>
                    <dt>All-time high</dt>
                    <dd>
                      {formatCurrency(marketData?.ath?.[currency], currency)}
                    </dd>
                    <dt>All-time low</dt>
                    <dd>
                      {formatCurrency(marketData?.atl?.[currency], currency)}
                    </dd>
                  </dl>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Card className="mt-4">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                <Card.Title className="mb-0">Price history</Card.Title>
                <ButtonGroup aria-label="Price history range">
                  {chartRanges.map((range) => (
                    <Button
                      key={range.value}
                      variant={
                        chartRange === range.value
                          ? 'primary'
                          : 'outline-primary'
                      }
                      onClick={() => setChartRange(range.value)}
                    >
                      {range.label}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
              {chartIsLoading && (
                <div className="d-flex align-items-center gap-2" role="status">
                  <Spinner animation="border" size="sm" />
                  <span>Loading price history...</span>
                </div>
              )}
              {chartError && (
                <Alert variant="danger" className="mb-0">
                  <p>{chartError.message}</p>
                  <Button variant="outline-danger" onClick={handleRetry}>
                    Try again
                  </Button>
                </Alert>
              )}
              {!chartIsLoading && !chartError && chartData.length === 0 && (
                <Alert variant="info" className="mb-0">
                  No price history is available for this range.
                </Alert>
              )}
              {!chartIsLoading && !chartError && chartData.length > 0 && (
                <div style={{ height: 480 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="price-area-gradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={chartColor}
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor={chartColor}
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(timestamp) =>
                          format(new Date(timestamp), 'MMM d')
                        }
                      />
                      <YAxis
                        tickFormatter={(price) => formatCurrency(price, currency)}
                        width={90}
                      />
                      <Tooltip
                        labelFormatter={(timestamp) =>
                          format(new Date(timestamp), 'MMM d, yyyy h:mm a')
                        }
                        formatter={(price) => [
                          formatCurrency(price, currency),
                          'Price',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={chartColor}
                        fill="url(#price-area-gradient)"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </main>
  )
}

export default CoinDetailPage
