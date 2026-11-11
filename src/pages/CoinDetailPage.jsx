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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { getCoinDetails, getMarketChart } from '../api'
import { usePortfolio } from '../context/portfolioContext'

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
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [cryptoAmount, setCryptoAmount] = useState('')
  const [formError, setFormError] = useState('')
  const { addHolding } = usePortfolio()

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

  function handleAddHolding(event) {
    event.preventDefault()
    const parsedInvestment = Number(investmentAmount)
    const parsedCryptoAmount = Number(cryptoAmount)

    if (!Number.isFinite(parsedInvestment) || parsedInvestment <= 0) {
      setFormError('Enter an investment or crypto amount greater than zero.')
      return
    }

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      setFormError('The current price is unavailable. Try again shortly.')
      return
    }

    try {
      addHolding({
        coinId: coin.id,
        coinName: coin.name,
        symbol: coin.symbol,
        image: coin.image?.small,
        amount: parsedCryptoAmount,
        buyPrice: currentPrice,
        currency,
      })
      setInvestmentAmount('')
      setCryptoAmount('')
      setFormError('')
      toast.success(`${coin.name} was added to your portfolio.`)
    } catch (saveError) {
      setFormError(saveError.message)
      toast.error('The holding could not be saved.')
    }

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

  function handleInvestmentChange(event) {
    const value = event.target.value
    setInvestmentAmount(value)

    const parsedValue = Number(value)
    if (value === '' || !Number.isFinite(parsedValue) || currentPrice <= 0) {
      setCryptoAmount('')
      return
    }

    setCryptoAmount(String(parsedValue / currentPrice))
  }

  function handleCryptoAmountChange(event) {
    const value = event.target.value
    setCryptoAmount(value)

    const parsedValue = Number(value)
    if (value === '' || !Number.isFinite(parsedValue) || currentPrice <= 0) {
      setInvestmentAmount('')
      return
    }

    setInvestmentAmount(String(parsedValue * currentPrice))
  }

  return (
    <main className="container py-5">
      <Link to="/" className="btn btn-outline-primary coin-back-button mb-3">
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
          <div className="coin-detail-header d-flex align-items-center gap-3 mb-4">
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
              <Card className="h-100 coin-detail-card">
                <Card.Body>
                  <Card.Title>Current price</Card.Title>
                  <Card.Text className="fs-3 coin-current-price">
                    {formatCurrency(currentPrice, currency)}
                  </Card.Text>
                  <Card.Text
                    className={`coin-price-change ${
                      priceChange > 0
                        ? 'text-success'
                        : priceChange < 0
                          ? 'text-danger'
                          : 'text-body-secondary'
                    }`}
                  >
                    {formatPercentage(priceChange)} in the last 24 hours
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="h-100 coin-detail-card">
                <Card.Body>
                  <Card.Title>Market statistics</Card.Title>
                  <dl className="coin-detail-stats mb-0">
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
          <Card className="mt-4 coin-detail-card">
            <Card.Body>
              <Card.Title>Add to portfolio</Card.Title>
              <Form onSubmit={handleAddHolding}>
                <Row className="g-3 align-items-end">
                  <Col xs={12} md={4}>
                    <Form.Group controlId="holding-amount">
                      <Form.Label>Investment amount ({currency.toUpperCase()})</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="any"
                        value={investmentAmount}
                        onChange={handleInvestmentChange}
                        placeholder="e.g. 10"
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Group controlId="holding-crypto-amount">
                      <Form.Label>Crypto amount</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="any"
                        value={cryptoAmount}
                        onChange={handleCryptoAmountChange}
                        placeholder="e.g. 0.00015"
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} md={4}>
                    <Form.Group controlId="holding-buy-price">
                      <Form.Label>Current price ({currency.toUpperCase()})</Form.Label>
                      <Form.Control
                        className="coin-current-price-input"
                        value={formatCurrency(currentPrice, currency)}
                        readOnly
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12}>
                    <Button type="submit" className="w-100">
                      Add holding
                    </Button>
                  </Col>
                </Row>
                {formError && (
                  <Alert variant="danger" className="mt-3 mb-0">
                    {formError}
                  </Alert>
                )}
              </Form>
            </Card.Body>
          </Card>
          <Card className="mt-4 coin-detail-card price-history-card">
            <Card.Body>
              <div className="price-history-header d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                <Card.Title className="mb-0">Price history</Card.Title>
                <ButtonGroup className="price-history-ranges" aria-label="Price history range">
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
                <div className="price-history-chart">
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
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(timestamp) =>
                          format(new Date(timestamp), 'MMM d')
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(price) => formatCurrency(price, currency)}
                        width={72}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--chart-tooltip-bg)',
                          border: '1px solid var(--chart-tooltip-border)',
                          borderRadius: '0.65rem',
                          color: 'var(--chart-tooltip-text)',
                        }}
                        labelFormatter={(timestamp) =>
                          format(new Date(timestamp), 'MMM d, yyyy h:mm a')
                        }
                        labelStyle={{ color: 'var(--chart-tooltip-text)' }}
                        itemStyle={{ color: 'var(--chart-tooltip-text)' }}
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
