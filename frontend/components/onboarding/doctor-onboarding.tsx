"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select-native"
import { Checkbox } from "@/components/ui/checkbox"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { updateDoctorOnboarding, completeOnboarding } from "@/lib/auth-actions"
import { useRouter } from "next/navigation"

const STEPS = [
  { id: 1, title: "Personal Identity", shortName: "Identity" },
  { id: 2, title: "Professional Information", shortName: "Professional" },
  { id: 3, title: "Registration & Verification", shortName: "Verification" },
  { id: 4, title: "Practice Details", shortName: "Practice" },
  { id: 5, title: "Consultation Setup", shortName: "Consultation" },
  { id: 6, title: "Preferences & Consent", shortName: "Consent" },
]

export function DoctorOnboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [formData, setFormData] = useState({
    // Step 1
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    phone: "",
    email: "",
    profile_photo_url: "",
    // Step 2
    degree: "",
    specialization: "",
    experience: "",
    degree_certificates_url: "",
    // Step 3
    registrationNumber: "",
    bmdc_document_url: "",
    // Step 4
    hospitalName: "",
    practiceLocation: "",
    consultationMode: "both",
    affiliation_letter_url: "",
    // Step 5
    consultationFee: "",
    availableDays: [] as string[],
    timeSlots: "",
    emergencyAvailability: false,
    // Step 6
    language: "English",
    caseTypes: "",
    aiAssistance: true,
    termsAccepted: false,
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/upload/`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          handleInputChange(field, data.url);
          alert("File uploaded successfully!");
        } else {
          alert("Upload failed");
        }
      } catch (err) {
        console.error(err);
        alert("Upload error");
      }
    }
  };

  const nextStep = async () => {
    if (currentStep < STEPS.length) {
      try {
        // Save progress (optional, but good practice)
        await updateDoctorOnboarding(formData)
        setCurrentStep((prev) => prev + 1)
        window.scrollTo(0, 0)
      } catch (error) {
        console.error("Failed to save progress", error)
      }
    } else {
      // Final submission
      setLoading(true)
      try {
        await updateDoctorOnboarding(formData)
        await completeOnboarding()
        router.push("/doctor/dashboard")
      } catch (error) {
        console.error("Failed to complete onboarding", error)
      } finally {
        setLoading(false)
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo(0, 0)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select id="gender" value={formData.gender} onChange={(e) => handleInputChange("gender", e.target.value)}>
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={formData.dob} onChange={(e) => handleInputChange("dob", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="+1 234 567 890" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="doctor@hospital.com" />
            </div>
            
            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Profile Photo (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    type="file" 
                    className="hidden" 
                    id="profile-photo-upload"
                    onChange={(e) => handleFileUpload(e, "profile_photo_url")}
                  />
                  <Label htmlFor="profile-photo-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.profile_photo_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="degree">Primary Medical Degree</Label>
              <Input id="degree" value={formData.degree} onChange={(e) => handleInputChange("degree", e.target.value)} placeholder="MBBS, MD" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <Input id="specialization" value={formData.specialization} onChange={(e) => handleInputChange("specialization", e.target.value)} placeholder="Cardiology" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Input id="experience" type="number" value={formData.experience} onChange={(e) => handleInputChange("experience", e.target.value)} placeholder="5" />
            </div>

            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Degree Certificates (Optional)</h4>
                <p className="text-xs text-muted-foreground">You can proceed without uploading now.</p>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    type="file" 
                    className="hidden" 
                    id="degree-cert-upload"
                    onChange={(e) => handleFileUpload(e, "degree_certificates_url")}
                  />
                  <Label htmlFor="degree-cert-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.degree_certificates_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Medical Registration Number (BMDC or equivalent)</Label>
              <Input id="registrationNumber" value={formData.registrationNumber} onChange={(e) => handleInputChange("registrationNumber", e.target.value)} />
            </div>

            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Registration Proof (Optional)</h4>
                <p className="text-xs text-muted-foreground">Recommended for faster verification.</p>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    type="file" 
                    className="hidden" 
                    id="reg-proof-upload"
                    onChange={(e) => handleFileUpload(e, "bmdc_document_url")}
                  />
                  <Label htmlFor="reg-proof-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.bmdc_document_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hospitalName">Hospital or Clinic Name</Label>
              <Input id="hospitalName" value={formData.hospitalName} onChange={(e) => handleInputChange("hospitalName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceLocation">Practice Location</Label>
              <Input id="practiceLocation" value={formData.practiceLocation} onChange={(e) => handleInputChange("practiceLocation", e.target.value)} placeholder="City, Address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consultationMode">Consultation Mode</Label>
              <Select id="consultationMode" value={formData.consultationMode} onChange={(e) => handleInputChange("consultationMode", e.target.value)}>
                <option value="online">Online Only</option>
                <option value="in-person">In-Person Only</option>
                <option value="both">Both</option>
              </Select>
            </div>

            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Affiliation Letter (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    type="file" 
                    className="hidden" 
                    id="affiliation-upload"
                    onChange={(e) => handleFileUpload(e, "affiliation_letter_url")}
                  />
                  <Label htmlFor="affiliation-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.affiliation_letter_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="consultationFee">Consultation Fee (Currency)</Label>
              <Input id="consultationFee" type="number" value={formData.consultationFee} onChange={(e) => handleInputChange("consultationFee", e.target.value)} placeholder="500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeSlots">Available Time Slots</Label>
              <Input id="timeSlots" value={formData.timeSlots} onChange={(e) => handleInputChange("timeSlots", e.target.value)} placeholder="e.g. 9 AM - 5 PM" />
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <Checkbox 
                id="emergencyAvailability" 
                checked={formData.emergencyAvailability}
                onCheckedChange={(checked) => handleInputChange("emergencyAvailability", checked)}
              />
              <Label htmlFor="emergencyAvailability">Available for Emergencies</Label>
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="language">Preferred Language</Label>
              <Select id="language" value={formData.language} onChange={(e) => handleInputChange("language", e.target.value)}>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Bengali">Bengali</option>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="caseTypes">Case Types Handled</Label>
              <Input id="caseTypes" value={formData.caseTypes} onChange={(e) => handleInputChange("caseTypes", e.target.value)} placeholder="e.g. General, Surgery" />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Consent & Terms</h4>
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="aiAssistance" 
                  checked={formData.aiAssistance}
                  onCheckedChange={(checked) => handleInputChange("aiAssistance", checked)}
                />
                <Label htmlFor="aiAssistance" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to use AI assistance for preliminary diagnosis support.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="termsAccepted" 
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) => handleInputChange("termsAccepted", checked)}
                />
                <Label htmlFor="termsAccepted" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I accept the Terms of Service and Professional Responsibilities.
                </Label>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="space-y-8">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border shadow-xl bg-card">
              <CardHeader>
                <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                <CardDescription>
                  Step {currentStep} of {STEPS.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderStepContent()}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1 || loading}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={nextStep} disabled={loading}>
                  {loading ? "Completing..." : (currentStep === STEPS.length ? "Complete Onboarding" : "Next")} 
                  {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
