import { useEffect, useRef } from "react";
import { Carousel, CareerCard } from "../../components/public";
import { careers, institutionalInfo } from "../../data/careers";

// Imágenes reales del CEA para el carrusel
const carouselImages = [
  { src: "/images/CEA.jpeg", alt: "Fachada del Centro de Educación Alternativa Madre María Oliva en Cochabamba" },
  { src: "/images/CEA1.jpeg", alt: "Estudiantes del CEA Madre María Oliva en actividades de formación técnica" },
  { src: "/images/CEA2.jpeg", alt: "Instalaciones y talleres del CEA Madre María Oliva" },
];

// Imágenes reales por carrera
const careerImages: Record<string, string> = {
  sistemas: "/images/Infor.jpg",
  gastronomia: "/images/Gastro.jpg",
  contaduria: "/images/Conta.jpg",
  textil: "/images/text.jpg",
};

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

export default function HomePage() {
  const containerRef = useScrollAnimation();

  // SEO: título para la página principal
  useEffect(() => {
    document.title = "CEA Madre María Oliva | Centro de Educación Alternativa - Cochabamba, Bolivia";
  }, []);

  return (
    <div ref={containerRef}>
      {/* Sección Institución */}
      <section id="institucion" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">
            Sobre la Institución
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Nosotros */}
            <div className="animate-on-scroll institutional-card">
              <h3 className="institutional-card-title">
                {institutionalInfo.about.title}
              </h3>
              <p className="institutional-card-text">
                {institutionalInfo.about.content}
              </p>
            </div>

            {/* Misión */}
            <div className="animate-on-scroll institutional-card" style={{ transitionDelay: "100ms" }}>
              <h3 className="institutional-card-title">
                {institutionalInfo.mission.title}
              </h3>
              <p className="institutional-card-text">
                {institutionalInfo.mission.content}
              </p>
            </div>

            {/* Visión */}
            <div className="animate-on-scroll institutional-card" style={{ transitionDelay: "200ms" }}>
              <h3 className="institutional-card-title">
                {institutionalInfo.vision.title}
              </h3>
              <p className="institutional-card-text">
                {institutionalInfo.vision.content}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Galería / Carrusel */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 animate-on-scroll">
            Galería
          </h2>
          <div className="animate-on-scroll">
            <Carousel images={carouselImages} />
          </div>
        </div>
      </section>

      {/* Sección Carreras */}
      <section id="carreras" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">
            Nuestras Carreras
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {careers.map((career, index) => (
              <div
                key={career.id}
                className="animate-on-scroll"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CareerCard
                  name={career.name}
                  slug={career.slug}
                  image={careerImages[career.id]}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección Requisitos */}
      <section id="requisitos" className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">
            Requisitos de Inscripción
          </h2>

          <div className="requirements-list">
            {institutionalInfo.requirements.map((req, index) => (
              <div
                key={index}
                className="animate-on-scroll requirement-item"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <span className="requirement-icon">
                  {index === 0 ? "📄" : index === 1 ? "🧾" : "💰"}
                </span>
                <span className="requirement-text">{req}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección Contacto */}
      <section id="contacto" className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-10 text-gray-900">
            Contáctanos
          </h2>

          <div className="space-y-4 mb-8">
            <p className="contact-item">
              <span>📍</span>
              <span>Dirección: {institutionalInfo.contact.address}</span>
            </p>
            <p className="contact-item">
              <span>📱</span>
              <span>Celular: <a href={`tel:${institutionalInfo.contact.mobile}`} className="text-blue-600 hover:underline">{institutionalInfo.contact.mobile}</a></span>
            </p>
            <p className="contact-item">
              <span>📞</span>
              <span>Teléfono: <a href={`tel:${institutionalInfo.contact.phone}`} className="text-blue-600 hover:underline">{institutionalInfo.contact.phone}</a></span>
            </p>
            <p className="contact-item">
              <span>✉️</span>
              <span>Correo: <a href={`mailto:${institutionalInfo.contact.email}`} className="text-blue-600 hover:underline">{institutionalInfo.contact.email}</a></span>
            </p>
          </div>

          {/* Botones de redes sociales */}
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={`https://wa.me/${institutionalInfo.contact.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn-whatsapp"
            >
              WhatsApp 💬
            </a>
            <a
              href={institutionalInfo.contact.socialMedia.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn-facebook"
            >
              Facebook
            </a>
            <a
              href={institutionalInfo.contact.socialMedia.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn-tiktok"
            >
              TikTok
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
