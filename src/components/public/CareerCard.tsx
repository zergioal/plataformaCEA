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
        alt={name}
        className="career-card-image"
      />
      <div className="career-card-body">
        <h5 className="career-card-title">{name}</h5>
      </div>
    </Link>
  );
}
