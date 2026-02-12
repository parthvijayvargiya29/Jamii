import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, startOfWeek, eachDayOfInterval, isToday } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
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
import { 
  Plus, 
  Users,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  X,
  Loader2,
  Calendar as CalendarIcon,
  User,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ShiftWithAssignments } from "@shared/schema";

interface ShiftPlannerProps {
  restaurantId: string;
  isAdmin: boolean;
  isManager: boolean;
}

const STATIONS = ["Kitchen", "Bar", "Service"];

const STATION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Kitchen: { bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
  Bar: { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
  Service: { bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300" },
};

const DEFAULT_STATION_COLOR = { bg: "bg-muted/30", border: "border-border", text: "text-muted-foreground" };

export function ShiftPlanner({ restaurantId, isAdmin, isManager }: ShiftPlannerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftWithAssignments | null>(null);
  const { toast } = useToast();

  const canManageShifts = isAdmin || isManager;

  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery<{ shifts: ShiftWithAssignments[] }>({
    queryKey: ["/api/shifts/week", { start: format(weekStart, "yyyy-MM-dd"), restaurantId }],
    queryFn: async () => {
      const url = `/api/shifts/week?start=${format(weekStart, "yyyy-MM-dd")}&restaurantId=${restaurantId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
    enabled: !!restaurantId,
  });

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

  const invalidateShiftQueries = () => {
    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && key.startsWith("/api/shifts");
    }});
  };

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

  const assignUserMutation = useMutation({
    mutationFn: async ({ shiftId, userId }: { shiftId: string; userId: string }) => {
      const res = await apiRequest("POST", "/api/shifts/assignments", { shiftId, userId });
      return res.json();
    },
    onSuccess: () => {
      invalidateShiftQueries();
      toast({ title: "Staff assigned successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to assign staff", description: err.message });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("DELETE", `/api/shifts/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      invalidateShiftQueries();
      toast({ title: "Assignment removed" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to remove assignment", description: err.message });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      return apiRequest("DELETE", `/api/shifts/${shiftId}`);
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

  const navigatePrev = () => setSelectedDate(prev => addDays(prev, -7));
  const navigateNext = () => setSelectedDate(prev => addDays(prev, 7));
  const navigateToday = () => setSelectedDate(new Date());

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftWithAssignments[]>();
    shiftsData?.shifts?.forEach(shift => {
      const dateKey = shift.shiftDate;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(shift);
    });
    return map;
  }, [shiftsData?.shifts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
                {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
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

      {shiftsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!shiftsLoading && (
        <div className="space-y-3">
          {weekDays.map(day => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayShifts = shiftsByDate.get(dateKey) || [];
            const sortedShifts = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));

            const shiftsByStation = new Map<string, ShiftWithAssignments[]>();
            sortedShifts.forEach(shift => {
              const station = shift.station || "Other";
              if (!shiftsByStation.has(station)) shiftsByStation.set(station, []);
              shiftsByStation.get(station)!.push(shift);
            });

            const today = isToday(day);

            return (
              <div
                key={dateKey}
                className={cn(
                  "rounded-lg border p-3",
                  today && "border-primary ring-1 ring-primary/20"
                )}
                data-testid={`day-row-${dateKey}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "text-sm font-semibold",
                    today && "text-primary"
                  )}>
                    {format(day, "EEE, MMM d")}
                  </span>
                  {today && <Badge variant="default">Today</Badge>}
                  {dayShifts.length === 0 && (
                    <span className="text-xs text-muted-foreground ml-2">No shifts scheduled</span>
                  )}
                </div>

                {dayShifts.length > 0 && (
                  <div className="space-y-2">
                    {Array.from(shiftsByStation.entries()).map(([station, stationShifts]) => {
                      const colors = STATION_COLORS[station] || DEFAULT_STATION_COLOR;
                      const allStaff = stationShifts.flatMap(s => s.assignments || []);

                      return (
                        <div
                          key={station}
                          className={cn(
                            "rounded-md border p-2.5",
                            colors.bg,
                            colors.border,
                          )}
                          data-testid={`station-block-${dateKey}-${station}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <MapPin className={cn("h-3.5 w-3.5 shrink-0", colors.text)} />
                              <span className={cn("text-sm font-semibold", colors.text)}>
                                {station}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {stationShifts.map(shift => (
                                <button
                                  key={shift.id}
                                  onClick={() => setSelectedShift(shift)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  data-testid={`shift-time-${shift.id}`}
                                >
                                  <Clock className="h-3 w-3" />
                                  <span>{shift.startTime} - {shift.endTime}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {allStaff.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {allStaff.map(a => (
                                <div
                                  key={a.id}
                                  className="flex items-center gap-1 rounded-md bg-background/80 border px-2 py-0.5 text-xs"
                                  data-testid={`staff-badge-${a.id}`}
                                >
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">{a.userName}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">No staff assigned</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
  const colors = STATION_COLORS[shift.station] || DEFAULT_STATION_COLOR;

  return (
    <div className="space-y-4">
      <div className={cn("rounded-md p-3 space-y-2", colors.bg, colors.border, "border")}>
        <div className="flex items-center gap-2 text-sm">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{format(new Date(shift.shiftDate), "EEEE, MMMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{shift.startTime} - {shift.endTime}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className={cn(colors.text, "border-current")}>{shift.station}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{shift.assignments?.length || 0} / {shift.requiredStaff} staff assigned</span>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Assigned Staff</Label>
        {shift.assignments && shift.assignments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {shift.assignments.map(assignment => (
              <div key={assignment.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
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
