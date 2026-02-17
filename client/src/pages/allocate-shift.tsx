import { useState, useMemo, useCallback, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, GripVertical, Store, Users, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STATIONS = ["Kitchen", "Bar", "Service"];

type ViewMode = "day" | "week";

interface ShiftTemplate {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  color: string;
}

const SHIFT_TEMPLATES: Record<string, ShiftTemplate[]> = {
  mini: [
    { id: "mini-full", label: "Full Day", startTime: "08:40", endTime: "18:30", color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800" },
    { id: "mini-later", label: "Later Full Day", startTime: "10:00", endTime: "18:30", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  ],
  immortl: [
    { id: "immortl-morning", label: "Morning", startTime: "08:00", endTime: "13:30", color: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800" },
    { id: "immortl-evening", label: "Evening", startTime: "13:30", endTime: "18:30", color: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" },
  ],
};

const STATION_COLORS: Record<string, string> = {
  Kitchen: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  Bar: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Service: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
};

function getRestaurantKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("mini")) return "mini";
  if (lower.includes("immortl")) return "immortl";
  return "mini";
}

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
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dropDialog, setDropDialog] = useState<{
    open: boolean;
    dateKey: string;
    template: ShiftTemplate | null;
    station: string;
    requiredStaff: number;
  }>({ open: false, dateKey: "", template: null, station: STATIONS[0], requiredStaff: 1 });

  const { data: restaurantsData } = useQuery<{ restaurants: { id: string; name: string }[] }>({
    queryKey: ["/api/restaurants"],
    queryFn: async () => {
      const res = await fetch("/api/restaurants", {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch restaurants");
      return res.json();
    },
  });

  const effectiveRestaurantId = isAdmin ? selectedRestaurantId : (user?.restaurantId || "");

  const templateGroups = useMemo(() => {
    const groups: { restaurantKey: string; restaurantLabel: string; templates: ShiftTemplate[] }[] = [];
    if (effectiveRestaurantId && restaurantsData?.restaurants) {
      const r = restaurantsData.restaurants.find(r => r.id === effectiveRestaurantId);
      if (r) {
        const key = getRestaurantKey(r.name);
        const templates = SHIFT_TEMPLATES[key] || [];
        if (templates.length > 0) groups.push({ restaurantKey: key, restaurantLabel: r.name, templates });
      }
    } else if (restaurantsData?.restaurants) {
      for (const r of restaurantsData.restaurants) {
        const key = getRestaurantKey(r.name);
        const templates = SHIFT_TEMPLATES[key] || [];
        if (templates.length > 0) groups.push({ restaurantKey: key, restaurantLabel: r.name, templates });
      }
    }
    return groups;
  }, [effectiveRestaurantId, restaurantsData]);

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

  const handleDragStart = useCallback((e: React.DragEvent, template: ShiftTemplate) => {
    e.dataTransfer.setData("application/shift-template", JSON.stringify(template));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverDate(dateKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const { data: availableStaffData, isLoading: isLoadingStaff } = useQuery<{ users: any[] }>({
    queryKey: ["/api/shifts/available-staff", effectiveRestaurantId, dropDialog.dateKey],
    queryFn: async () => {
      const res = await fetch(`/api/shifts/available-staff?restaurantId=${effectiveRestaurantId}&date=${dropDialog.dateKey}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch available staff");
      return res.json();
    },
    enabled: dropDialog.open && !!effectiveRestaurantId && !!dropDialog.dateKey,
  });

  const handleDrop = useCallback((e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const data = e.dataTransfer.getData("application/shift-template");
    if (!data) return;

    const template: ShiftTemplate = JSON.parse(data);
    if (!effectiveRestaurantId) {
      toast({ variant: "destructive", title: "Please select a restaurant" });
      return;
    }

    setDropDialog({
      open: true,
      dateKey,
      template,
      station: STATIONS[0],
      requiredStaff: 1,
    });
  }, [effectiveRestaurantId, toast]);

  const handleDropDialogConfirm = useCallback(() => {
    if (!dropDialog.template || !effectiveRestaurantId) return;
    createShiftMutation.mutate({
      shiftDate: dropDialog.dateKey,
      startTime: dropDialog.template.startTime,
      endTime: dropDialog.template.endTime,
      station: dropDialog.station,
      requiredStaff: dropDialog.requiredStaff,
    });
    setDropDialog(prev => ({ ...prev, open: false }));
  }, [dropDialog, effectiveRestaurantId, createShiftMutation]);

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
    const isDragOver = dragOverDate === dateKey;

    return (
      <div className="border rounded-md overflow-visible">
        <div className="text-center text-xs font-medium text-muted-foreground py-2 border-b bg-muted/30">
          {format(currentDate, "EEEE")}
        </div>
        <div
          onClick={() => setSelectedDate(currentDate)}
          onDragOver={(e) => handleDragOver(e, dateKey)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, dateKey)}
          className={cn(
            "w-full min-h-[24rem] p-3 text-left transition-colors flex flex-col cursor-pointer",
            "hover:bg-muted/20",
            isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
            isDragOver && "bg-primary/10 ring-2 ring-primary ring-dashed ring-inset"
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
            {dayShifts.length === 0 && !isDragOver && (
              <div className="text-sm text-muted-foreground/50 text-center mt-8">No shifts</div>
            )}
            {isDragOver && (
              <div className="text-sm text-primary/60 text-center mt-4 border-2 border-dashed border-primary/30 rounded-md py-3">Drop here to add shift</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="grid grid-cols-7 border rounded-md overflow-visible">
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
        const isDragOver = dragOverDate === dateKey;

        return (
          <div
            key={dateKey}
            onClick={() => setSelectedDate(day)}
            onDragOver={(e) => handleDragOver(e, dateKey)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, dateKey)}
            className={cn(
              "relative border-r min-h-[10rem] sm:min-h-[14rem] p-1 text-left transition-colors flex flex-col cursor-pointer",
              "hover:bg-muted/20",
              isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
              isDragOver && "bg-primary/10 ring-2 ring-primary ring-dashed ring-inset"
            )}
            data-testid={`calendar-day-${dateKey}`}
          >
            <span className={cn(
              "text-xs sm:text-sm font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
              isDayToday && "bg-primary text-primary-foreground"
            )}>
              {format(day, "d")}
            </span>
            {isDragOver && dayShifts.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-[10px] text-primary/60 text-center border border-dashed border-primary/30 rounded px-1 py-2">Drop</div>
              </div>
            )}
            {renderShiftItems(dayShifts, 5)}
          </div>
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
            <div className="flex items-center rounded-md border overflow-hidden">
              {restaurantsData.restaurants.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRestaurantId(prev => prev === r.id ? "" : r.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                    selectedRestaurantId === r.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                  data-testid={`button-restaurant-${r.id}`}
                >
                  <Store className="h-3.5 w-3.5" />
                  {r.name.replace("Restaurant ", "")}
                </button>
              ))}
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

            {templateGroups.length > 0 && (
              <div className="space-y-1.5 py-1.5 px-1">
                <span className="text-xs text-muted-foreground">Drag to schedule:</span>
                {templateGroups.map(group => (
                  <div key={group.restaurantKey} className="flex items-center gap-2 flex-wrap">
                    {templateGroups.length > 1 && (
                      <span className="text-[11px] text-muted-foreground/70 w-16 shrink-0 truncate">{group.restaurantLabel.replace("Restaurant ", "")}</span>
                    )}
                    {group.templates.map(template => (
                      <div
                        key={template.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, template)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs sm:text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md",
                          template.color
                        )}
                        data-testid={`draggable-shift-${template.id}`}
                      >
                        <GripVertical className="h-3 w-3 opacity-50 shrink-0" />
                        <span>{template.label}</span>
                        <span className="opacity-60">{template.startTime} - {template.endTime}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

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

        <Dialog open={dropDialog.open} onOpenChange={(open) => setDropDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Schedule Shift
              </DialogTitle>
            </DialogHeader>

            {dropDialog.template && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <div>
                    <div className="text-sm font-medium">{format(new Date(dropDialog.dateKey + "T12:00:00"), "EEEE, MMMM d, yyyy")}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dropDialog.template.label} &middot; {dropDialog.template.startTime} - {dropDialog.template.endTime}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Station</Label>
                  <div className="flex gap-2">
                    {STATIONS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDropDialog(prev => ({ ...prev, station: s }))}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors border",
                          dropDialog.station === s
                            ? cn(STATION_COLORS[s], "border-current")
                            : "text-muted-foreground border-border hover:bg-muted/50"
                        )}
                        data-testid={`button-station-${s.toLowerCase()}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Required Staff</Label>
                  <Input
                    type="number"
                    min={1}
                    value={dropDialog.requiredStaff}
                    onChange={(e) => setDropDialog(prev => ({ ...prev, requiredStaff: parseInt(e.target.value) || 1 }))}
                    data-testid="input-drop-required-staff"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm font-medium">Available Staff</Label>
                  </div>
                  <div className="rounded-md border p-3 min-h-[4rem]">
                    {isLoadingStaff ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </div>
                    ) : availableStaffData?.users && availableStaffData.users.length > 0 ? (
                      <div className="space-y-2">
                        {availableStaffData.users.map((staff: any) => (
                          <div key={staff.id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{staff.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {staff.availableFrom} - {staff.availableTo}
                              </div>
                            </div>
                            {staff.station && (
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                {staff.station}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground/60 text-center py-2">
                        No staff available for this date
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDropDialog(prev => ({ ...prev, open: false }))} data-testid="button-cancel-drop">
                Cancel
              </Button>
              <Button
                onClick={handleDropDialogConfirm}
                disabled={createShiftMutation.isPending}
                data-testid="button-confirm-drop"
              >
                {createShiftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
