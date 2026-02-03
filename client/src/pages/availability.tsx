import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CalendarCheck, Loader2 } from "lucide-react";
import { StaffAvailability } from "@/components/staff-availability";
import { format, parseISO } from "date-fns";

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
              Shifts
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
