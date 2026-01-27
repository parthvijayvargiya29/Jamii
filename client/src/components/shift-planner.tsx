import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CalendarDays, 
  CalendarRange, 
  Calendar as CalendarIcon,
  Plus, 
  Users,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  Check,
  Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Shift, ShiftAssignment, ShiftWithAssignments } from "@shared/schema";

type ViewMode = "day" | "week" | "month";

interface ShiftPlannerProps {
  restaurantId: string;
  isAdmin: boolean;
  isManager: boolean;
}

const STATIONS = ["Kitchen", "Bar", "Counter", "Prep", "Service"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ShiftPlanner({ restaurantId, isAdmin, isManager }: ShiftPlannerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftWithAssignments | null>(null);
  const { toast } = useToast();

  const canManageShifts = isAdmin || isManager;

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      return { start: selectedDate, end: selectedDate };
    } else if (viewMode === "week") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
      return { start, end: addDays(start, 6) };
    } else {
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);
      return { start, end };
    }
  }, [viewMode, selectedDate]);

  // Fetch shifts based on view mode
  const shiftsQueryKey = viewMode === "week" 
    ? ["/api/shifts/week", { start: format(dateRange.start, "yyyy-MM-dd"), restaurantId }]
    : viewMode === "month"
    ? ["/api/shifts/month", { year: selectedDate.getFullYear(), month: selectedDate.getMonth() + 1, restaurantId }]
    : ["/api/shifts", { date: format(selectedDate, "yyyy-MM-dd"), restaurantId }];

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery<{ shifts: ShiftWithAssignments[] }>({
    queryKey: shiftsQueryKey,
    queryFn: async () => {
      let url = `/api/shifts`;
      if (viewMode === "week") {
        url = `/api/shifts/week?start=${format(dateRange.start, "yyyy-MM-dd")}&restaurantId=${restaurantId}`;
      } else if (viewMode === "month") {
        url = `/api/shifts/month?year=${selectedDate.getFullYear()}&month=${selectedDate.getMonth() + 1}&restaurantId=${restaurantId}`;
      } else {
        url = `/api/shifts?date=${format(selectedDate, "yyyy-MM-dd")}&restaurantId=${restaurantId}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
    enabled: !!restaurantId,
  });

  // Fetch available users for shift assignment
  const { data: availableUsersData } = useQuery<{ users: { id: string; name: string; email: string; role: string; availableFrom?: string; availableTo?: string }[] }>({
    queryKey: ["/api/shifts", selectedShift?.id, "available-users"],
    queryFn: async () => {
      const res = await fetch(`/api/shifts/${selectedShift!.id}/available-users?restaurantId=${restaurantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch available users");
      return res.json();
    },
    enabled: !!selectedShift && canManageShifts,
  });

  // Helper to invalidate all shift-related queries
  const invalidateShiftQueries = () => {
    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith("/api/shifts");
    }});
  };

  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: async (data: { shiftDate: string; startTime: string; endTime: string; station: string; requiredStaff: number }) => {
      const res = await apiRequest("POST", "/api/shifts", { ...data, restaurantId });
      return res.json();
    },
    onSuccess: () => {
      invalidateShiftQueries();
      setIsCreateDialogOpen(false);
      toast({ title: "Shift created successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to create shift", description: err.message });
    },
  });

  // Assign user mutation
  const assignUserMutation = useMutation({
    mutationFn: async ({ shiftId, userId }: { shiftId: string; userId: string }) => {
      const res = await apiRequest("POST", "/api/shifts/assignments", { shiftId, userId });
      return res.json();
    },
    onSuccess: () => {
      invalidateShiftQueries();
      toast({ title: "User assigned successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to assign user", description: err.message });
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiRequest("DELETE", `/api/shifts/assignments/${assignmentId}`);
      return res;
    },
    onSuccess: () => {
      invalidateShiftQueries();
      toast({ title: "Assignment removed" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to remove assignment", description: err.message });
    },
  });

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const res = await apiRequest("DELETE", `/api/shifts/${shiftId}`);
      return res;
    },
    onSuccess: () => {
      invalidateShiftQueries();
      setSelectedShift(null);
      toast({ title: "Shift deleted" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to delete shift", description: err.message });
    },
  });

  // Navigation handlers
  const navigatePrev = () => {
    if (viewMode === "day") {
      setSelectedDate(prev => addDays(prev, -1));
    } else if (viewMode === "week") {
      setSelectedDate(prev => addDays(prev, -7));
    } else {
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "day") {
      setSelectedDate(prev => addDays(prev, 1));
    } else if (viewMode === "week") {
      setSelectedDate(prev => addDays(prev, 7));
    } else {
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const navigateToday = () => setSelectedDate(new Date());

  // Group shifts by date for week/month view
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftWithAssignments[]>();
    shiftsData?.shifts?.forEach(shift => {
      const dateKey = shift.shiftDate;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(shift);
    });
    return map;
  }, [shiftsData?.shifts]);

  // Get days for the current view
  const viewDays = useMemo(() => {
    if (viewMode === "day") {
      return [selectedDate];
    } else if (viewMode === "week") {
      return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    } else {
      return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    }
  }, [viewMode, dateRange, selectedDate]);

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev} data-testid="button-nav-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday} data-testid="button-nav-today">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext} data-testid="button-nav-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-picker">
                <CalendarIcon className="h-4 w-4" />
                {viewMode === "month" 
                  ? format(selectedDate, "MMMM yyyy")
                  : viewMode === "week"
                  ? `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`
                  : format(selectedDate, "EEEE, MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border p-1">
            <Button 
              variant={viewMode === "day" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("day")}
              className="gap-1"
              data-testid="button-view-day"
            >
              <CalendarDays className="h-4 w-4" />
              Day
            </Button>
            <Button 
              variant={viewMode === "week" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("week")}
              className="gap-1"
              data-testid="button-view-week"
            >
              <CalendarRange className="h-4 w-4" />
              Week
            </Button>
            <Button 
              variant={viewMode === "month" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("month")}
              className="gap-1"
              data-testid="button-view-month"
            >
              <CalendarIcon className="h-4 w-4" />
              Month
            </Button>
          </div>

          {/* Create Shift Button */}
          {canManageShifts && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-shift">
                  <Plus className="h-4 w-4" />
                  Add Shift
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Shift</DialogTitle>
                </DialogHeader>
                <CreateShiftForm 
                  selectedDate={selectedDate}
                  onSubmit={(data) => createShiftMutation.mutate(data)}
                  isPending={createShiftMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Loading State */}
      {shiftsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Day View */}
      {!shiftsLoading && viewMode === "day" && (
        <DayView 
          date={selectedDate}
          shifts={shiftsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []}
          onShiftClick={setSelectedShift}
          canManageShifts={canManageShifts}
        />
      )}

      {/* Week View */}
      {!shiftsLoading && viewMode === "week" && (
        <WeekView 
          days={viewDays}
          shiftsByDate={shiftsByDate}
          onShiftClick={setSelectedShift}
          canManageShifts={canManageShifts}
        />
      )}

      {/* Month View */}
      {!shiftsLoading && viewMode === "month" && (
        <MonthView 
          days={viewDays}
          shiftsByDate={shiftsByDate}
          selectedDate={selectedDate}
          onDayClick={(date) => {
            setSelectedDate(date);
            setViewMode("day");
          }}
        />
      )}

      {/* Shift Details Dialog */}
      <Dialog open={!!selectedShift} onOpenChange={(open) => !open && setSelectedShift(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shift Details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <ShiftDetailsPanel
              shift={selectedShift}
              availableUsers={availableUsersData?.users || []}
              onAssign={(userId) => assignUserMutation.mutate({ shiftId: selectedShift.id, userId })}
              onRemoveAssignment={(assignmentId) => removeAssignmentMutation.mutate(assignmentId)}
              onDelete={() => deleteShiftMutation.mutate(selectedShift.id)}
              canManageShifts={canManageShifts}
              isAssigning={assignUserMutation.isPending}
              isDeleting={deleteShiftMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Shift Form Component
function CreateShiftForm({ 
  selectedDate, 
  onSubmit, 
  isPending 
}: { 
  selectedDate: Date;
  onSubmit: (data: { shiftDate: string; startTime: string; endTime: string; station: string; requiredStaff: number }) => void;
  isPending: boolean;
}) {
  const [shiftDate, setShiftDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [station, setStation] = useState(STATIONS[0]);
  const [requiredStaff, setRequiredStaff] = useState(1);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSubmit({ shiftDate, startTime, endTime, station, requiredStaff });
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="shiftDate">Date</Label>
          <Input 
            id="shiftDate" 
            type="date" 
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            data-testid="input-shift-date"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="station">Station</Label>
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
          <Label htmlFor="startTime">Start Time</Label>
          <Input 
            id="startTime" 
            type="time" 
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            data-testid="input-start-time"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">End Time</Label>
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
        <Label htmlFor="requiredStaff">Required Staff</Label>
        <Input 
          id="requiredStaff" 
          type="number" 
          min={1}
          value={requiredStaff}
          onChange={(e) => setRequiredStaff(parseInt(e.target.value) || 1)}
          data-testid="input-required-staff"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-shift">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Create Shift
      </Button>
    </form>
  );
}

// Shift Card Component
function ShiftCard({ 
  shift, 
  onClick,
  compact = false
}: { 
  shift: ShiftWithAssignments; 
  onClick: () => void;
  compact?: boolean;
}) {
  const assignedCount = shift.assignments?.length || 0;
  const requiredStaff = shift.requiredStaff || 1;
  const isFull = assignedCount >= requiredStaff;

  // Compact view for weekly calendar
  if (compact) {
    return (
      <div
        className={cn(
          "rounded-md px-2 py-1.5 cursor-pointer hover-elevate text-xs",
          isFull 
            ? "bg-primary/15 border border-primary/30" 
            : "bg-muted/50 border border-border"
        )}
        onClick={onClick}
        data-testid={`card-shift-${shift.id}`}
      >
        <div className="font-medium truncate">{shift.startTime}-{shift.endTime}</div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-muted-foreground truncate">{shift.station}</span>
          <span className={cn(
            "shrink-0 font-medium",
            isFull ? "text-primary" : "text-muted-foreground"
          )}>
            {assignedCount}/{requiredStaff}
          </span>
        </div>
      </div>
    );
  }

  // Full view for day view
  return (
    <Card 
      className="cursor-pointer hover-elevate transition-colors p-3"
      onClick={onClick}
      data-testid={`card-shift-${shift.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{shift.startTime} - {shift.endTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{shift.station}</span>
          </div>
        </div>
        <Badge variant={isFull ? "default" : "secondary"} className="shrink-0">
          <Users className="h-3 w-3 mr-1" />
          {assignedCount}/{requiredStaff}
        </Badge>
      </div>
      {shift.assignments && shift.assignments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {shift.assignments.slice(0, 3).map(a => (
            <Badge key={a.id} variant="outline" className="text-xs">
              {a.userName}
            </Badge>
          ))}
          {shift.assignments.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{shift.assignments.length - 3}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}

// Day View Component
function DayView({ 
  date, 
  shifts, 
  onShiftClick,
  canManageShifts
}: { 
  date: Date; 
  shifts: ShiftWithAssignments[];
  onShiftClick: (shift: ShiftWithAssignments) => void;
  canManageShifts: boolean;
}) {
  const sortedShifts = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg" data-testid="text-day-header">
        {format(date, "EEEE, MMMM d, yyyy")}
        {isToday(date) && <Badge className="ml-2">Today</Badge>}
      </h3>
      {sortedShifts.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No shifts scheduled for this day
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedShifts.map(shift => (
            <ShiftCard key={shift.id} shift={shift} onClick={() => onShiftClick(shift)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Week View Component
function WeekView({ 
  days, 
  shiftsByDate, 
  onShiftClick,
  canManageShifts
}: { 
  days: Date[]; 
  shiftsByDate: Map<string, ShiftWithAssignments[]>;
  onShiftClick: (shift: ShiftWithAssignments) => void;
  canManageShifts: boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayShifts = shiftsByDate.get(dateKey) || [];
        const sortedShifts = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));

        return (
          <div 
            key={dateKey} 
            className={cn(
              "min-h-[200px] rounded-lg border p-2",
              isToday(day) && "border-primary bg-primary/5"
            )}
          >
            <div className="text-center mb-2">
              <div className="text-xs text-muted-foreground">{DAY_NAMES[day.getDay()]}</div>
              <div className={cn(
                "text-lg font-semibold",
                isToday(day) && "text-primary"
              )}>
                {format(day, "d")}
              </div>
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {sortedShifts.map(shift => (
                  <ShiftCard 
                    key={shift.id} 
                    shift={shift} 
                    onClick={() => onShiftClick(shift)}
                    compact
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}

// Month View Component
function MonthView({ 
  days, 
  shiftsByDate,
  selectedDate,
  onDayClick
}: { 
  days: Date[];
  shiftsByDate: Map<string, ShiftWithAssignments[]>;
  selectedDate: Date;
  onDayClick: (date: Date) => void;
}) {
  // Add padding days for the start of the month
  const firstDay = days[0];
  const startPadding = firstDay.getDay(); // 0-6, Sunday start
  const paddedDays: (Date | null)[] = Array(startPadding).fill(null).concat(days);

  // Fill remaining to complete the grid
  while (paddedDays.length % 7 !== 0) {
    paddedDays.push(null);
  }

  // Helper to calculate staffing status
  const getStaffingStatus = (shifts: ShiftWithAssignments[]) => {
    if (shifts.length === 0) return null;
    const totalRequired = shifts.reduce((sum, s) => sum + (s.requiredStaff || 1), 0);
    const totalAssigned = shifts.reduce((sum, s) => sum + (s.assignments?.length || 0), 0);
    return { totalRequired, totalAssigned, isFull: totalAssigned >= totalRequired };
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="min-h-[80px]" />;
          }

          const dateKey = format(day, "yyyy-MM-dd");
          const dayShifts = shiftsByDate.get(dateKey) || [];
          const shiftCount = dayShifts.length;
          const staffing = getStaffingStatus(dayShifts);

          return (
            <button
              key={dateKey}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[80px] rounded-md border p-1.5 hover-elevate transition-colors text-left flex flex-col",
                isToday(day) && "border-primary bg-primary/5 ring-1 ring-primary/20"
              )}
              data-testid={`button-month-day-${dateKey}`}
            >
              <div className={cn(
                "text-sm font-semibold",
                isToday(day) && "text-primary"
              )}>
                {format(day, "d")}
              </div>
              {shiftCount > 0 && (
                <div className="mt-auto space-y-1">
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      staffing?.isFull ? "bg-green-500" : "bg-amber-500"
                    )} />
                    <span className="text-xs text-muted-foreground">
                      {shiftCount} shift{shiftCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Users className="inline h-3 w-3 mr-0.5" />
                    {staffing?.totalAssigned}/{staffing?.totalRequired}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Shift Details Panel Component
function ShiftDetailsPanel({ 
  shift, 
  availableUsers,
  onAssign,
  onRemoveAssignment,
  onDelete,
  canManageShifts,
  isAssigning,
  isDeleting
}: { 
  shift: ShiftWithAssignments;
  availableUsers: { id: string; name: string; email: string; role: string; availableFrom?: string; availableTo?: string }[];
  onAssign: (userId: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onDelete: () => void;
  canManageShifts: boolean;
  isAssigning: boolean;
  isDeleting: boolean;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(shift.shiftDate), "EEEE, MMMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{shift.startTime} - {shift.endTime}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{shift.station}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{shift.assignments?.length || 0} / {shift.requiredStaff} staff assigned</span>
        </div>
      </div>

      {/* Assigned Staff */}
      <div>
        <Label className="text-sm font-medium">Assigned Staff</Label>
        {shift.assignments && shift.assignments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {shift.assignments.map(assignment => (
              <div key={assignment.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{assignment.userName}</span>
                  <Badge variant={assignment.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                    {assignment.status}
                  </Badge>
                </div>
                {canManageShifts && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onRemoveAssignment(assignment.id)}
                    data-testid={`button-remove-assignment-${assignment.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No staff assigned yet</p>
        )}
      </div>

      {/* Assign User */}
      {canManageShifts && availableUsers.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Assign Available Staff</Label>
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1" data-testid="select-assign-user">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.name}</span>
                      {user.availableFrom && user.availableTo && (
                        <span className="text-xs text-muted-foreground">
                          ({user.availableFrom} - {user.availableTo})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => {
                if (selectedUserId) {
                  onAssign(selectedUserId);
                  setSelectedUserId("");
                }
              }}
              disabled={!selectedUserId || isAssigning}
              data-testid="button-assign-user"
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {canManageShifts && availableUsers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No available staff found. Staff must set their availability to be assigned.
        </p>
      )}

      {/* Delete Shift */}
      {canManageShifts && (
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={onDelete}
          disabled={isDeleting}
          data-testid="button-delete-shift"
        >
          {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Delete Shift
        </Button>
      )}
    </div>
  );
}
