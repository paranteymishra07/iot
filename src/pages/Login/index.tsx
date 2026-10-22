import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";
import { Activity, Eye, EyeOff, AlertCircle } from "lucide-react";
import loginBg from "@/assets/login-bg.jpg";

export default function LoginPage() {
  const [email, setEmail] = useState("superadmin@bytematrix.com");
  const [password, setPassword] = useState("super123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      const role = useAuthStore.getState().user?.role;
      navigate(role === "operator" ? "/operator" : "/");
    } else {
      setError("Invalid email or password. Try superadmin@bytematrix.com / super123");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-industrial-bg">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${loginBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-industrial-bg via-industrial-bg/90 to-industrial-bg/80" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />

      {/* Card */}
      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-glow">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">ByteMatrix IoT</div>
            <div className="text-xs text-muted-foreground tracking-widest uppercase">Industrial Intelligence</div>
          </div>
        </div>

        <div className="industrial-card p-6 shadow-2xl border-industrial-border">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-white">Sign In</h1>
            <p className="text-sm text-muted-foreground mt-1">Access your plant monitoring platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-industrial-surface border border-industrial-border rounded-md px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-status-down/10 border border-status-down/30 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 text-status-down mt-0.5 flex-shrink-0" />
                <p className="text-xs text-status-down">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-60 text-white font-semibold py-2.5 rounded-md transition-colors text-sm"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-4 p-3 bg-industrial-surface rounded-md border border-industrial-border">
            <p className="text-[11px] text-muted-foreground font-medium mb-1">Demo Credentials</p>
            <div className="space-y-0.5 text-[11px] font-mono">
              <p className="text-muted-foreground">superadmin@bytematrix.com / super123</p>
              <p className="text-muted-foreground/60">ravi@abcmfg.com / admin123</p>
              <p className="text-muted-foreground/60">rajesh@abcmfg.com / password</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-4">
          © 2026 ByteMatrix Technologies · All rights reserved
        </p>
      </div>
    </div>
  );
}
