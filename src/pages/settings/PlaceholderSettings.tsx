import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PlaceholderSettings({ title }: { title: string }) {
  return (
    <Card className="rounded-2xl max-w-2xl">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <Construction className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground">Kommt bald – dieser Bereich wird in einer späteren Version verfügbar sein.</p>
      </CardContent>
    </Card>
  );
}
