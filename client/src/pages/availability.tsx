import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CalendarCheck, Loader2, LogIn, LogOut, Timer } from "lucide-react";
import { StaffAvailability } from "@/components/staff-availability";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AllocatedShift {
  id: string;
  restaurantId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  station: string;
  assignmentId: string;
  assignmentStatus: string;
  restaurantName: string;
}

interface TimeEntry {
  id: string;
  userId: string;
  shiftId: string | null;
  restaurantId: string;
  clockInTime: string;
  clockOutTime: string | null;
  totalMinutes: number | null;
  status: string;
  createdAt: string;
}

function TimeTrackingWidget() {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState<string>("");

  const { data: statusData, isLoading } = useQuery<{ hasOpenEntry: boolean; openEntry: TimeEntry | null }>({
    queryKey: ["/api/time-entries/status"],
    queryFn: async () => {
      const res = await fetch("/api/time-entries/status", {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time-entries/clock-in", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/status"] });
      toast({ title: "Clocked In", description: "Your shift has started." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time-entries/clock-out", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/status"] });
      const mins = Math.round(data.timeEntry?.totalMinutes || 0);
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      toast({ 
        title: "Clocked Out", 
        description: `Total time: ${hours}h ${remainingMins}m` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (statusData?.openEntry?.clockInTime) {
      const updateElapsed = () => {
        const clockIn = new Date(statusData.openEntry!.clockInTime);
        const now = new Date();
        const diffMs = now.getTime() - clockIn.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setElapsedTime(`${hours}h ${mins}m`);
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 60000);
      return () => clearInterval(interval);
    }
  }, [statusData?.openEntry?.clockInTime]);

  if (isLoading) {
    return (
      <Card data-testid="card-time-tracking">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Time Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasOpenEntry = statusData?.hasOpenEntry || false;
  const openEntry = statusData?.openEntry;

  return (
    <Card data-testid="card-time-tracking">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Time Tracking
        </CardTitle>
        <CardDescription>
          {hasOpenEntry ? "You are currently clocked in." : "Clock in to start tracking your shift."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasOpenEntry && openEntry ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <div>
                <div className="text-sm text-muted-foreground">Clocked in at</div>
                <div className="font-medium">
                  {format(new Date(openEntry.clockInTime), "h:mm a")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Elapsed time</div>
                <div className="font-medium text-lg">{elapsedTime}</div>
              </div>
            </div>
            <Button
              onClick={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
              className="w-full gap-2"
              variant="destructive"
              data-testid="button-clock-out"
            >
              {clockOutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Clock Out
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => clockInMutation.mutate()}
            disabled={clockInMutation.isPending}
            className="w-full gap-2"
            data-testid="button-clock-in"
          >
            {clockInMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Clock In
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Availability() {
  const [, navigate] = useLocation();

  const { data: shiftsData, isLoading } = useQuery<{ shifts: AllocatedShift[] }>({
    queryKey: ["/api/shifts/my-shifts"],
    queryFn: async () => {
      const res = await fetch("/api/shifts/my-shifts", {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch shifts");
      return res.json();
    },
  });

  const allocatedShifts = shiftsData?.shifts || [];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/landing")}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>

        <TimeTrackingWidget />

        <Card data-testid="card-allocated-shifts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              My Allocated Shifts
            </CardTitle>
            <CardDescription>
              View your upcoming assigned shifts across all restaurants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allocatedShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming shifts allocated. Set your availability below and managers will assign shifts.
              </p>
            ) : (
              <div className="space-y-3">
                {allocatedShifts.map((shift) => (
                  <div
                    key={shift.assignmentId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`shift-card-${shift.id}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {format(parseISO(shift.shiftDate), "EEE, MMM d")}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {shift.station}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shift.startTime} - {shift.endTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{shift.restaurantName}</div>
                      <Badge 
                        variant={shift.assignmentStatus === "confirmed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {shift.assignmentStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-availability">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Availability
            </CardTitle>
            <CardDescription>
              Click on dates to set your availability. Managers can use this when creating shift schedules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaffAvailability />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
