import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Spinner, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
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

function PortfolioPage() {
  const { holdings, removeHolding, sellHolding } = usePortfolio()
  const [prices, setPrices] = useState({})
  const [isLoading, setIsLoading] = useState(holdings.length > 0)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
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
        responses.flat().forEach((coin) => {
          nextPrices[coin.id] = coin.current_price
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
  }, [holdings, retryCount])

  const rows = useMemo(
    () =>
      holdings.map((holding) => {
        const currency = holding.currency || 'usd'
        const currentPrice = prices[holding.coinId]
        const currentValue =
          typeof currentPrice === 'number'
            ? currentPrice * holding.amount
            : null
        const costBasis = holding.buyPrice * holding.amount
        const profitLoss =
          typeof currentValue === 'number' ? currentValue - costBasis : null

        return { ...holding, currency, currentPrice, currentValue, profitLoss }
      }),
    [holdings, prices],
  )

  function handleRetry() {
    setError(null)
    setIsLoading(true)
    setRetryCount((count) => count + 1)
  }

  function handleSell(holding) {
    const amount = Number(sellAmount)
    const currentPrice = prices[holding.coinId]

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
          holding.currency || 'usd',
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
                        : 'text-body-secondary'
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
      )}
    </main>
  )
}

export default PortfolioPage
