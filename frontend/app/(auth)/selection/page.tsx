import Link from "next/link";
import Image from "next/image";
import { Stethoscope, UserCircle, ArrowRight } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";
import logo from "@/assets/images/medora-logo.png";

export default function SelectionPage() {
  return (
    <AppBackground className="min-h-screen animate-page-enter">
      {/* Mobile-first stacked layout, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row min-h-screen p-4 md:p-6 lg:p-8 gap-4">
        
        {/* Floating Logo - Centered at top */}
        <div className="absolute top-4 left-0 right-0 flex justify-center z-20 lg:top-8">
          <div className="relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-card/95 backdrop-blur-md rounded-full p-3 shadow-xl border-4 border-white/30">
            <Image src={logo} alt="Medora" fill sizes="96px" className="object-contain p-1" />
          </div>
        </div>

        {/* Doctor Section */}
        <Link 
          href="/doctor/register" 
          className="relative flex-1 group overflow-hidden rounded-2xl lg:rounded-3xl shadow-xl min-h-[280px] lg:min-h-0"
        >
          <Image
            src={doctorImg}
            alt="Doctor"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/60 transition-colors duration-300" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end p-6 pb-8 lg:pb-16">
            <div className="bg-card/20 backdrop-blur-sm rounded-full p-3 mb-4 group-hover:bg-card/30 transition-colors">
              <Stethoscope className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
            </div>
            <h2 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-2 transform transition-transform duration-300 group-hover:-translate-y-1">
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
          className="relative flex-1 group overflow-hidden rounded-2xl lg:rounded-3xl shadow-xl min-h-[280px] lg:min-h-0"
        >
          <Image
            src={patientImg}
            alt="Patient"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/60 transition-colors duration-300" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-end p-6 pb-8 lg:pb-16">
            <div className="bg-card/20 backdrop-blur-sm rounded-full p-3 mb-4 group-hover:bg-card/30 transition-colors">
              <UserCircle className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
            </div>
            <h2 className="text-white text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-2 transform transition-transform duration-300 group-hover:-translate-y-1">
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
      <div className="fixed bottom-6 left-0 right-0 text-center z-10">
        <div className="inline-block bg-card/95 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-border/50">
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

