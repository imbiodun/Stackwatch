import { useEffect, useState } from 'react'
import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink } from 'react-router-dom'

function NavigationBar() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('stackwatch-theme')
    return savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light')
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.body.dataset.theme = theme
    window.localStorage.setItem('stackwatch-theme', theme)
  }, [theme])

  useEffect(() => {
    let previousScrollY = window.scrollY
    let touchStartY = 0

    function handleScroll() {
      const currentScrollY = window.scrollY
      setIsScrolled(currentScrollY > 24)
      setIsExpanded(false)
      setIsHidden(currentScrollY > 80 && currentScrollY > previousScrollY)
      previousScrollY = currentScrollY
    }

    function handleWheel(event) {
      if (event.deltaY < 0) {
        setIsHidden(false)
      } else if (event.deltaY > 0 && window.scrollY > 80) {
        setIsHidden(true)
      }
    }

    function handleTouchStart(event) {
      touchStartY = event.touches[0]?.clientY || 0
    }

    function handleTouchMove(event) {
      const currentY = event.touches[0]?.clientY || touchStartY
      if (currentY > touchStartY) {
        setIsHidden(false)
      } else if (currentY < touchStartY && window.scrollY > 80) {
        setIsHidden(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  const linkClassName = ({ isActive }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <Navbar
      expand="lg"
      expanded={isExpanded}
      onToggle={setIsExpanded}
      collapseOnSelect
      className={`app-navbar${isScrolled ? ' app-navbar-scrolled' : ''}${
        isHidden ? ' app-navbar-hidden' : ''
      }`}
      data-bs-theme="dark"
    >
      <Container>
        <Navbar.Brand as={NavLink} to="/" className="app-brand">
          Stackwatch
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="stackwatch-navigation" />
        <Navbar.Collapse id="stackwatch-navigation">
          <Nav className="ms-auto">
            <Nav.Link as={NavLink} to="/" className={linkClassName} end>
              Market
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/portfolio"
              className={linkClassName}
            >
              Portfolio
            </Nav.Link>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default NavigationBar
