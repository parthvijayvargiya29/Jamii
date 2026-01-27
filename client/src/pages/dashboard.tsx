import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Calendar, TrendingDown, TrendingUp, Package, Truck, AlertTriangle, BarChart3, Users, Trash2, History, ClipboardList, User, Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InventoryItem, CleaningLogWithDetails, InventoryLog } from "@shared/schema";
import { format as formatDate } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShiftPlanner } from "@/components/shift-planner";
import { StaffAvailability } from "@/components/staff-availability";
import { CalendarDays, Clock } from "lucide-react";

interface DailyUsageData {
  date: string;
  totalUsage: number;
  itemCount: number;
}

interface DeliveryData {
  date: string;
  totalDelivered: number;
  deliveryCount: number;
}

interface NetMovementData {
  date: string;
  deliveries: number;
  usage: number;
  adjustments: number;
  netMovement: number;
}

interface SummaryData {
  totalDeliveries: number;
  totalUsage: number;
  totalAdjustments: number;
  netMovement: number;
  deliveryCount: number;
  usageCount: number;
  adjustmentCount: number;
  totalLogCount: number;
  averageDailyUsage: number;
  averageDailyDeliveries: number;
  daysCovered: number;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
  restaurantId: string | null;
  createdAt: string;
}

type DashboardSection = "analytics" | "logs" | "low-stock" | "users" | "cleaning-logs" | "my-availability";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [dateRange, setDateRange] = useState("30");
  const [selectedItem, setSelectedItem] = useState<string>("all");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<DashboardSection>("analytics");
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const canManageShifts = isAdmin || isManager;
  const isAdminWithoutRestaurant = isAdmin && !user?.restaurantId;

  const startDate = useMemo(() => {
    const days = parseInt(dateRange);
    return format(subDays(new Date(), days), "yyyy-MM-dd");
  }, [dateRange]);

  const endDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Fetch restaurants first for admin selector
  const { data: restaurantsData } = useQuery<{ restaurants: { id: string; name: string }[] }>({
    queryKey: ["/api/restaurants"],
    enabled: isAdminWithoutRestaurant,
  });

  // Set default restaurant when data loads
  const effectiveRestaurantId = isAdminWithoutRestaurant 
    ? selectedRestaurantId 
    : user?.restaurantId;

  // Auto-select first restaurant for admins
  if (isAdminWithoutRestaurant && !selectedRestaurantId && restaurantsData?.restaurants?.length) {
    setSelectedRestaurantId(restaurantsData.restaurants[0].id);
  }

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    if (selectedItem !== "all") {
      params.set("itemId", selectedItem);
    }
    if (isAdminWithoutRestaurant && selectedRestaurantId) {
      params.set("restaurantId", selectedRestaurantId);
    }
    return params.toString();
  }, [startDate, endDate, selectedItem, isAdminWithoutRestaurant, selectedRestaurantId]);

  const inventoryUrl = isAdminWithoutRestaurant && selectedRestaurantId
    ? `/api/inventory?restaurantId=${selectedRestaurantId}`
    : "/api/inventory";
  
  const { data: inventoryItems } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory", selectedRestaurantId],
    queryFn: async () => {
      const res = await fetch(inventoryUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  const { data: dailyUsageData, isLoading: usageLoading } = useQuery<{ data: DailyUsageData[] }>({
    queryKey: ["/api/inventory-logs/analytics/daily-usage", { startDate, endDate, selectedItem, selectedRestaurantId }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/daily-usage?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch daily usage");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery<{ data: DeliveryData[] }>({
    queryKey: ["/api/inventory-logs/analytics/deliveries", { startDate, endDate, selectedItem, selectedRestaurantId }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/deliveries?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  const { data: netMovementData, isLoading: netLoading } = useQuery<{ data: NetMovementData[] }>({
    queryKey: ["/api/inventory-logs/analytics/net-movement", { startDate, endDate, selectedItem, selectedRestaurantId }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/net-movement?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch net movement");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ summary: SummaryData }>({
    queryKey: ["/api/inventory-logs/analytics/summary", { startDate, endDate, selectedItem, selectedRestaurantId }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/summary?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  // Fetch raw inventory logs for table view
  interface LogWithItem extends InventoryLog {
    itemName?: string;
    itemUnit?: string;
  }
  
  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: InventoryLog[] }>({
    queryKey: ["/api/inventory-logs", { startDate, endDate, selectedItem, selectedRestaurantId }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  // Enrich logs with item names
  const enrichedLogs = useMemo(() => {
    if (!logsData?.logs || !inventoryItems?.items) return [];
    const itemMap = new Map(inventoryItems.items.map(item => [item.id, item]));
    return logsData.logs.map(log => {
      const item = itemMap.get(log.inventoryItemId);
      return {
        ...log,
        itemName: item?.item || 'Unknown',
        itemUnit: item?.unit || '',
      };
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [logsData?.logs, inventoryItems?.items]);

  const lowStockUrl = isAdminWithoutRestaurant && selectedRestaurantId
    ? `/api/inventory/low-stock?restaurantId=${selectedRestaurantId}`
    : "/api/inventory/low-stock";

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory/low-stock", selectedRestaurantId],
    queryFn: async () => {
      const res = await fetch(lowStockUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch low stock");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  // Admin: fetch all users
  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: UserData[] }>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });


  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update role",
        description: error.message,
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted",
        description: "User has been removed from the system.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete user",
        description: error.message,
      });
    },
  });

  const getRestaurantName = (restaurantId: string | null) => {
    if (!restaurantId) return "None";
    const restaurant = restaurantsData?.restaurants?.find(r => r.id === restaurantId);
    return restaurant?.name || "Unknown";
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default";
      case "manager": return "secondary";
      default: return "outline";
    }
  };

  const isLoading = usageLoading || deliveriesLoading || netLoading || summaryLoading || lowStockLoading;

  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "MMM d");
  };

  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/landing")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-muted-foreground">Analytics, stock alerts, and management</p>
          </div>
        </div>

        {isAdminWithoutRestaurant && restaurantsData?.restaurants && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
              <SelectTrigger className="w-[200px]" data-testid="select-restaurant">
                <SelectValue placeholder="Select restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurantsData.restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex items-center gap-2 flex-wrap bg-muted rounded-lg p-1">
        <Button
          variant={activeSection === "analytics" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("analytics")}
          className="gap-2"
          data-testid="button-section-analytics"
        >
          <BarChart3 className="h-4 w-4" />
          Analytics
        </Button>
        <Button
          variant={activeSection === "logs" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("logs")}
          className="gap-2"
          data-testid="button-section-logs"
        >
          <ClipboardList className="h-4 w-4" />
          Logs
          {enrichedLogs.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{enrichedLogs.length}</Badge>
          )}
        </Button>
        <Button
          variant={activeSection === "low-stock" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("low-stock")}
          className="gap-2"
          data-testid="button-section-low-stock"
        >
          <AlertTriangle className="h-4 w-4" />
          Low Stock
          {lowStockData?.items?.length ? (
            <Badge variant="destructive" className="ml-1 text-xs">{lowStockData.items.length}</Badge>
          ) : null}
        </Button>
        {canManageShifts && (
          <Button
            variant={activeSection === "users" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection("users")}
            className="gap-2"
            data-testid="button-section-users"
          >
            <CalendarDays className="h-4 w-4" />
            Shifts
          </Button>
        )}
        {isAdmin && (
          <Button
            variant={activeSection === "cleaning-logs" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection("cleaning-logs")}
            className="gap-2"
            data-testid="button-section-cleaning-logs"
          >
            <History className="h-4 w-4" />
            Cleaning Logs
          </Button>
        )}
        <Button
          variant={activeSection === "my-availability" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSection("my-availability")}
          className="gap-2"
          data-testid="button-section-my-availability"
        >
          <Clock className="h-4 w-4" />
          My Availability
        </Button>
      </div>

      {/* Analytics Section */}
      {activeSection === "analytics" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]" data-testid="select-date-range">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger className="w-[180px]" data-testid="select-inventory-item">
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {inventoryItems?.items?.map((invItem) => (
                    <SelectItem key={invItem.id} value={invItem.id}>
                      {invItem.item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-deliveries">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? "..." : summaryData?.summary.totalDeliveries.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summaryData?.summary.deliveryCount || 0} deliveries
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-usage">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? "..." : summaryData?.summary.totalUsage.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {summaryData?.summary.averageDailyUsage.toFixed(1) || 0}/day
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-net-movement">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Movement</CardTitle>
            {(summaryData?.summary.netMovement || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summaryData?.summary.netMovement || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {summaryLoading ? "..." : ((summaryData?.summary.netMovement ?? 0) >= 0 ? "+" : "") + (summaryData?.summary.netMovement ?? 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Over {summaryData?.summary.daysCovered || 0} days
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lowStockLoading ? "..." : lowStockData?.items?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Items below threshold</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-usage-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Usage Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyUsageData?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(label) => format(new Date(label), "PPP")}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalUsage"
                    name="Usage"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-deliveries-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deliveriesLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deliveriesData?.data || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    labelFormatter={(label) => format(new Date(label), "PPP")}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="totalDelivered"
                    name="Delivered"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-net-movement-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Net Stock Movement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {netLoading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={netMovementData?.data || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(label) => format(new Date(label), "PPP")}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="deliveries"
                  name="Deliveries"
                  fill="hsl(142, 76%, 36%)"
                  stackId="stack"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="usage"
                  name="Usage"
                  fill="hsl(0, 84%, 60%)"
                  stackId="stack2"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

        </>
      )}

      {/* Logs Section */}
      {activeSection === "logs" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]" data-testid="select-logs-date-range">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger className="w-[180px]" data-testid="select-logs-inventory-item">
                  <SelectValue placeholder="All items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {inventoryItems?.items?.map((invItem) => (
                    <SelectItem key={invItem.id} value={invItem.id}>
                      {invItem.item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card data-testid="card-logs-table">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Inventory Logs
                {enrichedLogs.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {enrichedLogs.length} entries
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading logs...
                </div>
              ) : enrichedLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No inventory logs found for the selected filters
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead className="text-right">New Qty</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                          <TableCell className="text-muted-foreground">
                            {log.createdAt ? formatDate(new Date(log.createdAt), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="font-medium">{log.itemName}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                log.changeType === "Delivery" ? "default" :
                                log.changeType === "Usage" ? "destructive" : "secondary"
                              }
                            >
                              {log.changeType}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-mono ${
                            parseFloat(log.quantityChanged || "0") > 0 
                              ? "text-green-600 dark:text-green-400" 
                              : parseFloat(log.quantityChanged || "0") < 0 
                                ? "text-red-600 dark:text-red-400" 
                                : ""
                          }`}>
                            {parseFloat(log.quantityChanged || "0") > 0 ? "+" : ""}
                            {parseFloat(log.quantityChanged || "0").toFixed(1)} {log.itemUnit}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(log.finalQuantity || "0").toFixed(1)} {log.itemUnit}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {log.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Low Stock Section */}
      {activeSection === "low-stock" && (
        <Card data-testid="card-low-stock-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : !lowStockData?.items?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No items below stock threshold
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockData?.items?.map((item) => (
                    <TableRow key={item.id} data-testid={`row-low-stock-${item.id}`}>
                      <TableCell className="font-medium">{item.item}</TableCell>
                      <TableCell>{item.storage}</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(item.quantity || "0").toFixed(1)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(item.lowStockThreshold || "0").toFixed(1)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">Low Stock</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shift Planner Section - Available to Admin and Manager */}
      {activeSection === "users" && canManageShifts && (
        <div className="space-y-6">
          {/* Shift Planner */}
          {(effectiveRestaurantId || user?.restaurantId) && (
            <Card data-testid="card-shift-planner">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Shift Planner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ShiftPlanner 
                  restaurantId={effectiveRestaurantId || user?.restaurantId || ""} 
                  isAdmin={isAdmin}
                  isManager={isManager}
                />
              </CardContent>
            </Card>
          )}
          
          {/* User Management Table - Admin Only */}
          {isAdmin && (
            <Card data-testid="card-user-management">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
            {usersLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Loading users...
              </div>
            ) : !usersData?.users?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.users?.map((userItem) => (
                    <TableRow key={userItem.id} data-testid={`row-user-${userItem.id}`}>
                      <TableCell className="font-medium">{userItem.name}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>{getRestaurantName(userItem.restaurantId)}</TableCell>
                      <TableCell>
                        <Select
                          value={userItem.role}
                          onValueChange={(newRole) => {
                            updateRoleMutation.mutate({ userId: userItem.id, role: newRole });
                          }}
                          disabled={updateRoleMutation.isPending || userItem.id === user?.id}
                        >
                          <SelectTrigger 
                            className="w-[120px]" 
                            data-testid={`select-role-${userItem.id}`}
                          >
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff" data-testid={`select-role-staff-${userItem.id}`}>Staff</SelectItem>
                            <SelectItem value="manager" data-testid={`select-role-manager-${userItem.id}`}>Manager</SelectItem>
                            <SelectItem value="admin" data-testid={`select-role-admin-${userItem.id}`}>Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {userItem.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-user-${userItem.id}`}
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {userItem.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserMutation.mutate(userItem.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  data-testid={`button-confirm-delete-${userItem.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cleaning Completion Logs - Admin Only */}
      {activeSection === "cleaning-logs" && isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Cleaning Completion Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CleaningLogsSection />
          </CardContent>
        </Card>
      )}

      {/* My Availability Section - Available to all users */}
      {activeSection === "my-availability" && (
        <Card data-testid="card-my-availability">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              My Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Set your availability for each day of the week. Managers can use this information when creating shift schedules.
            </p>
            <StaffAvailability />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CleaningLogsSection() {
  const { data: logs = [], isLoading } = useQuery<CleaningLogWithDetails[]>({
    queryKey: ["/api/cleaning/logs/all"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center">
        <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No completion logs yet</h3>
        <p className="text-muted-foreground">
          When tasks are completed, they will appear here with the timestamp and who completed them.
        </p>
      </div>
    );
  }

  // Group logs by restaurant
  const logsByRestaurant = logs.reduce((acc, log) => {
    const name = log.restaurantName || "Unknown Restaurant";
    if (!acc[name]) {
      acc[name] = [];
    }
    acc[name].push(log);
    return acc;
  }, {} as Record<string, CleaningLogWithDetails[]>);

  const restaurantNames = Object.keys(logsByRestaurant).sort();

  return (
    <div className="space-y-6">
      {restaurantNames.map((restaurantName) => (
        <div key={restaurantName}>
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">{restaurantName}</h3>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {logsByRestaurant[restaurantName].map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{log.taskName}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          {log.station}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {log.day}
                        </Badge>
                      </div>
                      {log.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{log.notes}</p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span data-testid={`log-user-${log.id}`}>{log.username}</span>
                      </div>
                      <div className="text-muted-foreground mt-1" data-testid={`log-time-${log.id}`}>
                        {log.completedAt ? formatDate(new Date(log.completedAt), "MMM d, yyyy h:mm a") : "Unknown"}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
