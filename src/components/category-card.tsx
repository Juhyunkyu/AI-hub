"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageCircle,
  HelpCircle,
  FileText,
  Code,
  Palette,
  LucideIcon,
} from "lucide-react";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
};

const iconMap: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "help-circle": HelpCircle,
  "file-text": FileText,
  code: Code,
  palette: Palette,
};

const colorMap: Record<string, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
  green: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
  purple: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100",
  orange: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  pink: "bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100",
};

interface CategoryCardProps {
  category: Category;
  isMobile?: boolean;
}

export function CategoryCard({
  category,
  isMobile = false,
}: CategoryCardProps) {
  const IconComponent = category.icon ? iconMap[category.icon] : MessageCircle;
  const colorClass = category.color ? colorMap[category.color] : colorMap.blue;

  if (isMobile) {
    return (
      <Link href={`/categories/${category.slug}`}>
        <Card className="transition-all duration-200 active:scale-95 cursor-pointer bg-card border-border shadow-sm">
          <CardContent className="p-2">
            <div className="text-center">
              <h3 className="font-semibold text-sm whitespace-nowrap text-foreground">
                {category.name}
              </h3>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/categories/${category.slug}`}>
      <Card
        className={`transition-all duration-200 hover:shadow-md cursor-pointer ${colorClass}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <IconComponent className="h-5 w-5" />
          </div>
          <CardTitle className="text-sm">{category.name}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {category.description && (
            <p className="text-xs opacity-80">{category.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
