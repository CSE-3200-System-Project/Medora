"use client"

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select-native"
import { RadioGroup } from "@/components/ui/radio-group-native"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { StepIndicator } from "@/components/onboarding/step-indicator"

const STEPS = [
  { id: 1, title: "Basic Identity", shortName: "Identity" },
  { id: 2, title: "Physical & Demographic", shortName: "Profile" },
  { id: 3, title: "Known Medical Conditions", shortName: "Conditions" },
  { id: 4, title: "Medications & Allergies", shortName: "Meds" },
  { id: 5, title: "Medical History", shortName: "History" },
  { id: 6, title: "Lifestyle & Health", shortName: "Lifestyle" },
  { id: 7, title: "Preferences & Consent", shortName: "Consent" },
]

export function PatientOnboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    phone: "",
    email: "",
    // Step 2
    height: "",
    weight: "",
    bloodGroup: "",
    city: "",
    country: "",
    occupation: "",
    // Step 3
    hasConditions: "no",
    conditions: [] as { name: string; year: string; treating: boolean }[],
    // Step 4
    takingMeds: "no",
    medications: [] as { name: string; dosage: string; frequency: string; duration: string }[],
    allergies: "",
    allergyReaction: "",
    // Step 5
    pastSurgeries: "no",
    surgeryDescription: "",
    ongoingTreatments: "no",
    // Step 6
    smoking: "never",
    alcohol: "never",
    activityLevel: "moderate",
    sleepDuration: "",
    diet: "omnivore",
    // Step 7
    language: "English",
    notifications: true,
    emergencyName: "",
    emergencyRelation: "",
    emergencyPhone: "",
    consentStorage: false,
    consentAI: false,
    consentDoctor: false,
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1)
      window.scrollTo(0, 0)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo(0, 0)
    }
  }

  // Helper for dynamic lists (Conditions, Meds)
  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { name: "", year: "", treating: true }]
    }))
  }

  const updateCondition = (index: number, field: string, value: any) => {
    const newConditions = [...formData.conditions]
    // @ts-ignore
    newConditions[index][field] = value
    setFormData(prev => ({ ...prev, conditions: newConditions }))
  }

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }))
  }

  const addMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { name: "", dosage: "", frequency: "", duration: "" }]
    }))
  }

  const updateMedication = (index: number, field: string, value: any) => {
    const newMeds = [...formData.medications]
    // @ts-ignore
    newMeds[index][field] = value
    setFormData(prev => ({ ...prev, medications: newMeds }))
  }

  const removeMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={formData.dob} onChange={(e) => handleInputChange("dob", e.target.value)} />
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
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="+1 234 567 890" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="john@example.com" />
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input id="height" type="number" value={formData.height} onChange={(e) => handleInputChange("height", e.target.value)} placeholder="175" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input id="weight" type="number" value={formData.weight} onChange={(e) => handleInputChange("weight", e.target.value)} placeholder="70" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select id="bloodGroup" value={formData.bloodGroup} onChange={(e) => handleInputChange("bloodGroup", e.target.value)}>
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={formData.city} onChange={(e) => handleInputChange("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={formData.country} onChange={(e) => handleInputChange("country", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation (Optional)</Label>
              <Input id="occupation" value={formData.occupation} onChange={(e) => handleInputChange("occupation", e.target.value)} />
            </div>
            
            <Separator className="my-4" />
            
            <div className="rounded-lg border border-dashed p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Medical Summary or ID (Optional)</h4>
                <p className="text-xs text-muted-foreground">Scan or upload to auto-fill some details. You can skip this.</p>
                <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
              </div>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Do you have any diagnosed conditions?</Label>
              <RadioGroup
                name="hasConditions"
                value={formData.hasConditions}
                onChange={(val) => handleInputChange("hasConditions", val)}
                options={[
                  { label: "No, I don't have any known conditions", value: "no" },
                  { label: "Yes, I have diagnosed conditions", value: "yes" },
                ]}
              />
            </div>

            {formData.hasConditions === "yes" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                {formData.conditions.map((condition, index) => (
                  <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="space-y-2">
                      <Label>Condition Name</Label>
                      <Input 
                        value={condition.name} 
                        onChange={(e) => updateCondition(index, "name", e.target.value)} 
                        placeholder="e.g. Hypertension"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Year Diagnosed</Label>
                        <Input 
                          type="number" 
                          value={condition.year} 
                          onChange={(e) => updateCondition(index, "year", e.target.value)} 
                          placeholder="2020"
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-8">
                        <Checkbox 
                          id={`treating-${index}`} 
                          checked={condition.treating}
                          onCheckedChange={(checked) => updateCondition(index, "treating", checked)}
                        />
                        <Label htmlFor={`treating-${index}`}>Currently treating?</Label>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addCondition} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Condition
                </Button>
              </div>
            )}

            <Separator />
            
            <div className="rounded-lg border border-dashed p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Diagnosis Reports (Optional)</h4>
                <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
              </div>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Are you currently taking any medicines?</Label>
              <RadioGroup
                name="takingMeds"
                value={formData.takingMeds}
                onChange={(val) => handleInputChange("takingMeds", val)}
                options={[
                  { label: "No, I am not taking any medication", value: "no" },
                  { label: "Yes, I am currently taking medication", value: "yes" },
                ]}
              />
            </div>

            {formData.takingMeds === "yes" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                {formData.medications.map((med, index) => (
                  <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMedication(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="space-y-2">
                      <Label>Medicine Name</Label>
                      <Input 
                        value={med.name} 
                        onChange={(e) => updateMedication(index, "name", e.target.value)} 
                        placeholder="e.g. Paracetamol"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Dosage</Label>
                        <Input 
                          value={med.dosage} 
                          onChange={(e) => updateMedication(index, "dosage", e.target.value)} 
                          placeholder="500mg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Input 
                          value={med.frequency} 
                          onChange={(e) => updateMedication(index, "frequency", e.target.value)} 
                          placeholder="Twice daily"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Input 
                          value={med.duration} 
                          onChange={(e) => updateMedication(index, "duration", e.target.value)} 
                          placeholder="5 days"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addMedication} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Medication
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="allergies">Known Drug Allergies</Label>
              <Input id="allergies" value={formData.allergies} onChange={(e) => handleInputChange("allergies", e.target.value)} placeholder="e.g. Penicillin" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="allergyReaction">Allergy Reaction (Optional)</Label>
              <Input id="allergyReaction" value={formData.allergyReaction} onChange={(e) => handleInputChange("allergyReaction", e.target.value)} placeholder="e.g. Rash, Swelling" />
            </div>

            <Separator />
            
            <div className="rounded-lg border border-dashed p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Scan Prescription (Optional)</h4>
                <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
              </div>
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Past Surgeries or Hospitalizations?</Label>
              <RadioGroup
                name="pastSurgeries"
                value={formData.pastSurgeries}
                onChange={(val) => handleInputChange("pastSurgeries", val)}
                options={[
                  { label: "No", value: "no" },
                  { label: "Yes", value: "yes" },
                ]}
              />
            </div>

            {formData.pastSurgeries === "yes" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                <Label htmlFor="surgeryDescription">Description</Label>
                <Textarea 
                  id="surgeryDescription" 
                  value={formData.surgeryDescription} 
                  onChange={(e) => handleInputChange("surgeryDescription", e.target.value)} 
                  placeholder="Briefly describe surgeries or hospital stays..."
                />
              </div>
            )}

            <div className="space-y-3">
              <Label>Ongoing Treatments?</Label>
              <RadioGroup
                name="ongoingTreatments"
                value={formData.ongoingTreatments}
                onChange={(val) => handleInputChange("ongoingTreatments", val)}
                options={[
                  { label: "No", value: "no" },
                  { label: "Yes", value: "yes" },
                ]}
              />
            </div>

            <Separator />
            
            <div className="rounded-lg border border-dashed p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Test Reports (Optional)</h4>
                <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
              </div>
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smoking">Smoking Status</Label>
              <Select id="smoking" value={formData.smoking} onChange={(e) => handleInputChange("smoking", e.target.value)}>
                <option value="never">Never Smoked</option>
                <option value="former">Former Smoker</option>
                <option value="current">Current Smoker</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alcohol">Alcohol Consumption</Label>
              <Select id="alcohol" value={formData.alcohol} onChange={(e) => handleInputChange("alcohol", e.target.value)}>
                <option value="never">Never</option>
                <option value="occasional">Occasional</option>
                <option value="frequent">Frequent</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activityLevel">Physical Activity Level</Label>
              <Select id="activityLevel" value={formData.activityLevel} onChange={(e) => handleInputChange("activityLevel", e.target.value)}>
                <option value="sedentary">Sedentary (Little or no exercise)</option>
                <option value="moderate">Moderate (Exercise 1-3 times/week)</option>
                <option value="active">Active (Exercise 4-5 times/week)</option>
                <option value="very_active">Very Active (Daily exercise)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sleepDuration">Average Sleep Duration (Hours)</Label>
              <Input id="sleepDuration" type="number" value={formData.sleepDuration} onChange={(e) => handleInputChange("sleepDuration", e.target.value)} placeholder="7-8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diet">Diet Preference</Label>
              <Select id="diet" value={formData.diet} onChange={(e) => handleInputChange("diet", e.target.value)}>
                <option value="omnivore">Omnivore (All)</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="keto">Keto</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
        )
      case 7:
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
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="notifications" 
                checked={formData.notifications}
                onCheckedChange={(checked) => handleInputChange("notifications", checked)}
              />
              <Label htmlFor="notifications">Enable Notifications</Label>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Emergency Contact</h4>
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Name</Label>
                <Input id="emergencyName" value={formData.emergencyName} onChange={(e) => handleInputChange("emergencyName", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelation">Relation</Label>
                  <Input id="emergencyRelation" value={formData.emergencyRelation} onChange={(e) => handleInputChange("emergencyRelation", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone</Label>
                  <Input id="emergencyPhone" value={formData.emergencyPhone} onChange={(e) => handleInputChange("emergencyPhone", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Consent</h4>
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="consentStorage" 
                  checked={formData.consentStorage}
                  onCheckedChange={(checked) => handleInputChange("consentStorage", checked)}
                />
                <Label htmlFor="consentStorage" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I consent to the storage of my medical data.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="consentAI" 
                  checked={formData.consentAI}
                  onCheckedChange={(checked) => handleInputChange("consentAI", checked)}
                />
                <Label htmlFor="consentAI" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I allow AI assistance to analyze my data for better insights.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox 
                  id="consentDoctor" 
                  checked={formData.consentDoctor}
                  onCheckedChange={(checked) => handleInputChange("consentDoctor", checked)}
                />
                <Label htmlFor="consentDoctor" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I allow authorized doctors to access my records.
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
    <div className="min-h-screen bg-surface/30 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-none shadow-lg">
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
                  disabled={currentStep === 1}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={nextStep}>
                  {currentStep === STEPS.length ? "Finish Setup" : "Next"} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
