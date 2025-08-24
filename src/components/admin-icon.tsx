import { Shield } from "lucide-react";

export function AdminIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return <Shield className={className + " text-muted-foreground"} />;
}
