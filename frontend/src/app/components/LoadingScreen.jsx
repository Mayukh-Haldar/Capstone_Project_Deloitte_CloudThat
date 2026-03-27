import { Calendar } from "lucide-react";
export function LoadingScreen() {
    return (<div className="flex items-center justify-center size-full bg-background">
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="size-16 bg-[#1132d4] rounded-xl flex items-center justify-center animate-pulse">
            <Calendar className="size-8 text-white"/>
          </div>
          <div className="absolute inset-0 bg-[#1132d4]/20 rounded-xl animate-ping"/>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">EventZen</h2>
          <p className="text-sm text-muted-foreground">Loading your experience...</p>
        </div>
      </div>
    </div>);
}
