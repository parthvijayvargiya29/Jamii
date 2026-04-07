import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, setAuthToken, setRefreshToken } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, Delete, CheckCircle2, KeyRound } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function PinDisplay({ pin }: { pin: string }) {
  return (
    <div className="flex justify-center gap-4 my-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            pin.length > i
              ? "bg-primary border-primary"
              : "border-muted-foreground"
          }`}
        />
      ))}
    </div>
  );
}

function Numpad({ onPress, onDelete }: { onPress: (d: string) => void; onDelete: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k, i) =>
        k === "" ? (
          <div key={i} />
        ) : k === "del" ? (
          <Button
            key={i}
            variant="outline"
            size="lg"
            className="h-14 text-lg"
            onClick={onDelete}
            data-testid="button-pin-delete"
          >
            <Delete className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            key={i}
            variant="outline"
            size="lg"
            className="h-14 text-xl font-semibold"
            onClick={() => onPress(k)}
            data-testid={`button-pin-${k}`}
          >
            {k}
          </Button>
        )
      )}
    </div>
  );
}

function ClockInTab() {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [success, setSuccess] = useState<{ name: string; station: string | null } | null>(null);

  const { data: restaurantsData } = useQuery<{ restaurants: { id: string; name: string }[] }>({
    queryKey: ["/api/restaurants"],
  });

  const clockInMutation = useMutation({
    mutationFn: async (data: { pin: string; restaurantId: string }) => {
      const res = await fetch("/api/time-entries/pin-clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Clock-in failed");
      return json;
    },
    onSuccess: (data) => {
      setSuccess({ name: data.userName, station: data.station });
      setPin("");
      setTimeout(() => setSuccess(null), 4000);
    },
    onError: (error: Error) => {
      setPin("");
      toast({ variant: "destructive", title: error.message });
    },
  });

  const handlePress = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4 && restaurantId) {
      clockInMutation.mutate({ pin: next, restaurantId });
    }
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center" data-testid="clock-in-success">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <div>
          <p className="text-xl font-bold">{success.name}</p>
          {success.station && (
            <p className="text-muted-foreground text-sm mt-1">Station: {success.station}</p>
          )}
          <p className="text-green-600 font-medium mt-2">Clocked in successfully!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Restaurant</label>
        <Select value={restaurantId} onValueChange={setRestaurantId}>
          <SelectTrigger data-testid="select-clock-in-restaurant">
            <SelectValue placeholder="Select your restaurant" />
          </SelectTrigger>
          <SelectContent>
            {restaurantsData?.restaurants?.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-center text-muted-foreground">
        {restaurantId ? "Enter your 4-digit PIN" : "Select a restaurant to continue"}
      </p>

      <PinDisplay pin={pin} />

      <div className={!restaurantId ? "opacity-40 pointer-events-none" : ""}>
        {clockInMutation.isPending ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Numpad onPress={handlePress} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { setUser } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAuthToken(data.accessToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      setUser(data.user);
      toast({ title: "Welcome back!", description: `Logged in as ${data.user.name}` });
      setTimeout(() => navigate("/landing"), 50);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Login failed", description: error.message || "Invalid email or password" });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" data-testid="card-login">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold" data-testid="text-login-title">
            Restaurant Ops
          </CardTitle>
          <CardDescription>Sign in or clock in for your shift</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1" data-testid="tab-login">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </TabsTrigger>
              <TabsTrigger value="clockin" className="flex-1" data-testid="tab-clockin">
                <KeyRound className="h-4 w-4 mr-2" />
                Clock In
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" data-testid="input-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Your password" data-testid="input-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                    {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                    Sign In
                  </Button>
                </form>
              </Form>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link href="/signup" className="text-primary hover:underline" data-testid="link-signup">
                  Create an account
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="clockin">
              <ClockInTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
