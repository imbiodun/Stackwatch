import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="container py-5">
      <h1>Page not found</h1>
      <p className="lead">The page you requested does not exist.</p>
      <Link to="/" className="btn btn-primary">
        Return to market
      </Link>
    </main>
  )
}

export default NotFoundPage
