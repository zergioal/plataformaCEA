import { careers } from "../../data/careers";
import CareerPage from "./CareerPage";

const career = careers.find((c) => c.id === "contaduria")!;

export default function ContaduriaPage() {
  return <CareerPage career={career} />;
}
