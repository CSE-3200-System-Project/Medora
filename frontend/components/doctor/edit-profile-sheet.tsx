"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Save, Plus, Trash2, Upload } from "lucide-react";
import { updateDoctorProfile } from "@/lib/auth-actions";

interface EditDoctorProfileSheetProps {
  doctor: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditDoctorProfileSheet({
  doctor,
  open,
  onOpenChange,
  onSuccess,
}: EditDoctorProfileSheetProps) {
  const [formData, setFormData] = React.useState<any>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (doctor) {
      setFormData({
        ...doctor,
        locations: doctor.locations || [],
        languages_spoken: doctor.languages_spoken || [],
        education: doctor.education || [],
        work_experience: doctor.work_experience || [],
        services: doctor.services || [],
        sub_specializations: doctor.sub_specializations || [],
      });
    }
  }, [doctor]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const addArrayItem = (field: string, defaultValue: any) => {
    const currentArray = formData[field] || [];
    setFormData((prev: any) => ({
      ...prev,
      [field]: [...currentArray, defaultValue],
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    const currentArray = formData[field] || [];
    setFormData((prev: any) => ({
      ...prev,
      [field]: currentArray.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateArrayItem = (
    field: string,
    index: number,
    key: string,
    value: any
  ) => {
    const currentArray = [...(formData[field] || [])];
    currentArray[index] = { ...currentArray[index], [key]: value };
    setFormData((prev: any) => ({ ...prev, [field]: currentArray }));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/`,
        {
          method: "POST",
          body: formDataUpload,
        }
      );

      if (res.ok) {
        const data = await res.json();
        handleInputChange(field, data.url);
      } else {
        alert("Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateDoctorProfile(formData);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      alert(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-gradient-to-br from-surface via-white to-primary-more-light/30"
      >
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold text-foreground">
            Edit Profile
          </SheetTitle>
          <SheetDescription>
            Update your professional information
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="basic" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-primary/10">
            <TabsTrigger value="basic" className="data-[state=active]:bg-primary data-[state=active]:text-white">Basic Info</TabsTrigger>
            <TabsTrigger value="professional" className="data-[state=active]:bg-primary data-[state=active]:text-white">Professional</TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-primary data-[state=active]:text-white">More Details</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Profile Photo */}
            <div>
              <Label className="font-semibold">Profile Photo</Label>
              <div className="mt-2 flex items-center gap-4">
                {formData.profile_photo_url && (
                  <img
                    src={formData.profile_photo_url}
                    alt="Profile"
                    className="h-20 w-20 rounded-lg object-cover border-2 border-primary"
                  />
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "profile_photo_url")}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, max 5MB
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">First Name</Label>
                <Input
                  value={formData.first_name || ""}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                />
              </div>
              <div>
                <Label className="font-semibold">Last Name</Label>
                <Input
                  value={formData.last_name || ""}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="font-semibold">Title</Label>
              <Input
                value={formData.title || ""}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Dr., Prof., Assoc. Prof."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">Phone</Label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+880 XXX XXXX"
                />
              </div>
              <div>
                <Label className="font-semibold">Gender</Label>
                <select
                  value={formData.gender || ""}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 bg-white"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="font-semibold">About</Label>
              <Textarea
                value={formData.about || ""}
                onChange={(e) => handleInputChange("about", e.target.value)}
                placeholder="Tell patients about yourself..."
                rows={4}
              />
            </div>
          </TabsContent>

          {/* Professional Info Tab */}
          <TabsContent value="professional" className="space-y-4 mt-4">
            <div>
              <Label className="font-semibold">Qualifications</Label>
              <Input
                value={formData.qualifications || ""}
                onChange={(e) =>
                  handleInputChange("qualifications", e.target.value)
                }
                placeholder="MBBS, MD, etc."
              />
            </div>

            <div>
              <Label className="font-semibold">Specialization</Label>
              <Input
                value={formData.specialization || ""}
                onChange={(e) =>
                  handleInputChange("specialization", e.target.value)
                }
                placeholder="Cardiologist, Nephrologist, etc."
              />
            </div>

            <div>
              <Label className="font-semibold">Years of Experience</Label>
              <Input
                type="number"
                value={formData.years_of_experience || ""}
                onChange={(e) =>
                  handleInputChange("years_of_experience", e.target.value)
                }
              />
            </div>

            {/* Services */}
            <div>
              <Label className="font-semibold">Services (comma-separated)</Label>
              <Textarea
                value={(formData.services || []).join(", ")}
                onChange={(e) =>
                  handleInputChange(
                    "services",
                    e.target.value.split(",").map((s) => s.trim())
                  )
                }
                placeholder="Diabetes Management, Heart Disease, etc."
                rows={3}
              />
            </div>

            {/* Sub-specializations */}
            <div>
              <Label className="font-semibold">
                Sub-Specializations (comma-separated)
              </Label>
              <Textarea
                value={(formData.sub_specializations || []).join(", ")}
                onChange={(e) =>
                  handleInputChange(
                    "sub_specializations",
                    e.target.value.split(",").map((s) => s.trim())
                  )
                }
                placeholder="Pediatric Cardiology, Interventional, etc."
                rows={3}
              />
            </div>

            {/* Languages */}
            <div>
              <Label className="font-semibold">
                Languages Spoken (comma-separated)
              </Label>
              <Input
                value={(formData.languages_spoken || []).join(", ")}
                onChange={(e) =>
                  handleInputChange(
                    "languages_spoken",
                    e.target.value.split(",").map((l) => l.trim())
                  )
                }
                placeholder="English, Bengali, Hindi"
              />
            </div>
          </TabsContent>

          {/* More Details Tab */}
          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Locations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="font-semibold text-base">
                  Practice Locations
                </Label>
                <Button
                  onClick={() =>
                    addArrayItem("locations", {
                      name: "",
                      address: "",
                      city: "",
                      country: "Bangladesh",
                      availability: "",
                    })
                  }
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {formData.locations?.map((location: any, index: number) => (
                  <div
                    key={index}
                    className="border border-primary/20 rounded-lg p-3 bg-white/50 space-y-2"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-primary">
                        Location {index + 1}
                      </span>
                      <Button
                        onClick={() => removeArrayItem("locations", index)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={location.name || ""}
                      onChange={(e) =>
                        updateArrayItem("locations", index, "name", e.target.value)
                      }
                      placeholder="Hospital/Chamber Name"
                      className="text-sm"
                    />
                    <Input
                      value={location.address || ""}
                      onChange={(e) =>
                        updateArrayItem(
                          "locations",
                          index,
                          "address",
                          e.target.value
                        )
                      }
                      placeholder="Address"
                      className="text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={location.city || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "locations",
                            index,
                            "city",
                            e.target.value
                          )
                        }
                        placeholder="City"
                        className="text-sm"
                      />
                      <Input
                        value={location.country || "Bangladesh"}
                        onChange={(e) =>
                          updateArrayItem(
                            "locations",
                            index,
                            "country",
                            e.target.value
                          )
                        }
                        placeholder="Country"
                        className="text-sm"
                      />
                    </div>
                    <Input
                      value={location.availability || ""}
                      onChange={(e) =>
                        updateArrayItem(
                          "locations",
                          index,
                          "availability",
                          e.target.value
                        )
                      }
                      placeholder="Availability (e.g., Sat-Thu 5PM-9PM)"
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="font-semibold text-base">Education</Label>
                <Button
                  onClick={() =>
                    addArrayItem("education", {
                      degree: "",
                      institution: "",
                      year: "",
                      country: "",
                    })
                  }
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {formData.education?.map((edu: any, index: number) => (
                  <div
                    key={index}
                    className="border border-primary/20 rounded-lg p-3 bg-white/50 space-y-2"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-primary">
                        Education {index + 1}
                      </span>
                      <Button
                        onClick={() => removeArrayItem("education", index)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={edu.degree || ""}
                      onChange={(e) =>
                        updateArrayItem("education", index, "degree", e.target.value)
                      }
                      placeholder="Degree (e.g., MBBS)"
                      className="text-sm"
                    />
                    <Input
                      value={edu.institution || ""}
                      onChange={(e) =>
                        updateArrayItem(
                          "education",
                          index,
                          "institution",
                          e.target.value
                        )
                      }
                      placeholder="Institution"
                      className="text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={edu.year || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "education",
                            index,
                            "year",
                            e.target.value
                          )
                        }
                        placeholder="Year"
                        className="text-sm"
                      />
                      <Input
                        value={edu.country || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "education",
                            index,
                            "country",
                            e.target.value
                          )
                        }
                        placeholder="Country"
                        className="text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Experience */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="font-semibold text-base">
                  Work Experience
                </Label>
                <Button
                  onClick={() =>
                    addArrayItem("work_experience", {
                      position: "",
                      hospital: "",
                      from_year: "",
                      to_year: "",
                      current: false,
                    })
                  }
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {formData.work_experience?.map((exp: any, index: number) => (
                  <div
                    key={index}
                    className="border border-primary/20 rounded-lg p-3 bg-white/50 space-y-2"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-primary">
                        Experience {index + 1}
                      </span>
                      <Button
                        onClick={() => removeArrayItem("work_experience", index)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={exp.position || ""}
                      onChange={(e) =>
                        updateArrayItem(
                          "work_experience",
                          index,
                          "position",
                          e.target.value
                        )
                      }
                      placeholder="Position"
                      className="text-sm"
                    />
                    <Input
                      value={exp.hospital || ""}
                      onChange={(e) =>
                        updateArrayItem(
                          "work_experience",
                          index,
                          "hospital",
                          e.target.value
                        )
                      }
                      placeholder="Hospital/Organization"
                      className="text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={exp.from_year || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "work_experience",
                            index,
                            "from_year",
                            e.target.value
                          )
                        }
                        placeholder="From Year"
                        className="text-sm"
                      />
                      <Input
                        value={exp.to_year || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "work_experience",
                            index,
                            "to_year",
                            e.target.value
                          )
                        }
                        placeholder="To Year"
                        className="text-sm"
                        disabled={exp.current}
                      />
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exp.current || false}
                        onChange={(e) =>
                          updateArrayItem(
                            "work_experience",
                            index,
                            "current",
                            e.target.checked
                          )
                        }
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-foreground">
                        Currently working here
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="mt-6 pt-6 border-t border-primary/10">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-muted text-white font-semibold"
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
