import doctorImg from "@/assets/images/hero-carousel/context-square.jpg";
import patientImg from "@/assets/images/hero-carousel/patient-square.jpg";
import heroDoctorImg from "@/assets/images/hero-carousel/doctor-square.jpg";
import heroPatientImg from "@/assets/images/hero-carousel/care-square.jpg";

export const SHARED_HERO_IMAGES = [
  { src: patientImg, alt: "Patient care in a calm, welcoming clinic setting" },
  { src: heroDoctorImg, alt: "Doctor reviewing patient context" },
  { src: doctorImg, alt: "Medical team collaborating on care" },
  { src: heroPatientImg, alt: "Patient using Medora to manage health records" },
] as const;

export type SharedHeroImage = (typeof SHARED_HERO_IMAGES)[number];
