import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink } from 'react-router-dom'

function NavigationBar() {
  const linkClassName = ({ isActive }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <Navbar expand="lg" bg="dark" data-bs-theme="dark">
      <Container>
        <Navbar.Brand as={NavLink} to="/">
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
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default NavigationBar
