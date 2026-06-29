import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth";
import logoAsset from "@/assets/hireflow-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — HireFlow" },
      { name: "description", content: "Sign in to HireFlow, the AI-assisted hiring workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("jordan.avery@riverside-clinic.example");
  const [password, setPassword] = useState("password");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Enter your email and password to continue.");
      return;
    }
    login();
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[image:var(--gradient-brand-soft)] px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-teal/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoAsset} alt="HireFlow" className="mb-3 h-20 w-auto object-contain" />
          <p className="text-sm text-muted-foreground">AI-assisted hiring management</p>
        </div>

        <div className="rounded-xl border border-border bg-card/90 p-6 shadow-[var(--shadow-elevated)] backdrop-blur">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.example"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => toast.info("Password reset isn't available in this demo.")}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
