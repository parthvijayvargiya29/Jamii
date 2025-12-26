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
  Clock,
  Sparkles,
  CalendarCheck
} from "lucide-react";

const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
type Frequency = typeof FREQUENCIES[number];

interface CleaningTaskFormData {
  name: string;
  frequency: string;
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
  const [name, setName] = useState(task?.name || "");
  const [frequency, setFrequency] = useState<string>(task?.frequency || "daily");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      frequency,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Task Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter task name"
          required
          data-testid="input-task-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency</Label>
        <Select value={frequency} onValueChange={setFrequency}>
          <SelectTrigger data-testid="select-frequency">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map((freq) => (
              <SelectItem key={freq} value={freq}>
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()} data-testid="button-submit">
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
          <DialogTitle>Complete Task: {task.name}</DialogTitle>
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
  const frequencyColors: Record<Frequency, string> = {
    daily: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    weekly: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    monthly: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-task-${task.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{task.name}</CardTitle>
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
                      Are you sure you want to delete "{task.name}"? This action cannot be undone.
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
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={frequencyColors[task.frequency as Frequency] || ""}>
            <Clock className="h-3 w-3 mr-1" />
            {task.frequency}
          </Badge>
        </div>
        <CompleteTaskDialog 
          task={task} 
          onComplete={onComplete} 
          isCompleting={isCompleting} 
        />
      </CardContent>
    </Card>
  );
}

export default function CleaningTasksPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<CleaningTask | null>(null);
  const [filterFrequency, setFilterFrequency] = useState<string>("all");

  const canEdit = user?.role === "admin" || user?.role === "manager";

  const { data: tasks = [], isLoading } = useQuery<CleaningTask[]>({
    queryKey: ["/api/cleaning"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CleaningTaskFormData) => {
      const res = await apiRequest("POST", "/api/cleaning", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning"] });
      setIsAddingTask(false);
      toast({ title: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CleaningTaskFormData }) => {
      const res = await apiRequest("PATCH", `/api/cleaning/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning"] });
      setEditingTask(null);
      toast({ title: "Task updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cleaning/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/cleaning/${taskId}/complete`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaning"] });
      toast({ title: "Task marked as complete" });
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  const handleComplete = (taskId: string, notes: string) => {
    completeMutation.mutate({ taskId, notes });
  };

  const filteredTasks = filterFrequency === "all" 
    ? tasks 
    : tasks.filter(t => t.frequency === filterFrequency);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/landing")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Cleaning Tasks</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterFrequency} onValueChange={setFilterFrequency}>
              <SelectTrigger className="w-32" data-testid="select-filter-frequency">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canEdit && (
              <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-task">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Cleaning Task</DialogTitle>
                  </DialogHeader>
                  <CleaningTaskForm
                    onSubmit={(data) => createMutation.mutate(data)}
                    onCancel={() => setIsAddingTask(false)}
                    isSubmitting={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filterFrequency === "all" 
                ? "No cleaning tasks yet" 
                : `No ${filterFrequency} cleaning tasks`}
            </p>
            {canEdit && filterFrequency === "all" && (
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => setIsAddingTask(true)}
                data-testid="button-add-first-task"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              <CleaningTaskCard
                key={task.id}
                task={task}
                canEdit={canEdit}
                onEdit={setEditingTask}
                onDelete={(id) => deleteMutation.mutate(id)}
                onComplete={handleComplete}
                editingTask={editingTask}
                setEditingTask={setEditingTask}
                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                isUpdating={updateMutation.isPending}
                isCompleting={completeMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
