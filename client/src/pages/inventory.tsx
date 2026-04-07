import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InventoryItem, Restaurant } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Building2,
  Plus,
  Trash2,
  ShoppingCart,
} from "lucide-react";

const STORAGE_LOCATIONS = ["All", "Shelves", "Fridge", "Freezer"] as const;
type StorageLocation = typeof STORAGE_LOCATIONS[number];

const storageIcons: Record<StorageLocation, typeof Package> = {
  All: Package,
  Shelves: Archive,
  Fridge: Refrigerator,
  Freezer: Snowflake,
};

function EditableCell({
  item,
  field,
  onSave,
  editable = true,
}: {
  item: InventoryItem;
  field: "quantity" | "lowStockThreshold";
  onSave: (id: string, value: number) => void;
  editable?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const currentValue = field === "quantity" ? item.quantity : item.lowStockThreshold;
  const [value, setValue] = useState(currentValue || "0");

  const handleSave = () => {
    const numValue = parseFloat(value) || 0;
    onSave(item.id, numValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(currentValue || "0");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing && editable) {
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
          data-testid={`input-${field}-${item.id}`}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          className="h-8 w-8"
          data-testid={`button-save-${field}-${item.id}`}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          className="h-8 w-8"
          data-testid={`button-cancel-${field}-${item.id}`}
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  if (!editable) {
    return (
      <span className="px-2 py-1">
        {parseFloat(currentValue || "0").toFixed(1)}
      </span>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="text-right cursor-pointer hover-elevate px-2 py-1 rounded-md min-w-[60px]"
      data-testid={`button-edit-${field}-${item.id}`}
    >
      {parseFloat(currentValue || "0").toFixed(1)}
    </button>
  );
}

export default function InventoryPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStorage, setActiveStorage] = useState<StorageLocation>("All");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [newItem, setNewItem] = useState({ item: "", storage: "Shelves", unit: "", lowStockThreshold: "0", quantity: "0" });

  const isAdmin = user?.role === "admin";
  const isAdminWithoutRestaurant = user?.role === "admin" && !user?.restaurantId;

  // Fetch restaurants for admin selector
  const { data: restaurantsData } = useQuery<{ restaurants: Restaurant[] }>({
    queryKey: ["/api/restaurants"],
    enabled: isAdminWithoutRestaurant,
  });

  // Set default restaurant when data loads
  useEffect(() => {
    if (isAdminWithoutRestaurant && restaurantsData?.restaurants?.length && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurantsData.restaurants[0].id);
    }
  }, [restaurantsData, isAdminWithoutRestaurant, selectedRestaurantId]);

  // Build the API URL with restaurant ID for admins
  const inventoryApiUrl = isAdminWithoutRestaurant && selectedRestaurantId
    ? `/api/inventory?restaurantId=${selectedRestaurantId}`
    : "/api/inventory";

  const { data: inventoryData, isLoading } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory", selectedRestaurantId],
    queryFn: async () => {
      const res = await fetch(inventoryApiUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    enabled: !isAdminWithoutRestaurant || !!selectedRestaurantId,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const url = isAdminWithoutRestaurant && selectedRestaurantId
        ? `/api/inventory/${id}/quantity?restaurantId=${selectedRestaurantId}`
        : `/api/inventory/${id}/quantity`;
      return apiRequest("PATCH", url, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory", selectedRestaurantId] });
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

  const updateThresholdMutation = useMutation({
    mutationFn: async ({ id, lowStockThreshold }: { id: string; lowStockThreshold: number }) => {
      const url = isAdminWithoutRestaurant && selectedRestaurantId
        ? `/api/inventory/${id}?restaurantId=${selectedRestaurantId}`
        : `/api/inventory/${id}`;
      return apiRequest("PATCH", url, { lowStockThreshold });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory", selectedRestaurantId] });
      toast({
        title: "Threshold updated",
        description: "The minimum threshold has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update threshold",
        variant: "destructive",
      });
    },
  });

  const handleThresholdSave = (id: string, threshold: number) => {
    updateThresholdMutation.mutate({ id, lowStockThreshold: threshold });
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      const url = isAdminWithoutRestaurant && selectedRestaurantId
        ? `/api/inventory?restaurantId=${selectedRestaurantId}`
        : "/api/inventory";
      return apiRequest("POST", url, {
        item: data.item,
        storage: data.storage,
        unit: data.unit,
        lowStockThreshold: parseFloat(data.lowStockThreshold) || 0,
        quantity: parseFloat(data.quantity) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory", selectedRestaurantId] });
      toast({
        title: "Item added",
        description: "The inventory item has been added successfully.",
      });
      setAddDialogOpen(false);
      setNewItem({ item: "", storage: "Shelves", unit: "", lowStockThreshold: "0", quantity: "0" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = isAdminWithoutRestaurant && selectedRestaurantId
        ? `/api/inventory/${id}?restaurantId=${selectedRestaurantId}`
        : `/api/inventory/${id}`;
      return apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory", selectedRestaurantId] });
      toast({
        title: "Item deleted",
        description: "The inventory item has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (!newItem.item.trim() || !newItem.unit.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in the item name and unit.",
        variant: "destructive",
      });
      return;
    }
    createItemMutation.mutate(newItem);
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
            onClick={() => navigate("/landing")}
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
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory Items
            </CardTitle>
            <div className="flex items-center gap-4 flex-wrap">
              {isAdminWithoutRestaurant && restaurantsData?.restaurants && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedRestaurantId}
                    onValueChange={setSelectedRestaurantId}
                  >
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
              {isAdmin && (
                <>
                  <Dialog open={shoppingListOpen} onOpenChange={(open) => {
                    setShoppingListOpen(open);
                    if (!open) setCheckedItems(new Set());
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-shopping-list">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Shopping List
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <ShoppingCart className="h-5 w-5" />
                          Shopping List
                        </DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        {(() => {
                          const lowStockItems = (inventoryData?.items || []).filter((item) => {
                            const qty = parseFloat(item.quantity || "0");
                            const threshold = parseFloat(item.lowStockThreshold || "0");
                            return qty < threshold;
                          });

                          if (lowStockItems.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <Check className="h-12 w-12 mb-4 text-green-600" />
                                <p className="text-center">All items are stocked!</p>
                                <p className="text-sm text-center mt-1">No items below minimum threshold.</p>
                              </div>
                            );
                          }

                          const toggleItem = (id: string) => {
                            setCheckedItems(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) {
                                next.delete(id);
                              } else {
                                next.add(id);
                              }
                              return next;
                            });
                          };

                          return (
                            <ScrollArea className="h-[400px] pr-4">
                              <div className="space-y-2">
                                {lowStockItems.map((item) => {
                                  const qty = parseFloat(item.quantity || "0");
                                  const threshold = parseFloat(item.lowStockThreshold || "0");
                                  const needed = Math.max(0, threshold - qty);
                                  const isChecked = checkedItems.has(item.id);

                                  return (
                                    <div
                                      key={item.id}
                                      className={`flex items-center gap-3 p-3 rounded-md border ${
                                        isChecked ? "bg-muted/50 opacity-60" : "bg-card"
                                      }`}
                                      data-testid={`shopping-item-${item.id}`}
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleItem(item.id)}
                                        data-testid={`checkbox-shopping-${item.id}`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${isChecked ? "line-through" : ""}`}>
                                          {item.item}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          Need: {needed.toFixed(1)} {item.unit} (Current: {qty.toFixed(1)})
                                        </p>
                                      </div>
                                      <Badge variant="secondary" className="shrink-0">
                                        {item.storage}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-muted-foreground text-center">
                                  {checkedItems.size} of {lowStockItems.length} items checked
                                </p>
                              </div>
                            </ScrollArea>
                          );
                        })()}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-item">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Inventory Item</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="item-name">Item Name</Label>
                          <Input
                            id="item-name"
                            value={newItem.item}
                            onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                            placeholder="Enter item name"
                            data-testid="input-new-item-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-storage">Storage Location</Label>
                          <Select
                            value={newItem.storage}
                            onValueChange={(v) => setNewItem({ ...newItem, storage: v })}
                          >
                            <SelectTrigger data-testid="select-new-item-storage">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Shelves">Shelves</SelectItem>
                              <SelectItem value="Fridge">Fridge</SelectItem>
                              <SelectItem value="Freezer">Freezer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="item-unit">Unit</Label>
                          <Input
                            id="item-unit"
                            value={newItem.unit}
                            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                            placeholder="e.g., packs, boxes, kg"
                            data-testid="input-new-item-unit"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="item-threshold">Min Threshold</Label>
                            <Input
                              id="item-threshold"
                              type="number"
                              step="0.1"
                              min="0"
                              value={newItem.lowStockThreshold}
                              onChange={(e) => setNewItem({ ...newItem, lowStockThreshold: e.target.value })}
                              data-testid="input-new-item-threshold"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="item-quantity">Quantity</Label>
                            <Input
                              id="item-quantity"
                              type="number"
                              step="0.1"
                              min="0"
                              value={newItem.quantity}
                              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                              data-testid="input-new-item-quantity"
                            />
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          onClick={handleAddItem}
                          disabled={createItemMutation.isPending}
                          data-testid="button-submit-add-item"
                        >
                          {createItemMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Add Item
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeStorage}
              onValueChange={(v) => setActiveStorage(v as StorageLocation)}
              className="space-y-6"
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
                <TabsContent key={storage} value={storage} className="mt-6">
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
                            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
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
                                  <EditableCell
                                    item={item}
                                    field="lowStockThreshold"
                                    onSave={handleThresholdSave}
                                    editable={isAdmin}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <EditableCell
                                    item={item}
                                    field="quantity"
                                    onSave={handleQuantitySave}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  {isLowStock ? (
                                    <Badge variant="destructive">Low Stock</Badge>
                                  ) : (
                                    <Badge className="bg-green-600 text-white dark:bg-green-700">Stocked</Badge>
                                  )}
                                </TableCell>
                                {isAdmin && (
                                  <TableCell className="text-right">
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="text-destructive"
                                          data-testid={`button-delete-${item.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Item</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete "{item.item}"? This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteItemMutation.mutate(item.id)}
                                            className="bg-destructive text-destructive-foreground"
                                          >
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </TableCell>
                                )}
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
