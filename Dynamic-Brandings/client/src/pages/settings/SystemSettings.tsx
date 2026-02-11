import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Settings,
  Palette,
  Image,
  Building2,
  Save,
  RotateCcw,
  Upload,
  Check,
  Monitor,
  Sun,
  Moon,
  GraduationCap
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useSystemSettings } from "@/hooks/use-system-settings";

// Color presets for the theme
const colorPresets = [
  { name: "Green", primary: "#006937", secondary: "#004d29" },
  { name: "Royal Blue", primary: "#1e40af", secondary: "#1e3a8a" },
  { name: "Crimson Red", primary: "#dc2626", secondary: "#b91c1c" },
  { name: "Purple", primary: "#7c3aed", secondary: "#6d28d9" },
  { name: "Teal", primary: "#0d9488", secondary: "#0f766e" },
  { name: "Orange", primary: "#ea580c", secondary: "#c2410c" },
  { name: "Pink", primary: "#db2777", secondary: "#be185d" },
  { name: "Indigo", primary: "#4f46e5", secondary: "#4338ca" },
];

const systemSettingsSchema = z.object({
  schoolName: z.string().min(1, "School name is required"),
  systemTitle: z.string().min(1, "System title is required"),
  tagline: z.string().optional(),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().min(1, "Secondary color is required"),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  theme: z.enum(["light", "dark", "system"]),
  fontFamily: z.enum(["inter", "roboto", "poppins", "open-sans"]),
});

type SystemSettingsValues = z.infer<typeof systemSettingsSchema>;

