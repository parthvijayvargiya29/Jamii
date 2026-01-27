import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, Save, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import type { UserAvailability } from "@shared/schema";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AvailabilityEntry {
  dayOfWeek: number;
  specificDate?: string | null;
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
  const [activeTab, setActiveTab] = useState<"weekly" | "calendar">("weekly");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize availability state for all days
  const defaultAvailability: AvailabilityEntry[] = DAY_NAMES.map((_, i) => ({
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    isAvailable: false,
  }));

  const [localAvailability, setLocalAvailability] = useState<AvailabilityEntry[]>(defaultAvailability);
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

  // Update local state when data is fetched
  useEffect(() => {
    if (availabilityData?.availability && !hasChanges) {
      const updated = [...defaultAvailability];
      // Only set weekly (non-specific-date) availability
      availabilityData.availability
        .filter(av => !av.specificDate)
        .forEach(av => {
          updated[av.dayOfWeek] = {
            dayOfWeek: av.dayOfWeek,
            startTime: av.startTime,
            endTime: av.endTime,
            isAvailable: av.isAvailable ?? true,
            id: av.id,
          };
        });
      setLocalAvailability(updated);
    }
  }, [availabilityData?.availability, hasChanges]);

  // Update date availability when a date is selected
  useEffect(() => {
    if (selectedDate && availabilityData?.availability) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const specificEntry = availabilityData.availability.find(av => av.specificDate === dateStr);
      
      if (specificEntry) {
        setDateAvailability({
          dayOfWeek: getDay(selectedDate),
          specificDate: dateStr,
          startTime: specificEntry.startTime,
          endTime: specificEntry.endTime,
          isAvailable: specificEntry.isAvailable ?? true,
          id: specificEntry.id,
        });
      } else {
        // Use weekly default for that day
        const dayOfWeek = getDay(selectedDate);
        const weeklyEntry = localAvailability[dayOfWeek];
        setDateAvailability({
          dayOfWeek,
          specificDate: dateStr,
          startTime: weeklyEntry?.startTime || "09:00",
          endTime: weeklyEntry?.endTime || "17:00",
          isAvailable: weeklyEntry?.isAvailable || false,
        });
      }
    } else {
      setDateAvailability(null);
    }
  }, [selectedDate, availabilityData?.availability, localAvailability]);

  // Get dates with specific availability set
  const datesWithOverrides = useMemo(() => {
    if (!availabilityData?.availability) return new Set<string>();
    return new Set(
      availabilityData.availability
        .filter(av => av.specificDate)
        .map(av => av.specificDate!)
    );
  }, [availabilityData?.availability]);

  // Save availability mutation
  const saveMutation = useMutation({
    mutationFn: async (entry: AvailabilityEntry) => {
      const res = await apiRequest("POST", "/api/shifts/availability", {
        dayOfWeek: entry.dayOfWeek,
        specificDate: entry.specificDate || null,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isAvailable: entry.isAvailable,
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all availability-related queries (base and user-specific)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "/api/shifts/availability";
        }
      });
      toast({ title: "Availability saved" });
      setHasChanges(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to save", description: err.message });
    },
  });

  const updateDay = (dayOfWeek: number, updates: Partial<AvailabilityEntry>) => {
    setLocalAvailability(prev => {
      const updated = [...prev];
      updated[dayOfWeek] = { ...updated[dayOfWeek], ...updates };
      return updated;
    });
    setHasChanges(true);
  };

  const saveDay = (dayOfWeek: number) => {
    const entry = localAvailability[dayOfWeek];
    saveMutation.mutate(entry);
  };

  const updateDateAvailability = (updates: Partial<AvailabilityEntry>) => {
    if (dateAvailability) {
      setDateAvailability({ ...dateAvailability, ...updates });
      setHasChanges(true);
    }
  };

  const saveDateAvailability = () => {
    if (dateAvailability) {
      saveMutation.mutate(dateAvailability);
    }
  };

  // Calendar navigation
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Get days for the calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days from previous month
    const startDayOfWeek = getDay(start);
    const paddingBefore = Array(startDayOfWeek).fill(null);
    
    return [...paddingBefore, ...days];
  }, [currentMonth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "weekly" | "calendar")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weekly" data-testid="tab-weekly">
            <Clock className="h-4 w-4 mr-2" />
            Weekly Schedule
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Specific Dates
          </TabsTrigger>
        </TabsList>

        {/* Weekly Schedule Tab */}
        <TabsContent value="weekly" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set your recurring weekly availability. This applies to all weeks unless overridden for specific dates.
          </p>
          {DAY_NAMES.map((day, index) => {
            const entry = localAvailability[index];
            return (
              <div
                key={day}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  entry?.isAvailable ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/50"
                )}
              >
                <Switch
                  checked={entry?.isAvailable || false}
                  onCheckedChange={(checked) => updateDay(index, { isAvailable: checked })}
                  disabled={isReadOnly}
                  data-testid={`switch-available-${index}`}
                />
                <span className="w-24 font-medium">{day}</span>
                {entry?.isAvailable && (
                  <>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={entry.startTime}
                      onChange={(e) => updateDay(index, { startTime: e.target.value })}
                      className="w-28"
                      disabled={isReadOnly}
                      data-testid={`input-start-${index}`}
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={entry.endTime}
                      onChange={(e) => updateDay(index, { endTime: e.target.value })}
                      className="w-28"
                      disabled={isReadOnly}
                      data-testid={`input-end-${index}`}
                    />
                  </>
                )}
                <div className="flex-1" />
                {!isReadOnly && (
                  <Button
                    size="sm"
                    onClick={() => saveDay(index)}
                    disabled={saveMutation.isPending}
                    data-testid={`button-save-${index}`}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Override your availability for specific dates. Click on a date to set custom hours.
          </p>
          
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
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
                return <div key={`empty-${index}`} className="h-10" />;
              }
              const dateStr = format(day, "yyyy-MM-dd");
              const hasOverride = datesWithOverrides.has(dateStr);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dayOfWeek = getDay(day);
              const weeklyEntry = localAvailability[dayOfWeek];
              const isAvailable = hasOverride 
                ? availabilityData?.availability?.find(av => av.specificDate === dateStr)?.isAvailable 
                : weeklyEntry?.isAvailable;

              return (
                <Button
                  key={dateStr}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-10 relative",
                    !isSameMonth(day, currentMonth) && "opacity-50",
                    isAvailable && !isSelected && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
                    hasOverride && "ring-2 ring-primary ring-offset-1"
                  )}
                  onClick={() => setSelectedDate(day)}
                  data-testid={`calendar-day-${dateStr}`}
                >
                  {format(day, "d")}
                </Button>
              );
            })}
          </div>

          {/* Selected Date Editor */}
          {selectedDate && dateAvailability && (
            <Card className="mt-4" data-testid="card-date-editor">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  {datesWithOverrides.has(format(selectedDate, "yyyy-MM-dd")) && (
                    <Badge variant="secondary" className="ml-2">Custom</Badge>
                  )}
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
                  <Label>Available on this date</Label>
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
                    Save for {format(selectedDate, "MMM d")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
