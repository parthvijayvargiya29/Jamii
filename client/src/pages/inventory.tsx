import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InventoryItem } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Loader2,
  Search,
  Package,
  Snowflake,
  Refrigerator,
  Archive,
  Check,
  X,
} from "lucide-react";

const STORAGE_LOCATIONS = ["All", "Shelves", "Fridge", "Freezer"] as const;
type StorageLocation = typeof STORAGE_LOCATIONS[number];

const storageIcons: Record<StorageLocation, typeof Package> = {
  All: Package,
  Shelves: Archive,
  Fridge: Refrigerator,
  Freezer: Snowflake,
};

function EditableQuantityCell({
  item,
  onSave,
}: {
  item: InventoryItem;
  onSave: (id: string, quantity: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(item.quantity || "0");

  const handleSave = () => {
    const numValue = parseFloat(value) || 0;
    onSave(item.id, numValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(item.quantity || "0");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step="0.1"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-20 h-8 text-right"
          autoFocus
          data-testid={`input-quantity-${item.id}`}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          className="h-8 w-8"
          data-testid={`button-save-quantity-${item.id}`}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          className="h-8 w-8"
          data-testid={`button-cancel-quantity-${item.id}`}
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="text-right cursor-pointer hover-elevate px-2 py-1 rounded-md min-w-[60px]"
      data-testid={`button-edit-quantity-${item.id}`}
    >
      {parseFloat(item.quantity || "0").toFixed(1)}
    </button>
  );
}

export default function InventoryPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStorage, setActiveStorage] = useState<StorageLocation>("All");

  const { data: inventoryData, isLoading } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory"],
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      return apiRequest("PATCH", `/api/inventory/${id}/quantity`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Quantity updated",
        description: "The inventory quantity has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update quantity",
        variant: "destructive",
      });
    },
  });

  const handleQuantitySave = (id: string, quantity: number) => {
    updateQuantityMutation.mutate({ id, quantity });
  };

  const filteredItems = useMemo(() => {
    if (!inventoryData?.items) return [];

    return inventoryData.items.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.item?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStorage =
        activeStorage === "All" || item.storage === activeStorage;

      return matchesSearch && matchesStorage;
    });
  }, [inventoryData?.items, searchQuery, activeStorage]);

  const storageCounts = useMemo(() => {
    if (!inventoryData?.items) return {};

    const counts: Record<string, number> = { All: inventoryData.items.length };
    inventoryData.items.forEach((item) => {
      const storage = item.storage || "Other";
      counts[storage] = (counts[storage] || 0) + 1;
    });
    return counts;
  }, [inventoryData?.items]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/recipes")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Inventory</h1>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory Items
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-inventory"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeStorage}
              onValueChange={(v) => setActiveStorage(v as StorageLocation)}
              className="space-y-4"
            >
              <TabsList className="flex flex-wrap gap-1">
                {STORAGE_LOCATIONS.map((storage) => {
                  const Icon = storageIcons[storage];
                  return (
                    <TabsTrigger
                      key={storage}
                      value={storage}
                      className="flex items-center gap-2"
                      data-testid={`tab-storage-${storage.toLowerCase()}`}
                    >
                      <Icon className="h-4 w-4" />
                      {storage}
                      {storageCounts[storage] !== undefined && (
                        <Badge variant="secondary" className="ml-1">
                          {storageCounts[storage]}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {STORAGE_LOCATIONS.map((storage) => (
                <TabsContent key={storage} value={storage} className="mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <Package className="h-12 w-12 mb-4" />
                      <p>No inventory items found</p>
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead className="text-right">Min Threshold</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((item) => {
                            const qty = parseFloat(item.quantity || "0");
                            const threshold = parseFloat(item.lowStockThreshold || "0");
                            const isLowStock = qty < threshold;

                            return (
                              <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                                <TableCell className="font-medium">{item.item}</TableCell>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell className="text-right">
                                  {threshold.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <EditableQuantityCell
                                    item={item}
                                    onSave={handleQuantitySave}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  {isLowStock ? (
                                    <Badge variant="destructive">Low Stock</Badge>
                                  ) : (
                                    <Badge variant="secondary">OK</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
