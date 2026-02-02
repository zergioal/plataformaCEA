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

export default function CareerPage({ career, galleryImages }: CareerPageProps) {
  const containerRef = useScrollAnimation();

  // Generar placeholders si no hay imágenes
  const images = galleryImages || [
    `https://placehold.co/400x200/${career.color.replace("#", "")}/white?text=${encodeURIComponent(career.name)}+1`,
    `https://placehold.co/400x200/${career.color.replace("#", "")}/white?text=${encodeURIComponent(career.name)}+2`,
    `https://placehold.co/400x200/${career.color.replace("#", "")}/white?text=${encodeURIComponent(career.name)}+3`,
  ];

  return (
    <div ref={containerRef}>
      {/* Header con gradiente animado */}
      <section
        className={`career-header bg-gradient-to-r ${career.headerGradient}`}
      >
        <h2 className="career-header-title animate-on-scroll">
          {career.name}
        </h2>
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
                  alt={`${career.name} - Imagen ${index + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
