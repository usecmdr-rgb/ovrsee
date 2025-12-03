import { useTheme } from "@/context/ThemeContext";
import { getColors } from "@/theme/colors";

/**
 * Hook to get theme-aware colors
 * Automatically returns colors based on current theme from ThemeContext
 */
export function useColors() {
  const { theme } = useTheme();
  return getColors(theme);
}



