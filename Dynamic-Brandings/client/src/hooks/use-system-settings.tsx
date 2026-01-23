import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface SystemSettings {
  schoolName: string;
  systemTitle: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  theme: "light" | "dark" | "system";
  fontFamily: "inter" | "roboto" | "poppins" | "open-sans";
}

const defaultSettings: SystemSettings = {
  schoolName: "De La Salle University",
  systemTitle: "AttendED",
  tagline: "Streamlining Academic Attendance",
  primaryColor: "#006937",
  secondaryColor: "#004d29",
  logoUrl: "",
  faviconUrl: "",
  theme: "light",
  fontFamily: "inter",
};

interface SystemSettingsContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

const STORAGE_KEY = "attended-system-settings";

// Convert hex to HSL for CSS variable compatibility
function hexToHSL(hex: string): string {
  // Remove the hash if present
  hex = hex.replace(/^#/, '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Apply CSS variables to document
function applyThemeColors(settings: SystemSettings) {
  const root = document.documentElement;
  
  // Convert hex colors to HSL for the CSS variables
  const primaryHSL = hexToHSL(settings.primaryColor);
  const secondaryHSL = hexToHSL(settings.secondaryColor);
  
  // Apply primary color
  root.style.setProperty('--primary', primaryHSL);
  root.style.setProperty('--primary-foreground', '0 0% 100%'); // White text on primary
  
  // Apply secondary/accent color
  root.style.setProperty('--accent', secondaryHSL);
  
  // Apply ring color (for focus states)
  root.style.setProperty('--ring', primaryHSL);
  
  // Store raw hex values for components that need them
  root.style.setProperty('--primary-hex', settings.primaryColor);
  root.style.setProperty('--secondary-hex', settings.secondaryColor);
}

// Apply theme mode
function applyThemeMode(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

// Apply font family
function applyFontFamily(fontFamily: string) {
  const root = document.documentElement;
  const fontMap: Record<string, string> = {
    'inter': '"Inter", sans-serif',
    'roboto': '"Roboto", sans-serif',
    'poppins': '"Poppins", sans-serif',
    'open-sans': '"Open Sans", sans-serif',
  };
  root.style.setProperty('--font-sans', fontMap[fontFamily] || fontMap['inter']);
}

// Apply favicon
function applyFavicon(faviconUrl: string) {
  if (!faviconUrl) return;
  
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconUrl;
}

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SystemSettings;
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load system settings:", error);
    }
    setIsLoading(false);
  }, []);

  // Apply settings whenever they change
  useEffect(() => {
    if (!isLoading) {
      applyThemeColors(settings);
      applyThemeMode(settings.theme);
      applyFontFamily(settings.fontFamily);
      applyFavicon(settings.faviconUrl);
      
      // Update document title
      document.title = `${settings.systemTitle} - ${settings.schoolName}`;
    }
  }, [settings, isLoading]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeMode("system");
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [settings.theme]);

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save system settings:", error);
      }
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to reset system settings:", error);
    }
  };

  return (
    <SystemSettingsContext.Provider value={{ settings, updateSettings, resetSettings, isLoading }}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (context === undefined) {
    throw new Error("useSystemSettings must be used within a SystemSettingsProvider");
  }
  return context;
}
