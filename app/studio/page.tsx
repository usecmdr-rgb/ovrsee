/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { mockMediaItems } from "@/lib/data";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAppState } from "@/context/AppStateContext";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import { useTranslation } from "@/hooks/useTranslation";
import { getLanguageFromLocale } from "@/lib/localization";
import type { ConnectedAccountType } from "@/types";
import { Download, Facebook, Instagram, Maximize2, X, Plus, Trash2, Bold, Italic, Underline, Sparkles, Send, Linkedin, Globe, Check, Loader2, SlidersHorizontal, Wand2, Crop, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, ChevronDown, ChevronUp, Type, Image as ImageIcon, Video, ArrowUp, ArrowDown } from "lucide-react";

const filters = [
  "Soft",
  "Vivid",
  "Monochrome",
  "Vintage",
  "Dramatic",
  "Cool",
  "Warm",
  "Cinematic",
  "B&W",
  "Sepia",
];

type SocialPlatform = "instagram" | "tiktok" | "facebook";

interface SocialMediaPost {
  id: string;
  platform: SocialPlatform;
  postId: string; // Platform-specific post ID
  caption?: string;
  mediaUrl?: string;
  postedAt: string;
  metrics: {
    likes: number;
    comments: number;
    reposts?: number; // For TikTok/Facebook
    retweets?: number; // For Twitter/X if added later
    views: number;
    shares?: number;
    saves?: number; // For Instagram
  };
  lastSyncedAt?: string;
}

interface ConnectedAccount {
  platform: SocialPlatform;
  accountId: string;
  accountName: string;
  connectedAt: string;
  accessToken?: string; // In production, store securely
}

type ShareTargetPayload = {
  connectedAccountId: string;
  caption: string;
};

type ShareRequest = {
  assetId: string; // URL or unique identifier for the image/video
  targets: ShareTargetPayload[];
};
type AdjustmentKey =
  | "brightness"
  | "contrast"
  | "saturation"
  | "warmth"
  | "shadows"
  | "highlights"
  | "zoom";

type EditMode = "adjust" | "filters" | "crop";

type CropAspect = "free" | "square" | "vertical" | "horizontal" | "story" | "post";

type CropState = {
  aspect: CropAspect;
  rotation: number; // degrees
  flipHorizontal: boolean;
  flipVertical: boolean;
};
type OverlayAlignment = "left" | "center" | "right";

type QuickAddSuggestion = {
  id: string;
  label: string; // e.g., "Quick add website URL"
  type: "website" | "phone" | "companyName" | "email" | "location" | "serviceName";
  value: string; // The actual text that will be added as overlay
};

type TextItem = {
  id: string;
  content: string;
  color: string; // HEX format
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  position: { x: number; y: number }; // Percentage-based
  alignment: OverlayAlignment;
  // Text effects
  effectType?: "none" | "glow" | "outline" | "highlight" | "shadow";
  effectColor?: string; // HEX/RGBA for effect
  effectIntensity?: number; // 0–100 (controls blur/strength)
  effectThickness?: number; // px for outline thickness
  highlightPadding?: number; // px padding around text for highlight
  // Metadata
  metaType?: QuickAddSuggestion["type"]; // Track source for Quick Add suggestions
};

type AdjustmentState = Record<AdjustmentKey, number>;

// Multi-asset support types
type StudioAssetType = "image" | "video";

interface VideoEdits {
  trimStartMs: number;
  trimEndMs: number;
  includeInShort: boolean;
}

interface StudioAsset {
  id: string;
  type: StudioAssetType;
  name: string;
  previewUrl: string; // what we show in UI
  sourceFile?: File | null; // optional in frontend only
  edits: {
    adjustments: AdjustmentState;
    filters: string | null;
    textItems: TextItem[];
    crop?: CropState;
    video?: VideoEdits; // for video assets
  };
}

const adjustmentKeys: AdjustmentKey[] = [
  "brightness",
  "contrast",
  "saturation",
  "warmth",
  "shadows",
  "highlights",
  "zoom",
];

const NO_OP_ADJUSTMENTS: AdjustmentState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  shadows: 0,
  highlights: 0,
  zoom: 0,
};

const adjustmentSliderConfig: Record<AdjustmentKey, { label: string; min: number; max: number; step?: number }> = {
  brightness: { label: "Brightness", min: 0, max: 200 },
  contrast: { label: "Contrast", min: 0, max: 200 },
  saturation: { label: "Saturation", min: 0, max: 200 },
  warmth: { label: "Temperature", min: -50, max: 50 },
  shadows: { label: "Shadows", min: -50, max: 50 },
  highlights: { label: "Highlights", min: -50, max: 50 },
  zoom: { label: "Zoom", min: -50, max: 100 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Helper function to compute text item styles with effects
function getTextItemStyle(item: TextItem): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    fontFamily: item.fontFamily,
    fontSize: `${item.fontSize}px`,
    lineHeight: 1.2,
    userSelect: "none",
    color: item.color,
    fontWeight: item.bold ? "bold" : "normal",
    fontStyle: item.italic ? "italic" : "normal",
    textDecoration: item.underline ? "underline" : "none",
  };

  const effectType = item.effectType || "none";
  const effectColor = item.effectColor || "#000000";
  const effectIntensity = item.effectIntensity ?? 50;
  const effectThickness = item.effectThickness ?? 2;
  const highlightPadding = item.highlightPadding ?? 4;

  // Convert HEX to RGBA for effects
  const hexToRgba = (hex: string, alpha: number = 1): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
  };

  // Calculate effect values based on intensity (0-100)
  const blurRadius = (effectIntensity / 100) * 20; // 0-20px blur
  const shadowOpacity = effectIntensity / 100; // 0-1 opacity

  switch (effectType) {
    case "glow": {
      const glowColor = hexToRgba(effectColor, shadowOpacity);
      return {
        ...baseStyle,
        textShadow: `0 0 ${blurRadius}px ${glowColor}, 0 0 ${blurRadius * 1.5}px ${glowColor}`,
      };
    }

    case "outline": {
      const outlineColor = hexToRgba(effectColor, 1);
      // Create outline using multiple text-shadows
      const shadows: string[] = [];
      const steps = Math.max(8, Math.ceil(effectThickness * 2));
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const x = Math.cos(angle) * effectThickness;
        const y = Math.sin(angle) * effectThickness;
        shadows.push(`${x}px ${y}px 0 ${outlineColor}`);
      }
      return {
        ...baseStyle,
        textShadow: shadows.join(", "),
      };
    }

    case "highlight": {
      const highlightColor = hexToRgba(effectColor, shadowOpacity);
      return {
        ...baseStyle,
        backgroundColor: highlightColor,
        padding: `${highlightPadding}px ${highlightPadding * 1.5}px`,
        borderRadius: `${highlightPadding}px`,
        display: "inline-block",
      };
    }

    case "shadow": {
      const shadowColor = hexToRgba(effectColor, shadowOpacity);
      const offsetX = (effectIntensity / 100) * 4; // 0-4px offset
      const offsetY = (effectIntensity / 100) * 4;
      return {
        ...baseStyle,
        textShadow: `${offsetX}px ${offsetY}px ${blurRadius}px ${shadowColor}`,
      };
    }

    case "none":
    default:
      return baseStyle;
  }
}

// Color Picker Component with Circular Wheel
const ColorPicker = ({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isDraggingWheel, setIsDraggingWheel] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const hexToHsl = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 0 };
    
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  };

  const hslToHex = useCallback((h: number, s: number, l: number) => {
    const rgb = hslToRgb(h, s, l);
    return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
  }, []);

  const updateColor = useCallback((newHue: number, newSaturation: number, newLightness: number) => {
    setHue(newHue);
    setSaturation(newSaturation);
    setLightness(newLightness);
    const newHex = hslToHex(newHue, newSaturation, newLightness);
    onChange(newHex);
    setHexInput(newHex);
  }, [hslToHex, onChange]);

  useEffect(() => {
    setHexInput(color);
    const hsl = hexToHsl(color);
    setHue(hsl.h);
    setSaturation(hsl.s);
    setLightness(hsl.l);
  }, [color]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle wheel drag
  useEffect(() => {
    if (!isDraggingWheel) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wheelRef.current) return;
      const canvas = wheelRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const center = canvas.width / 2;
      const scale = 2; // Match the scale used in rendering
      const radius = center - 15 * scale; // Match rendering calculation
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius && distance > 5 * scale) {
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 180;
        const newHue = angle;
        const newSaturation = Math.min((distance / radius) * 100, 100);
        updateColor(newHue, newSaturation, lightness);
      } else if (distance <= radius) {
        // If too close to center, set saturation to 0
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 180;
        updateColor(angle, 0, lightness);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingWheel(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingWheel, lightness, updateColor]);

  // Handle slider drag
  useEffect(() => {
    if (!isDraggingSlider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
      const newLightness = 100 - percentage;
      updateColor(hue, saturation, newLightness);
    };

    const handleMouseUp = () => {
      setIsDraggingSlider(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSlider, hue, saturation, updateColor]);

  useEffect(() => {
    if (!wheelRef.current || !isOpen) return;

    const canvas = wheelRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    // Use higher resolution for better quality
    const displaySize = 200;
    const scale = 2; // Higher resolution
    const size = displaySize * scale;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const center = size / 2;
    const radius = size / 2 - 15 * scale;

    // Enable image smoothing for better edges
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw color wheel with better rendering
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 180;

        if (distance <= radius && distance > 5 * scale) {
          const hue = angle;
          const sat = (distance / radius) * 100;
          const light = 50;
          const hex = hslToHex(hue, sat, light);
          const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          
          if (rgb) {
            const idx = (y * size + x) * 4;
            data[idx] = parseInt(rgb[1], 16);
            data[idx + 1] = parseInt(rgb[2], 16);
            data[idx + 2] = parseInt(rgb[3], 16);
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw center indicator - position it exactly where the color is selected
    // Use the same radius calculation as the wheel rendering
    const wheelRadius = size / 2 - 15 * scale;
    const currentX = center + Math.cos((hue * Math.PI) / 180) * (saturation / 100) * wheelRadius;
    const currentY = center + Math.sin((hue * Math.PI) / 180) * (saturation / 100) * wheelRadius;
    
    // Outer white circle only (no inner black circle)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(currentX, currentY, 8 * scale, 0, 2 * Math.PI);
    ctx.stroke();
  }, [hue, saturation, lightness, isOpen, hslToHex]);

  const handleWheelMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!wheelRef.current) return;
    const canvas = wheelRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const center = canvas.width / 2;
    const scale = 2; // Match the scale used in rendering
    const radius = center - 15 * scale; // Match rendering calculation
    const dx = x - center;
    const dy = y - center;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radius && distance > 5 * scale) {
      setIsDraggingWheel(true);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 180;
      const newHue = angle;
      const newSaturation = Math.min((distance / radius) * 100, 100);
      updateColor(newHue, newSaturation, lightness);
    } else if (distance <= radius) {
      // If too close to center, set saturation to 0
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 180;
      setIsDraggingWheel(true);
      updateColor(angle, 0, lightness);
    }
  };

  const handleSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!sliderRef.current) return;
    setIsDraggingSlider(true);
    const rect = sliderRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
    const newLightness = 100 - percentage;
    updateColor(hue, saturation, newLightness);
  };

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      onChange(value);
      const hsl = hexToHsl(value);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <div
          className="w-6 h-6 rounded border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm flex-1 text-left">{color}</span>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-2 p-6 bg-slate-900 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-6">
            {/* Vertical Lightness Slider */}
            <div className="relative" ref={sliderRef}>
              <div
                className="w-8 h-48 rounded-full cursor-pointer relative overflow-hidden border border-slate-700 select-none"
                style={{
                  background: `linear-gradient(to bottom, 
                    ${hslToHex(hue, saturation, 100)}, 
                    ${hslToHex(hue, saturation, 75)}, 
                    ${hslToHex(hue, saturation, 50)}, 
                    ${hslToHex(hue, saturation, 25)}, 
                    ${hslToHex(hue, saturation, 0)})`,
                }}
                onMouseDown={handleSliderMouseDown}
              >
                <div
                  className="absolute left-0 right-0 w-full pointer-events-none transition-none"
                  style={{
                    top: `${100 - lightness}%`,
                    transform: "translateY(-50%)",
                  }}
                >
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-white ml-auto mr-auto" />
                </div>
              </div>
            </div>

            {/* Color Wheel */}
            <div className="relative">
              <canvas
                ref={wheelRef}
                className="cursor-crosshair rounded-full select-none"
                onMouseDown={handleWheelMouseDown}
              />
            </div>
          </div>

          {/* HEX Input */}
          <div className="mt-4 pt-4 border-t border-slate-700">
            <label className="text-xs font-semibold mb-2 block text-white">HEX Color</label>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value.toUpperCase())}
              placeholder="#FFFFFF"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              pattern="^#[0-9A-F]{6}$"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to build Quick Add suggestions from business info
