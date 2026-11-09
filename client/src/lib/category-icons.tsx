import { createElement } from "react";
import {
  Atom,
  BookOpen,
  Cog,
  Gauge,
  GraduationCap,
  Landmark,
  Layers,
  Leaf,
  Radiation,
  ShieldCheck,
  Thermometer,
  TrendingUp,
  Recycle,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "nuclear-engineering": Cog,
  "nuclear-safety": ShieldCheck,
  "radiation-protection": Radiation,
  "nuclear-reactor-physics": Atom,
  "nuclear-energy": Zap,
  "nuclear-materials": Layers,
  "thermal-hydraulics": Thermometer,
  "nuclear-instrumentation": Gauge,
  "nuclear-waste-management": Recycle,
  "environmental-radiation": Leaf,
  "nuclear-policy": Landmark,
  "energy-economics": TrendingUp,
  "education-and-training": GraduationCap,
};

// Editors can add categories, so anything unknown falls back to a book.
export function categoryIcon(slug: string | undefined | null): LucideIcon {
  return (slug && ICONS[slug]) || BookOpen;
}

// Renders the icon for a category. Looking the icon up inside createElement
// keeps React from treating it as a component defined during render.
export function CategoryIcon({ slug, className }: { slug: string | undefined | null; className?: string }) {
  return createElement(categoryIcon(slug), { "aria-hidden": true, className });
}
