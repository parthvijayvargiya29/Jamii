import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Check, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { UserAvailability } from "@shared/schema";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AvailabilityEntry {
  dayOfWeek: number;
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
  const [editingDay, setEditingDay] = useState<number | null>(null);

  // Initialize availability state for all days
  const defaultAvailability: AvailabilityEntry[] = DAY_NAMES.map((_, i) => ({
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    isAvailable: false,
  }));

  const [localAvailability, setLocalAvailability] = useState<AvailabilityEntry[]>(defaultAvailability);
  const [hasChanges, setHasChanges] = useState(false);

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

  // Update local state when data is fetched - using useEffect to avoid setState during render
  useEffect(() => {
    if (availabilityData?.availability && !hasChanges) {
      const updated = [...defaultAvailability];
      availabilityData.availability.forEach(av => {
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

  // Save availability mutation
  const saveMutation = useMutation({
    mutationFn: async (entry: AvailabilityEntry) => {
      const res = await apiRequest("POST", "/api/shifts/availability", {
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isAvailable: entry.isAvailable,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/availability"] });
      toast({ title: "Availability saved" });
      setEditingDay(null);
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
        <h3 className="text-lg font-semibold">Weekly Availability</h3>
        {!isReadOnly && hasChanges && (
          <Badge variant="secondary">Unsaved changes</Badge>
        )}
      </div>

      <div className="grid gap-3">
        {localAvailability.map((entry, dayIndex) => (
          <Card 
            key={dayIndex}
            className={cn(
              "transition-colors",
              entry.isAvailable && "border-primary/50 bg-primary/5"
            )}
            data-testid={`card-availability-${dayIndex}`}
          >
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Day name and toggle */}
                <div className="flex items-center gap-3 min-w-[140px]">
                  <Switch
                    checked={entry.isAvailable}
                    onCheckedChange={(checked) => updateDay(dayIndex, { isAvailable: checked })}
                    disabled={isReadOnly}
                    data-testid={`switch-available-${dayIndex}`}
                  />
                  <span className={cn(
                    "font-medium",
                    !entry.isAvailable && "text-muted-foreground"
                  )}>
                    {DAY_NAMES[dayIndex]}
                  </span>
                </div>

                {/* Time inputs */}
                {entry.isAvailable && (
                  <div className="flex items-center gap-2 flex-1">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={entry.startTime}
                        onChange={(e) => updateDay(dayIndex, { startTime: e.target.value })}
                        disabled={isReadOnly}
                        className="w-[120px]"
                        data-testid={`input-start-time-${dayIndex}`}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={entry.endTime}
                        onChange={(e) => updateDay(dayIndex, { endTime: e.target.value })}
                        disabled={isReadOnly}
                        className="w-[120px]"
                        data-testid={`input-end-time-${dayIndex}`}
                      />
                    </div>
                  </div>
                )}

                {/* Save button for this day */}
                {!isReadOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveDay(dayIndex)}
                    disabled={saveMutation.isPending}
                    className="gap-1"
                    data-testid={`button-save-${dayIndex}`}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isReadOnly && (
        <p className="text-sm text-muted-foreground">
          Set your availability for each day. Managers will use this information when scheduling shifts.
        </p>
      )}
    </div>
  );
}

// Compact version for dashboard sidebar
export function AvailabilityOverview() {
  const { data: availabilityData, isLoading } = useQuery<{ availability: UserAvailability[] }>({
    queryKey: ["/api/shifts/availability"],
    queryFn: async () => {
      const res = await fetch("/api/shifts/availability", {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableDays = availabilityData?.availability
    ?.filter(av => av.isAvailable)
    ?.map(av => SHORT_DAY_NAMES[av.dayOfWeek]) || [];

  return (
    <div className="flex flex-wrap gap-1">
      {SHORT_DAY_NAMES.map((day, i) => {
        const isAvailable = availableDays.includes(day);
        return (
          <Badge 
            key={day} 
            variant={isAvailable ? "default" : "outline"}
            className={cn(
              "text-xs",
              !isAvailable && "text-muted-foreground"
            )}
          >
            {day}
          </Badge>
        );
      })}
    </div>
  );
}
