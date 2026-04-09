import Link from "next/link";
import Image from "next/image";
import { Stethoscope, UserCircle, ArrowRight } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";
import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";

export default function SelectionPage() {
  return (
    <AppBackground className="min-h-dvh min-h-app animate-page-enter">
      {/* Mobile-first stacked layout, side-by-side on desktop */}
      <div className="flex flex-col xl:flex-row min-h-dvh min-h-app p-4 sm:p-5 md:p-6 xl:p-8 gap-4 sm:gap-5 pb-24 sm:pb-28">
        
        {/* Floating Logo - Centered at top */}
        <div className="absolute top-4 left-0 right-0 flex justify-center z-20 lg:top-8">
          <div className="relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-card/95 rounded-full p-3 shadow-xl border-4 border-white/30">
            <Image src={medoraDarkLogo} alt="Medora" fill sizes="96px" className="object-contain p-1 dark:hidden" loading="eager" fetchPriority="high" />
            <Image src={medoraLightLogo} alt="Medora" fill sizes="96px" className="hidden object-contain p-1 dark:block" loading="eager" fetchPriority="high" />
          </div>
        </div>

        {/* Doctor Section */}
        <Link 
          href="/doctor/register" 
          className="relative flex-1 group overflow-hidden rounded-2xl xl:rounded-3xl shadow-xl min-h-70 sm:min-h-80 xl:min-h-0 bg-linear-to-br from-primary to-primary-muted"
        >
          <Image
            src={doctorImg}
            alt="Doctor"
            fill
            sizes="(max-width: 767px) 1px, (max-width: 1279px) 100vw, 50vw"
            className="hidden md:block object-cover transition-none md:transition-transform md:duration-700 motion-reduce:transition-none md:group-hover:scale-105"
            loading="lazy"
            fetchPriority="low"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent md:group-hover:from-black/60 transition-colors duration-300" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end p-5 sm:p-6 pb-8 xl:pb-16">
            <div className="bg-card/20 backdrop-blur-sm rounded-full p-3 mb-4 group-hover:bg-card/30 transition-colors">
              <Stethoscope className="h-8 w-8 xl:h-10 xl:w-10 text-white" />
            </div>
            <h2 className="text-white text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight mb-2 transform transition-transform duration-300 group-hover:-translate-y-1">
              Doctor
            </h2>
            <p className="text-white/90 text-sm md:text-base text-center max-w-xs opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
              Join our network of healthcare specialists
            </p>
            <div className="mt-4 flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
              <span className="text-sm font-medium">Get Started</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        {/* Patient Section */}
        <Link 
          href="/patient/register" 
          className="relative flex-1 group overflow-hidden rounded-2xl xl:rounded-3xl shadow-xl min-h-70 sm:min-h-80 xl:min-h-0 bg-linear-to-br from-primary-muted to-primary"
        >
          <Image
            src={patientImg}
            alt="Patient"
            fill
            sizes="(max-width: 767px) 1px, (max-width: 1279px) 100vw, 50vw"
            className="hidden md:block object-cover transition-none md:transition-transform md:duration-700 motion-reduce:transition-none md:group-hover:scale-105"
            loading="lazy"
            fetchPriority="low"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent md:group-hover:from-black/60 transition-colors duration-300" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end p-5 sm:p-6 pb-8 xl:pb-16">
            <div className="bg-card/20 backdrop-blur-sm rounded-full p-3 mb-4 group-hover:bg-card/30 transition-colors">
              <UserCircle className="h-8 w-8 xl:h-10 xl:w-10 text-white" />
            </div>
            <h2 className="text-white text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight mb-2 transform transition-transform duration-300 group-hover:-translate-y-1">
              Patient
            </h2>
            <p className="text-white/90 text-sm md:text-base text-center max-w-xs opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
              Find the best care for you and your family
            </p>
            <div className="mt-4 flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
              <span className="text-sm font-medium">Get Started</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      {/* Floating Sign In Link - Fixed at bottom */}
      <div className="fixed bottom-3 sm:bottom-6 left-0 right-0 text-center z-10 px-4">
        <div className="inline-block bg-card/95 md:backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-border/50">
          <p className="text-foreground text-sm md:text-base">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-semibold hover:text-primary-muted underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AppBackground>
  );
}

