"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Droplets,
  Activity,
  Heart,
  AlertCircle,
  Pill,
  Shield,
  Edit,
  Loader2,
  FileText,
  Users,
  Scale,
  Ruler,
} from "lucide-react";

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
}

interface DrugAllergy {
  name: string;
  reaction?: string;
  severity?: string;
}

interface PatientData {
  // Profile
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  // Patient specific
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  profile_photo_url?: string;
  nid_number?: string;
  address?: string;
  city?: string;
  district?: string;
  postal_code?: string;
  country?: string;
  height?: number;
  weight?: number;
  marital_status?: string;
  occupation?: string;
  // Chronic conditions
  has_diabetes?: boolean;
  has_hypertension?: boolean;
  has_heart_disease?: boolean;
  has_asthma?: boolean;
  has_kidney_disease?: boolean;
  has_liver_disease?: boolean;
  has_thyroid?: boolean;
  has_mental_health?: boolean;
  // Allergies & medications
  allergies?: string;
  medications?: Medication[];
  drug_allergies?: DrugAllergy[];
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

export default function PatientProfilePage() {
  const router = useRouter();
  const [patient, setPatient] = React.useState<PatientData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadPatientProfile();
  }, []);

  const loadPatientProfile = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        
        // Fetch detailed patient data
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const detailsResponse = await fetch(`${backendUrl}/profile/patient/onboarding`, {
          headers: {
            Authorization: `Bearer ${document.cookie.split('session_token=')[1]?.split(';')[0]}`,
          },
        });
        
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          setPatient({ ...data, ...details });
        } else {
          setPatient(data);
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getChronicConditions = () => {
    if (!patient) return [];
    const conditions = [];
    if (patient.has_diabetes) conditions.push("Diabetes");
    if (patient.has_hypertension) conditions.push("Hypertension");
    if (patient.has_heart_disease) conditions.push("Heart Disease");
    if (patient.has_asthma) conditions.push("Asthma");
    if (patient.has_kidney_disease) conditions.push("Kidney Disease");
    if (patient.has_liver_disease) conditions.push("Liver Disease");
    if (patient.has_thyroid) conditions.push("Thyroid");
    if (patient.has_mental_health) conditions.push("Mental Health");
    return conditions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-foreground font-semibold">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground mb-4">Failed to load profile</p>
            <Button onClick={() => router.push('/login')}>Go to Login</Button>
          </div>
        </div>
      </div>
    );
  }

  const chronicConditions = getChronicConditions();
  const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your personal and medical information</p>
          </div>
          <Button variant="medical" size="lg" onClick={() => router.push('/onboarding/patient')}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        {/* Profile Header Card */}
        <Card className="mb-6 overflow-hidden rounded-2xl border-none shadow-lg">
          <div className="bg-gradient-to-r from-primary via-primary-muted to-primary h-32 sm:h-40" />
          <CardContent className="relative px-4 sm:px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16 sm:-mt-20">
              <Avatar className="h-28 w-28 sm:h-36 sm:w-36 border-4 border-white shadow-lg">
                <AvatarImage src={patient.profile_photo_url} alt={`${patient.first_name} ${patient.last_name}`} />
                <AvatarFallback className="bg-primary text-white text-3xl font-bold">
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left pb-2 flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {patient.first_name} {patient.last_name}
                </h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  {patient.gender && (
                    <Badge variant="secondary" className="font-medium">
                      {patient.gender}
                    </Badge>
                  )}
                  {age && (
                    <Badge variant="outline" className="font-medium">
                      {age} years old
                    </Badge>
                  )}
                  {patient.blood_group && (
                    <Badge className="bg-red-100 text-red-700 font-medium">
                      <Droplets className="h-3 w-3 mr-1" />
                      {patient.blood_group}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{patient.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{patient.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">
                    {[patient.address, patient.city, patient.district, patient.country].filter(Boolean).join(', ') || 'Not provided'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Physical Information */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Physical Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface rounded-xl text-center">
                  <Ruler className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Height</p>
                  <p className="text-xl font-bold text-foreground">
                    {patient.height ? `${patient.height} cm` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-surface rounded-xl text-center">
                  <Scale className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Weight</p>
                  <p className="text-xl font-bold text-foreground">
                    {patient.weight ? `${patient.weight} kg` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-surface rounded-xl text-center">
                  <Calendar className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="text-sm font-bold text-foreground">
                    {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '--'}
                  </p>
                </div>
                <div className="p-4 bg-surface rounded-xl text-center">
                  <Users className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Marital Status</p>
                  <p className="text-sm font-bold text-foreground capitalize">
                    {patient.marital_status || '--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Conditions */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-primary" />
                Medical Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chronicConditions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chronicConditions.map((condition, index) => (
                    <Badge key={index} variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      {condition}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No chronic conditions reported</p>
              )}
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.allergies || (patient.drug_allergies && patient.drug_allergies.length > 0) ? (
                <div className="space-y-2">
                  {patient.allergies && (
                    <p className="text-sm">{patient.allergies}</p>
                  )}
                  {patient.drug_allergies && patient.drug_allergies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {patient.drug_allergies.map((allergy: DrugAllergy, index: number) => (
                        <Badge key={index} variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                          {typeof allergy === 'string' ? allergy : allergy.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No allergies reported</p>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="rounded-2xl border-border/50 shadow-md lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.emergency_contact_name ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 p-4 bg-surface rounded-xl">
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{patient.emergency_contact_name}</p>
                  </div>
                  <div className="flex-1 p-4 bg-surface rounded-xl">
                    <p className="text-sm text-muted-foreground">Relation</p>
                    <p className="font-medium capitalize">{patient.emergency_contact_relation || 'Not specified'}</p>
                  </div>
                  <div className="flex-1 p-4 bg-surface rounded-xl">
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{patient.emergency_contact_phone || 'Not provided'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No emergency contact added</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light hover:border-primary"
            onClick={() => router.push('/patient/home')}
          >
            <Users className="h-6 w-6 text-primary" />
            <span>Find Doctors</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light hover:border-primary"
          >
            <Calendar className="h-6 w-6 text-primary" />
            <span>My Appointments</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light hover:border-primary"
          >
            <FileText className="h-6 w-6 text-primary" />
            <span>Medical Records</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light hover:border-primary"
          >
            <Pill className="h-6 w-6 text-primary" />
            <span>Medications</span>
          </Button>
        </div>
      </main>
    </div>
  );
}
