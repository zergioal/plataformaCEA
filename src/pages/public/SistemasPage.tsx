import { careers } from "../../data/careers";
import CareerPage from "./CareerPage";

const career = careers.find((c) => c.id === "sistemas")!;

export default function SistemasPage() {
  return <CareerPage career={career} />;
}