function buildQuickAddSuggestions(
  businessInfo: {
    website?: string;
    contactPhone?: string;
    businessName?: string;
    contactEmail?: string;
    location?: string;
    serviceName?: string;
  },
  existingTextItems: TextItem[]
): QuickAddSuggestion[] {
  const suggestions: QuickAddSuggestion[] = [];

  // Track which types already exist to avoid duplicates
  const existingTypes = new Set(
    existingTextItems.map((item) => item.metaType).filter(Boolean)
  );

  if (businessInfo.website && businessInfo.website.trim() && !existingTypes.has("website")) {
    suggestions.push({
      id: "quick-add-website",
      label: "Quick add website URL",
      type: "website",
      value: businessInfo.website.trim(),
    });
  }

  if (
    businessInfo.contactPhone &&
    businessInfo.contactPhone.trim() &&
    !existingTypes.has("phone")
  ) {
    suggestions.push({
      id: "quick-add-phone",
      label: "Quick add phone number",
      type: "phone",
      value: businessInfo.contactPhone.trim(),
    });
  }

  if (
    businessInfo.businessName &&
    businessInfo.businessName.trim() &&
    !existingTypes.has("companyName")
  ) {
    suggestions.push({
      id: "quick-add-company",
      label: "Quick add company name",
      type: "companyName",
      value: businessInfo.businessName.trim(),
    });
  }

  if (
    businessInfo.contactEmail &&
    businessInfo.contactEmail.trim() &&
    !existingTypes.has("email")
  ) {
    suggestions.push({
      id: "quick-add-email",
      label: "Quick add email",
      type: "email",
      value: businessInfo.contactEmail.trim(),
    });
  }

  if (
    businessInfo.location &&
    businessInfo.location.trim() &&
    !existingTypes.has("location")
  ) {
    suggestions.push({
      id: "quick-add-location",
      label: "Quick add location",
      type: "location",
      value: businessInfo.location.trim(),
    });
  }

  if (
    businessInfo.serviceName &&
    businessInfo.serviceName.trim() &&
    !existingTypes.has("serviceName")
  ) {
    suggestions.push({
      id: "quick-add-service",
      label: "Quick add service name",
      type: "serviceName",
      value: businessInfo.serviceName.trim(),
    });
  }

  return suggestions;
}

// Share Modal Component
interface MuShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetUrl: string | null;
  assetName?: string;
  previewFilter?: string;
  previewTransform?: string;
  cropAspectRatio?: string;
}

