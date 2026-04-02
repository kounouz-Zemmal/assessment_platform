import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { GraduationCap } from "lucide-react";
import { setCurrentUser } from "../mockData";
import { toast } from "sonner";
import { apiGet } from "../apiClient";

const DEMO_TEACHER_EMAIL = "teacher.analytics@demo.edu";
const DEMO_STUDENT_EMAIL = "student.aya@demo.edu";

export default function Login() {
  const [email, setEmail] = useState(DEMO_TEACHER_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (email !== DEMO_TEACHER_EMAIL && email !== DEMO_STUDENT_EMAIL) {
      setError("Use one of the demo accounts shown below.");
      setLoading(false);
      return;
    }

    try {
      const data = await apiGet<{
        user: {
          id: string;
          firstName?: string;
          lastName?: string;
          email: string;
          name: string;
          role: "admin" | "teacher" | "student";
          status: "active" | "inactive";
          createdAt: string;
        };
      }>("auth/demo-user", { email });

      const user = data.user;
      setCurrentUser(user);
      toast.success(`Welcome back, ${user.name}!`);

      if (user.role === "teacher") {
        navigate("/teacher");
      } else if (user.role === "student") {
        navigate("/student");
      } else {
        navigate("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            University Assessment Platform
          </CardTitle>
          <CardDescription>Sign in to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant={email === DEMO_TEACHER_EMAIL ? "default" : "outline"}
                onClick={() => setEmail(DEMO_TEACHER_EMAIL)}
              >
                Use Teacher Demo
              </Button>
              <Button
                type="button"
                variant={email === DEMO_STUDENT_EMAIL ? "default" : "outline"}
                onClick={() => setEmail(DEMO_STUDENT_EMAIL)}
              >
                Use Student Demo
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline"
                onClick={() =>
                  toast.info(
                    "Please contact your administrator to reset your password.",
                  )
                }
              >
                Forgot password?
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Demo Accounts:
            </p>
            <div className="space-y-1 text-xs text-gray-600">
              <p>Teacher: {DEMO_TEACHER_EMAIL}</p>
              <p>Student: {DEMO_STUDENT_EMAIL}</p>
              <p className="text-gray-500 mt-2 italic">Use any password</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
