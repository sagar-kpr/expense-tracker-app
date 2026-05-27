import { Ionicons } from "@expo/vector-icons";

export type CategoryMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  Food: { icon: "fast-food", color: "#159665", tint: "#EAF7F0" },
  Travel: { icon: "airplane", color: "#2878E3", tint: "#EAF2FF" },
  Shopping: { icon: "bag", color: "#C98200", tint: "#FFF5DF" },
  Bills: { icon: "bulb", color: "#E5484D", tint: "#FFF0F0" },
  Health: { icon: "medical", color: "#D9468E", tint: "#FFF0F7" },
  Freelance: { icon: "sparkles", color: "#159665", tint: "#EAF7F0" },
  Client: { icon: "person", color: "#159665", tint: "#EAF7F0" },
  Business: { icon: "briefcase", color: "#159665", tint: "#EAF7F0" },
  Cash: { icon: "cash", color: "#159665", tint: "#EAF7F0" },
  Commission: { icon: "trending-up", color: "#159665", tint: "#EAF7F0" },
  Other: { icon: "ellipsis-horizontal", color: "#7152F3", tint: "#F4F0FF" },
};

export const getCategoryMeta = (category?: string) =>
  CATEGORY_META[category || "Other"] || CATEGORY_META.Other;
