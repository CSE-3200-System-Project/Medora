import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFiltersProps {
  onSearch: (filters: Record<string, string>) => void;
}

export function SearchFilters({ onSearch }: SearchFiltersProps) {
  const [query, setQuery] = React.useState("");
  const [speciality, setSpeciality] = React.useState("");
  const [city, setCity] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [consultationType, setConsultationType] = React.useState("");

  const handleSearch = () => {
    onSearch({
      query,
      specialization: speciality === "all" ? "" : speciality,
      city: city === "all" ? "" : city,
      gender: gender === "all" ? "" : gender,
      consultation_mode: consultationType === "all" ? "" : consultationType,
    });
  };

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search doctors, symptoms, specialities..." 
            className="pl-10 h-12 text-lg shadow-sm bg-background border-border"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button size="lg" className="h-12 px-8" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Gender</label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="All Genders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Specialities</label>
          <Select value={speciality} onValueChange={setSpeciality}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="All Specialities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialities</SelectItem>
              <SelectItem value="Cardiologist">Cardiologist</SelectItem>
              <SelectItem value="Dermatologist">Dermatologist</SelectItem>
              <SelectItem value="Neurologist">Neurologist</SelectItem>
              <SelectItem value="Orthopedic">Orthopedic</SelectItem>
              <SelectItem value="Pediatrician">Pediatrician</SelectItem>
              <SelectItem value="Psychiatrist">Psychiatrist</SelectItem>
              <SelectItem value="Urologist">Urologist</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Cities</label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              <SelectItem value="Dhaka">Dhaka</SelectItem>
              <SelectItem value="Chittagong">Chittagong</SelectItem>
              <SelectItem value="Sylhet">Sylhet</SelectItem>
              <SelectItem value="Rajshahi">Rajshahi</SelectItem>
              <SelectItem value="Khulna">Khulna</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Distance</label>
          <Select>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="Any Distance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Distance</SelectItem>
              <SelectItem value="5">Within 5 km</SelectItem>
              <SelectItem value="10">Within 10 km</SelectItem>
              <SelectItem value="20">Within 20 km</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Consultation Type</label>
          <Select value={consultationType} onValueChange={setConsultationType}>
            <SelectTrigger className="bg-background border-border">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="video">Video Consult</SelectItem>
              <SelectItem value="in-person">In-Person</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
