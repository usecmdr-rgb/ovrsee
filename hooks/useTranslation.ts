import { useAppState } from "@/context/AppStateContext";
import { useTranslation as useTranslationBase } from "@/lib/translations";

export const useTranslation = () => {
  const { language } = useAppState();
  return useTranslationBase(language);
};














