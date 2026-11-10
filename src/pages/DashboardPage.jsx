import { useEffect, useState } from 'react'
import { Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { getMarkets } from '../api'

function DashboardPage() {
  const [coins, setCoins] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

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
  }, [])

  return (
    <main className="container py-5">
      <h1>Market dashboard</h1>
      <p className="lead">Top cryptocurrency prices by market capitalization.</p>
      {isLoading && <p>Loading market data...</p>}
      {error && <p>Unable to load market data: {error.message}</p>}
      {!isLoading && !error && coins.length === 0 && (
        <p>No market data is available.</p>
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
                <td>{coin.current_price}</td>
                <td>{coin.price_change_percentage_24h}</td>
                <td>{coin.market_cap}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  )
}

export default DashboardPage
