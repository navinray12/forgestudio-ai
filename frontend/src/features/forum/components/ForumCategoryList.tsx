import React from "react";
import type { ForumCategory } from "../types/forum.types";
import { MessageSquare, Layout, Edit3, Globe, Palette, Code, Zap, Server, Sparkles, Lightbulb, BookOpen, Megaphone } from "lucide-react";

interface ForumCategoryListProps {
  categories: ForumCategory[];
  onSelectCategory: (category: ForumCategory) => void;
  selectedCategorySlug?: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare,
  Layout,
  Edit3,
  Globe,
  Palette,
  Code,
  Zap,
  Server,
  Sparkles,
  Lightbulb,
  BookOpen,
  Megaphone,
};

export const ForumCategoryList: React.FC<ForumCategoryListProps> = ({
  categories,
  onSelectCategory,
  selectedCategorySlug,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
      {categories.map((cat) => {
        const IconComponent = (cat.icon && ICON_MAP[cat.icon]) || MessageSquare;
        const isSelected = selectedCategorySlug === cat.slug;

        return (
          <div
            key={cat.id}
            onClick={() => onSelectCategory(cat)}
            className={`group relative p-5 rounded-2xl border transition-all cursor-pointer ${
              isSelected
                ? "bg-slate-800/90 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-start justify-between">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105"
                style={{ backgroundColor: cat.color || "#6366f1" }}
              >
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {cat._count?.topics ?? 0} topics
              </span>
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
              {cat.name}
            </h3>
            <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {cat.description || "Discuss and collaborate with fellow builders."}
            </p>
          </div>
        );
      })}
    </div>
  );
};
