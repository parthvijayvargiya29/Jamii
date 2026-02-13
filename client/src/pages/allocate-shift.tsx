import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STATIONS = ["Kitchen", "Bar", "Service"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATION_COLORS: Record<string, string> = {
  Kitchen: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  Bar: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Service: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
};

export default function AllocateShiftPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  const { data: shiftsData } = useQuery<{ shifts: any[] }>({
    queryKey: ["/api/shifts", effectiveRestaurantId, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const res = await fetch(`/api/shifts?restaurantId=${effectiveRestaurantId}&startDate=${monthStart}&endDate=${monthEnd}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
    enabled: !!effectiveRestaurantId,
  });

  const shiftsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (shiftsData?.shifts) {
      for (const shift of shiftsData.shifts) {
        const dateKey = shift.shiftDate || shift.shift_date;
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(shift);
      }
    }
    return map;
  }, [shiftsData]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

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
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="mx-auto space-y-3" style={{ maxWidth: "calc(100% - 1rem)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
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
                <SelectTrigger className="w-[180px]" data-testid="select-restaurant">
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
        </div>

        {!showDetails ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold" data-testid="text-current-month">{format(currentMonth, "MMMM yyyy")}</h2>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 border rounded-md overflow-hidden">
              {WEEKDAYS.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2 border-b bg-muted/30">
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayShifts = shiftsByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);
                const isDayToday = isToday(day);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "relative border-b border-r min-h-[5rem] sm:min-h-[6rem] p-1 text-left transition-colors flex flex-col",
                      !isCurrentMonth && "bg-muted/10 text-muted-foreground/40",
                      isCurrentMonth && "hover:bg-muted/20",
                      isSelected && "ring-2 ring-primary ring-inset bg-primary/5"
                    )}
                    data-testid={`calendar-day-${dateKey}`}
                  >
                    <span className={cn(
                      "text-xs sm:text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                      isDayToday && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    <div className="flex-1 mt-0.5 space-y-0.5 overflow-hidden">
                      {dayShifts.slice(0, 3).map((shift: any, i: number) => {
                        const shiftStation = shift.station || "Kitchen";
                        return (
                          <div
                            key={shift.id || i}
                            className={cn(
                              "text-[10px] leading-tight px-1 py-0.5 rounded truncate",
                              STATION_COLORS[shiftStation] || "bg-muted text-muted-foreground"
                            )}
                          >
                            {shiftStation} {shift.startTime || shift.start_time}
                          </div>
                        );
                      })}
                      {dayShifts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayShifts.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
              </div>
              <Button
                onClick={handleAllocate}
                data-testid="button-submit-shift"
              >
                Allocate Shift
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
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
