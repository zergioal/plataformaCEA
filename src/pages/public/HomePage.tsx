import { useEffect, useRef, useState } from "react";
import { Carousel, CareerCard } from "../../components/public";
import { careers, institutionalInfo } from "../../data/careers";
import { supabase } from "../../lib/supabase";

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
      { threshold: 0.1 },
    );

    const elements = ref.current?.querySelectorAll(".animate-on-scroll");
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return ref;
}

export default function HomePage() {
  const containerRef = useScrollAnimation();

  // Estado dinámico — arranca con los valores hardcodeados como default
  const [mission, setMission] = useState(institutionalInfo.mission.content);
  const [vision, setVision] = useState(institutionalInfo.vision.content);
  const [contactPhone, setContactPhone] = useState(institutionalInfo.contact.phone);
  const [contactMobile, setContactMobile] = useState(institutionalInfo.contact.mobile);
  const [contactAddress, setContactAddress] = useState(institutionalInfo.contact.address);
  const [carouselImages, setCarouselImages] = useState([
    { src: "/images/CEA.jpeg", alt: "Fachada del Centro de Educación Alternativa Madre María Oliva en Cochabamba" },
    { src: "/images/CEA1.jpeg", alt: "Estudiantes del CEA Madre María Oliva en actividades de formación técnica" },
    { src: "/images/CEA2.jpeg", alt: "Instalaciones y talleres del CEA Madre María Oliva" },
  ]);
  const [requirements, setRequirements] = useState<string[]>(institutionalInfo.requirements);

  // Cargar desde site_settings (sobreescribe defaults si existen)
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("site_settings").select("key,value");
        if (error || !data || data.length === 0) return;
        const map = Object.fromEntries(data.map((r) => [r.key, r.value ?? ""]));
        if (map["institution_mission"]) setMission(map["institution_mission"]);
        if (map["institution_vision"])  setVision(map["institution_vision"]);
        if (map["contact_phone"])       setContactPhone(map["contact_phone"]);
        if (map["contact_mobile"])      setContactMobile(map["contact_mobile"]);
        if (map["contact_address"])     setContactAddress(map["contact_address"]);
        if (map["gallery_images"])  { try { const g = JSON.parse(map["gallery_images"]); if (Array.isArray(g) && g.length > 0) setCarouselImages(g); } catch { /* keep default */ } }
        if (map["requirements"])    { try { const r = JSON.parse(map["requirements"]); if (Array.isArray(r) && r.length > 0) setRequirements(r); } catch { /* keep default */ } }
      } catch { /* sin conexión o tabla inexistente, conservar defaults */ }
    })();
  }, []);

  // SEO
  useEffect(() => {
    document.title =
      "CEA Madre María Oliva | Centro de Educación Alternativa - Cochabamba, Bolivia";
  }, []);

  return (
    <div ref={containerRef}>
      {/* Carrusel — full width en móvil, contenedor con padding en desktop */}
      <section className="bg-black md:bg-white md:py-12 md:px-4">
        <div className="md:max-w-5xl md:mx-auto md:rounded-xl md:overflow-hidden md:shadow-xl">
          <Carousel images={carouselImages} />
        </div>
      </section>

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
            <div
              className="animate-on-scroll institutional-card"
              style={{ transitionDelay: "100ms" }}
            >
              <h3 className="institutional-card-title">
                {institutionalInfo.mission.title}
              </h3>
              <p className="institutional-card-text">{mission}</p>
            </div>

            {/* Visión */}
            <div
              className="animate-on-scroll institutional-card"
              style={{ transitionDelay: "200ms" }}
            >
              <h3 className="institutional-card-title">
                {institutionalInfo.vision.title}
              </h3>
              <p className="institutional-card-text">{vision}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Carreras */}
      <section id="carreras" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">
            Nuestras Carreras
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {careers.map((career, index) => (
              <div
                key={career.id}
                className="animate-on-scroll flex flex-col"
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
            {requirements.map((req, index) => (
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
              <span>Dirección: {contactAddress}</span>
            </p>
            <p className="contact-item">
              <span>📱</span>
              <span>
                Celular:{" "}
                <a href={`tel:${contactMobile}`} className="text-blue-600 hover:underline">
                  {contactMobile}
                </a>
              </span>
            </p>
            <p className="contact-item">
              <span>📞</span>
              <span>
                Teléfono:{" "}
                <a href={`tel:${contactPhone}`} className="text-blue-600 hover:underline">
                  {contactPhone}
                </a>
              </span>
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
