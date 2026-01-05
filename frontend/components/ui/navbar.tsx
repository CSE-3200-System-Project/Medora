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
const user = { name: "Sarwad Hasan", role: "patient" }; 
// const user = null; // Example logged out

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
            <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/patient/home" className={cn("transition-colors hover:text-primary", pathname === "/patient/home" && "text-primary")}>
                Find Doctor
              </Link>
              <Link href="/find-medicine" className={cn("transition-colors hover:text-primary", pathname === "/find-medicine" && "text-primary")}>
                Find Medicine
              </Link>
              <Link href="/find-ambulance" className={cn("transition-colors hover:text-primary", pathname === "/find-ambulance" && "text-primary")}>
                Find Ambulance
              </Link>
            </nav>
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
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-primary-more-light hover:text-primary relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-primary-more-light pl-2 pr-4 rounded-full">
                    <Avatar className="h-8 w-8 border border-primary/20">
                      <AvatarImage src="/avatars/01.png" alt="@user" />
                      <AvatarFallback>SH</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        patient@example.com
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
                      <Link href="/patient/home" className="flex items-center gap-2 text-lg font-medium text-foreground hover:text-primary transition-colors py-2">
                        <Users className="h-5 w-5 text-primary" /> Find Doctor
                      </Link>
                      <Link href="/find-medicine" className="flex items-center gap-2 text-lg font-medium text-foreground hover:text-primary transition-colors py-2">
                        <Activity className="h-5 w-5 text-primary" /> Find Medicine
                      </Link>
                      <Link href="/find-ambulance" className="flex items-center gap-2 text-lg font-medium text-foreground hover:text-primary transition-colors py-2">
                        <Shield className="h-5 w-5 text-primary" /> Find Ambulance
                      </Link>
                    </div>
                    <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4">
                      <div className="flex items-center gap-3 px-2">
                        <Avatar className="h-10 w-10 border-2 border-primary/10">
                          <AvatarImage src="/avatars/01.png" />
                          <AvatarFallback className="bg-primary/10 text-primary">SH</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1">
                          <span className="font-semibold text-foreground">{user.name}</span>
                          <span className="text-xs text-muted-foreground">patient@example.com</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link href="/profile" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary px-2 py-2 rounded-md hover:bg-primary-more-light transition-colors">
                          <User className="h-4 w-4" /> My Profile
                        </Link>
                        <Link href="/settings" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary px-2 py-2 rounded-md hover:bg-primary-more-light transition-colors">
                          <Settings className="h-4 w-4" /> Settings
                        </Link>
                        <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                          <LogOut className="mr-2 h-4 w-4" /> Log out
                        </Button>
                      </div>
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
