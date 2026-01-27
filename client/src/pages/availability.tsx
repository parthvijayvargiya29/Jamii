import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import { StaffAvailability } from "@/components/staff-availability";

export default function Availability() {
  const [, navigate] = useLocation();

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