export default function SystemSettings() {
  const { toast } = useToast();
  const { settings, updateSettings, resetSettings } = useSystemSettings();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const form = useForm<SystemSettingsValues>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      schoolName: settings.schoolName,
      systemTitle: settings.systemTitle,
      tagline: settings.tagline,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      theme: settings.theme,
      fontFamily: settings.fontFamily,
    },
  });

  // Sync form with context settings on mount and when settings change
  useEffect(() => {
    form.reset({
      schoolName: settings.schoolName,
      systemTitle: settings.systemTitle,
      tagline: settings.tagline,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      theme: settings.theme,
      fontFamily: settings.fontFamily,
    });
    setLogoPreview(settings.logoUrl || null);
    setFaviconPreview(settings.faviconUrl || null);

    // Find matching preset
    const matchingPreset = colorPresets.find(
      p => p.primary === settings.primaryColor && p.secondary === settings.secondaryColor
    );
    setSelectedPreset(matchingPreset?.name || null);
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        form.setValue("logoUrl", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFaviconPreview(result);
        form.setValue("faviconUrl", result);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    setSelectedPreset(preset.name);
    form.setValue("primaryColor", preset.primary);
    form.setValue("secondaryColor", preset.secondary);
  };

  const onSubmit = async (data: SystemSettingsValues) => {
    try {
      await updateSettings({
        schoolName: data.schoolName,
        systemTitle: data.systemTitle,
        tagline: data.tagline || "",
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        logoUrl: data.logoUrl || "",
        faviconUrl: data.faviconUrl || "",
        theme: data.theme,
        fontFamily: data.fontFamily,
      });

      toast({
        title: "Settings saved",
        description: "Your system settings have been saved to the database.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings();
      setSelectedPreset("DLSU Green");
      setLogoPreview(null);
      setFaviconPreview(null);
      toast({
        title: "Settings reset",
        description: "All settings have been restored to defaults.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const watchPrimaryColor = form.watch("primaryColor");
  const watchSecondaryColor = form.watch("secondaryColor");
  const watchTheme = form.watch("theme");
  const watchSchoolName = form.watch("schoolName");
  const watchSystemTitle = form.watch("systemTitle");
  const watchTagline = form.watch("tagline");

  const getPreviewBgClass = () => {
    if (watchTheme === "dark") return "bg-gray-900";
    if (watchTheme === "light") return "bg-gray-50";
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "bg-gray-900";
    }
    return "bg-gray-50";
  };

  const getPreviewTextClass = () => {
    if (watchTheme === "dark") return "text-white";
    if (watchTheme === "light") return "text-gray-900";
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "text-white";
    }
    return "text-gray-900";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Customize the appearance and branding of your attendance system
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Tabs defaultValue="branding" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
              <TabsTrigger value="branding" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Branding
              </TabsTrigger>
              <TabsTrigger value="colors" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Colors
              </TabsTrigger>
            </TabsList>

            {/* Branding Tab */}
            <TabsContent value="branding" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Details</CardTitle>
                  <CardDescription>
                    Configure your school or organization information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="schoolName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School / Organization Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., De La Salle University"
                            className="max-w-md"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This will be displayed throughout the system
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="systemTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., AttendED"
                            className="max-w-md"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The name of your attendance system
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tagline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagline (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Streamlining Academic Attendance"
                            className="max-w-md"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          A short description shown on the login page
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Logo & Favicon</CardTitle>
                  <CardDescription>
                    Upload your organization's logo and favicon
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label>Logo</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        {logoPreview ? (
                          <div className="space-y-4">
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="max-h-24 mx-auto object-contain"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLogoPreview(null);
                                form.setValue("logoUrl", "");
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer block">
                            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">
                              Click to upload logo
                            </span>
                            <span className="block text-xs text-muted-foreground mt-1">
                              PNG, JPG, SVG (max 2MB)
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleLogoUpload}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Favicon</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        {faviconPreview ? (
                          <div className="space-y-4">
                            <img
                              src={faviconPreview}
                              alt="Favicon preview"
                              className="w-16 h-16 mx-auto object-contain"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFaviconPreview(null);
                                form.setValue("faviconUrl", "");
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer block">
                            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">
                              Click to upload favicon
                            </span>
                            <span className="block text-xs text-muted-foreground mt-1">
                              ICO, PNG (32x32 or 64x64)
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.ico"
                              onChange={handleFaviconUpload}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Color Presets</CardTitle>
                  <CardDescription>
                    Choose a preset color scheme or customize your own
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => applyColorPreset(preset)}
                        className={`relative p-4 rounded-lg border-2 transition-all ${selectedPreset === preset.name
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        {selectedPreset === preset.name && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex gap-2 mb-3">
                          <div
                            className="w-8 h-8 rounded-full shadow-sm"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <div
                            className="w-8 h-8 rounded-full shadow-sm"
                            style={{ backgroundColor: preset.secondary }}
                          />
                        </div>
                        <p className="text-sm font-medium text-left">{preset.name}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Colors</CardTitle>
                  <CardDescription>
                    Fine-tune your color scheme with custom hex values
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-3">
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setSelectedPreset(null);
                                }}
                                className="w-12 h-10 rounded border cursor-pointer"
                              />
                              <Input
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setSelectedPreset(null);
                                }}
                                placeholder="#006937"
                                className="font-mono"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Used for buttons, links, and accents
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secondaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-3">
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setSelectedPreset(null);
                                }}
                                className="w-12 h-10 rounded border cursor-pointer"
                              />
                              <Input
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setSelectedPreset(null);
                                }}
                                placeholder="#004d29"
                                className="font-mono"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Used for hover states and secondary elements
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />
                  <div className="space-y-4">
                    <Label>Live Preview</Label>
                    <div className="p-6 bg-white rounded-lg border space-y-4">
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          type="button"
                          style={{ backgroundColor: watchPrimaryColor, borderColor: watchPrimaryColor }}
                          className="hover:opacity-90 text-white"
                        >
                          Primary Button
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          style={{ borderColor: watchPrimaryColor, color: watchPrimaryColor }}
                        >
                          Outline Button
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          style={{ color: watchPrimaryColor }}
                          className="text-sm hover:underline"
                        >
                          Sample Link
                        </a>
                        <span
                          className="px-3 py-1 rounded-full text-white text-sm"
                          style={{ backgroundColor: watchPrimaryColor }}
                        >
                          Badge
                        </span>
                        <div
                          className="w-full max-w-[200px] h-2 rounded-full"
                          style={{ backgroundColor: `${watchPrimaryColor}30` }}
                        >
                          <div
                            className="w-3/4 h-full rounded-full"
                            style={{ backgroundColor: watchPrimaryColor }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
