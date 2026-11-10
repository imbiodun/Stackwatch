import { useCallback, useMemo, useState } from 'react'
import { PortfolioContext } from './portfolioContext'

const STORAGE_KEY = 'stackwatch-portfolio'

function readStoredHoldings() {
  const storedHoldings = localStorage.getItem(STORAGE_KEY)

  if (!storedHoldings) {
    return []
  }

  const parsedHoldings = JSON.parse(storedHoldings)
  return Array.isArray(parsedHoldings) ? parsedHoldings : []
}

function createHoldingId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function PortfolioProvider({ children }) {
  const [holdings, setHoldings] = useState(() => {
    try {
      return readStoredHoldings()
    } catch (error) {
      console.error('Unable to read the saved portfolio.', error)
      return []
    }
  })

  const saveHoldings = useCallback((nextHoldings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHoldings))
    } catch (error) {
      console.error('Unable to save the portfolio.', error)
      throw new Error('Your portfolio could not be saved.')
    }
  }, [])

  const addHolding = useCallback(
    (holding) => {
      const nextHolding = {
        id: createHoldingId(),
        coinId: holding.coinId,
        coinName: holding.coinName,
        symbol: holding.symbol,
        image: holding.image,
        amount: holding.amount,
        buyPrice: holding.buyPrice,
      }

      setHoldings((currentHoldings) => {
        const nextHoldings = [...currentHoldings, nextHolding]
        saveHoldings(nextHoldings)
        return nextHoldings
      })
    },
    [saveHoldings],
  )

  const removeHolding = useCallback(
    (holdingId) => {
      setHoldings((currentHoldings) => {
        const nextHoldings = currentHoldings.filter(
          (holding) => holding.id !== holdingId,
        )
        saveHoldings(nextHoldings)
        return nextHoldings
      })
    },
    [saveHoldings],
  )

  const value = useMemo(
    () => ({ holdings, addHolding, removeHolding }),
    [addHolding, holdings, removeHolding],
  )

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}
