import Image from "next/image";
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div>
      Hello
      <Button variant="secondary">Click Me</Button>
      <Button variant="medical">Medical</Button>
      <Button variant="transaction">Transaction</Button>
      <Button variant="emergency">Emergency</Button>
    </div>
  );
}
