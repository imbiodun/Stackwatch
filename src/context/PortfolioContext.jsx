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
        currency: holding.currency,
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

  const sellHolding = useCallback(
    (holdingId, amount, sellPrice) => {
      let realizedProfit = 0

      setHoldings((currentHoldings) => {
        const holding = currentHoldings.find(
          (currentHolding) => currentHolding.id === holdingId,
        )

        if (!holding || amount <= 0 || amount > holding.amount) {
          throw new Error('Enter a valid amount to sell.')
        }

        realizedProfit = (sellPrice - holding.buyPrice) * amount
        const remainingAmount = holding.amount - amount
        const nextHoldings =
          remainingAmount < Number.EPSILON
            ? currentHoldings.filter(
                (currentHolding) => currentHolding.id !== holdingId,
              )
            : currentHoldings.map((currentHolding) =>
                currentHolding.id === holdingId
                  ? { ...currentHolding, amount: remainingAmount }
                  : currentHolding,
              )

        saveHoldings(nextHoldings)
        return nextHoldings
      })

      return realizedProfit
    },
    [saveHoldings],
  )

  const value = useMemo(
    () => ({ holdings, addHolding, removeHolding, sellHolding }),
    [addHolding, holdings, removeHolding, sellHolding],
  )

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  )
}
