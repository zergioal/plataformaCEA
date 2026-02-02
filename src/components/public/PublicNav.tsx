import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Institución", href: "/#institucion" },
  { label: "Carreras", href: "/#carreras" },
  { label: "Requisitos", href: "/#requisitos" },
  { label: "Contacto", href: "/#contacto" },
];

export default function PublicNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);

    // Si es un anchor en la misma página
    if (href.startsWith("/#")) {
      const id = href.replace("/#", "");
      const element = document.getElementById(id);
      if (element) {
        const navHeight = 64;
        const top = element.offsetTop - navHeight;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href.replace("/#", ""));
  };

  return (
    <nav className="public-nav">
      <div className="public-nav-container">
        {/* Links de navegación (desktop) */}
        <div className="hidden lg:flex public-nav-links">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => handleNavClick(link.href)}
              className={`public-nav-link ${isActive(link.href) ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Botón LOGIN */}
        <Link to="/login" className="btn-login">
          LOGIN
        </Link>

        {/* Botón menú móvil */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Menú"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Menú móvil */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => handleNavClick(link.href)}
              className="mobile-menu-link"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
