import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ChevronLeft, ChevronRight, Calendar, X, CalendarDays } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, getDay } from "date-fns";
import type { UserAvailability } from "@shared/schema";

const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AvailabilityEntry {
  dayOfWeek: number;
  specificDate: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  id?: string;
}

interface StaffAvailabilityProps {
  userId?: string;
  isReadOnly?: boolean;
}

export function StaffAvailability({ userId, isReadOnly = false }: StaffAvailabilityProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateAvailability, setDateAvailability] = useState<AvailabilityEntry | null>(null);

  // Fetch current availability
  const { data: availabilityData, isLoading } = useQuery<{ availability: UserAvailability[] }>({
    queryKey: userId ? ["/api/shifts/availability", userId] : ["/api/shifts/availability"],
    queryFn: async () => {
      const url = userId ? `/api/shifts/availability/${userId}` : "/api/shifts/availability";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    staleTime: 0,
  });

  // Get availability map by date
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, UserAvailability>();
    if (availabilityData?.availability) {
      availabilityData.availability
        .filter(av => av.specificDate)
        .forEach(av => map.set(av.specificDate!, av));
    }
    return map;
  }, [availabilityData?.availability]);

  // Update date availability when a date is selected
  const handleDateSelect = (day: Date) => {
    setSelectedDate(day);
    const dateStr = format(day, "yyyy-MM-dd");
    const existing = availabilityByDate.get(dateStr);
    
    if (existing) {
      setDateAvailability({
        dayOfWeek: getDay(day),
        specificDate: dateStr,
        startTime: existing.startTime,
        endTime: existing.endTime,
        isAvailable: existing.isAvailable ?? true,
        id: existing.id,
      });
    } else {
      setDateAvailability({
        dayOfWeek: getDay(day),
        specificDate: dateStr,
        startTime: "09:00",
        endTime: "17:00",
        isAvailable: true,
      });
    }
  };

  // Save availability mutation
  const saveMutation = useMutation({
    mutationFn: async (entry: AvailabilityEntry) => {
      const res = await apiRequest("POST", "/api/shifts/availability", {
        dayOfWeek: entry.dayOfWeek,
        specificDate: entry.specificDate,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isAvailable: entry.isAvailable,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/shifts/availability";
        }
      });
      toast({ title: "Availability saved" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to save", description: err.message });
    },
  });

  const updateDateAvailability = (updates: Partial<AvailabilityEntry>) => {
    if (dateAvailability) {
      setDateAvailability({ ...dateAvailability, ...updates });
    }
  };

  const saveDateAvailability = () => {
    if (dateAvailability) {
      saveMutation.mutate(dateAvailability);
    }
  };

  const clearSelection = () => {
    setSelectedDate(null);
    setDateAvailability(null);
  };

  // Navigation
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  // Get days for the calendar grid
  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start, end });
      
      // Add padding days from previous month
      const startDayOfWeek = getDay(start);
      const paddingBefore = Array(startDayOfWeek).fill(null);
      
      return [...paddingBefore, ...days];
    } else {
      // Weekly view
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);

  // Get header text
  const headerText = useMemo(() => {
    if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy");
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
      }
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
  }, [currentDate, viewMode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click on a date to set your availability.
        </p>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
            data-testid="button-view-week"
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
            data-testid="button-view-month"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Month
          </Button>
        </div>
      </div>
      
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goToPrevious} data-testid="button-prev">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold" data-testid="text-current-period">
          {headerText}
        </h3>
        <Button variant="outline" size="icon" onClick={goToNext} data-testid="button-next">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {SHORT_DAY_NAMES.map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className={cn("h-10", viewMode === "week" && "h-16")} />;
          }
          const dateStr = format(day, "yyyy-MM-dd");
          const availability = availabilityByDate.get(dateStr);
          const hasAvailability = !!availability;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isAvailable = availability?.isAvailable ?? false;
          const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;

          return (
            <Button
              key={dateStr}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className={cn(
                viewMode === "month" ? "h-10" : "h-16 flex-col",
                "relative",
                !isCurrentMonth && "opacity-50",
                hasAvailability && isAvailable && !isSelected && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
                hasAvailability && !isAvailable && !isSelected && "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
              )}
              onClick={() => handleDateSelect(day)}
              data-testid={`calendar-day-${dateStr}`}
            >
              <span className={viewMode === "week" ? "text-lg font-semibold" : ""}>
                {format(day, "d")}
              </span>
              {viewMode === "week" && hasAvailability && (
                <span className="text-xs mt-1">
                  {isAvailable ? `${availability?.startTime?.slice(0, 5)}` : "Off"}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" />
          <span>Not available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" />
          <span>Not set</span>
        </div>
      </div>

      {/* Selected Date Editor */}
      {selectedDate && dateAvailability && (
        <Card className="mt-4" data-testid="card-date-editor">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
                {availabilityByDate.has(format(selectedDate, "yyyy-MM-dd")) && (
                  <Badge variant="secondary" className="ml-2">Saved</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={clearSelection} data-testid="button-close-editor">
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Switch
                checked={dateAvailability.isAvailable}
                onCheckedChange={(checked) => updateDateAvailability({ isAvailable: checked })}
                disabled={isReadOnly}
                data-testid="switch-date-available"
              />
              <Label>{dateAvailability.isAvailable ? "Available" : "Not available"}</Label>
            </div>
            
            {dateAvailability.isAvailable && (
              <div className="flex items-center gap-3">
                <Label>Hours:</Label>
                <Input
                  type="time"
                  value={dateAvailability.startTime}
                  onChange={(e) => updateDateAvailability({ startTime: e.target.value })}
                  className="w-28"
                  disabled={isReadOnly}
                  data-testid="input-date-start"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={dateAvailability.endTime}
                  onChange={(e) => updateDateAvailability({ endTime: e.target.value })}
                  className="w-28"
                  disabled={isReadOnly}
                  data-testid="input-date-end"
                />
              </div>
            )}

            {!isReadOnly && (
              <Button
                onClick={saveDateAvailability}
                disabled={saveMutation.isPending}
                className="w-full"
                data-testid="button-save-date"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : `Save for ${format(selectedDate, "MMM d")}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
