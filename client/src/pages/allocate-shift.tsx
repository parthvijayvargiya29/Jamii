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
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, GripVertical, Store, Users, Clock, X, Plus, AlertTriangle, Check, KeyRound } from "lucide-react";
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
    selectedStaffIds: string[];
  }>({ open: false, dateKey: "", template: null, station: STATIONS[0], requiredStaff: 1, selectedStaffIds: [] });
  const [customShiftDialog, setCustomShiftDialog] = useState<{
    open: boolean;
    label: string;
    startTime: string;
    endTime: string;
  }>({ open: false, label: "", startTime: "09:00", endTime: "17:00" });
  const [customTemplates, setCustomTemplates] = useState<ShiftTemplate[]>([]);

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


  const handleAddCustomTemplate = useCallback(() => {
    if (!customShiftDialog.label.trim()) return;
    const newTemplate: ShiftTemplate = {
      id: `custom-${Date.now()}`,
      label: customShiftDialog.label.trim(),
      startTime: customShiftDialog.startTime,
      endTime: customShiftDialog.endTime,
      color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    };
    setCustomTemplates(prev => [...prev, newTemplate]);
    setCustomShiftDialog({ open: false, label: "", startTime: "09:00", endTime: "17:00" });
    toast({ title: "Custom shift type added" });
  }, [customShiftDialog, toast]);

  const handleRemoveCustomTemplate = useCallback((id: string) => {
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

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

  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      await apiRequest("DELETE", `/api/shifts/${shiftId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shifts");
      }});
      toast({ title: "Shift deleted" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to delete shift", description: err.message });
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
      selectedStaffIds: [],
    });
  }, [effectiveRestaurantId, toast]);

  const assignStaffMutation = useMutation({
    mutationFn: async ({ shiftId, userId }: { shiftId: string; userId: string }) => {
      await apiRequest("POST", "/api/shifts/assignments", { shiftId, userId });
    },
  });

  const [isCreatingShift, setIsCreatingShift] = useState(false);

  const handleDropDialogConfirm = useCallback(async () => {
    if (!dropDialog.template || !effectiveRestaurantId) return;
    setIsCreatingShift(true);
    try {
      const res = await apiRequest("POST", "/api/shifts", {
        shiftDate: dropDialog.dateKey,
        startTime: dropDialog.template.startTime,
        endTime: dropDialog.template.endTime,
        station: dropDialog.station,
        requiredStaff: dropDialog.requiredStaff,
        restaurantId: effectiveRestaurantId,
      });
      const data = await res.json();
      const newShiftId = data.id;

      if (newShiftId && dropDialog.selectedStaffIds.length > 0) {
        await Promise.all(
          dropDialog.selectedStaffIds.map(userId =>
            apiRequest("POST", "/api/shifts/assignments", { shiftId: String(newShiftId), userId })
          )
        );
      }

      setDropDialog(prev => ({ ...prev, open: false }));
      await queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/shifts");
      }});
      toast({ title: "Shift created" + (dropDialog.selectedStaffIds.length > 0 ? ` with ${dropDialog.selectedStaffIds.length} staff assigned` : "") });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to create shift", description: err.message });
    } finally {
      setIsCreatingShift(false);
    }
  }, [dropDialog, effectiveRestaurantId, toast]);

  const renderShiftItems = (dayShifts: any[], maxItems: number) => (
    <div className="flex-1 mt-0.5 space-y-0.5 overflow-hidden">
      {dayShifts.slice(0, maxItems).map((shift: any, i: number) => {
        const shiftStation = shift.station || "Kitchen";
        return (
          <div
            key={shift.id || i}
            className={cn(
              "group/shift text-[10px] sm:text-xs leading-tight px-1 py-0.5 rounded flex items-center gap-0.5",
              STATION_COLORS[shiftStation] || "bg-muted text-muted-foreground"
            )}
          >
            <span className="truncate flex-1">{shiftStation} {shift.startTime || shift.start_time}</span>
            {shift.id && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteShiftMutation.mutate(String(shift.id)); }}
                className="invisible group-hover/shift:visible shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                data-testid={`button-delete-shift-${shift.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
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
      <div
        onDragOver={(e) => handleDragOver(e, dateKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, dateKey)}
        className={cn(
          "border rounded-md overflow-visible transition-colors",
          isDragOver && "ring-2 ring-primary ring-dashed bg-primary/5"
        )}
      >
        <div className={cn(
          "flex items-center justify-between px-4 py-2.5 border-b bg-muted/30"
        )}>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full",
              isDayToday && "bg-primary text-primary-foreground"
            )}>
              {format(currentDate, "d")}
            </span>
            <span className="text-sm font-medium">{format(currentDate, "EEEE")}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {dayShifts.length} {dayShifts.length === 1 ? "shift" : "shifts"}
          </div>
        </div>

        <div className="p-3 space-y-2 min-h-[20rem]" data-testid={`calendar-day-${dateKey}`}>
          {dayShifts.map((shift: any, i: number) => {
            const shiftStation = shift.station || "Kitchen";
            const assignments = shift.assignments || [];
            const required = shift.requiredStaff || shift.required_staff || 1;
            const filled = assignments.length;

            return (
              <div
                key={shift.id || i}
                className={cn(
                  "group/shift rounded-md border p-3 space-y-2",
                  STATION_COLORS[shiftStation] || "bg-muted text-muted-foreground",
                  filled >= required && filled > 0 && "border-green-500 dark:border-green-400 border-2"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{shiftStation}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {shift.startTime || shift.start_time} - {shift.endTime || shift.end_time}
                      </Badge>
                    </div>
                    <div className="text-xs opacity-70">
                      {filled}/{required} staff assigned
                    </div>
                  </div>
                  {shift.id && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteShiftMutation.mutate(String(shift.id)); }}
                      className="invisible group-hover/shift:visible shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      data-testid={`button-delete-shift-${shift.id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {assignments.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="space-y-0.5">
                      {assignments.map((a: any) => (
                        <div key={a.id || a.userId || a.user_id} className="flex items-center gap-1.5 text-xs bg-white/40 dark:bg-black/20 rounded px-2 py-1.5">
                          <Users className="h-3 w-3 shrink-0 opacity-60" />
                          <span className="font-medium truncate">{a.userName || a.user_name || "Staff"}</span>
                        </div>
                      ))}
                    </div>
                    <div className={cn(
                      "text-[10px] px-2 py-1 rounded text-center font-medium",
                      filled >= required
                        ? "bg-green-100/60 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-yellow-100/60 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                    )}>
                      {filled >= required ? "assigned" : `${filled}/${required} assigned`}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs opacity-50 italic">No staff assigned yet</div>
                )}
              </div>
            );
          })}

          {dayShifts.length === 0 && !isDragOver && (
            <div className="flex flex-col items-center justify-center text-muted-foreground/50 py-12 gap-2">
              <Clock className="h-8 w-8" />
              <span className="text-sm">No shifts scheduled</span>
              <span className="text-xs">Drag a template here to add one</span>
            </div>
          )}
          {isDragOver && (
            <div className="text-sm text-primary/60 text-center border-2 border-dashed border-primary/30 rounded-md py-6">
              Drop here to add shift
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
      <div className="grid grid-cols-7 gap-1.5" style={{ minWidth: "1100px" }}>
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
                "border rounded-md min-h-[22rem] text-left transition-colors flex flex-col cursor-pointer overflow-visible",
                "hover:bg-muted/10",
                isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
                isDragOver && "bg-primary/10 ring-2 ring-primary ring-dashed ring-inset"
              )}
              data-testid={`calendar-day-${dateKey}`}
            >
              <div className="flex items-center justify-between px-2.5 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full",
                    isDayToday && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(day, "EEE")}</span>
                </div>
                {dayShifts.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{dayShifts.length} {dayShifts.length === 1 ? "shift" : "shifts"}</span>
                )}
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-auto">
                {dayShifts.map((shift: any, i: number) => {
                  const shiftStation = shift.station || "Kitchen";
                  const assignments = shift.assignments || [];
                  const required = shift.requiredStaff || shift.required_staff || 1;
                  const filled = assignments.length;

                  return (
                    <div
                      key={shift.id || i}
                      className={cn(
                        "group/shift rounded-md border p-2 space-y-1.5",
                        STATION_COLORS[shiftStation] || "bg-muted text-muted-foreground",
                        filled >= required && filled > 0 && "border-green-500 dark:border-green-400 border-2"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">{shiftStation}</div>
                          <div className="text-[11px] opacity-70">{shift.startTime || shift.start_time} - {shift.endTime || shift.end_time}</div>
                        </div>
                        {shift.id && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deleteShiftMutation.mutate(String(shift.id)); }}
                            className="invisible group-hover/shift:visible shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            data-testid={`button-delete-shift-${shift.id}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] opacity-60">{filled}/{required} staff</div>
                      {assignments.length > 0 ? (
                        <div className="space-y-1">
                          <div className="space-y-0.5">
                            {assignments.map((a: any) => (
                              <div key={a.id || a.userId || a.user_id} className="flex items-center gap-1.5 text-[11px] bg-white/40 dark:bg-black/20 rounded px-1.5 py-1">
                                <Users className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="font-medium">{a.userName || a.user_name || "Staff"}</span>
                              </div>
                            ))}
                          </div>
                          <div className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded text-center font-medium",
                            filled >= required
                              ? "bg-green-100/60 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-yellow-100/60 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          )}>
                            {filled >= required ? "assigned" : `${filled}/${required} assigned`}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] opacity-40 italic">No staff assigned</div>
                      )}
                    </div>
                  );
                })}

                {dayShifts.length === 0 && !isDragOver && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-1 py-6">
                    <Clock className="h-5 w-5" />
                    <span className="text-[10px]">No shifts</span>
                  </div>
                )}
                {isDragOver && (
                  <div className="text-xs text-primary/60 text-center border border-dashed border-primary/30 rounded-md px-2 py-4">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="mx-auto space-y-3" style={{ maxWidth: "calc(100% - 1rem)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => { if (showDetails) { setShowDetails(false); } else { navigate("/dashboard"); } }}
              className="gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              {showDetails ? "Back to Calendar" : "Back to Dashboard"}
            </Button>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border text-sm" data-testid="text-my-shift-pin">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Your PIN:</span>
              {user?.shiftPin
                ? <span className="font-mono font-bold tracking-widest">{user.shiftPin}</span>
                : <span className="text-muted-foreground text-xs italic">not set</span>
              }
            </div>
          </div>

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

            {!!effectiveRestaurantId && (
              <div className="space-y-1.5 py-1.5 px-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Drag to schedule:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomShiftDialog({ open: true, label: "", startTime: "09:00", endTime: "17:00" })}
                    data-testid="button-add-custom-shift"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Custom Shift
                  </Button>
                </div>
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
                {customTemplates.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground/70 w-16 shrink-0 flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      Custom
                    </span>
                    {customTemplates.map(template => (
                      <div
                        key={template.id}
                        className="flex items-center gap-0.5"
                      >
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, template)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-l-md border border-r-0 text-xs sm:text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md",
                            template.color
                          )}
                          data-testid={`draggable-shift-${template.id}`}
                        >
                          <GripVertical className="h-3 w-3 opacity-50 shrink-0" />
                          <span>{template.label}</span>
                          <span className="opacity-60">{template.startTime} - {template.endTime}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomTemplate(template.id)}
                          className={cn(
                            "px-1.5 py-1.5 rounded-r-md border text-xs transition-colors hover:bg-red-200 dark:hover:bg-red-900/40",
                            template.color
                          )}
                          data-testid={`button-remove-custom-${template.id}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-sm font-medium">Assign Staff</Label>
                    </div>
                    {dropDialog.selectedStaffIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dropDialog.selectedStaffIds.length} selected
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-md border min-h-[4rem] max-h-[12rem] overflow-auto">
                    {isLoadingStaff ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </div>
                    ) : availableStaffData?.users && availableStaffData.users.length > 0 ? (
                      <div className="divide-y">
                        {availableStaffData.users.map((staff: any) => {
                          const isSelected = dropDialog.selectedStaffIds.includes(String(staff.id));
                          return (
                            <button
                              key={staff.id}
                              type="button"
                              onClick={() => {
                                setDropDialog(prev => ({
                                  ...prev,
                                  selectedStaffIds: isSelected
                                    ? prev.selectedStaffIds.filter(id => id !== String(staff.id))
                                    : [...prev.selectedStaffIds, String(staff.id)],
                                }));
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                                isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                              )}
                              data-testid={`button-select-staff-${staff.id}`}
                            >
                              <div className={cn(
                                "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30"
                              )}>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{staff.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Available {staff.availableFrom} - {staff.availableTo}
                                </div>
                              </div>
                              {staff.station && (
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  {staff.station}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground/60 text-center py-4">
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
                disabled={isCreatingShift}
                data-testid="button-confirm-drop"
              >
                {isCreatingShift && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={customShiftDialog.open} onOpenChange={(open) => setCustomShiftDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Add Custom Shift Type
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Shift Name</Label>
                <Input
                  placeholder="e.g. Emergency Cover, Event Staff..."
                  value={customShiftDialog.label}
                  onChange={(e) => setCustomShiftDialog(prev => ({ ...prev, label: e.target.value }))}
                  data-testid="input-custom-shift-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Start Time</Label>
                  <Input
                    type="time"
                    value={customShiftDialog.startTime}
                    onChange={(e) => setCustomShiftDialog(prev => ({ ...prev, startTime: e.target.value }))}
                    data-testid="input-custom-start-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">End Time</Label>
                  <Input
                    type="time"
                    value={customShiftDialog.endTime}
                    onChange={(e) => setCustomShiftDialog(prev => ({ ...prev, endTime: e.target.value }))}
                    data-testid="input-custom-end-time"
                  />
                </div>
              </div>

              <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Custom shifts appear in red and can be removed when no longer needed.</span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCustomShiftDialog(prev => ({ ...prev, open: false }))} data-testid="button-cancel-custom-shift">
                Cancel
              </Button>
              <Button
                onClick={handleAddCustomTemplate}
                disabled={!customShiftDialog.label.trim()}
                data-testid="button-confirm-custom-shift"
              >
                Add Shift Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
