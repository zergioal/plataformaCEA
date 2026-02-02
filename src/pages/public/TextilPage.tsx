import { careers } from "../../data/careers";
import CareerPage from "./CareerPage";

const career = careers.find((c) => c.id === "textil")!;

export default function TextilPage() {
  return <CareerPage career={career} />;
}
