import { Switch, Route, Redirect } from "wouter";
import { queryClient, getAuthToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import RecipesPage from "@/pages/recipes";
import RecipeDetailPage from "@/pages/recipe-detail";
import CleaningTasksPage from "@/pages/cleaning";
import InventoryPage from "@/pages/inventory";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ 
  component: Component, 
  requireRole 
}: { 
  component: () => JSX.Element; 
  requireRole?: ("admin" | "manager")[];
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const hasToken = !!getAuthToken();

  // Show loading while auth state is being determined
  // But only if we have a token (meaning user might be authenticated)
  if (isLoading && hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login only if not authenticated AND no token present
  if (!isAuthenticated && !hasToken) {
    return <Redirect to="/login" />;
  }

  // If we have a token but user isn't loaded yet, show loading
  if (!isAuthenticated && hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requireRole && user && !requireRole.includes(user.role as "admin" | "manager")) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/landing">
        {() => <ProtectedRoute component={Landing} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} requireRole={["admin", "manager"]} />}
      </Route>
      <Route path="/recipes/:id">
        {() => <ProtectedRoute component={RecipeDetailPage} />}
      </Route>
      <Route path="/recipes">
        {() => <ProtectedRoute component={RecipesPage} />}
      </Route>
      <Route path="/cleaning">
        {() => <ProtectedRoute component={CleaningTasksPage} />}
      </Route>
      <Route path="/inventory">
        {() => <ProtectedRoute component={InventoryPage} />}
      </Route>
      <Route path="/">
        {() => <Redirect to="/recipes" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
