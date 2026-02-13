import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const STATIONS = ["Kitchen", "Bar", "Service"];

export default function AllocateShiftPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const [shiftDate, setShiftDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [station, setStation] = useState(STATIONS[0]);
  const [requiredStaff, setRequiredStaff] = useState(1);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(user?.restaurantId || "");

  const { data: restaurantsData } = useQuery<{ restaurants: { id: string; name: string }[] }>({
    queryKey: ["/api/restaurants"],
    queryFn: async () => {
      const res = await fetch("/api/restaurants", {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch restaurants");
      return res.json();
    },
    enabled: isAdmin,
  });

  const effectiveRestaurantId = isAdmin ? selectedRestaurantId : (user?.restaurantId || "");

  const createShiftMutation = useMutation({
    mutationFn: async (data: { shiftDate: string; startTime: string; endTime: string; station: string; requiredStaff: number }) => {
      const res = await apiRequest("POST", "/api/shifts", { ...data, restaurantId: effectiveRestaurantId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shifts");
      }});
      toast({ title: "Shift allocated successfully" });
      navigate("/dashboard");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to allocate shift", description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRestaurantId) {
      toast({ variant: "destructive", title: "Please select a restaurant" });
      return;
    }
    createShiftMutation.mutate({ shiftDate, startTime, endTime, station, requiredStaff });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Allocate Shift
            </CardTitle>
            <CardDescription>
              Create a new shift and assign it to a station. Staff can then be assigned from the shift planner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {isAdmin && restaurantsData?.restaurants && (
                <div className="space-y-2">
                  <Label htmlFor="restaurant">Restaurant</Label>
                  <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                    <SelectTrigger data-testid="select-restaurant">
                      <SelectValue placeholder="Select restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurantsData.restaurants.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shiftDate" className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    Date
                  </Label>
                  <Input
                    id="shiftDate"
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    data-testid="input-shift-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="station" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Station
                  </Label>
                  <Select value={station} onValueChange={setStation}>
                    <SelectTrigger data-testid="select-station">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Start Time
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    data-testid="input-start-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    End Time
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    data-testid="input-end-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requiredStaff" className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Required Staff
                </Label>
                <Input
                  id="requiredStaff"
                  type="number"
                  min={1}
                  value={requiredStaff}
                  onChange={(e) => setRequiredStaff(parseInt(e.target.value) || 1)}
                  data-testid="input-required-staff"
                />
              </div>

              <Button type="submit" className="w-full" disabled={createShiftMutation.isPending} data-testid="button-submit-shift">
                {createShiftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Allocate Shift
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
