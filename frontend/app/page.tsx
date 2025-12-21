import Image from "next/image";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Home() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="pt-28 px-4 md:px-8 max-w-7xl mx-auto space-y-8 pb-10">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Component Playground</h1>
          <p className="text-muted-foreground">Testing UI components below the navbar.</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="secondary">Click Me</Button>
          <Button variant="medical">Medical</Button>
          <Button variant="transaction">Transaction</Button>
          <Button variant="emergency">Emergency</Button>
        </div>

        <div className="max-w-sm space-y-2">
          <Label htmlFor="email">Your email address</Label>
          <Input type="email" placeholder="Email" id="email" />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label htmlFor="terms">Accept terms and conditions</Label>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>

        <Separator />

        <Tabs defaultValue="account" className="w-100">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Make changes to your account here.</TabsContent>
          <TabsContent value="password">Change your password here.</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}




