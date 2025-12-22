"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Bell, User, Settings, LogOut, LayoutDashboard, FileText, Calendar, Shield, Activity, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import logo from "@/assets/image/medora-logo.png";

// Mock User State (Replace with real auth logic)
// const user = { name: "Dr. Smith", role: "doctor" }; // Example logged in
const user = null; // Example logged out

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Don't show navbar on auth pages if desired, or keep it consistent. 
  // Usually auth pages (login/register) might have a simplified navbar or none.
  // For now, we render it everywhere.

  return (
    <header
      className={cn(
        "fixed top-4 inset-x-4 z-50 mx-auto max-w-7xl transition-all duration-300",
        "rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-lg shadow-primary/5",
        isScrolled ? "bg-white/80 shadow-md" : "bg-white/60"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* LEFT: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-10 w-10 md:h-14 md:w-14">
            <Image src={logo} alt="Medora" fill className="object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-primary hidden md:block">Medora</span>
        </Link>

        {/* CENTER: Desktop Menu */}
        <div className="hidden md:flex flex-1 justify-center">
          {!user ? (
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-primary-more-light hover:text-primary">Platform</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-4 md:w-100 lg:w-125 lg:grid-cols-[.75fr_1fr]">
                      <li className="row-span-3">
                        <NavigationMenuLink asChild>
                          <a
                            className="flex h-full w-full select-none flex-col justify-end rounded-md bg-linear-to-b from-primary/10 to-primary/30 p-6 no-underline outline-none focus:shadow-md"
                            href="/"
                          >
                            <div className="mb-2 mt-4 text-lg font-medium">
                              Medora Platform
                            </div>
                            <p className="text-sm leading-tight text-muted-foreground">
                              The complete healthcare ecosystem for modern medical practice.
                            </p>
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <ListItem href="/overview" title="Overview">
                        Comprehensive view of our services.
                      </ListItem>
                      <ListItem href="/#how-it-works" title="How it works">
                        Step-by-step guide for all users.
                      </ListItem>
                      <ListItem href="/#privacy" title="Privacy & Control">
                        Your data security is our priority.
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-primary-more-light hover:text-primary">For Patients</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-100 gap-3 p-4 md:w-125 md:grid-cols-2 lg:w-150 ">
                      <ListItem href="/#for-patients" title="What you can do">
                        Book appointments, view records, and more.
                      </ListItem>
                      <ListItem href="/#for-patients" title="Patient Experience">
                        Seamless care journey designed for you.
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-primary-more-light hover:text-primary">For Doctors</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-100 gap-3 p-4 md:w-125 md:grid-cols-2 lg:w-150 ">
                      <ListItem href="/#for-doctors" title="What you can do">
                        Manage practice, patients, and schedule.
                      </ListItem>
                      <ListItem href="/#for-doctors" title="Doctor Experience">
                        Tools built to optimize your workflow.
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link href="/#about" legacyBehavior passHref>
                    <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "bg-transparent hover:bg-primary-more-light hover:text-primary")}>
                      About
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          ) : (
            <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/dashboard" className={cn("transition-colors hover:text-primary", pathname === "/dashboard" && "text-primary")}>
                Dashboard
              </Link>
              <Link href="/overview" className={cn("transition-colors hover:text-primary", pathname === "/overview" && "text-primary")}>
                Overview
              </Link>
              <Link href="/appointments" className={cn("transition-colors hover:text-primary", pathname === "/appointments" && "text-primary")}>
                Appointments
              </Link>
              <Link href="/records" className={cn("transition-colors hover:text-primary", pathname === "/records" && "text-primary")}>
                Records
              </Link>
            </nav>
          )}
        </div>

        {/* RIGHT: Actions */}
        <div className="hidden md:flex items-center gap-4">
          {!user ? (
            <>
              <Button variant="ghost" asChild className="text-muted-foreground hover:bg-primary-more-light hover:text-primary">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary-muted text-white rounded-full px-6">
                <Link href="/selection">Sign up</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-primary-more-light hover:text-primary">
                <Bell className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-primary-more-light">
                    <Avatar className="h-10 w-10 border border-primary/20">
                      <AvatarImage src="/avatars/01.png" alt="@user" />
                      <AvatarFallback>US</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Dr. Smith</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        dr.smith@example.com
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="focus:bg-primary-more-light focus:text-primary">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-primary-more-light focus:text-primary">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* MOBILE: Hamburger */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-75 sm:w-100">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="relative h-8 w-8">
                    <Image src={logo} alt="Medora" fill className="object-contain" />
                  </div>
                  Medora
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-full py-6 px-6">
                {!user ? (
                  <>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="platform" className="border-b-0">
                        <AccordionTrigger className="text-lg font-medium hover:text-primary hover:no-underline py-3">
                          <span className="flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-primary" /> Platform</span>
                        </AccordionTrigger>
                        <AccordionContent className="flex flex-col gap-3 pl-4 pb-4">
                          <Link href="/overview" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <Activity className="h-4 w-4" /> Overview
                          </Link>
                          <Link href="/how-it-works" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <FileText className="h-4 w-4" /> How it works
                          </Link>
                          <Link href="/privacy" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <Shield className="h-4 w-4" /> Privacy & Control
                          </Link>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="patients" className="border-b-0">
                        <AccordionTrigger className="text-lg font-medium hover:text-primary hover:no-underline py-3">
                          <span className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> For Patients</span>
                        </AccordionTrigger>
                        <AccordionContent className="flex flex-col gap-3 pl-4 pb-4">
                          <Link href="/patients/features" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <Calendar className="h-4 w-4" /> What you can do
                          </Link>
                          <Link href="/patients/experience" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <Activity className="h-4 w-4" /> Patient Experience
                          </Link>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="doctors" className="border-b-0">
                        <AccordionTrigger className="text-lg font-medium hover:text-primary hover:no-underline py-3">
                          <span className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> For Doctors</span>
                        </AccordionTrigger>
                        <AccordionContent className="flex flex-col gap-3 pl-4 pb-4">
                          <Link href="/doctors/features" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <LayoutDashboard className="h-4 w-4" /> What you can do
                          </Link>
                          <Link href="/doctors/experience" className="flex items-center gap-2 text-muted-foreground hover:text-primary py-1">
                            <Users className="h-4 w-4" /> Doctor Experience
                          </Link>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    
                    <Link href="/about" className="flex items-center gap-2 text-lg font-medium hover:text-primary py-3 border-b border-border/50">
                      <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> About</span>
                    </Link>

                    <div className="mt-auto flex flex-col gap-3 pt-6">
                      <Button variant="outline" asChild className="w-full justify-center h-12 text-base border-primary/20 hover:bg-primary-more-light hover:text-primary">
                        <Link href="/login">Log in</Link>
                      </Button>
                      <Button asChild className="w-full justify-center h-12 text-base bg-primary hover:bg-primary-muted shadow-lg shadow-primary/20">
                        <Link href="/selection">Sign up</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-4">
                      <Link href="/dashboard" className="flex items-center gap-2 text-lg font-medium hover:text-primary">
                        <LayoutDashboard className="h-5 w-5" /> Dashboard
                      </Link>
                      <Link href="/overview" className="flex items-center gap-2 text-lg font-medium hover:text-primary">
                        <Activity className="h-5 w-5" /> Overview
                      </Link>
                      <Link href="/appointments" className="flex items-center gap-2 text-lg font-medium hover:text-primary">
                        <Calendar className="h-5 w-5" /> Appointments
                      </Link>
                      <Link href="/records" className="flex items-center gap-2 text-lg font-medium hover:text-primary">
                        <FileText className="h-5 w-5" /> Records
                      </Link>
                    </div>
                    <div className="mt-auto flex flex-col gap-4 border-t pt-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src="/avatars/01.png" />
                          <AvatarFallback>US</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">Dr. Smith</span>
                          <span className="text-xs text-muted-foreground">dr.smith@example.com</span>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-50">
                        <LogOut className="mr-2 h-4 w-4" /> Log out
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-primary-more-light hover:text-primary focus:bg-primary-more-light focus:text-primary",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
