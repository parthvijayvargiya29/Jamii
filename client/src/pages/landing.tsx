import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ChefHat, LogOut, Sparkles, Package, Clock } from "lucide-react";
import { clearAuthToken } from "@/lib/queryClient";

export default function Landing() {
  const [, navigate] = useLocation();
  const { user, setUser } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canAccessDashboard = isAdmin || isManager;

  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg" data-testid="card-landing">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold" data-testid="text-welcome">
              Welcome, {user?.name}
            </CardTitle>
            <CardDescription>
              {user?.role === "admin" && "Administrator Access"}
              {user?.role === "manager" && "Manager Access"}
              {user?.role === "staff" && "Staff Access"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {canAccessDashboard && (
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => navigate("/dashboard")}
                  data-testid="button-dashboard"
                >
                  <LayoutDashboard className="h-8 w-8" />
                  <span>Dashboard</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate("/recipes")}
                data-testid="button-recipes"
              >
                <ChefHat className="h-8 w-8" />
                <span>Recipes</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate("/cleaning")}
                data-testid="button-cleaning"
              >
                <Sparkles className="h-8 w-8" />
                <span>Cleaning Tasks</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate("/inventory")}
                data-testid="button-inventory"
              >
                <Package className="h-8 w-8" />
                <span>Inventory</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate("/availability")}
                data-testid="button-availability"
              >
                <Clock className="h-8 w-8" />
                <span>My Availability</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
    </div>
  );
}
