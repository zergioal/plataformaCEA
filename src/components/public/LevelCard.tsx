import type { CareerLevel } from "../../data/careers";

interface LevelCardProps {
  level: CareerLevel;
}

export default function LevelCard({ level }: LevelCardProps) {
  return (
    <div className="level-card">
      <h5 className="level-card-title">{level.name}</h5>
      <ul className="level-card-list">
        {level.subjects.map((subject, index) => (
          <li key={index}>{subject}</li>
        ))}
      </ul>
    </div>
  );
}
