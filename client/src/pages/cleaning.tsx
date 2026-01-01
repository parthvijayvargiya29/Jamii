import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CleaningTask, CleaningLog } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  Sparkles,
} from "lucide-react";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayOfWeek = typeof DAYS_OF_WEEK[number];

interface CleaningTaskFormData {
  day: string;
  station: string;
  task: string;
  isActive: boolean;
}

function CleaningTaskForm({
  task,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  task?: CleaningTask;
  onSubmit: (data: CleaningTaskFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [day, setDay] = useState(task?.day || "Monday");
  const [station, setStation] = useState(task?.station || "");
  const [taskName, setTaskName] = useState(task?.task || "");
  const [isActive, setIsActive] = useState(task?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      day,
      station,
      task: taskName,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="day">Day</Label>
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger data-testid="select-day">
            <SelectValue placeholder="Select day" />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OF_WEEK.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="station">Station</Label>
        <Input
          id="station"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          placeholder="e.g., Kitchen, Prep Area, Front Counter"
          required
          data-testid="input-station"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task">Task</Label>
        <Input
          id="task"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          placeholder="Enter cleaning task description"
          required
          data-testid="input-task"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          data-testid="switch-active"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !station.trim() || !taskName.trim()} data-testid="button-submit">
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {task ? "Update" : "Create"} Task
        </Button>
      </div>
    </form>
  );
}

function CompleteTaskDialog({
  task,
  onComplete,
  isCompleting,
}: {
  task: CleaningTask;
  onComplete: (taskId: string, notes: string) => void;
  isCompleting: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const handleComplete = () => {
    onComplete(task.id, notes);
    setOpen(false);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" data-testid={`button-complete-${task.id}`}>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Complete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Task: {task.task}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this cleaning..."
              rows={3}
              data-testid="input-complete-notes"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isCompleting} data-testid="button-confirm-complete">
              {isCompleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CleaningTaskCard({
  task,
  canEdit,
  onEdit,
  onDelete,
  onComplete,
  editingTask,
  setEditingTask,
  onUpdate,
  isUpdating,
  isCompleting,
}: {
  task: CleaningTask;
  canEdit: boolean;
  onEdit: (task: CleaningTask) => void;
  onDelete: (id: string) => void;
  onComplete: (taskId: string, notes: string) => void;
  editingTask: CleaningTask | null;
  setEditingTask: (task: CleaningTask | null) => void;
  onUpdate: (id: string, data: CleaningTaskFormData) => void;
  isUpdating: boolean;
  isCompleting: boolean;
}) {
  const dayColors: Record<string, string> = {
    Monday: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    Tuesday: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    Wednesday: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    Thursday: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    Friday: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    Saturday: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    Sunday: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Card className={`hover-elevate ${!task.isActive ? 'opacity-60' : ''}`} data-testid={`card-task-${task.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{task.task}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{task.station}</p>
          </div>
          {canEdit && (
            <div className="flex gap-1 flex-shrink-0">
              <Dialog open={editingTask?.id === task.id} onOpenChange={(open) => !open && setEditingTask(null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(task)} data-testid={`button-edit-task-${task.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                  </DialogHeader>
                  <CleaningTaskForm
                    task={task}
                    onSubmit={(data) => onUpdate(task.id, data)}
                    onCancel={() => setEditingTask(null)}
                    isSubmitting={isUpdating}
                  />
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid={`button-delete-task-${task.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this task? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(task.id)} data-testid="button-confirm-delete">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={dayColors[task.day || "Monday"] || dayColors.Monday}>
            {task.day || "Unscheduled"}
          </Badge>
          {!task.isActive && (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
        <div className="mt-3">
          <CompleteTaskDialog
            task={task}
            onComplete={onComplete}
            isCompleting={isCompleting}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CleaningTasksPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "all">("all");
  const [editingTask, setEditingTask] = useState<CleaningTask | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const canEdit = user?.role === "admin" || user?.role === "manager";

  const { data: tasks = [], isLoading } = useQuery<CleaningTask[]>({
    queryKey: ["/api/cleaning/tasks"],
  });

  const createMutation = useMutation({
    mutationFn: (data: CleaningTaskFormData) =>
      apiRequest("POST", "/api/cleaning/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning/tasks"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Task created",
        description: "Cleaning task has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CleaningTaskFormData }) =>
      apiRequest("PATCH", `/api/cleaning/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning/tasks"] });
      setEditingTask(null);
      toast({
        title: "Task updated",
        description: "Cleaning task has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/cleaning/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning/tasks"] });
      toast({
        title: "Task deleted",
        description: "Cleaning task has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task.",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string }) =>
      apiRequest("POST", `/api/cleaning/tasks/${taskId}/complete`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning/tasks"] });
      toast({
        title: "Task completed",
        description: "Task has been marked as complete.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete task.",
        variant: "destructive",
      });
    },
  });

  const handleComplete = (taskId: string, notes: string) => {
    completeMutation.mutate({ taskId, notes });
  };

  const handleUpdate = (id: string, data: CleaningTaskFormData) => {
    updateMutation.mutate({ id, data });
  };

  const filteredTasks = selectedDay === "all"
    ? tasks
    : tasks.filter((t) => t.day === selectedDay);

  // Group tasks by station
  const tasksByStation = filteredTasks.reduce((acc, task) => {
    const station = task.station || "Unassigned";
    if (!acc[station]) {
      acc[station] = [];
    }
    acc[station].push(task);
    return acc;
  }, {} as Record<string, CleaningTask[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/landing")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Cleaning Tasks</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedDay === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDay("all")}
            data-testid="filter-all"
          >
            All Days
          </Button>
          {DAYS_OF_WEEK.map((day) => (
            <Button
              key={day}
              variant={selectedDay === day ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDay(day)}
              data-testid={`filter-${day.toLowerCase()}`}
            >
              {day.slice(0, 3)}
            </Button>
          ))}
        </div>

        {canEdit && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-task">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Cleaning Task</DialogTitle>
              </DialogHeader>
              <CleaningTaskForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateDialogOpen(false)}
                isSubmitting={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {Object.keys(tasksByStation).length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No cleaning tasks found</h3>
          <p className="text-muted-foreground mb-4">
            {selectedDay !== "all"
              ? `No tasks scheduled for ${selectedDay}.`
              : "Get started by adding your first cleaning task."}
          </p>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-task">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(tasksByStation).map(([station, stationTasks]) => (
            <div key={station}>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{station}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stationTasks.map((task) => (
                  <CleaningTaskCard
                    key={task.id}
                    task={task}
                    canEdit={canEdit}
                    onEdit={setEditingTask}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onComplete={handleComplete}
                    editingTask={editingTask}
                    setEditingTask={setEditingTask}
                    onUpdate={handleUpdate}
                    isUpdating={updateMutation.isPending}
                    isCompleting={completeMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
