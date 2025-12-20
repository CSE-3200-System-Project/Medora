import Image from "next/image";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

export default function Home() {
  return (
    <div>
      Hello
      <Button variant="secondary">Click Me</Button>
      <Button variant="medical">Medical</Button>
      <Button variant="transaction">Transaction</Button>
      <Button variant="emergency">Emergency</Button>
      <Input type="email" placeholder="Email" />
      <Label htmlFor="email">Your email address</Label>
      <Checkbox />
    </div>
  );
}




