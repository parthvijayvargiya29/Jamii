import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Calendar, TrendingDown, TrendingUp, Package, Truck, AlertTriangle, BarChart3 } from "lucide-react";
import type { InventoryItem } from "@shared/schema";

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

export default function Dashboard() {
  const [dateRange, setDateRange] = useState("30");
  const [selectedItem, setSelectedItem] = useState<string>("all");

  const startDate = useMemo(() => {
    const days = parseInt(dateRange);
    return format(subDays(new Date(), days), "yyyy-MM-dd");
  }, [dateRange]);

  const endDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("startDate", startDate);
    params.set("endDate", endDate);
    if (selectedItem !== "all") {
      params.set("itemId", selectedItem);
    }
    return params.toString();
  }, [startDate, endDate, selectedItem]);

  const { data: inventoryItems } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory"],
  });

  const { data: dailyUsageData, isLoading: usageLoading } = useQuery<{ data: DailyUsageData[] }>({
    queryKey: ["/api/inventory-logs/analytics/daily-usage", { startDate, endDate, selectedItem }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/daily-usage?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch daily usage");
      return res.json();
    },
  });

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery<{ data: DeliveryData[] }>({
    queryKey: ["/api/inventory-logs/analytics/deliveries", { startDate, endDate, selectedItem }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/deliveries?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      return res.json();
    },
  });

  const { data: netMovementData, isLoading: netLoading } = useQuery<{ data: NetMovementData[] }>({
    queryKey: ["/api/inventory-logs/analytics/net-movement", { startDate, endDate, selectedItem }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/net-movement?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch net movement");
      return res.json();
    },
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ summary: SummaryData }>({
    queryKey: ["/api/inventory-logs/analytics/summary", { startDate, endDate, selectedItem }],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-logs/analytics/summary?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: lowStockData, isLoading: lowStockLoading } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory/low-stock"],
  });

  const isLoading = usageLoading || deliveriesLoading || netLoading || summaryLoading || lowStockLoading;

  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "MMM d");
  };

  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Inventory Analytics</h1>
          <p className="text-muted-foreground">Track inventory usage, deliveries, and stock levels</p>
        </div>

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
                {inventoryItems?.items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockData?.items?.map((item) => (
                  <TableRow key={item.id} data-testid={`row-low-stock-${item.id}`}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">
                      {parseFloat(item.quantity).toFixed(1)} {item.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {parseFloat(item.lowStockThreshold).toFixed(1)} {item.unit}
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
    </div>
  );
}
