import { Home, Search } from "lucide-react";
import { Link } from "react-router";
export function NotFound() {
    return (<div className="flex items-center justify-center size-full bg-background">
      <div className="text-center space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-[120px] font-bold text-primary/20">404</h1>
          <h2 className="text-3xl font-bold text-foreground">Page Not Found</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex gap-4 justify-center pt-4">
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Home className="size-5"/>
            Go Home
          </Link>
          <Link to="/events" className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors">
            <Search className="size-5"/>
            Browse Events
          </Link>
        </div>
      </div>
    </div>);
}
