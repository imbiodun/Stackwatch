import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
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
      <h1>Portfolio simulator</h1>
      <p className="lead">Track your simulated cryptocurrency holdings.</p>
      <Form.Group controlId="portfolio-currency" className="mb-4">
        <Form.Label>Display portfolio values in</Form.Label>
        <Form.Select
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
                  <div className="card h-100">
                    <div className="card-body">
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
            <div className="card mb-4">
              <div className="card-body">
                <h2 className="h5">Portfolio allocation</h2>
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="75%"
                        label
                      >
                        {allocationData.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={chartColors[index % chartColors.length]}
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
            </div>
          )}
          <Table responsive hover>
            <thead>
              <tr>
                <th>Coin</th>
                <th>Amount</th>
                <th>Buy price</th>
                <th>Current price</th>
                <th>Current value</th>
                <th>Profit / loss</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((holding) => (
                <tr key={holding.id}>
                <td>
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
                </td>
                <td>{holding.amount}</td>
                <td>{formatCurrency(holding.buyPrice, holding.currency)}</td>
                <td>
                  {formatCurrency(holding.currentPrice, holding.currency)}
                </td>
                <td>
                  {formatCurrency(holding.currentValue, holding.currency)}
                </td>
                <td
                  className={
                    holding.profitLoss > 0
                      ? 'text-success'
                      : holding.profitLoss < 0
                        ? 'text-danger'
                        : 'text-warning'
                  }
                >
                  {formatCurrency(holding.profitLoss, holding.currency)}
                </td>
                <td>
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
                </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </main>
  )
}

export default PortfolioPage
