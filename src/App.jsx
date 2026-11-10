import { HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import NavigationBar from './components/NavigationBar'
import CoinDetailPage from './pages/CoinDetailPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import PortfolioPage from './pages/PortfolioPage'

function App() {
  return (
    <HashRouter>
      <Toaster position="top-right" />
      <NavigationBar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/coin/:id" element={<CoinDetailPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
