import { useCallback, useEffect, useMemo, useState } from 'react'
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

function mergeHoldings(holdings) {
  const merged = []
  const holdingIndexes = new Map()

  holdings.forEach((holding) => {
    const key = `${holding.coinId}:${holding.currency || 'usd'}`
    const existingIndex = holdingIndexes.get(key)

    if (existingIndex === undefined) {
      holdingIndexes.set(key, merged.length)
      merged.push({
        ...holding,
        currency: holding.currency || 'usd',
      })
      return
    }

    const existing = merged[existingIndex]
    const existingAmount = Number(existing.amount)
    const addedAmount = Number(holding.amount)
    const totalAmount = existingAmount + addedAmount
    const weightedBuyPrice =
      totalAmount > 0
        ? (existingAmount * Number(existing.buyPrice) +
            addedAmount * Number(holding.buyPrice)) /
          totalAmount
        : existing.buyPrice

    merged[existingIndex] = {
      ...existing,
      amount: totalAmount,
      buyPrice: weightedBuyPrice,
    }
  })

  return merged
}

export function PortfolioProvider({ children }) {
  const [holdings, setHoldings] = useState(() => {
    try {
      return mergeHoldings(readStoredHoldings())
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
    } catch (error) {
      console.error('Unable to save the normalized portfolio.', error)
    }
  }, [holdings])

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
        const nextHoldings = mergeHoldings([...currentHoldings, nextHolding])
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
