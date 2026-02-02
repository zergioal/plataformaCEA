// Datos de carreras del CEA Madre María Oliva

export interface CareerLevel {
  name: string;
  subjects: string[];
}

export interface Career {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  textColor: string;
  headerGradient: string;
  levels: CareerLevel[];
}

export const careers: Career[] = [
  {
    id: "sistemas",
    name: "Sistemas Informáticos",
    slug: "sistemas",
    description:
      "Diseño, desarrollo y mantenimiento de sistemas computacionales, redes, programación y hardware.",
    color: "#0088cc",
    textColor: "text-blue-600",
    headerGradient: "from-blue-600 via-blue-800 to-slate-900",
    levels: [
      {
        name: "Técnico Básico",
        subjects: [
          "Introducción a la Informática",
          "Ofimática Básica",
          "Mantenimiento Preventivo",
          "Software Educativo",
          "Ética Profesional",
        ],
      },
      {
        name: "Técnico Auxiliar",
        subjects: [
          "Redes de Computadoras",
          "Programación en PSeInt",
          "Sistemas Operativos",
          "Arquitectura de Hardware",
          "Diseño Web",
        ],
      },
      {
        name: "Técnico Medio I",
        subjects: [
          "Base de Datos",
          "Programación en JavaScript",
          "Redes LAN y WAN",
          "Proyectos Tecnológicos",
          "Seguridad Informática",
        ],
      },
      {
        name: "Técnico Medio II",
        subjects: [
          "Administración de Redes",
          "Programación con Base de Datos",
          "Auditoría Informática",
          "Internet de las Cosas",
          "Defensa de Proyecto",
        ],
      },
    ],
  },
  {
    id: "gastronomia",
    name: "Gastronomía",
    slug: "gastronomia",
    description:
      "Formación en arte culinario, técnicas de cocina, repostería y atención al cliente.",
    color: "#dc2626",
    textColor: "text-red-600",
    headerGradient: "from-red-500 via-red-700 to-red-900",
    levels: [
      {
        name: "Técnico Básico",
        subjects: [
          "Manipulación Higiénica de Alimentos",
          "Preparación de Ensaladas",
          "Bebidas Naturales y Refrescantes",
          "Recetario Nacional",
          "Ética Profesional",
        ],
      },
      {
        name: "Técnico Auxiliar",
        subjects: [
          "Pastelería Básica",
          "Platos Internacionales",
          "Decoración Gastronómica",
          "Conservas y Enlatados",
          "Menús Nutricionales",
        ],
      },
      {
        name: "Técnico Medio I",
        subjects: [
          "Administración de Cocina",
          "Marketing Gastronómico",
          "Panadería y Pastelería Avanzada",
          "Alta Cocina Boliviana",
          "Diseño de Recetarios",
        ],
      },
      {
        name: "Técnico Medio II",
        subjects: [
          "Nutrición y Dietética",
          "Costeo y Presupuesto de Alimentos",
          "Gestión de Eventos",
          "Servicio y Atención al Cliente",
          "Defensa de Proyecto",
        ],
      },
    ],
  },
  {
    id: "contaduria",
    name: "Contaduría General",
    slug: "contaduria",
    description:
      "Formación en principios contables, registros financieros, auditoría, análisis de costos y legislación tributaria.",
    color: "#16a34a",
    textColor: "text-green-600",
    headerGradient: "from-emerald-500 via-teal-600 to-blue-700",
    levels: [
      {
        name: "Técnico Básico",
        subjects: [
          "Fundamentos Contables",
          "Documentación Comercial",
          "Matemática Financiera",
          "Ética y Valores",
          "Computación Básica",
        ],
      },
      {
        name: "Técnico Auxiliar",
        subjects: [
          "Contabilidad General",
          "Gestión Tributaria",
          "Administración de Recursos Humanos",
          "Ofimática Contable",
          "Emprendimiento I",
        ],
      },
      {
        name: "Técnico Medio I",
        subjects: [
          "Contabilidad de Costos",
          "Auditoría I",
          "Gestión Empresarial",
          "Contabilidad Computarizada",
          "Emprendimiento II",
        ],
      },
      {
        name: "Técnico Medio II",
        subjects: [
          "Auditoría II",
          "Contabilidad Gubernamental",
          "Tributación Avanzada",
          "Normas Internacionales de Información Financiera",
          "Modalidades de Graduación",
        ],
      },
    ],
  },
  {
    id: "textil",
    name: "Textil y Confección",
    slug: "textil",
    description:
      "Capacitación en diseño, patronaje, corte y confección de prendas textiles, moda sostenible y uso de maquinaria industrial.",
    color: "#9333ea",
    textColor: "text-purple-600",
    headerGradient: "from-purple-500 via-purple-700 to-purple-900",
    levels: [
      {
        name: "Técnico Básico",
        subjects: [
          "Fundamentos de Costura",
          "Manejo de Máquinas",
          "Textiles y Telas",
          "Patronaje Básico",
          "Diseño de Prendas",
        ],
      },
      {
        name: "Técnico Auxiliar",
        subjects: [
          "Confección de Prendas Femeninas",
          "Costura Industrial",
          "Transformaciones de Patrones",
          "Emprendimiento I",
          "Moda y Tendencias",
        ],
      },
      {
        name: "Técnico Medio I",
        subjects: [
          "Alta Costura",
          "Prendas Masculinas",
          "Textil Sostenible",
          "Emprendimiento II",
          "Diseño Digital de Moda",
        ],
      },
      {
        name: "Técnico Medio II",
        subjects: [
          "Diseño de Colecciones",
          "Confección Avanzada",
          "Maquinarias Especializadas",
          "Producción Textil",
          "Modalidades de Graduación",
        ],
      },
    ],
  },
];

export const institutionalInfo = {
  name: "CEA Madre María Oliva",
  fullName: 'Centro de Educación Alternativa "Madre María Oliva"',

  about: {
    title: "Nosotros",
    content:
      'El Centro de Educación Alternativa "Madre María Oliva" es una institución fiscal de convenio fundada por la Congregación Hijas de la Iglesia. El CEA está orientado a brindar formación técnica profesional a personas jóvenes y adultas que buscan especializarse para el mundo laboral.',
  },

  mission: {
    title: "Misión",
    content:
      "Formar técnicos medios con espíritu emprendedor y vocación de servicio, comprometidos con su desarrollo personal y el bienestar de sus comunidades.",
  },

  vision: {
    title: "Visión",
    content:
      "Consolidarnos como una institución líder en educación técnica alternativa, reconocida por su excelencia académica, formación en valores, calidad humana y compromiso con el desarrollo local.",
  },

  contact: {
    address: "Calle Maximiliano Marquez Nº 2036 (Lado UCB)",
    phone: "4502863",
    mobile: "71418791",
    email: "ceammoliva@gmail.com",
    whatsapp: "59171418791",
    socialMedia: {
      facebook: "https://www.facebook.com/profile.php?id=61563612481185",
      tiktok: "https://www.tiktok.com/@ceammo",
    },
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d18899.74195996116!2d-66.1469012176758!3d-17.377539521629988!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x93e375fa6d279abb%3A0x2593b31c86be20d1!2sCEA%20MADRE%20MAR%C3%8DA%20OLIVA!5e1!3m2!1ses-419!2sbo!4v1753847412199!5m2!1ses-419!2sbo",
  },

  requirements: [
    "3 Fotocopias de Cédula de Identidad",
    "3 Fotocopias de Certificado de Nacimiento",
    "100 Bs. de aporte estudiantil semestral",
  ],
};
