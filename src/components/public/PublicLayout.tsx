import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PublicNav from "./PublicNav";
import PublicFooter from "./PublicFooter";
import logoCea from "../../assets/logo-cea.png";
import fondo from "../../assets/CEA.jpeg";

import { institutionalInfo } from "../../data/careers";

export default function PublicLayout() {
  const location = useLocation();

  // Scroll to top cuando cambia la ruta
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div className="public-layout min-h-screen flex flex-col">
      {/* Fondo con imagen tenue */}
      <div
        className="public-bg-image"
        style={{ backgroundImage: `url(${fondo})` }}
        aria-hidden="true"
      />

      {/* Header */}
      <header className="public-header relative z-10">
        <img src={logoCea} alt="Logo CEA" className="public-header-logo" />
        <h3 className="public-header-subtitle">
          CENTRO DE EDUCACIÓN ALTERNATIVA
        </h3>
        <h1 className="public-header-title">
          {institutionalInfo.name.replace("CEA ", "")}
        </h1>
      </header>

      {/* Navegación */}
      <PublicNav />

      {/* Contenido principal */}
      <main className="flex-1 relative z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
