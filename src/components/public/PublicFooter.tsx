import { institutionalInfo } from "../../data/careers";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="container mx-auto px-4">
        {/* Mapa de Google */}
        <iframe
          src={institutionalInfo.contact.mapEmbedUrl}
          className="public-footer-map mb-6"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          title="Ubicación CEA Madre María Oliva"
        />

        {/* Copyright */}
        <p className="text-white/80 text-sm">
          &copy; {new Date().getFullYear()} {institutionalInfo.fullName}
        </p>
        <p className="text-white/60 text-xs mt-2">
          Desarrollado por: Sergio M. Alcocer Valenzuela & Javier Delgadillo - Cochabamba, Bolivia
        </p>
      </div>
    </footer>
  );
}
