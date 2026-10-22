import { useNavigate } from "react-router-dom";
import { Activity, Home } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-industrial-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-primary/20 flex items-center justify-center mx-auto mb-4">
          <Activity className="w-6 h-6 text-brand-primary" />
        </div>
        <h1 className="text-4xl font-mono font-bold text-muted-foreground mb-2">404</h1>
        <p className="text-lg font-semibold text-white mb-1">Page Not Found</p>
        <p className="text-sm text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors mx-auto"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
