import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Clock, MapPin, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const STATIONS = ["Kitchen", "Bar", "Service"];

const STATION_COLORS: Record<string, string> = {
  Kitchen: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
  Bar: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  Service: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300",
};

export default function AllocateShiftPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  const handleAllocate = () => {
    if (!effectiveRestaurantId) {
      toast({ variant: "destructive", title: "Please select a restaurant" });
      return;
    }
    createShiftMutation.mutate({
      shiftDate: format(selectedDate, "yyyy-MM-dd"),
      startTime,
      endTime,
      station,
      requiredStaff,
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-lg font-semibold">Allocate Shift</h1>
        </div>

        {isAdmin && restaurantsData?.restaurants && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground shrink-0">Restaurant:</Label>
            <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
              <SelectTrigger className="max-w-xs" data-testid="select-restaurant">
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

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Selected:</span>
              <span className="font-medium text-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Station
              </Label>
              <div className="flex flex-wrap gap-2">
                {STATIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStation(s)}
                    className={cn(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all border",
                      station === s
                        ? cn(STATION_COLORS[s], "border-current ring-1 ring-current/20")
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                    )}
                    data-testid={`button-station-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="flex items-center gap-1.5 text-sm font-medium">
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
                <Label htmlFor="endTime" className="flex items-center gap-1.5 text-sm font-medium">
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
              <Label htmlFor="requiredStaff" className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                Required Staff
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setRequiredStaff(Math.max(1, requiredStaff - 1))}
                  data-testid="button-staff-minus"
                >
                  -
                </Button>
                <span className="text-lg font-semibold w-8 text-center" data-testid="text-required-staff">{requiredStaff}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setRequiredStaff(requiredStaff + 1)}
                  data-testid="button-staff-plus"
                >
                  +
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-3 bg-muted/20">
              <div className="text-xs text-muted-foreground mb-1.5">Shift Summary</div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{format(selectedDate, "EEE, MMM d")}</span>
                <Badge variant="outline" className={cn(STATION_COLORS[station])}>
                  {station}
                </Badge>
                <span className="text-muted-foreground">{startTime} - {endTime}</span>
                <span className="text-muted-foreground">{requiredStaff} staff</span>
              </div>
            </div>

            <Button
              onClick={handleAllocate}
              className="w-full"
              disabled={createShiftMutation.isPending}
              data-testid="button-submit-shift"
            >
              {createShiftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Allocate Shift
            </Button>
          </div>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              data-testid="calendar-shift-date"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
