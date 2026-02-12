import { Link } from "react-router-dom";

interface CareerCardProps {
  name: string;
  slug: string;
  image: string;
}

export default function CareerCard({ name, slug, image }: CareerCardProps) {
  return (
    <Link to={`/carreras/${slug}`} className="career-card block">
      <img
        src={image}
        alt={`Carrera de ${name} - CEA Madre María Oliva`}
        className="career-card-image"
        loading="lazy"
      />
      <div className="career-card-body">
        <h3 className="career-card-title">{name}</h3>
      </div>
    </Link>
  );
}
