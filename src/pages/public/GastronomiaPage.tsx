import { careers } from "../../data/careers";
import CareerPage from "./CareerPage";

const career = careers.find((c) => c.id === "gastronomia")!;

export default function GastronomiaPage() {
  return <CareerPage career={career} />;
}
