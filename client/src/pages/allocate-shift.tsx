import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, addWeeks, subWeeks, addDays, subDays } from "date-fns";
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

const STATIONS = ["Kitchen", "Bar", "Service"];

type ViewMode = "day" | "week";

const STATION_COLORS: Record<string, string> = {
  Kitchen: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  Bar: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Service: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
};

export default function AllocateShiftPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
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

  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    }
    return { start: currentDate, end: currentDate };
  }, [viewMode, currentDate]);

  const { data: shiftsData } = useQuery<{ shifts: any[] }>({
    queryKey: ["/api/shifts", effectiveRestaurantId, format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      const res = await fetch(`/api/shifts?restaurantId=${effectiveRestaurantId}&startDate=${format(dateRange.start, "yyyy-MM-dd")}&endDate=${format(dateRange.end, "yyyy-MM-dd")}`, {
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
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      return eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
    }
    return [currentDate];
  }, [viewMode, currentDate]);

  const navigatePrev = () => {
    if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const navigateNext = () => {
    if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const headerLabel = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "d, yyyy")}`;
      }
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }, [viewMode, currentDate]);

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

  const renderShiftItems = (dayShifts: any[], maxItems: number) => (
    <div className="flex-1 mt-0.5 space-y-0.5 overflow-hidden">
      {dayShifts.slice(0, maxItems).map((shift: any, i: number) => {
        const shiftStation = shift.station || "Kitchen";
        return (
          <div
            key={shift.id || i}
            className={cn(
              "text-[10px] sm:text-xs leading-tight px-1 py-0.5 rounded truncate",
              STATION_COLORS[shiftStation] || "bg-muted text-muted-foreground"
            )}
          >
            {shiftStation} {shift.startTime || shift.start_time}
          </div>
        );
      })}
      {dayShifts.length > maxItems && (
        <div className="text-[10px] text-muted-foreground px-1">+{dayShifts.length - maxItems} more</div>
      )}
    </div>
  );

  const renderDayView = () => {
    const dateKey = format(currentDate, "yyyy-MM-dd");
    const dayShifts = shiftsByDate[dateKey] || [];
    const isDayToday = isToday(currentDate);
    const isSelected = isSameDay(currentDate, selectedDate);

    return (
      <div className="border rounded-md overflow-hidden">
        <div className="text-center text-xs font-medium text-muted-foreground py-2 border-b bg-muted/30">
          {format(currentDate, "EEEE")}
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(currentDate)}
          className={cn(
            "w-full min-h-[24rem] p-3 text-left transition-colors flex flex-col",
            "hover:bg-muted/20",
            isSelected && "ring-2 ring-primary ring-inset bg-primary/5"
          )}
          data-testid={`calendar-day-${dateKey}`}
        >
          <span className={cn(
            "text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full",
            isDayToday && "bg-primary text-primary-foreground"
          )}>
            {format(currentDate, "d")}
          </span>
          <div className="flex-1 mt-2 space-y-1 overflow-auto">
            {dayShifts.map((shift: any, i: number) => {
              const shiftStation = shift.station || "Kitchen";
              return (
                <div
                  key={shift.id || i}
                  className={cn(
                    "text-sm px-2 py-1.5 rounded",
                    STATION_COLORS[shiftStation] || "bg-muted text-muted-foreground"
                  )}
                >
                  <span className="font-medium">{shiftStation}</span>
                  <span className="ml-2 opacity-80">{shift.startTime || shift.start_time} - {shift.endTime || shift.end_time}</span>
                  {(shift.requiredStaff || shift.required_staff) && (
                    <span className="ml-2 opacity-60">{shift.requiredStaff || shift.required_staff} staff</span>
                  )}
                </div>
              );
            })}
            {dayShifts.length === 0 && (
              <div className="text-sm text-muted-foreground/50 text-center mt-8">No shifts</div>
            )}
          </div>
        </button>
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="grid grid-cols-7 border rounded-md overflow-hidden">
      {calendarDays.map(day => (
        <div key={format(day, "EEE")} className="text-center text-xs font-medium text-muted-foreground py-2 border-b bg-muted/30">
          {format(day, "EEE")}
        </div>
      ))}
      {calendarDays.map(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayShifts = shiftsByDate[dateKey] || [];
        const isSelected = isSameDay(day, selectedDate);
        const isDayToday = isToday(day);

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => setSelectedDate(day)}
            className={cn(
              "relative border-r min-h-[10rem] sm:min-h-[14rem] p-1 text-left transition-colors flex flex-col",
              "hover:bg-muted/20",
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
            {renderShiftItems(dayShifts, 5)}
          </button>
        );
      })}
    </div>
  );


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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={navigatePrev} data-testid="button-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-base sm:text-lg font-semibold px-2 min-w-0" data-testid="text-current-period">{headerLabel}</h2>
                <Button variant="outline" size="icon" onClick={navigateNext} data-testid="button-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="ml-1 text-xs" data-testid="button-today">
                  Today
                </Button>
              </div>
              <div className="flex items-center rounded-md border overflow-hidden">
                {(["day", "week"] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-3 py-1.5 text-xs sm:text-sm font-medium capitalize transition-colors",
                      viewMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                    data-testid={`button-view-${mode}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}

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
