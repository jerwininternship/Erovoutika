import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  schoolName: "Robotics and Automation Solutions",
  systemTitle: "Erovoutika",
  tagline: "One-Stop-Shop Innovation Solutions",
  primaryColor: "#00008B",
  secondaryColor: "#ffffff",
  logoUrl: "/workspaces/Erovoutika/Dynamic-Brandings/client/public/Logo.webp",
  faviconUrl: "/workspaces/Erovoutika/Dynamic-Brandings/client/public/favicon.png",
  theme: "light",
  fontFamily: "inter",
};

interface SystemSettingsContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
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
  
  // Parse primary HSL to create derived colors
  const primaryParts = primaryHSL.split(' ');
  const primaryHue = primaryParts[0];
  
  // Apply primary color
  root.style.setProperty('--primary', primaryHSL);
  root.style.setProperty('--primary-foreground', '0 0% 100%'); // White text on primary
  
  // Apply secondary color (light tinted background for hover states) - uses primary hue
  root.style.setProperty('--secondary', `${primaryHue} 30% 96%`);
  root.style.setProperty('--secondary-foreground', primaryHSL);
  
  // Apply accent color
  root.style.setProperty('--accent', secondaryHSL);
  root.style.setProperty('--accent-foreground', '0 0% 100%');
  
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

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First try to load from database
        const { data, error } = await supabase
          .from("system_settings")
          .select("key, value");

        if (!error && data && data.length > 0) {
          // Convert array of key-value pairs to settings object
          const dbSettings: Partial<SystemSettings> = {};
          data.forEach((row: { key: string; value: string }) => {
            const key = row.key as keyof SystemSettings;
            if (key in defaultSettings) {
              (dbSettings as any)[key] = row.value;
            }
          });
          setSettings({ ...defaultSettings, ...dbSettings });
          // Also cache in localStorage for faster subsequent loads
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultSettings, ...dbSettings }));
        } else {
          // Fallback to localStorage if database is not available
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as SystemSettings;
            setSettings({ ...defaultSettings, ...parsed });
          }
        }
      } catch (error) {
        console.error("Failed to load system settings from database:", error);
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as SystemSettings;
            setSettings({ ...defaultSettings, ...parsed });
          }
        } catch (localError) {
          console.error("Failed to load system settings from localStorage:", localError);
        }
      }
      setIsLoading(false);
    };

    loadSettings();
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

  const updateSettings = useCallback(async (newSettings: Partial<SystemSettings>) => {
    const updated = { ...settings, ...newSettings };
    
    // Optimistically update local state
    setSettings(updated);
    
    // Save to localStorage immediately for faster UX
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }

    // Save to database
    try {
      // Update each changed setting in the database
      const entries = Object.entries(newSettings) as [keyof SystemSettings, string][];
      
      for (const [key, value] of entries) {
        const { error } = await supabase
          .from("system_settings")
          .upsert(
            { key, value: String(value), updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        
        if (error) {
          console.error(`Failed to save setting ${key}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to save system settings to database:", error);
    }
  }, [settings]);

  const resetSettings = useCallback(async () => {
    setSettings(defaultSettings);
    
    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }

    // Reset database settings to defaults
    try {
      const entries = Object.entries(defaultSettings) as [keyof SystemSettings, string][];
      
      for (const [key, value] of entries) {
        const { error } = await supabase
          .from("system_settings")
          .upsert(
            { key, value: String(value), updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
        
        if (error) {
          console.error(`Failed to reset setting ${key}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to reset system settings in database:", error);
    }
  }, []);

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
