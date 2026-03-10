import { Compass } from "lucide-react";

export default function ExplorePage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Compass className="w-12 h-12 mb-4" />
      <p className="text-lg font-medium">탐색</p>
      <p className="text-sm mt-1">준비 중입니다</p>
    </div>
  );
}
