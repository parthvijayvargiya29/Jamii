import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LayoutDashboard, ChefHat, LogOut } from "lucide-react";
import { clearAuthToken } from "@/lib/queryClient";

export default function Landing() {
  const [, navigate] = useLocation();
  const { user, setUser } = useAuth();
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  const canAccessDashboard = user?.role === "admin" || user?.role === "manager";

  const handleDashboardClick = () => {
    setShowRoleDialog(true);
  };

  const handleDashboardConfirm = () => {
    setShowRoleDialog(false);
    if (canAccessDashboard) {
      navigate("/dashboard");
    }
  };

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={handleDashboardClick}
              data-testid="button-dashboard"
            >
              <LayoutDashboard className="h-8 w-8" />
              <span>Dashboard</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => navigate("/recipes")}
              data-testid="button-recipes"
            >
              <ChefHat className="h-8 w-8" />
              <span>Recipes</span>
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

      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent data-testid="dialog-role-verify">
          <AlertDialogHeader>
            <AlertDialogTitle>Role Verification</AlertDialogTitle>
            <AlertDialogDescription>
              {canAccessDashboard ? (
                <>
                  Your role: <strong className="text-foreground">{user?.role}</strong>
                  <br />
                  You have access to the dashboard with analytics and management features.
                </>
              ) : (
                <>
                  Your role: <strong className="text-foreground">{user?.role}</strong>
                  <br />
                  The dashboard is only available to Admin and Manager roles. 
                  You can still view recipes and inventory data.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-dialog-cancel">Cancel</AlertDialogCancel>
            {canAccessDashboard ? (
              <AlertDialogAction onClick={handleDashboardConfirm} data-testid="button-dialog-continue">
                Continue to Dashboard
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={() => setShowRoleDialog(false)} data-testid="button-dialog-ok">
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
