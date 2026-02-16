import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import logo from "@/assets/freesol-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, role, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user && role) {
      if (role === "admin" || role === "office_worker") {
        navigate("/dashboard");
      }
    }
  }, [user, role, isLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      console.error("Login error:", error);
      if (error.message.includes("Invalid login credentials")) {
        toast.error("פרטי ההתחברות שגויים");
      } else {
        toast.error("שגיאה בהתחברות: " + error.message);
      }
      setIsSubmitting(false);
      return;
    }

    toast.success("התחברת בהצלחה!");
    // Navigation will happen via useEffect when user/role updates
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardContent className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logo} alt="FreeSol" className="h-24 w-auto" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            כניסה למערכת
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            הזינו את פרטי ההתחברות שלכם
          </p>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                כתובת מייל
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="הזינו כתובת מייל"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-right"
                required
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                סיסמא
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="הזינו סיסמא"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-right pl-12"
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg rounded-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  מתחבר...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  התחברות
                  <ArrowLeft className="h-5 w-5" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