function MuShareModal({ isOpen, onClose, assetUrl, assetName, previewFilter, previewTransform, cropAspectRatio }: MuShareModalProps) {
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<ConnectedAccountType | null>(null);

  const {
    accounts,
    isLoading: accountsLoading,
    error: accountsError,
    connectAccount,
  } = useConnectedAccounts();

  useEffect(() => {
    if (!isOpen) {
      setSelectedTargets(new Set());
      setCaptions({});
      setError(null);
      setConnectingPlatform(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedTargets((prev) => {
      const connectedIds = new Set(accounts.filter((a) => a.isConnected).map((a) => a.id));
      const next = new Set(Array.from(prev).filter((id) => connectedIds.has(id)));
      return next;
    });
    setCaptions((prev) => {
      const connectedIds = new Set(accounts.filter((a) => a.isConnected).map((a) => a.id));
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (connectedIds.has(key)) {
          next[key] = value;
        }
      });
      return next;
    });
  }, [accounts]);

  const getPlatformIcon = (type: ConnectedAccountType) => {
    switch (type) {
      case "instagram":
        return <Instagram className="h-5 w-5" />;
      case "facebook":
        return <Facebook className="h-5 w-5" />;
      case "x":
        return <X className="h-5 w-5" />;
      case "linkedin":
        return <Linkedin className="h-5 w-5" />;
      case "website":
        return <Globe className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const handleToggleTarget = (accountId: string, isConnected: boolean) => {
    if (!isConnected) return;
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleConnectAccount = async (type: ConnectedAccountType) => {
    try {
      setConnectingPlatform(type);
      setError(null);
      await connectAccount(type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect the selected platform.");
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleShare = async () => {
    if (selectedTargets.size === 0 || !assetUrl) {
      setError("Please select at least one platform to share to.");
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const shareRequest: ShareRequest = {
        assetId: assetUrl,
        targets: Array.from(selectedTargets).map((accountId) => ({
          connectedAccountId: accountId,
          caption: captions[accountId] ?? "",
        })),
      };

      // Call API - placeholder for now
      await sharePost(shareRequest);

      // Success - close modal and reset state
      onClose();
      setSelectedTargets(new Set());
      setCaptions({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share post. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCaptionChange = (accountId: string, value: string) => {
    setCaptions((prev) => ({ ...prev, [accountId]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-50 w-full max-w-4xl max-h-[90vh] mx-4 bg-white rounded-3xl shadow-xl dark:bg-slate-900 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold">Share Post</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
            disabled={isSharing}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
            {/* Left: Preview */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preview</h3>
              {assetUrl ? (
                <div 
                  className="share-preview-container rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative"
                  style={{ aspectRatio: cropAspectRatio || "16/9", minHeight: "200px" }}
                >
                  <img
                    key={`${assetUrl}-${Date.now()}`}
                    src={assetUrl}
                    alt="Share preview"
                    className="h-full w-full object-contain"
                    style={{
                      ...(previewFilter && { filter: previewFilter }),
                      ...(previewTransform && { transform: previewTransform }),
                      transformOrigin: "center center",
                    }}
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
                  No preview available
                </div>
              )}
              {assetName && (
                <p className="text-xs text-slate-500 truncate">{assetName}</p>
              )}
            </div>

            {/* Right: Platforms & Captions */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Select Platforms</h3>
              {accountsLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  Loading connected accounts…
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-slate-600 dark:text-slate-400">
                          {getPlatformIcon(account.type)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold capitalize">{account.type === "x" ? "X (Twitter)" : account.type}</p>
                          <p className="text-xs text-slate-500">{account.displayName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {account.isConnected ? (
                          <>
                            <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                            <button
                              type="button"
                              onClick={() => handleToggleTarget(account.id, account.isConnected)}
                              className={`flex items-center justify-center w-6 h-6 rounded border-2 transition ${
                                selectedTargets.has(account.id)
                                  ? "bg-slate-900 border-slate-900 dark:bg-white dark:border-white"
                                  : "border-slate-300 dark:border-slate-600"
                              }`}
                              disabled={isSharing}
                            >
                              {selectedTargets.has(account.id) && (
                                <Check className="h-4 w-4 text-white dark:text-slate-900" />
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConnectAccount(account.type)}
                            className={`text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1 ${
                              connectingPlatform === account.type ? "opacity-60" : ""
                            }`}
                            disabled={isSharing || connectingPlatform === account.type}
                          >
                            {connectingPlatform === account.type ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Connecting…
                              </>
                            ) : (
                              "Connect"
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Caption field - only show if selected and connected */}
                    {selectedTargets.has(account.id) && account.isConnected && (
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                          Caption for {account.type === "x" ? "X" : account.type}
                        </label>
                        <textarea
                          value={captions[account.id] ?? ""}
                          onChange={(e) => handleCaptionChange(account.id, e.target.value)}
                          placeholder={`Write a caption for ${account.displayName}...`}
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-3 text-sm focus:border-slate-900 dark:focus:border-white focus:outline-none resize-none"
                          disabled={isSharing}
                        />
                      </div>
                    )}
                  </div>
                  ))}
                  {accounts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                      No platforms available yet. Connect an account to start sharing.
                    </div>
                  )}
                </div>
              )}

              {(error || accountsError) && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error || accountsError}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={isSharing}
            className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing || selectedTargets.size === 0 || !assetUrl}
            className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSharing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Share
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// API helper function - placeholder for real implementation
async function sharePost(request: ShareRequest): Promise<void> {
  // In production, this would call: POST /api/share
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate API call
      if (Math.random() > 0.1) {
        // 90% success rate for demo
        resolve();
      } else {
        reject(new Error("Network error. Please try again."));
      }
    }, 2000);
  });
}

// MuAnalyticsPanel Component
function MuAnalyticsPanel({
  mediaItems,
  connectedSocials,
  fetchingMetrics,
  handlePostToSocial,
  syncAllMetrics,
  socialMediaPosts,
  connectedAccounts,
  onRefreshMetrics,
}: {
  mediaItems: typeof mockMediaItems;
  connectedSocials: Record<SocialPlatform, boolean>;
  fetchingMetrics: Record<string, boolean>;
  handlePostToSocial: (mediaId: string, platform: SocialPlatform) => Promise<void>;
  syncAllMetrics: (mediaId: string) => Promise<void>;
  socialMediaPosts: SocialMediaPost[];
  connectedAccounts: ConnectedAccount[];
  onRefreshMetrics: (platform: SocialPlatform) => Promise<SocialMediaPost[]>;
}) {
  const { stats, loading, error } = useAgentStats();
  const fallbackStats = {
    ...emptyAgentStats,
    mu_media_edits: 124,
  };
  const latestStats = stats ?? fallbackStats;
  const noStats = !stats && !loading && !error;

  // Calculate totals from social media posts
  const totalLikes = socialMediaPosts.reduce((sum, post) => sum + post.metrics.likes, 0);
  const totalComments = socialMediaPosts.reduce((sum, post) => sum + post.metrics.comments, 0);
  const totalViews = socialMediaPosts.reduce((sum, post) => sum + post.metrics.views, 0);
  const totalReposts = socialMediaPosts.reduce((sum, post) => sum + (post.metrics.reposts || 0), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Total Edits</p>
            <p className="text-3xl font-semibold">{latestStats.mu_media_edits}</p>
            {loading && <p className="text-xs text-slate-400 mt-1">Loading...</p>}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Total Posts</p>
            <p className="text-3xl font-semibold">{socialMediaPosts.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Total Views</p>
            <p className="text-3xl font-semibold">{totalViews.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Total Likes</p>
            <p className="text-3xl font-semibold">{totalLikes.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Total Comments</p>
            <p className="text-3xl font-semibold">{totalComments.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {connectedAccounts.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-lg font-semibold mb-4">Connected Accounts</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {connectedAccounts.map((account) => {
              const platformIcon = account.platform === "instagram" ? <Instagram className="h-5 w-5" /> :
                                 account.platform === "tiktok" ? <div className="w-5 h-5 bg-black rounded" /> :
                                 <Facebook className="h-5 w-5" />;
              const postsCount = socialMediaPosts.filter(p => p.platform === account.platform).length;
              return (
                <div
                  key={account.accountId}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center gap-3 mb-2">
                    {platformIcon}
                    <div className="flex-1">
                      <p className="font-semibold text-sm capitalize">{account.platform}</p>
                      <p className="text-xs text-slate-500">{account.accountName}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500">Posts tracked: {postsCount}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Posts & Interactions</h3>
          {connectedAccounts.length > 0 && (
            <button
              onClick={async () => {
                for (const account of connectedAccounts) {
                  await onRefreshMetrics(account.platform);
                }
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Refresh All
            </button>
          )}
        </div>
        {socialMediaPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
            <p className="text-sm text-slate-500">
              {connectedAccounts.length === 0
                ? "Connect social media accounts to see post analytics"
                : "No posts found. Posts will appear here once you start posting."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {socialMediaPosts
              .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
              .map((post) => {
                const platformIcon = post.platform === "instagram" ? <Instagram className="h-4 w-4" /> :
                                   post.platform === "tiktok" ? <div className="w-4 h-4 bg-black rounded" /> :
                                   <Facebook className="h-4 w-4" />;
                return (
                  <div
                    key={post.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {platformIcon}
                          <p className="font-semibold text-sm capitalize">{post.platform}</p>
                          {post.lastSyncedAt && (
                            <span className="text-[10px] text-slate-400">
                              • Synced {new Date(post.lastSyncedAt).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        {post.caption && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {post.caption}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(post.postedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => onRefreshMetrics(post.platform)}
                        className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        title="Refresh metrics"
                      >
                        ↻
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Likes</p>
                        <p className="text-sm font-semibold mt-1">{post.metrics.likes.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Comments</p>
                        <p className="text-sm font-semibold mt-1">{post.metrics.comments.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Views</p>
                        <p className="text-sm font-semibold mt-1">{post.metrics.views.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">
                          {post.metrics.reposts !== undefined ? "Reposts" : post.metrics.saves !== undefined ? "Saves" : "Shares"}
                        </p>
                        <p className="text-sm font-semibold mt-1">
                          {(post.metrics.reposts || post.metrics.saves || post.metrics.shares || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h3 className="text-lg font-semibold mb-4">Trends</h3>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-sm text-slate-500">
            Analytics charts and trends will be displayed here once data is available.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Recent media</h3>
        </div>
        <ul className="mt-3 space-y-3 text-sm">
          {mediaItems.map((item) => {
            const isPostedToInstagram = item.postedTo?.some((p) => p.platform === "instagram");
            const isPostedToTikTok = item.postedTo?.some((p) => p.platform === "tiktok");
            const isPostedToFacebook = item.postedTo?.some((p) => p.platform === "facebook");
            const isFetching = Object.keys(fetchingMetrics).some((key) => key.startsWith(`${item.id}_`));

            return (
              <li key={item.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold">{item.filename}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.updatedAt}</p>
                    {item.metricsLastUpdated && (
                      <p className="text-xs text-slate-400 mt-1">
                        Metrics updated: {new Date(item.metricsLastUpdated).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <span className="text-xs uppercase tracking-wide text-slate-500 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    {item.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3 mb-3 flex-wrap">
                  <span className="text-xs text-slate-500">Post to:</span>
                  <button
                    onClick={() => handlePostToSocial(item.id, "instagram")}
                    disabled={!connectedSocials.instagram || isPostedToInstagram}
                    className={`text-xs px-2 py-1 rounded-full transition ${
                      isPostedToInstagram
                        ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white"
                        : connectedSocials.instagram
                        ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        : "border border-slate-200 opacity-50 cursor-not-allowed dark:border-slate-700"
                    }`}
                  >
                    <Instagram size={12} className="inline mr-1" />
                    Instagram
                  </button>
                  <button
                    onClick={() => handlePostToSocial(item.id, "tiktok")}
                    disabled={!connectedSocials.tiktok || isPostedToTikTok}
                    className={`text-xs px-2 py-1 rounded-full transition ${
                      isPostedToTikTok
                        ? "bg-black text-white"
                        : connectedSocials.tiktok
                        ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        : "border border-slate-200 opacity-50 cursor-not-allowed dark:border-slate-700"
                    }`}
                  >
                    TikTok
                  </button>
                  <button
                    onClick={() => handlePostToSocial(item.id, "facebook")}
                    disabled={!connectedSocials.facebook || isPostedToFacebook}
                    className={`text-xs px-2 py-1 rounded-full transition ${
                      isPostedToFacebook
                        ? "bg-blue-600 text-white"
                        : connectedSocials.facebook
                        ? "border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        : "border border-slate-200 opacity-50 cursor-not-allowed dark:border-slate-700"
                    }`}
                  >
                    <Facebook size={12} className="inline mr-1" />
                    Facebook
                  </button>
                  {item.postedTo && item.postedTo.length > 0 && (
                    <button
                      onClick={() => syncAllMetrics(item.id)}
                      disabled={isFetching}
                      className="text-xs px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isFetching ? "Syncing..." : "Sync Metrics"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Impressions</p>
                    <p className="text-sm font-semibold mt-1">{item.impressions?.toLocaleString() || "0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Likes</p>
                    <p className="text-sm font-semibold mt-1">{item.likes?.toLocaleString() || "0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Reposts</p>
                    <p className="text-sm font-semibold mt-1">{item.reposts?.toLocaleString() || "0"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Comments</p>
                    <p className="text-sm font-semibold mt-1">{item.comments?.toLocaleString() || "0"}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// Apple Photos-style Mode Toolbar
function StudioModeToolbar({
  activeMode,
  onModeChange,
}: {
  activeMode: EditMode;
  onModeChange: (mode: EditMode) => void;
}) {
  const modes: { id: EditMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
    { id: "filters", label: "Filters", icon: Wand2 },
    { id: "crop", label: "Crop", icon: Crop },
  ];

  return (
    <div className="flex items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onModeChange(mode.id)}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition ${
              isActive
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Simple Section Component (non-collapsible) with Icon
function SimpleSection({
  title,
  icon: Icon,
  children,
  tooltip,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div
        className="w-full flex items-center p-3 border-b border-slate-100 dark:border-slate-700"
        title={tooltip || title}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Collapsible Section Component with Icon and Tooltip (kept for video/shorts sections)
function CollapsibleSection({
  id,
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
  tooltip,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        title={tooltip || title}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {isExpanded && <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-700">{children}</div>}
    </div>
  );
}

// Adjust Panel with Icon Tooltips
function StudioAdjustPanel({
  adjustments,
  selectedAdjustment,
  onAdjustmentChange,
  onSelectedAdjustmentChange,
  showAdvanced,
  onToggleAdvanced,
  onReset,
  isAtNoOp,
  hasImage,
}: {
  adjustments: AdjustmentState;
  selectedAdjustment: AdjustmentKey;
  onAdjustmentChange: (key: AdjustmentKey, value: number) => void;
  onSelectedAdjustmentChange: (key: AdjustmentKey) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onReset: () => void;
  isAtNoOp: boolean;
  hasImage: boolean;
}) {
  const primaryAdjustments: AdjustmentKey[] = ["brightness", "contrast", "saturation", "warmth"];
  const advancedAdjustments: AdjustmentKey[] = ["shadows", "highlights", "zoom"];

  const adjustmentIcons: Record<AdjustmentKey, { icon: string; label: string }> = {
    brightness: { icon: "☀️", label: "Brightness" },
    contrast: { icon: "◐", label: "Contrast" },
    saturation: { icon: "🎨", label: "Saturation" },
    warmth: { icon: "🌡️", label: "Temperature" },
    shadows: { icon: "🌑", label: "Shadows" },
    highlights: { icon: "☀️", label: "Highlights" },
    zoom: { icon: "🔍", label: "Zoom" },
  };

  const currentSlider = adjustmentSliderConfig[selectedAdjustment];
  const currentValue = adjustments[selectedAdjustment];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold">Adjust</h3>
        <button
          type="button"
          onClick={onReset}
          disabled={isAtNoOp || !hasImage}
          className={`text-xs font-medium rounded-full px-2 py-1 border transition ${
            isAtNoOp || !hasImage
              ? "text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
              : "text-slate-700 border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          Reset
        </button>
      </div>

      {/* Icon buttons row */}
      <div className="flex items-center justify-center gap-1.5">
        {primaryAdjustments.map((key) => {
          const isActive = selectedAdjustment === key;
          const config = adjustmentIcons[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectedAdjustmentChange(key)}
              className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 min-w-[50px] transition ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
              title={config.label}
            >
              <span className="text-base">{config.icon}</span>
              <span className="text-[9px] font-medium">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Single main slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium">
            {adjustmentSliderConfig[selectedAdjustment].label}
          </span>
          <span className="text-[10px] text-slate-500">{currentValue}</span>
        </div>
        <input
          type="range"
          min={currentSlider.min}
          max={currentSlider.max}
          step={currentSlider.step ?? 1}
          value={currentValue}
          onChange={(e) => onAdjustmentChange(selectedAdjustment, Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
          style={{
            background: `linear-gradient(to right, #0f172a 0%, #0f172a ${((currentValue - currentSlider.min) / (currentSlider.max - currentSlider.min)) * 100}%, #e2e8f0 ${((currentValue - currentSlider.min) / (currentSlider.max - currentSlider.min)) * 100}%, #e2e8f0 100%)`,
          }}
        />
      </div>

      {/* Advanced section */}
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center justify-between w-full text-[10px] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition"
      >
        <span className="font-medium">Advanced</span>
        {showAdvanced ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {showAdvanced && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
          {advancedAdjustments.map((key) => {
            const slider = adjustmentSliderConfig[key];
            const value = adjustments[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium">{slider.label}</span>
                  <span className="text-[10px] text-slate-500">{value}</span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step ?? 1}
                  value={value}
                  onChange={(e) => onAdjustmentChange(key, Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Apple Photos-style Filters Panel
function StudioFiltersPanel({
  filters,
  selectedFilter,
  onFilterSelect,
}: {
  filters: string[];
  selectedFilter: string | null;
  onFilterSelect: (filter: string | null) => void;
}) {
  const filterIcons: Record<string, string> = {
    "Soft": "✨",
    "Vivid": "🌈",
    "Monochrome": "⚫",
    "Vintage": "📷",
    "Dramatic": "🎭",
    "Cool": "❄️",
    "Warm": "🔥",
    "Cinematic": "🎬",
    "B&W": "⚪",
    "Sepia": "🟤",
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold">Filters</h3>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onFilterSelect(null)}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg p-3 border transition ${
            selectedFilter === null
              ? "border-slate-900 bg-slate-100 text-slate-900 dark:border-white dark:bg-slate-700 dark:text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <span className="text-lg">⚪</span>
          <span className="text-[9px] font-medium">None</span>
        </button>
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onFilterSelect(selectedFilter === filter ? null : filter)}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg p-3 border transition ${
              selectedFilter === filter
                ? "border-slate-900 bg-slate-100 text-slate-900 dark:border-white dark:bg-slate-700 dark:text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <span className="text-lg">{filterIcons[filter] || "🎨"}</span>
            <span className="text-[9px] font-medium">{filter}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Aspect Ratio Selector Component
interface AspectRatioOption {
  value: CropAspect;
  label: string;
  ratio: string;
  description: string;
  platforms: string;
  recommended?: boolean;
  icon: React.ReactNode;
}

function AspectRatioSelector({
  cropState,
  onCropStateChange,
}: {
  cropState: CropState;
  onCropStateChange: (updates: Partial<CropState>) => void;
}) {
  const aspectRatioOptions: AspectRatioOption[] = [
    {
      value: "square",
      label: "Square",
      ratio: "1:1",
      description: "Best for Instagram & Facebook posts",
      platforms: "Instagram, Facebook posts",
      icon: (
        <div className="relative w-12 h-12 border-2 border-slate-700 dark:border-slate-300 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-800">
          <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">1:1</span>
        </div>
      ),
    },
    {
      value: "vertical",
      label: "Vertical",
      ratio: "9:16",
      description: "Best for Reels, TikTok, Shorts",
      platforms: "TikTok, Reels, YouTube Shorts",
      recommended: true,
      icon: (
        <div className="relative w-9 h-14 border-2 border-slate-700 dark:border-slate-300 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-800">
          <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">9:16</span>
        </div>
      ),
    },
    {
      value: "story",
      label: "Portrait",
      ratio: "4:5",
      description: "Best for Instagram feed",
      platforms: "Instagram feed",
      icon: (
        <div className="relative border-2 border-slate-700 dark:border-slate-300 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-800" style={{ width: '40px', height: '50px' }}>
          <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">4:5</span>
        </div>
      ),
    },
    {
      value: "horizontal",
      label: "Landscape",
      ratio: "16:9",
      description: "Wide format — users may rotate",
      platforms: "YouTube, cinematic shots",
      icon: (
        <div className="relative w-14 h-9 border-2 border-slate-700 dark:border-slate-300 rounded flex items-center justify-center bg-slate-50 dark:bg-slate-800">
          <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">16:9</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {aspectRatioOptions.map((option) => {
          const isSelected = cropState.aspect === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onCropStateChange({ aspect: option.value })}
              className={`relative rounded-xl border-2 p-2.5 text-center transition-all ${
                isSelected
                  ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
              }`}
              title={option.platforms}
            >
              {option.recommended && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
              <div className="flex flex-col items-center gap-2">
                {option.icon}
                <div className="w-full">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                    {option.label}
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight line-clamp-2">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Apple Photos-style Crop Panel
function StudioCropPanel({
  cropState,
  onCropStateChange,
}: {
  cropState: CropState;
  onCropStateChange: (updates: Partial<CropState>) => void;
}) {

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-sm font-semibold mb-4">Crop & Rotate</h3>

      {/* Rotate and Flip buttons */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <button
          type="button"
          onClick={() => onCropStateChange({ rotation: (cropState.rotation - 90) % 360 })}
          className="flex flex-col items-center justify-center gap-1 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
          title="Rotate left 90°"
        >
          <RotateCcw className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400">Left</span>
        </button>
        <button
          type="button"
          onClick={() => onCropStateChange({ rotation: (cropState.rotation + 90) % 360 })}
          className="flex flex-col items-center justify-center gap-1 rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
          title="Rotate right 90°"
        >
          <RotateCw className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400">Right</span>
        </button>
        <button
          type="button"
          onClick={() => onCropStateChange({ flipHorizontal: !cropState.flipHorizontal })}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg p-3 transition border ${
            cropState.flipHorizontal
              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
          title="Flip horizontally (mirror)"
        >
          <FlipHorizontal className="h-5 w-5" />
          <span className="text-[9px] font-medium">Flip H</span>
        </button>
        <button
          type="button"
          onClick={() => onCropStateChange({ flipVertical: !cropState.flipVertical })}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg p-3 transition border ${
            cropState.flipVertical
              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
          title="Flip vertically"
        >
          <FlipVertical className="h-5 w-5" />
          <span className="text-[9px] font-medium">Flip V</span>
        </button>
      </div>


      {/* TODO: Apply crop transforms to image preview */}
      {(cropState.rotation !== 0 || cropState.flipHorizontal || cropState.flipVertical) && (
        <p className="text-[10px] text-slate-500 text-center">
          💡 Crop transforms will be applied
        </p>
      )}
    </div>
  );
}

export default function StudioPage() {
  const { hasAccess, isLoading: accessLoading } = useAgentAccess("studio");
  const [activeTab, setActiveTab] = useState<"edit" | "analytics">("edit");
  const { businessInfo, language } = useAppState();
  const { stats, loading, error } = useAgentStats();
  const t = useTranslation();
  
  // Wait for access to be determined before showing stats to prevent flashing
  const isAccessReady = !accessLoading;
  
  // Use preview/mock data if user doesn't have access (only after access check is complete)
  const isPreview = isAccessReady && !hasAccess;
  
  // Fallback to realistic random numbers if no stats available or in preview mode
  // Only show fallback stats when access check is complete to prevent number flashing
  const fallbackStats = useMemo(() => {
    if (!isAccessReady) {
      // Return empty stats while loading to prevent flash
      return emptyAgentStats;
    }
    return {
      ...emptyAgentStats,
      mu_media_edits: isPreview ? 87 : 124,
    };
  }, [isPreview, isAccessReady]);
  
  const latestStats = stats ?? fallbackStats;
  const noStats = !stats && !loading && !error;
  
  const agentConfig = AGENT_BY_ID["studio"];
  const [selectedMediaName, setSelectedMediaName] = useState<string>(mockMediaItems[0]?.filename ?? "");
  const [customFilenames, setCustomFilenames] = useState<Record<string, string>>({});
  // Multi-asset state
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [muMessages, setMuMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [muInput, setMuInput] = useState("");
  const [muLoading, setMuLoading] = useState(false);
  const [muRecommendedFilters, setMuRecommendedFilters] = useState<string[]>([]);
  const [selectedTextItemId, setSelectedTextItemId] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingTextItemId, setDraggingTextItemId] = useState<string | null>(null);
  const [textOverlayEnabled, setTextOverlayEnabled] = useState(true);
  const [connectedSocials, setConnectedSocials] = useState<Record<SocialPlatform, boolean>>({
    instagram: false,
    tiktok: false,
    facebook: false,
  });
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [socialMediaPosts, setSocialMediaPosts] = useState<SocialMediaPost[]>([]);
  const [activityLog, setActivityLog] = useState<Array<{ role: "agent" | "user"; text: string }>>([]);
  const [activeMode, setActiveMode] = useState<EditMode>("adjust");
  const [selectedAdjustment, setSelectedAdjustment] = useState<AdjustmentKey>("brightness");
  const [showAdvancedAdjustments, setShowAdvancedAdjustments] = useState(false);
  // Shorts composition state (for video assets)
  const [shortsComposition, setShortsComposition] = useState<string[]>([]); // Array of asset IDs in order
  const [mediaItems, setMediaItems] = useState(mockMediaItems);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    adjust: true,
    filters: false,
    crop: false,
    text: true,
  });
  const [fetchingMetrics, setFetchingMetrics] = useState<Record<string, boolean>>({});
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Derived state: get active asset
  const activeAsset = useMemo(() => {
    return assets.find(a => a.id === activeAssetId) || null;
  }, [assets, activeAssetId]);

  // Derived state: get edits from active asset
  const adjustments = useMemo(() => {
    return activeAsset?.edits.adjustments || { ...NO_OP_ADJUSTMENTS };
  }, [activeAsset]);

  const selectedFilter = useMemo(() => {
    return activeAsset?.edits.filters || null;
  }, [activeAsset]);

  const textItems = useMemo(() => {
    return activeAsset?.edits.textItems || [];
  }, [activeAsset]);

  const cropState = useMemo(() => {
    return activeAsset?.edits.crop || {
      aspect: "vertical" as CropAspect, // Default to recommended 9:16
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    };
  }, [activeAsset]);

  // Helper function to update active asset edits
  const updateActiveAssetEdits = useCallback((
    updater: (edits: StudioAsset["edits"]) => StudioAsset["edits"]
  ) => {
    if (!activeAssetId) return;
    setAssets(prev =>
      prev.map(asset =>
        asset.id === activeAssetId
          ? { ...asset, edits: updater(asset.edits) }
          : asset
      )
    );
  }, [activeAssetId]);

  // Helper to add a new asset from file
  const addAssetFromFile = async (file: File) => {
    const assetType: StudioAssetType = file.type.startsWith("video/") ? "video" : "image";
    const previewUrl = URL.createObjectURL(file);
    const assetId = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newAsset: StudioAsset = {
      id: assetId,
      type: assetType,
      name: file.name,
      previewUrl,
      sourceFile: file,
      edits: {
        adjustments: { ...NO_OP_ADJUSTMENTS },
        filters: null,
        textItems: [],
        crop: {
          aspect: "vertical", // Default to recommended 9:16
          rotation: 0,
          flipHorizontal: false,
          flipVertical: false,
        },
        ...(assetType === "video" ? {
          video: {
            trimStartMs: 0,
            trimEndMs: 0, // Will be set to video duration
            includeInShort: false,
          }
        } : {}),
      },
    };

    setAssets(prev => [...prev, newAsset]);
    setActiveAssetId(assetId);
  };

  // Helper to remove an asset
  const removeAsset = (assetId: string) => {
    setAssets(prev => {
      const asset = prev.find(a => a.id === assetId);
      if (asset?.previewUrl) {
        URL.revokeObjectURL(asset.previewUrl);
      }
      const newAssets = prev.filter(a => a.id !== assetId);
      // If we removed the active asset, select the first remaining one or null
      if (activeAssetId === assetId) {
        setActiveAssetId(newAssets.length > 0 ? newAssets[0].id : null);
      }
      return newAssets;
    });
    // Remove from shorts composition if present
    setShortsComposition(prev => prev.filter(id => id !== assetId));
  };

  // Apply active image edits to all images
  const applyActiveEditsToAllImages = () => {
    const active = assets.find(a => a.id === activeAssetId && a.type === "image");
    if (!active) return;
    
    setAssets(prev =>
      prev.map(asset =>
        asset.type === "image"
          ? { ...asset, edits: { ...asset.edits, ...active.edits } }
          : asset
      )
    );
  };

  const handleResetAdjustments = () => {
    updateActiveAssetEdits(edits => ({
      ...edits,
      adjustments: { ...NO_OP_ADJUSTMENTS },
      filters: null,
    }));
  };

  const selectedTextItem = useMemo(() => {
    return textItems.find((item) => item.id === selectedTextItemId) || null;
  }, [textItems, selectedTextItemId]);

  const addTextItem = () => {
    const newId = Date.now().toString();
    const newItem: TextItem = {
      id: newId,
      content: "", // Start with empty content - user will type
      color: "#FFFFFF",
      fontFamily: "Inter, sans-serif",
      fontSize: 32,
      bold: false,
      italic: false,
      underline: false,
      position: { x: 50, y: 50 },
      alignment: "center",
      effectType: "none",
      effectColor: "#000000",
      effectIntensity: 50,
      effectThickness: 2,
      highlightPadding: 4,
    };
    updateActiveAssetEdits(edits => ({
      ...edits,
      textItems: [...edits.textItems, newItem],
    }));
    setSelectedTextItemId(newId);
    // Auto-focus the textarea after a brief delay to ensure it's rendered
    setTimeout(() => {
      textAreaRef.current?.focus();
    }, 100);
  };

  const deleteTextItem = (id: string) => {
    updateActiveAssetEdits(edits => ({
      ...edits,
      textItems: edits.textItems.filter(item => item.id !== id),
    }));
    if (selectedTextItemId === id) {
      const remaining = textItems.filter((item) => item.id !== id);
      setSelectedTextItemId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const updateTextItem = useCallback((id: string, updates: Partial<TextItem>) => {
    updateActiveAssetEdits(edits => ({
      ...edits,
      textItems: edits.textItems.map(item => (item.id === id ? { ...item, ...updates } : item)),
    }));
  }, [updateActiveAssetEdits]);

  // Build Quick Add suggestions from business info
  const quickAddSuggestions = useMemo(() => {
    return buildQuickAddSuggestions(businessInfo, textItems);
  }, [businessInfo, textItems]);

  // Handle Quick Add chip click
  const handleQuickAddClick = (suggestion: QuickAddSuggestion) => {
    const newId = Date.now().toString();
    
    // Determine initial position based on type (stagger them to avoid overlap)
    const positionMap: Record<QuickAddSuggestion["type"], { x: number; y: number }> = {
      website: { x: 50, y: 75 },
      phone: { x: 50, y: 80 },
      companyName: { x: 50, y: 20 },
      email: { x: 50, y: 85 },
      location: { x: 50, y: 25 },
      serviceName: { x: 50, y: 30 },
    };
    
    const initialPosition = positionMap[suggestion.type] || { x: 50, y: 50 };
    
    const newItem: TextItem = {
      id: newId,
      content: suggestion.value,
      color: "#FFFFFF",
      fontFamily: "Inter, sans-serif",
      fontSize: 32,
      bold: false,
      italic: false,
      underline: false,
      position: initialPosition,
      alignment: "center",
      effectType: "none",
      effectColor: "#000000",
      effectIntensity: 50,
      effectThickness: 2,
      highlightPadding: 4,
      metaType: suggestion.type, // Track source
    };
    
    updateActiveAssetEdits(edits => ({
      ...edits,
      textItems: [...edits.textItems, newItem],
    }));
    setSelectedTextItemId(newId);
  };

  const handleTextDragStart = (e: React.MouseEvent<HTMLDivElement>, itemId: string) => {
    if (!textOverlayEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDraggingTextItemId(itemId);
    const previewContainer = e.currentTarget.closest('[data-preview-container]') as HTMLElement;
    if (previewContainer) {
      const rect = previewContainer.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      updateTextItem(itemId, {
        position: {
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
        },
      });
    }
  };

  const handleTextDragEnd = () => {
    setIsDragging(false);
    setDraggingTextItemId(null);
  };

  useEffect(() => {
    if (isDragging && draggingTextItemId) {
      const handleMouseMove = (e: MouseEvent) => {
        const previewContainer = document.querySelector('[data-preview-container]') as HTMLElement;
        if (previewContainer) {
          const rect = previewContainer.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          updateTextItem(draggingTextItemId, {
            position: {
              x: Math.max(0, Math.min(100, x)),
              y: Math.max(0, Math.min(100, y)),
            },
          });
        }
      };
      const handleMouseUp = () => {
        setIsDragging(false);
        setDraggingTextItemId(null);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, draggingTextItemId, updateTextItem]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Disable in preview mode
    if (isPreview) {
      setMuMessages((prev) => [
        ...prev,
        { role: "assistant", content: "File upload is disabled in preview mode. Upgrade to Advanced or Elite tier to unlock full Studio agent features." },
      ]);
      event.target.value = "";
      return;
    }
    
    // Handle multiple files
    for (let i = 0; i < files.length; i++) {
      await addAssetFromFile(files[i]);
    }
    
    // Reset file input
    event.target.value = "";
  };

  useEffect(() => {
    return () => {
      // Clean up all asset preview URLs on unmount
      assets.forEach(asset => {
        if (asset.previewUrl && asset.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(asset.previewUrl);
        }
      });
    };
  }, [assets]);

  // DISABLED: Old text-parsing logic replaced by OpenAI tool calls
  // const applyMuCommandFromText = (text: string) => {
  //   const lower = text.toLowerCase();
  //   let delta = 0;

  //   if (
  //     lower.includes("brighter") ||
  //     lower.includes("increase brightness") ||
  //     lower.includes("add brightness") ||
  //     lower.includes("more bright")
  //   ) {
  //     delta = 10;
  //   } else if (
  //     lower.includes("darker") ||
  //     lower.includes("reduce brightness") ||
  //     lower.includes("lower brightness") ||
  //     lower.includes("less bright")
  //   ) {
  //     delta = -10;
  //   }

  //   if (delta !== 0) {
  //     setAdjustments((prev) => ({
  //       ...prev,
  //       brightness: clamp(prev.brightness + delta, 0, 200),
  //     }));
  //   }
  // };

  const shadowFactor = 1 + (adjustments.shadows / 100) * 0.2;
  const highlightFactor = 1 + (adjustments.highlights / 100) * 0.2;
  const computedBrightness = clamp(adjustments.brightness * shadowFactor * highlightFactor, 0, 400);
  const presetFilter =
    selectedFilter === "Monochrome" || selectedFilter === "B&W"
      ? "grayscale(100%)"
      : selectedFilter === "Sepia"
      ? "sepia(100%)"
      : selectedFilter === "Vintage"
      ? "sepia(50%) contrast(110%) brightness(90%)"
      : selectedFilter === "Dramatic"
      ? "contrast(150%) saturate(120%)"
      : selectedFilter === "Cool"
      ? "brightness(95%) saturate(80%)"
      : selectedFilter === "Warm"
      ? "brightness(105%) saturate(120%) sepia(20%)"
      : selectedFilter === "Cinematic"
      ? "contrast(120%) saturate(110%) brightness(95%)"
      : selectedFilter === "Soft"
      ? "contrast(90%) saturate(90%) brightness(105%)"
      : selectedFilter === "Vivid"
      ? "contrast(130%) saturate(150%)"
      : "";
  const isAtNoOp = useMemo(
    () =>
      Object.entries(NO_OP_ADJUSTMENTS).every(
        ([key, value]) => adjustments[key as AdjustmentKey] === value
      ) && !selectedFilter,
    [adjustments, selectedFilter]
  );

  const previewFilter = useMemo(() => {
    if (isAtNoOp) {
      return undefined;
    }

    const warmthHue = adjustments.warmth * 0.6;
    const warmthSepia = adjustments.warmth > 0 ? (adjustments.warmth / 100) * 0.3 : 0;
    const filterParts = [
      `brightness(${computedBrightness}%)`,
      `contrast(${adjustments.contrast}%)`,
      `saturate(${adjustments.saturation}%)`,
    ];

    if (adjustments.warmth !== 0) {
      filterParts.push(`hue-rotate(${warmthHue}deg)`);
      if (warmthSepia > 0) {
        filterParts.push(`sepia(${warmthSepia})`);
      }
    }

    if (presetFilter) {
      filterParts.push(presetFilter);
    }

    return filterParts.join(" ").trim();
  }, [adjustments, computedBrightness, isAtNoOp, presetFilter]);

  const previewScale = useMemo(() => clamp(1 + adjustments.zoom / 100, 0.5, 3), [adjustments.zoom]);
  
  // Calculate aspect ratio for crop
  const cropAspectRatio = useMemo(() => {
    if (!cropState?.aspect || cropState.aspect === "free") {
      return "9/16"; // Default to recommended vertical ratio
    }
    
    switch (cropState.aspect) {
      case "square":
        return "1/1";
      case "vertical":
        return "9/16";
      case "horizontal":
        return "16/9";
      case "story":
        return "4/5";
      case "post":
        return "1/1";
      default:
        return "16/9";
    }
  }, [cropState?.aspect]);
  
  // Build transform string including crop transformations
  const previewTransform = useMemo(() => {
    const transforms: string[] = [];
    
    // Add rotation first (before flips, so rotation happens around original axis)
    if (cropState?.rotation) {
      transforms.push(`rotate(${cropState.rotation}deg)`);
    }
    
    // Add flip transformations
    if (cropState?.flipHorizontal) {
      transforms.push(`scaleX(-1)`);
    }
    if (cropState?.flipVertical) {
      transforms.push(`scaleY(-1)`);
    }
    
    // Add scale last (so zoom happens after rotation/flip)
    transforms.push(`scale(${previewScale})`);
    
    return transforms.join(" ");
  }, [previewScale, cropState?.rotation, cropState?.flipHorizontal, cropState?.flipVertical]);
  const overlayAlignmentClass: Record<OverlayAlignment, string> = {
    center: "items-center justify-center text-center px-4",
    left: "items-center justify-start text-left pl-8 pr-4",
    right: "items-center justify-end text-right pr-8 pl-4",
  };

  // Helper function to convert blob URL to base64 data URL
  const blobToDataURL = async (blobUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to convert blob to data URL:", error);
      return null;
    }
  };

  const handleMuSend = async () => {
    const message = muInput.trim();
    if (!message || muLoading) return;

    setMuMessages((prev) => [...prev, { role: "user", content: message }]);
    // applyMuCommandFromText(message); // Disabled - now using tool calls
    setMuInput("");
    setMuLoading(true);

    try {
      // Get authentication token
      const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
      }
      
      // If no session, try to get a fresh one
      let authToken = session?.access_token || null;
      
      if (!authToken) {
        // Try to refresh if we have a session but no token
        if (session) {
          const { data: { session: refreshedSession } } = await supabaseBrowserClient.auth.refreshSession();
          authToken = refreshedSession?.access_token || null;
        }
      }
      
      // Disable in preview mode
      if (isPreview) {
        // Preview mode - feature not available
        return;
      }

      if (!authToken && process.env.NODE_ENV === "production") {
        // Authentication error - return early
        return;
      }

      // Convert blob URL to data URL if needed
      let imageDataUrl: string | null = null;
      if (activeAsset?.previewUrl) {
        if (activeAsset.previewUrl.startsWith("blob:")) {
          imageDataUrl = await blobToDataURL(activeAsset.previewUrl);
        } else if (activeAsset.previewUrl.startsWith("data:image/")) {
          imageDataUrl = activeAsset.previewUrl;
        } else {
          // For other URLs (http/https), use as-is if publicly accessible
          imageDataUrl = activeAsset.previewUrl;
        }
      }

      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({
          agent: "studio",
          message,
          taskType: "default",
          language: getLanguageFromLocale(language),
          context: {
            brightness: adjustments.brightness,
            contrast: adjustments.contrast,
            saturation: adjustments.saturation,
            imagePreviewUrl: imageDataUrl,
            imageName: activeAsset?.name ?? null,
            textItems: textItems.map((item) => ({
              id: item.id,
              content: item.content,
              color: item.color,
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              position: item.position,
              effectType: item.effectType,
            })),
          },
        }),
      });

      const json = await res.json();
      const isOk = res.ok && !json.error;

      // Log for debugging
      if (!isOk) {
        console.error("Studio API error:", json);
      }

      // Handle tool calls from Studio agent
      if (isOk && json.tool) {
        const tool = json.tool;
        const name = tool.name;
        const args = tool.arguments || {};

        try {
          if (name === "update_text_item") {
            const itemId = args.id || selectedTextItemId || textItems[0]?.id;
            if (itemId) {
              updateTextItem(itemId, args.updates || {});
              setMuMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `✓ Updated text item: ${Object.keys(args.updates || {}).join(", ")}`,
                },
              ]);
            } else {
              setMuMessages((prev) => [
                ...prev,
                { role: "assistant", content: "No text item found to update." },
              ]);
            }
          } else if (name === "add_text_item") {
            const newId = Date.now().toString();
            const newItem: TextItem = {
              id: newId,
              content: args.content || "New text",
              color: args.color || "#FFFFFF",
              fontFamily: args.fontFamily || "Inter, sans-serif",
              fontSize: args.fontSize || 32,
              bold: args.bold || false,
              italic: args.italic || false,
              underline: args.underline || false,
              position: args.position || { x: 50, y: 50 },
              alignment: args.alignment || "center",
              effectType: args.effectType || "none",
              effectColor: args.effectColor || "#000000",
              effectIntensity: args.effectIntensity ?? 50,
              effectThickness: args.effectThickness ?? 2,
              highlightPadding: args.highlightPadding ?? 4,
            };
            updateActiveAssetEdits(edits => ({
              ...edits,
              textItems: [...edits.textItems, newItem],
            }));
            setSelectedTextItemId(newId);
            setMuMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `✓ Added text: "${args.content || "New text"}"`,
              },
            ]);
          } else if (name === "update_adjustments") {
            updateActiveAssetEdits(edits => {
              const updates: Partial<AdjustmentState> = {};
              if (args.brightness !== undefined) updates.brightness = clamp(args.brightness, 0, 200);
              if (args.contrast !== undefined) updates.contrast = clamp(args.contrast, 0, 200);
              if (args.saturation !== undefined) updates.saturation = clamp(args.saturation, 0, 200);
              if (args.warmth !== undefined) updates.warmth = clamp(args.warmth, -50, 50);
              if (args.shadows !== undefined) updates.shadows = clamp(args.shadows, -50, 50);
              if (args.highlights !== undefined) updates.highlights = clamp(args.highlights, -50, 50);
              if (args.zoom !== undefined) updates.zoom = clamp(args.zoom, -50, 100);
              return {
                ...edits,
                adjustments: { ...edits.adjustments, ...updates },
              };
            });
            const updatedProps = Object.keys(args).filter((key) => args[key] !== undefined);
            setMuMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `✓ Updated adjustments: ${updatedProps.join(", ")}`,
              },
            ]);
          } else if (name === "set_filter") {
            updateActiveAssetEdits(edits => ({
              ...edits,
              filters: args.filter === null ? null : args.filter,
            }));
            setMuMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: args.filter ? `✓ Applied filter: ${args.filter}` : "✓ Removed filter",
              },
            ]);
          } else {
            setMuMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Unknown tool: ${name}` },
            ]);
          }
        } catch (toolError) {
          console.error("Tool execution error:", toolError);
          setMuMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error executing ${name}: ${toolError}` },
          ]);
        }
      } else {
        // Regular text response (fallback or explanation)
        if (!isOk) {
          // Handle unauthorized or other errors
          const errorMessage = json.error || "Error from Studio.";
          if (res.status === 401) {
            setMuMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Authentication error. Please try logging in again." },
            ]);
          } else {
            setMuMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Error: ${errorMessage}` },
            ]);
          }
        } else {
          setMuMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: json.reply || "No reply from Studio.",
            },
          ]);
        }
      }
    } catch (error: any) {
      console.error("Studio chat error:", error);
      setMuMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error talking to Studio: ${error?.message || "Unknown error"}` },
      ]);
    } finally {
      setMuLoading(false);
    }
  };

  // Fetch posts and metrics from connected social platforms
  const fetchSocialMediaMetrics = async (platform: SocialPlatform) => {
    try {
      // In production, this would call your backend API which uses the platform's API
      // For now, we'll simulate fetching data
      const mockPosts: SocialMediaPost[] = [
        {
          id: `post_${platform}_${Date.now()}_1`,
          platform,
          postId: `platform_${Date.now()}_1`,
          caption: `Recent post from ${platform}`,
          postedAt: new Date(Date.now() - 86400000 * Math.floor(Math.random() * 30)).toISOString(),
          metrics: {
            likes: Math.floor(Math.random() * 5000) + 100,
            comments: Math.floor(Math.random() * 500) + 10,
            reposts: platform === "tiktok" || platform === "facebook" ? Math.floor(Math.random() * 200) + 5 : undefined,
            views: Math.floor(Math.random() * 50000) + 1000,
            shares: platform === "facebook" ? Math.floor(Math.random() * 100) + 5 : undefined,
            saves: platform === "instagram" ? Math.floor(Math.random() * 300) + 20 : undefined,
          },
          lastSyncedAt: new Date().toISOString(),
        },
        {
          id: `post_${platform}_${Date.now()}_2`,
          platform,
          postId: `platform_${Date.now()}_2`,
          caption: `Another post from ${platform}`,
          postedAt: new Date(Date.now() - 86400000 * Math.floor(Math.random() * 30)).toISOString(),
          metrics: {
            likes: Math.floor(Math.random() * 5000) + 100,
            comments: Math.floor(Math.random() * 500) + 10,
            reposts: platform === "tiktok" || platform === "facebook" ? Math.floor(Math.random() * 200) + 5 : undefined,
            views: Math.floor(Math.random() * 50000) + 1000,
            shares: platform === "facebook" ? Math.floor(Math.random() * 100) + 5 : undefined,
            saves: platform === "instagram" ? Math.floor(Math.random() * 300) + 20 : undefined,
          },
          lastSyncedAt: new Date().toISOString(),
        },
      ];

      setSocialMediaPosts((prev) => {
        // Remove old posts from this platform and add new ones
        const filtered = prev.filter((p) => p.platform !== platform);
        return [...filtered, ...mockPosts];
      });

      return mockPosts;
    } catch (error) {
      console.error(`Error fetching metrics from ${platform}:`, error);
      throw error;
    }
  };

  const handleSocialConnect = async (platform: SocialPlatform) => {
    // Define OAuth URLs for each platform
    // In production, these would be your backend OAuth endpoints
    const authUrls: Record<SocialPlatform, string> = {
      instagram: "/api/auth/instagram", // Replace with your OAuth endpoint
      tiktok: "/api/auth/tiktok", // Replace with your OAuth endpoint
      facebook: "/api/auth/facebook", // Replace with your OAuth endpoint
    };

    // For demo, use login pages. In production, use OAuth endpoints
    const demoUrls: Record<SocialPlatform, string> = {
      instagram: "https://www.instagram.com/accounts/login/",
      tiktok: "https://www.tiktok.com/login/",
      facebook: "https://www.facebook.com/login/",
    };

    const authUrl = authUrls[platform] || demoUrls[platform];
    if (!authUrl) return;

    // Open popup window for authentication
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      `${platform}_auth`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=yes,status=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      setActivityLog((prev) => [
        ...prev,
        { role: "agent", text: `Please allow popups to connect ${platform}.` },
      ]);
      return;
    }

    setActivityLog((prev) => [
      ...prev,
      { role: "agent", text: `Opening ${platform} authentication page...` },
    ]);

    // Listen for popup to close or receive message
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        
        // Simulate successful connection and fetch metrics
        setActivityLog((prev) => [
          ...prev,
          { role: "agent", text: `Checking ${platform} authentication...` },
        ]);
        
        // Simulate successful connection (in production, verify via API)
        setTimeout(async () => {
          const account: ConnectedAccount = {
            platform,
            accountId: `account_${platform}_${Date.now()}`,
            accountName: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
            connectedAt: new Date().toISOString(),
          };

          setConnectedAccounts((prev) => {
            const filtered = prev.filter((a) => a.platform !== platform);
            return [...filtered, account];
          });

          setConnectedSocials((prev) => ({ ...prev, [platform]: true }));
          
          // Fetch initial metrics
          try {
            await fetchSocialMediaMetrics(platform);
            setActivityLog((prev) => [
              ...prev,
              { role: "agent", text: `Successfully connected to ${platform} and fetched post metrics.` },
            ]);
          } catch (error) {
            setActivityLog((prev) => [
              ...prev,
              { role: "agent", text: `Connected to ${platform}, but couldn't fetch metrics yet.` },
            ]);
          }
        }, 1000);
      }
    }, 500);

    // Listen for postMessage from popup (for OAuth callback)
    const messageHandler = async (event: MessageEvent) => {
      // In production, verify the origin and handle the OAuth callback
      if (event.data && event.data.type === `${platform}_auth_success`) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        popup.close();

        const account: ConnectedAccount = {
          platform,
          accountId: event.data.accountId || `account_${platform}_${Date.now()}`,
          accountName: event.data.accountName || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
          connectedAt: new Date().toISOString(),
          accessToken: event.data.accessToken, // In production, store securely
        };

        setConnectedAccounts((prev) => {
          const filtered = prev.filter((a) => a.platform !== platform);
          return [...filtered, account];
        });

        setConnectedSocials((prev) => ({ ...prev, [platform]: true }));
        
        // Fetch initial metrics
        try {
          await fetchSocialMediaMetrics(platform);
          setActivityLog((prev) => [
            ...prev,
            { role: "agent", text: `Successfully connected to ${platform} and fetched post metrics.` },
          ]);
        } catch (error) {
          setActivityLog((prev) => [
            ...prev,
            { role: "agent", text: `Connected to ${platform}, but couldn't fetch metrics yet.` },
          ]);
        }
      }
    };

    window.addEventListener("message", messageHandler);
  };

  const handleSocialUpload = (platform: SocialPlatform) => {
    // In a real implementation, this would open a modal or API to fetch media from the platform
    setActivityLog((prev) => [
      ...prev,
      { role: "user", text: `Uploading from ${platform}...` },
      { role: "agent", text: `Fetching media from ${platform}. Select the items you want to import.` },
    ]);
  };

  const handlePostToSocial = async (mediaId: string, platform: SocialPlatform) => {
    if (!connectedSocials[platform]) {
      setActivityLog((prev) => [
        ...prev,
        { role: "agent", text: `Please connect ${platform} first to post media.` },
      ]);
      return;
    }

    setActivityLog((prev) => [
      ...prev,
      { role: "user", text: `Posting to ${platform}...` },
      { role: "agent", text: `Posting media to ${platform}. This may take a moment...` },
    ]);

    // Simulate API call to post to social platform
    // In production, this would call: POST /api/social/post
    setTimeout(() => {
      const postId = `${platform}_${Date.now()}`;
      setMediaItems((prev) =>
        prev.map((item) =>
          item.id === mediaId
            ? {
                ...item,
                postedTo: [
                  ...(item.postedTo || []),
                  {
                    platform,
                    postId,
                    postedAt: new Date().toISOString(),
                  },
                ],
              }
            : item
        )
      );
      setActivityLog((prev) => [
        ...prev,
        { role: "agent", text: `Successfully posted to ${platform}! Post ID: ${postId}` },
      ]);
    }, 1500);
  };

  const fetchMetricsFromSocial = async (mediaId: string, platform: SocialPlatform, postId?: string) => {
    if (!connectedSocials[platform]) {
      setActivityLog((prev) => [
        ...prev,
        { role: "agent", text: `Please connect ${platform} first to fetch metrics.` },
      ]);
      return;
    }

    setFetchingMetrics((prev) => ({ ...prev, [`${mediaId}_${platform}`]: true }));

    // Simulate API call to fetch metrics
    // In production, this would call: GET /api/social/metrics?platform=${platform}&postId=${postId}
    setTimeout(() => {
      // Simulate fetching real metrics (in production, these would come from the API)
      const mockMetrics = {
        impressions: Math.floor(Math.random() * 20000) + 5000,
        likes: Math.floor(Math.random() * 1000) + 100,
        reposts: Math.floor(Math.random() * 200) + 20,
        comments: Math.floor(Math.random() * 150) + 10,
      };

      setMediaItems((prev) =>
        prev.map((item) => {
          if (item.id === mediaId) {
            // Aggregate metrics from all platforms
            const existingMetrics = {
              impressions: item.impressions || 0,
              likes: item.likes || 0,
              reposts: item.reposts || 0,
              comments: item.comments || 0,
            };

            return {
              ...item,
              impressions: existingMetrics.impressions + mockMetrics.impressions,
              likes: existingMetrics.likes + mockMetrics.likes,
              reposts: existingMetrics.reposts + mockMetrics.reposts,
              comments: existingMetrics.comments + mockMetrics.comments,
              metricsLastUpdated: new Date().toISOString(),
            };
          }
          return item;
        })
      );

      setFetchingMetrics((prev) => ({ ...prev, [`${mediaId}_${platform}`]: false }));
      setActivityLog((prev) => [
        ...prev,
        { role: "agent", text: `Updated metrics from ${platform}: ${mockMetrics.likes} likes, ${mockMetrics.comments} comments` },
      ]);
    }, 1000);
  };

  const syncAllMetrics = async (mediaId: string) => {
    const item = mediaItems.find((m) => m.id === mediaId);
    if (!item?.postedTo) return;

    for (const post of item.postedTo) {
      await fetchMetricsFromSocial(mediaId, post.platform, post.postId);
    }
  };

  return (
    <div className="space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">{t("studioAgent")}</p>
        <h1 className="text-3xl font-semibold">{t("mediaBrandingWorkspace")}</h1>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "edit"
                ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === "analytics"
                ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="studio-content">
        {activeTab === "edit" && (
          <div className="space-y-6">
            {/* Asset Strip - Show when we have assets - Full width at top */}
            {assets.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {assets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => setActiveAssetId(asset.id)}
                  className={`relative flex-shrink-0 rounded-lg border-2 overflow-hidden transition-all ${
                    activeAssetId === asset.id
                      ? "border-slate-900 dark:border-white shadow-md"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                  style={{ width: "80px", height: "80px" }}
                >
                  {asset.type === "image" ? (
                    <img
                      src={asset.previewUrl}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1">
                    <div className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      asset.type === "image"
                        ? "bg-blue-500 text-white"
                        : "bg-purple-500 text-white"
                    }`}>
                      {asset.type === "image" ? "IMG" : "VID"}
                    </div>
                  </div>
                  {activeAssetId === asset.id && (
                    <div className="absolute inset-0 border-2 border-white" />
                  )}
                </button>
              ))}
              <label className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 flex items-center justify-center cursor-pointer transition-colors">
                <Plus className="h-6 w-6 text-slate-400" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
            </div>
            )}

            {/* Main Content Area: Live Preview + Agent Chat */}
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              {/* Left Side: Live Preview */}
              <div className="space-y-6">
            {/* Drop Image Area - Only shown when no assets are uploaded */}
            {assets.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 transition-all duration-500 ease-in-out">
              <p className="font-semibold">{t("studioDropImageOrVideo")}</p>
              <p className="mt-2 text-slate-500">
                {t("studioOnlyApplies")}
              </p>
              <label className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                {t("studioBrowseFiles")}
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
              </label>
            </div>
          )}

          {/* Live Preview - Replaces drop area when asset is uploaded */}
          {activeAsset && (
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 transition-all duration-500 ease-in-out">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Live Preview</h3>
                <div className="flex items-center gap-2">
                  {activeAsset.type === "image" && (
                    <button
                      type="button"
                      onClick={applyActiveEditsToAllImages}
                      className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition px-2 py-1 rounded border border-slate-200 dark:border-slate-700"
                      title="Apply these edits to all images"
                    >
                      Apply to all images
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAsset(activeAsset.id)}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div
                data-preview-container
                className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center shadow-inner transition-all duration-500 ease-in-out"
                style={{ aspectRatio: cropAspectRatio, minHeight: "320px" }}
              >
                {activeAsset.type === "image" ? (
                  <img
                    src={activeAsset.previewUrl}
                    alt={activeAsset.name}
                    className="h-full w-full object-contain transition-all duration-200"
                    style={{
                      ...(previewFilter && { filter: previewFilter }),
                      ...(previewTransform && { transform: previewTransform }),
                      transformOrigin: "center center",
                    }}
                  />
                ) : (
                  <video
                    src={activeAsset.previewUrl}
                    controls
                    className="h-full w-full object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="absolute top-3 right-3 rounded-full bg-white/80 p-2 text-slate-700 shadow hover:bg-white dark:bg-slate-900/70 dark:hover:bg-slate-900"
                  aria-label="Expand preview"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                {textOverlayEnabled &&
                  textItems.filter(item => item.content && item.content.trim() !== "").map((item) => {
                    const textStyle = getTextItemStyle(item);
                    const isSelected = selectedTextItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`absolute select-none ${
                          isDragging && draggingTextItemId === item.id
                            ? "cursor-grabbing"
                            : "cursor-grab"
                        }`}
                        style={{
                          left: `${item.position.x}%`,
                          top: `${item.position.y}%`,
                          transform: "translate(-50%, -50%)",
                          pointerEvents: "auto",
                        }}
                        onMouseDown={(e) => handleTextDragStart(e, item.id)}
                        onClick={() => setSelectedTextItemId(item.id)}
                      >
                        <p
                          className="whitespace-nowrap"
                          style={{
                            ...textStyle,
                            border: isSelected ? "2px dashed rgba(255,255,255,0.5)" : "none",
                            ...(isSelected &&
                              item.effectType !== "highlight" && { padding: "2px" }),
                          }}
                        >
                          {item.content}
                        </p>
                      </div>
                    );
                  })}
              </div>
              
              {/* Quick Add Chips */}
              {quickAddSuggestions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-slate-500" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Quick Add
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickAddSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleQuickAddClick(suggestion)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:border-slate-600"
                      >
                        <Plus className="h-3 w-3" />
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Filename Input */}
              {activeAsset && (
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Filename
                  </label>
                  <input
                    type="text"
                    value={customFilenames[activeAsset.id] ?? activeAsset.name}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setCustomFilenames(prev => ({
                        ...prev,
                        [activeAsset.id]: newValue
                      }));
                    }}
                    onBlur={(e) => {
                      // Ensure extension exists when user finishes editing
                      const value = e.target.value.trim();
                      if (!value) {
                        // If empty, use original name
                        setCustomFilenames(prev => {
                          const updated = { ...prev };
                          delete updated[activeAsset.id];
                          return updated;
                        });
                        return;
                      }
                      const hasExtension = /\.\w+$/.test(value);
                      if (!hasExtension) {
                        const extension = activeAsset.name.match(/\.[^/.]+$/)?.[0] || (activeAsset.type === "video" ? ".mp4" : ".png");
                        setCustomFilenames(prev => ({
                          ...prev,
                          [activeAsset.id]: value + extension
                        }));
                      }
                    }}
                    placeholder="Enter filename"
                    className="w-full rounded-xl border-0 bg-transparent px-3 py-2 text-sm focus:outline-none dark:bg-transparent"
                  />
                  <p className="text-xs text-slate-500">
                    {activeAsset.type === "video" ? "Will save as .mp4" : "Will save as .png"}
                  </p>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeAsset) return;
                      const customName = customFilenames[activeAsset.id] || activeAsset.name;
                      const link = document.createElement("a");
                      link.href = activeAsset.previewUrl;
                      link.download = customName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    disabled={!activeAsset}
                    className={`inline-flex items-center gap-2 text-sm font-semibold ${
                      activeAsset
                        ? "text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                        : "text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    disabled={!activeAsset}
                    className={`inline-flex items-center gap-2 text-sm font-semibold ${
                      activeAsset
                        ? "text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                        : "text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    Share
                  </button>
                </div>
              </div>
            </div>
          )}
              </div>
        
              {/* Right Side: Agent Chat */}
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 flex flex-col" style={{ minHeight: "500px" }}>
                  <h3 className="text-sm font-semibold mb-3">{t("studioAgentChat")}</h3>
                  <div className="flex-1 space-y-2 overflow-y-auto text-sm min-h-0">
                    {muMessages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <span
                          className={`rounded-2xl px-3 py-2 ${
                            message.role === "user"
                              ? "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                              : "bg-slate-900/90 text-white dark:bg-slate-800"
                          }`}
                        >
                          {message.content}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      className="flex-1 rounded-2xl border border-slate-200 bg-transparent px-4 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                      placeholder={t("studioAddTweakRequest")}
                      value={muInput}
                      onChange={(event) => setMuInput(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleMuSend()}
                    />
                    <button
                      type="button"
                      onClick={handleMuSend}
                      disabled={muLoading}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                    >
                      {muLoading ? "Thinking…" : t("send")}
                    </button>
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <p className="text-xs font-semibold mb-2">Automation updates</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto text-xs">
                      {activityLog.map((message, index) => (
                        <div
                          key={index}
                          className={`rounded-2xl px-4 py-3 text-sm ${
                            message.role === "agent"
                              ? "bg-slate-900/90 text-white dark:bg-slate-800"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                          }`}
                        >
                          {message.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        
            {/* Edit Options - Horizontal Row Below Preview and Chat */}
            {activeAsset && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
            {/* Adjust Section */}
            <SimpleSection
              title="ADJUST"
              icon={SlidersHorizontal}
              tooltip="Adjust brightness, contrast, saturation, and more"
            >
              <StudioAdjustPanel
                adjustments={adjustments}
                selectedAdjustment={selectedAdjustment}
                onAdjustmentChange={(key, value) =>
                  updateActiveAssetEdits(edits => ({
                    ...edits,
                    adjustments: { ...edits.adjustments, [key]: value },
                  }))
                }
                onSelectedAdjustmentChange={setSelectedAdjustment}
                showAdvanced={showAdvancedAdjustments}
                onToggleAdvanced={() => setShowAdvancedAdjustments(!showAdvancedAdjustments)}
                onReset={handleResetAdjustments}
                isAtNoOp={isAtNoOp}
                hasImage={!!activeAsset && activeAsset.type === "image"}
              />
            </SimpleSection>

            {/* Filters Section */}
            <SimpleSection
              title="FILTERS"
              icon={Wand2}
              tooltip="Apply preset filters to your image"
            >
              <StudioFiltersPanel
                filters={filters}
                selectedFilter={selectedFilter}
                onFilterSelect={(filter) =>
                  updateActiveAssetEdits(edits => ({
                    ...edits,
                    filters: filter,
                  }))
                }
              />
            </SimpleSection>

            {/* Canvas Size & Ratio Section - Only for images */}
            {activeAsset.type === "image" && (
              <SimpleSection
                title="CANVAS SIZE & RATIO"
                icon={ImageIcon}
                tooltip="Choose the best aspect ratio for your social media platform"
              >
                <AspectRatioSelector
                  cropState={cropState}
                  onCropStateChange={(updates) =>
                    updateActiveAssetEdits(edits => ({
                      ...edits,
                      crop: { ...(edits.crop || {
                        aspect: "vertical" as CropAspect, // Default to recommended 9:16
                        rotation: 0,
                        flipHorizontal: false,
                        flipVertical: false,
                      }), ...updates },
                    }))
                  }
                />
              </SimpleSection>
            )}

            {/* Crop Section - Only for images */}
            {activeAsset.type === "image" && (
              <SimpleSection
                title="CROP & ROTATE"
                icon={Crop}
                tooltip="Crop, rotate, and flip your image"
              >
                <StudioCropPanel cropState={cropState} onCropStateChange={(updates) =>
                  updateActiveAssetEdits(edits => ({
                    ...edits,
                    crop: { ...(edits.crop || {
                      aspect: "vertical" as CropAspect, // Default to recommended 9:16
                      rotation: 0,
                      flipHorizontal: false,
                      flipVertical: false,
                    }), ...updates },
                  }))
                } />
              </SimpleSection>
            )}

            {/* Text Overlay Section - Only for images */}
            {activeAsset.type === "image" && (
              <SimpleSection
                title="TEXT"
                icon={Type}
                tooltip="Add and edit text overlays"
              >
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={textOverlayEnabled}
                    onChange={(e) => setTextOverlayEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-300">Enable text overlay</span>
                </label>
                
                {textOverlayEnabled && (
                  <>
                    {/* Text Items List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Text Items</p>
                        <button
                          type="button"
                          onClick={addTextItem}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                          title="Add new text item"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {textItems.length === 0 ? (
                          <div 
                            onClick={addTextItem}
                            className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-2 py-3 text-center cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                          >
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                              insert text here
                            </p>
                          </div>
                        ) : (
                          textItems.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 cursor-pointer transition ${
                                selectedTextItemId === item.id
                                  ? "border-slate-900 bg-slate-100 dark:border-white dark:bg-slate-700"
                                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                              }`}
                              onClick={() => setSelectedTextItemId(item.id)}
                            >
                              <Type className="h-3 w-3 text-slate-500" />
                              <span className="flex-1 text-xs truncate">
                                {item.content || "Empty text"}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTextItem(item.id);
                                }}
                                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                                title="Delete text item"
                              >
                                <Trash2 className="h-3 w-3 text-slate-500" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Selected Text Item Inspector */}
                    {selectedTextItem && (
                      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        {/* Content Section */}
                        <div>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Content</label>
                          <textarea
                            ref={textAreaRef}
                            value={selectedTextItem.content}
                            onChange={(event) =>
                              updateTextItem(selectedTextItem.id, { content: event.target.value })
                            }
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:focus:border-white"
                            placeholder="insert text here"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            Drag in preview to reposition
                          </p>
                        </div>

                        {/* Style Section */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Style</label>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-500">Color</span>
                              </div>
                              <ColorPicker
                                color={selectedTextItem.color}
                                onChange={(color) => updateTextItem(selectedTextItem.id, { color })}
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-500 mb-1 block">Font</label>
                              <select
                                className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs dark:border-slate-700"
                                value={selectedTextItem.fontFamily}
                                onChange={(event) =>
                                  updateTextItem(selectedTextItem.id, { fontFamily: event.target.value })
                                }
                              >
                                <option value="sans-serif">System Sans</option>
                                <option value="Inter, sans-serif">Inter</option>
                                <option value="'Work Sans', sans-serif">Work Sans</option>
                                <option value="'Roboto', sans-serif">Roboto</option>
                                <option value="'Playfair Display', serif">Playfair Display</option>
                                <option value="'Courier New', monospace">Courier New</option>
                              </select>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-500">Size</span>
                                <span className="text-[10px] text-slate-500">{selectedTextItem.fontSize}px</span>
                              </div>
                              <input
                                type="range"
                                min={12}
                                max={72}
                                value={selectedTextItem.fontSize}
                                onChange={(event) =>
                                  updateTextItem(selectedTextItem.id, {
                                    fontSize: Number(event.target.value),
                                  })
                                }
                                className="w-full h-1"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-500 mb-1 block">Styles</label>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateTextItem(selectedTextItem.id, {
                                      bold: !selectedTextItem.bold,
                                    })
                                  }
                                  className={`flex-1 rounded-lg border px-2 py-1.5 transition ${
                                    selectedTextItem.bold
                                      ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700"
                                  }`}
                                  title="Bold"
                                >
                                  <Bold className="h-3 w-3 mx-auto" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateTextItem(selectedTextItem.id, {
                                      italic: !selectedTextItem.italic,
                                    })
                                  }
                                  className={`flex-1 rounded-lg border px-2 py-1.5 transition ${
                                    selectedTextItem.italic
                                      ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700"
                                  }`}
                                  title="Italic"
                                >
                                  <Italic className="h-3 w-3 mx-auto" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateTextItem(selectedTextItem.id, {
                                      underline: !selectedTextItem.underline,
                                    })
                                  }
                                  className={`flex-1 rounded-lg border px-2 py-1.5 transition ${
                                    selectedTextItem.underline
                                      ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700"
                                  }`}
                                  title="Underline"
                                >
                                  <Underline className="h-3 w-3 mx-auto" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Effects Section */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Effects</label>
                          </div>
                          <select
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs mb-2 dark:border-slate-700"
                            value={selectedTextItem.effectType || "none"}
                            onChange={(event) => {
                              const effectType = event.target.value as TextItem["effectType"];
                              updateTextItem(selectedTextItem.id, {
                                effectType: effectType || "none",
                              });
                            }}
                          >
                            <option value="none">None</option>
                            <option value="glow">Glow</option>
                            <option value="outline">Outline</option>
                            <option value="highlight">Highlight</option>
                            <option value="shadow">Shadow</option>
                          </select>

                          {selectedTextItem.effectType &&
                            selectedTextItem.effectType !== "none" && (
                              <div className="space-y-2">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-slate-500">Effect Color</span>
                                  </div>
                                  <ColorPicker
                                    color={selectedTextItem.effectColor || "#000000"}
                                    onChange={(color) =>
                                      updateTextItem(selectedTextItem.id, { effectColor: color })
                                    }
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-slate-500">Intensity</span>
                                    <span className="text-[10px] text-slate-500">{selectedTextItem.effectIntensity ?? 50}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={selectedTextItem.effectIntensity ?? 50}
                                    onChange={(event) =>
                                      updateTextItem(selectedTextItem.id, {
                                        effectIntensity: Number(event.target.value),
                                      })
                                    }
                                    className="w-full h-1"
                                  />
                                </div>

                                {selectedTextItem.effectType === "outline" && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-slate-500">Thickness</span>
                                      <span className="text-[10px] text-slate-500">{selectedTextItem.effectThickness ?? 2}px</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={10}
                                      value={selectedTextItem.effectThickness ?? 2}
                                      onChange={(event) =>
                                        updateTextItem(selectedTextItem.id, {
                                          effectThickness: Number(event.target.value),
                                        })
                                      }
                                      className="w-full h-1"
                                    />
                                  </div>
                                )}

                                {selectedTextItem.effectType === "highlight" && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-slate-500">Padding</span>
                                      <span className="text-[10px] text-slate-500">{selectedTextItem.highlightPadding ?? 4}px</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={20}
                                      value={selectedTextItem.highlightPadding ?? 4}
                                      onChange={(event) =>
                                        updateTextItem(selectedTextItem.id, {
                                          highlightPadding: Number(event.target.value),
                                        })
                                      }
                                      className="w-full h-1"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </SimpleSection>
            )}

            {/* Video Editing Section - Only for video assets */}
            {activeAsset && activeAsset.type === "video" && (
              <CollapsibleSection
                id="video"
                title="VIDEO"
                icon={Video}
                isExpanded={expandedSections.video || false}
                onToggle={() => setExpandedSections((prev) => ({ ...prev, video: !prev.video }))}
                tooltip="Trim and edit video clips"
              >
                <div className="space-y-3">
                  {activeAsset.edits.video && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                          Trim Start (ms)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={activeAsset.edits.video.trimStartMs}
                          onChange={(e) =>
                            updateActiveAssetEdits(edits => ({
                              ...edits,
                              video: edits.video ? {
                                ...edits.video,
                                trimStartMs: Math.max(0, Number(e.target.value)),
                              } : undefined,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                          Trim End (ms)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={activeAsset.edits.video.trimEndMs}
                          onChange={(e) =>
                            updateActiveAssetEdits(edits => ({
                              ...edits,
                              video: edits.video ? {
                                ...edits.video,
                                trimEndMs: Math.max(0, Number(e.target.value)),
                              } : undefined,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:focus:border-white"
                        />
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeAsset.edits.video.includeInShort}
                            onChange={(e) => {
                              updateActiveAssetEdits(edits => ({
                                ...edits,
                                video: edits.video ? {
                                  ...edits.video,
                                  includeInShort: e.target.checked,
                                } : undefined,
                              }));
                              // Update shorts composition
                              if (e.target.checked) {
                                setShortsComposition(prev => 
                                  prev.includes(activeAsset.id) ? prev : [...prev, activeAsset.id]
                                );
                              } else {
                                setShortsComposition(prev => prev.filter(id => id !== activeAsset.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:bg-slate-800"
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-300">Include in Short</span>
                        </label>
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 text-center">
                      💡 Add music directly inside TikTok, Instagram, YouTube Shorts, etc. to avoid copyright issues. Studio exports clean video only.
                    </p>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Shorts Composition Section */}
            {assets.some(a => a.type === "video") && (
              <CollapsibleSection
                id="shorts"
                title="SHORTS"
                icon={Video}
                isExpanded={expandedSections.shorts || false}
                onToggle={() => setExpandedSections((prev) => ({ ...prev, shorts: !prev.shorts }))}
                tooltip="Compose your short from video clips"
              >
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Arrange video clips for your short:
                  </p>
                  {shortsComposition.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4">
                      No clips included yet. Enable &quot;Include in Short&quot; on video assets.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {shortsComposition.map((assetId, index) => {
                        const asset = assets.find(a => a.id === assetId);
                        if (!asset || asset.type !== "video") return null;
                        return (
                          <div
                            key={assetId}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2"
                          >
                            <div className="flex-1 flex items-center gap-2">
                              <Video className="h-4 w-4 text-slate-500" />
                              <span className="text-xs truncate">{asset.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (index > 0) {
                                    const newOrder = [...shortsComposition];
                                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                    setShortsComposition(newOrder);
                                  }
                                }}
                                disabled={index === 0}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (index < shortsComposition.length - 1) {
                                    const newOrder = [...shortsComposition];
                                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                    setShortsComposition(newOrder);
                                  }
                                }}
                                disabled={index === shortsComposition.length - 1}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShortsComposition(prev => prev.filter(id => id !== assetId));
                                  updateActiveAssetEdits(edits => ({
                                    ...edits,
                                    video: edits.video ? {
                                      ...edits.video,
                                      includeInShort: false,
                                    } : undefined,
                                  }));
                                }}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Remove from short"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 text-center">
                      💡 Add music directly inside TikTok, Instagram, YouTube Shorts, etc. to avoid copyright issues. Studio exports clean video only.
                    </p>
                  </div>
                </div>
              </CollapsibleSection>
            )}
              </div>
            )}
        
            {/* Connect Social Media - Independent section at bottom */}
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <h3 className="text-lg font-semibold mb-4">{t("studioConnectSocialMedia")}</h3>
              <p className="text-sm text-slate-500 mb-4">Connect your accounts to upload media directly from social platforms</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 p-2">
                      <Instagram size={20} className="text-white" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Instagram</p>
                      <p className="text-xs text-slate-500">
                        {connectedSocials.instagram ? "Connected" : t("studioNotConnected")}
                      </p>
                    </div>
                  </div>
                  {connectedSocials.instagram ? (
                    <button
                      onClick={() => handleSocialUpload("instagram")}
                      className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                    >
                      Upload
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSocialConnect("instagram")}
                      className="mt-3 w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      {t("studioConnect")}
                    </button>
                  )}
                </div>
                <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="rounded-xl bg-black p-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">TikTok</p>
                      <p className="text-xs text-slate-500">
                        {connectedSocials.tiktok ? "Connected" : t("studioNotConnected")}
                      </p>
                    </div>
                  </div>
                  {connectedSocials.tiktok ? (
                    <button
                      onClick={() => handleSocialUpload("tiktok")}
                      className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                    >
                      Upload
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSocialConnect("tiktok")}
                      className="mt-3 w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Connect
                    </button>
                  )}
                </div>
                <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="rounded-xl bg-blue-600 p-2">
                      <Facebook size={20} className="text-white" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Facebook</p>
                      <p className="text-xs text-slate-500">
                        {connectedSocials.facebook ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {connectedSocials.facebook ? (
                    <button
                      onClick={() => handleSocialUpload("facebook")}
                      className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                    >
                      Upload
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSocialConnect("facebook")}
                      className="mt-3 w-full rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "analytics" && (
          <MuAnalyticsPanel
            mediaItems={mediaItems}
            connectedSocials={connectedSocials}
            fetchingMetrics={fetchingMetrics}
            handlePostToSocial={handlePostToSocial}
            syncAllMetrics={syncAllMetrics}
            socialMediaPosts={socialMediaPosts}
            connectedAccounts={connectedAccounts}
            onRefreshMetrics={fetchSocialMediaMetrics}
          />
        )}
      </div>
      {isPreviewModalOpen && activeAsset && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsPreviewModalOpen(false)}
          />
          <div className="relative z-50 flex items-center justify-center w-full h-full px-4">
            {activeAsset.type === "image" ? (
              <>
                <div
                  className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center"
                  style={{ aspectRatio: cropAspectRatio, maxWidth: "90vw", maxHeight: "90vh" }}
                >
                  <img
                    src={activeAsset.previewUrl}
                    alt="Expanded preview"
                    className="h-full w-full object-contain rounded-2xl"
                    style={{
                      ...(previewFilter && { filter: previewFilter }),
                      ...(previewTransform && { transform: previewTransform }),
                      transformOrigin: "center center",
                    }}
                  />
                  {textOverlayEnabled &&
                    textItems.filter(item => item.content && item.content.trim() !== "").map((item) => {
                      const textStyle = getTextItemStyle(item);
                      return (
                        <div
                          key={item.id}
                          className="absolute pointer-events-none select-none"
                          style={{
                            left: `${item.position.x}%`,
                            top: `${item.position.y}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <p
                            className="whitespace-nowrap"
                            style={{
                              ...textStyle,
                              fontSize: `${(item.fontSize || 32) + 6}px`,
                            }}
                          >
                            {item.content}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <video
                src={activeAsset.previewUrl}
                controls
                className="max-w-[90vw] max-h-[90vh] rounded-2xl"
              />
            )}
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 text-white text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {isShareModalOpen && activeAsset && activeAsset.type === "image" && (
        <MuShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          assetUrl={activeAsset.previewUrl}
          assetName={customFilenames[activeAsset.id] || activeAsset.name}
          previewFilter={previewFilter || undefined}
          previewTransform={previewTransform || undefined}
          cropAspectRatio={cropAspectRatio}
        />
      )}
    </div>
  );
}
