import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const STATIONS = ["Kitchen", "Bar", "Service"];

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
  const [showDetails, setShowDetails] = useState(false);

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
    if (!showDetails) {
      setShowDetails(true);
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
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto space-y-4" style={{ maxWidth: "calc(100% - 2rem)" }}>
        <Button
          variant="ghost"
          onClick={() => { if (showDetails) { setShowDetails(false); } else { navigate("/dashboard"); } }}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          {showDetails ? "Back to Calendar" : "Back to Dashboard"}
        </Button>

        {isAdmin && restaurantsData?.restaurants && !showDetails && (
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

        {!showDetails ? (
          <div className="flex flex-col items-center space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full p-4 [&_table]:w-full [&_table_th]:text-base [&_table_td]:text-base [&_table_td>button]:h-14 [&_table_td>button]:w-full [&_.rdp-caption_label]:text-lg [&_.rdp-nav_button]:h-9 [&_.rdp-nav_button]:w-9 [&_.rdp-head_cell]:py-2"
              data-testid="calendar-shift-date"
            />
            <div className="text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
            </div>
            <Button
              onClick={handleAllocate}
              className="w-full"
              data-testid="button-submit-shift"
            >
              Allocate Shift
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              Shift for <span className="font-medium text-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Station</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-sm font-medium">Start Time</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-start-time" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-sm font-medium">End Time</Label>
                <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-end-time" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Required Staff</Label>
              <Input type="number" min={1} value={requiredStaff} onChange={(e) => setRequiredStaff(parseInt(e.target.value) || 1)} data-testid="input-required-staff" />
            </div>

            <Button
              onClick={handleAllocate}
              className="w-full"
              disabled={createShiftMutation.isPending}
              data-testid="button-confirm-shift"
            >
              {createShiftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Allocation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
