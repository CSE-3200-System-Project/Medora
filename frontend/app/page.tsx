import Image from "next/image";
import { Button } from "@/components/ui/button"
import BlueMedical from "@/assets/images/blue_medical_4.jpg"

export default function Home() {
  return (
    <div>
      <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
        <div className="max-w-4xl w-full px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Medora</h1>
            <p className="text-lg text-gray-600">Your gateway to seamless medical services.</p>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start bg-white shadow-md rounded-lg overflow-hidden">
            <div className="md:w-1/2 w-full">
              <Image
                src={BlueMedical}
                alt="Medical Illustration"
                className="object-cover w-full h-64 md:h-full"
              />
            </div>
            <div className="md:w-1/2 w-full p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Get Started</h2>
              <p className="text-gray-600 mb-6">
                Sign up or log in to access your personalized dashboard, book appointments, and manage your health records with ease.
              </p>
              <div className="flex space-x-4">
                <Button >
                  Log In
                </Button>
                <Button variant="secondary" >
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
