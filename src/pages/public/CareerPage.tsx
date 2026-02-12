import { useEffect, useRef } from "react";
import { LevelCard } from "../../components/public";
import type { Career } from "../../data/careers";

interface CareerPageProps {
  career: Career;
  galleryImages?: string[];
}

// Hook para animaciones al scroll
function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = ref.current?.querySelectorAll(".animate-on-scroll");
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return ref;
}

// Imágenes reales de galería por carrera
const GALLERY_IMAGES: Record<string, string[]> = {
  sistemas: ["/images/Sis1.jpeg", "/images/Sis2.jpeg", "/images/Sis3.jpeg"],
  gastronomia: ["/images/Gastro1.jpeg", "/images/Gastro2.jpeg", "/images/Gastro3.jpeg"],
  contaduria: ["/images/Conta1.jpeg", "/images/Conta2.jpeg", "/images/Conta3.jpg"],
  textil: ["/images/Text1.jpeg", "/images/Confec1.jpeg", "/images/Confec2.jpg"],
};

export default function CareerPage({ career, galleryImages }: CareerPageProps) {
  const containerRef = useScrollAnimation();

  // SEO: título dinámico por carrera
  useEffect(() => {
    document.title = `${career.name} | CEA Madre María Oliva`;
    return () => { document.title = "CEA Madre María Oliva | Centro de Educación Alternativa - Cochabamba, Bolivia"; };
  }, [career.name]);

  const images = galleryImages || GALLERY_IMAGES[career.id] || [];

  return (
    <div ref={containerRef}>
      {/* Header con gradiente animado */}
      <section
        className={`career-header bg-gradient-to-r ${career.headerGradient}`}
      >
        <h1 className="career-header-title animate-on-scroll">
          {career.name}
        </h1>
        <p className="career-header-description animate-on-scroll">
          {career.description}
        </p>
      </section>

      {/* Niveles técnicos */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {career.levels.map((level, index) => (
              <div
                key={level.name}
                className="animate-on-scroll"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <LevelCard level={level} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Galería */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 animate-on-scroll">
            Galería
          </h2>

          <div className="image-gallery">
            {images.map((img, index) => (
              <div
                key={index}
                className="animate-on-scroll gallery-image"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <img
                  src={img}
                  alt={`Estudiantes de ${career.name} en CEA Madre María Oliva - Foto ${index + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
