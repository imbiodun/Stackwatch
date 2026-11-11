import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { usePortfolio } from '../context/portfolioContext'
import { getMarketPrices } from '../api'

function formatCurrency(value, currency) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        maximumFractionDigits: 2,
      }).format(value)
    : '—'
}

const chartColors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1']
const currencies = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'gbp', label: 'GBP' },
  { value: 'jpy', label: 'JPY' },
]

function PortfolioPage() {
  const { holdings, removeHolding, sellHolding } = usePortfolio()
  const [prices, setPrices] = useState({})
  const [isLoading, setIsLoading] = useState(holdings.length > 0)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [displayCurrency, setDisplayCurrency] = useState('usd')
  const [sellingId, setSellingId] = useState(null)
  const [sellAmount, setSellAmount] = useState('')
  const [activeAllocationIndex, setActiveAllocationIndex] = useState(null)

  useEffect(() => {
    if (holdings.length === 0) {
      return undefined
    }

    const controller = new AbortController()

    async function loadPrices() {
      try {
        const holdingsByCurrency = holdings.reduce((groups, holding) => {
          const currency = holding.currency || 'usd'
          const currencyHoldings = groups.get(currency) || []
          currencyHoldings.push(holding)
          groups.set(currency, currencyHoldings)
          return groups
        }, new Map())
        const displayCurrencyHoldings =
          holdingsByCurrency.get(displayCurrency) || []
        holdingsByCurrency.set(displayCurrency, displayCurrencyHoldings)

        const responses = await Promise.all(
          [...holdingsByCurrency.entries()].map(([currency, currencyHoldings]) =>
            getMarketPrices(
              [...new Set(currencyHoldings.map((holding) => holding.coinId))],
              currency,
              controller.signal,
            ),
          ),
        )

        const nextPrices = {}
        responses.forEach((response, index) => {
          const currency = [...holdingsByCurrency.keys()][index]
          response.forEach((coin) => {
            nextPrices[`${currency}:${coin.id}`] = coin.current_price
          })
        })
        setPrices(nextPrices)
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

    loadPrices()
    return () => controller.abort()
  }, [displayCurrency, holdings, retryCount])

  const rows = useMemo(
    () =>
      holdings.map((holding) => {
        const sourceCurrency = holding.currency || 'usd'
        const currentPrice = prices[`${displayCurrency}:${holding.coinId}`]
        const sourcePrice = prices[`${sourceCurrency}:${holding.coinId}`]
        const conversionRate =
          typeof currentPrice === 'number' && typeof sourcePrice === 'number'
            ? currentPrice / sourcePrice
            : null
        const convertedBuyPrice =
          conversionRate === null ? null : holding.buyPrice * conversionRate
        const currentValue =
          typeof currentPrice === 'number'
            ? currentPrice * holding.amount
            : null
        const costBasis =
          typeof convertedBuyPrice === 'number'
            ? convertedBuyPrice * holding.amount
            : null
        const profitLoss =
          typeof currentValue === 'number' && typeof costBasis === 'number'
            ? currentValue - costBasis
            : null

        return {
          ...holding,
          currency: displayCurrency,
          currentPrice,
          currentValue,
          buyPrice: convertedBuyPrice,
          profitLoss,
        }
      }),
    [displayCurrency, holdings, prices],
  )

  const totalsByCurrency = useMemo(
    () =>
      rows.reduce((totals, holding) => {
        const current = totals[displayCurrency] || {
          currentValue: 0,
          profitLoss: 0,
        }
        totals[displayCurrency] = {
          currentValue:
            current.currentValue + (holding.currentValue ?? 0),
          profitLoss: current.profitLoss + (holding.profitLoss ?? 0),
        }
        return totals
      }, {}),
    [displayCurrency, rows],
  )

  const allocationData = useMemo(
    () =>
      rows
        .filter((holding) => typeof holding.currentValue === 'number')
        .map((holding) => ({
          name: holding.symbol?.toUpperCase() || holding.coinName,
          value: holding.currentValue,
          currency: holding.currency,
        })),
    [rows],
  )

  function handleRetry() {
    setError(null)
    setIsLoading(true)
    setRetryCount((count) => count + 1)
  }

  function handleSell(holding) {
    const amount = Number(sellAmount)
    const currentPrice = prices[`${displayCurrency}:${holding.coinId}`]

    if (!Number.isFinite(amount) || amount <= 0 || amount > holding.amount) {
      toast.error('Enter a valid amount to sell.')
      return
    }

    if (typeof currentPrice !== 'number') {
      toast.error('The current price is unavailable.')
      return
    }

    try {
      const realizedProfit = sellHolding(holding.id, amount, currentPrice)
      setSellingId(null)
      setSellAmount('')
      toast.success(
        `Sold ${amount} ${holding.symbol?.toUpperCase()} with ${formatCurrency(
          realizedProfit,
          displayCurrency,
        )} realized profit.`,
      )
    } catch (sellError) {
      toast.error(sellError.message)
    }
  }

  return (
    <main className="container py-5">
      <section className="portfolio-intro mb-4">
        <div className="portfolio-intro-copy">
          <p className="portfolio-simulator-label">PORTFOLIO SIMULATOR</p>
          <h1>Portfolio simulator</h1>
          <p className="lead">Track your simulated cryptocurrency holdings.</p>
        </div>
        <div className="portfolio-intro-control">
          <Form.Group controlId="portfolio-currency">
            <Form.Label>Display portfolio values in</Form.Label>
            <Form.Select
              className="portfolio-currency-select"
              value={displayCurrency}
              onChange={(event) => {
                setDisplayCurrency(event.target.value)
                setIsLoading(true)
              }}
              style={{ maxWidth: '180px' }}
            >
              {currencies.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
      </section>
      {isLoading && (
        <div className="d-flex align-items-center gap-2" role="status">
          <Spinner animation="border" size="sm" />
          <span>Loading current prices...</span>
        </div>
      )}
      {error && (
        <Alert variant="danger">
          <Alert.Heading>Portfolio prices unavailable</Alert.Heading>
          <p>{error.message}</p>
          <Button variant="outline-danger" onClick={handleRetry}>
            Try again
          </Button>
        </Alert>
      )}
      {!isLoading && !error && holdings.length === 0 && (
        <Alert variant="info">Your portfolio has no holdings yet.</Alert>
      )}
      {!error && holdings.length > 0 && (
        <>
          <div className="row g-3 mb-4">
            {Object.entries(totalsByCurrency).map(
              ([currency, totals]) => (
                <div className="col-12 col-md-6" key={currency}>
                  <div className="card h-100 portfolio-summary-card">
                    <div className="card-body portfolio-allocation-body">
                      <h2 className="h5">
                        Portfolio totals ({currency.toUpperCase()})
                      </h2>
                      <p className="mb-1">
                        Current value:{' '}
                        <strong>
                          {formatCurrency(totals.currentValue, currency)}
                        </strong>
                      </p>
                      <p
                        className={
                          totals.profitLoss > 0
                            ? 'text-success mb-0'
                            : totals.profitLoss < 0
                              ? 'text-danger mb-0'
                              : 'text-warning mb-0'
                        }
                      >
                        Profit / loss:{' '}
                        <strong>
                          {formatCurrency(totals.profitLoss, currency)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
          {allocationData.length > 0 && (
            <section className="portfolio-allocation-card mb-4">
              <div className="card-body portfolio-allocation-body">
                <div className="portfolio-allocation-header">
                  <div>
                    <p className="portfolio-allocation-label">
                      PORTFOLIO BREAKDOWN
                    </p>
                    <h2 className="h5 mb-1">Allocation</h2>
                    <p className="portfolio-allocation-subtitle mb-0">
                      Your current holdings by value
                    </p>
                  </div>
                  <strong className="portfolio-allocation-total">
                    {formatCurrency(
                      allocationData.reduce(
                        (total, holding) => total + holding.value,
                        0,
                      ),
                      displayCurrency,
                    )}
                  </strong>
                </div>
                <div className="portfolio-allocation-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      className="portfolio-allocation-chart"
                      onMouseLeave={() => setActiveAllocationIndex(null)}
                    >
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="78%"
                        label
                        activeIndex={activeAllocationIndex ?? undefined}
                      >
                        {allocationData.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={chartColors[index % chartColors.length]}
                            className="portfolio-allocation-slice"
                            fillOpacity={
                              activeAllocationIndex === null ||
                              activeAllocationIndex === index
                                ? 1
                                : 0.45
                            }
                            stroke={
                              activeAllocationIndex === index
                                ? '#ffffff'
                                : 'transparent'
                            }
                            strokeWidth={activeAllocationIndex === index ? 3 : 1}
                            onMouseEnter={() =>
                              setActiveAllocationIndex(index)
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(value, displayCurrency)
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}
          <div className="portfolio-list-section">
            <div className="portfolio-list-heading">
              <h2>Portfolio holdings</h2>
              <div className="portfolio-list-headings" aria-hidden="true">
                <span>Holding</span>
                <span>Amount</span>
                <span>Buy price</span>
                <span>Current price</span>
                <span>Profit / loss</span>
              </div>
            </div>
            <div className="portfolio-list">
              {rows.map((holding) => (
                <article key={holding.id} className="portfolio-row">
                  <div className="portfolio-row-header">
                  <Link to={`/coin/${holding.coinId}`}>
                    {holding.image && (
                      <img
                        src={holding.image}
                        alt=""
                        width="24"
                        height="24"
                        className="me-2"
                      />
                    )}
                    {holding.coinName} ({holding.symbol?.toUpperCase()})
                  </Link>
                  <strong className="portfolio-row-value">
                    {formatCurrency(holding.currentValue, holding.currency)}
                  </strong>
                  </div>
                  <div className="portfolio-row-details">
                    <span><small>Amount</small>{holding.amount}</span>
                    <span><small>Buy price</small>{formatCurrency(holding.buyPrice, holding.currency)}</span>
                    <span><small>Current price</small>{formatCurrency(holding.currentPrice, holding.currency)}</span>
                    <span className={
                    holding.profitLoss > 0
                      ? 'text-success'
                      : holding.profitLoss < 0 ? 'text-danger' : 'text-warning'
                    }>
                      <small>Profit / loss</small>
                      {formatCurrency(holding.profitLoss, holding.currency)}
                    </span>
                  </div>
                  <div className="portfolio-row-actions">
                  <div className="d-flex flex-wrap gap-2">
                    <Link
                      to={`/coin/${holding.coinId}`}
                      className="btn btn-outline-primary btn-sm"
                    >
                      Buy more / chart
                    </Link>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => {
                        setSellingId(holding.id)
                        setSellAmount(String(holding.amount))
                      }}
                    >
                      Sell
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => removeHolding(holding.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  {sellingId === holding.id && (
                    <div className="d-flex gap-2 mt-2">
                      <input
                        type="number"
                        min="0"
                        max={holding.amount}
                        step="any"
                        className="form-control form-control-sm"
                        value={sellAmount}
                        onChange={(event) => setSellAmount(event.target.value)}
                        aria-label={`Amount of ${holding.coinName} to sell`}
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleSell(holding)}
                      >
                        Confirm
                      </Button>
                    </div>
                  )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  )
}

export default PortfolioPage
