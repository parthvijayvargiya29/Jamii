import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ChefHat, LogOut, Sparkles, Package, Clock, AlertCircle } from "lucide-react";
import { clearAuthToken } from "@/lib/queryClient";
import { StaffAvailability } from "@/components/staff-availability";
import type { UserAvailability } from "@shared/schema";

export default function Landing() {
  const [, navigate] = useLocation();
  const { user, setUser } = useAuth();
  const isAdmin = user?.role === "admin";

  // Check if user has set availability
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery<{ availability: UserAvailability[] }>({
    queryKey: ["/api/shifts/availability"],
    queryFn: async () => {
      const res = await fetch("/api/shifts/availability", {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
  });

  // User has availability if they have at least one day marked as available
  const hasAvailability = availabilityData?.availability?.some(a => a.isAvailable) ?? false;

  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    navigate("/login");
  };

  // Show loading state while checking availability
  if (availabilityLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user hasn't set availability, show the availability form
  if (!hasAvailability) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl" data-testid="card-availability-required">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <Clock className="h-6 w-6" />
              Set Your Availability
            </CardTitle>
            <CardDescription>
              Welcome, {user?.name}! Before you can access the dashboard, please set your weekly availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Please mark at least one day as available to continue.</span>
            </div>
            <StaffAvailability />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isAdmin && (
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
              data-testid="button-my-availability"
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
