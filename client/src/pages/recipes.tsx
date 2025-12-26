import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe, InventoryItem, RecipeIngredient } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Pencil, Trash2, ChefHat, ArrowLeft, X, Loader2, Search, Salad, Wheat, UtensilsCrossed } from "lucide-react";

const CATEGORIES = ["Bowl", "Wrap", "Bread"] as const;
type Category = typeof CATEGORIES[number];

const categoryIcons: Record<Category, typeof Salad> = {
  Bowl: Salad,
  Wrap: UtensilsCrossed,
  Bread: Wheat,
};

function RecipeForm({
  recipe,
  inventoryItems,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  recipe?: Recipe;
  inventoryItems: InventoryItem[];
  onSubmit: (data: { name: string; category: string | null; instructions: string; ingredients: RecipeIngredient[] }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(recipe?.name || "");
  const [category, setCategory] = useState<string>(recipe?.category || "");
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients || []
  );
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  const addIngredient = () => {
    if (!selectedItem || !quantity) return;
    const item = inventoryItems.find((i) => i.id === selectedItem);
    if (!item) return;

    const newIngredient: RecipeIngredient = {
      inventoryItemId: item.id,
      name: item.name,
      quantity: parseFloat(quantity),
      unit: item.unit,
    };
    setIngredients([...ingredients, newIngredient]);
    setSelectedItem("");
    setQuantity("");
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name, category: category || null, instructions, ingredients });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Recipe Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter recipe name"
            data-testid="input-recipe-name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ingredients</Label>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedItem} onValueChange={setSelectedItem}>
            <SelectTrigger className="flex-1 min-w-[200px]" data-testid="select-ingredient">
              <SelectValue placeholder="Select ingredient" />
            </SelectTrigger>
            <SelectContent>
              {inventoryItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            className="w-24"
            data-testid="input-ingredient-quantity"
          />
          <Button type="button" variant="outline" onClick={addIngredient} data-testid="button-add-ingredient">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {ingredients.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {ingredients.map((ing, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {ing.quantity} {ing.unit} {ing.name}
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="ml-1"
                  data-testid={`button-remove-ingredient-${index}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Enter cooking instructions..."
          rows={5}
          data-testid="input-instructions"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="button-save-recipe">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {recipe ? "Update" : "Create"} Recipe
        </Button>
      </div>
    </form>
  );
}

function RecipeCard({
  recipe,
  canEdit,
  inventoryItems,
  onEdit,
  onDelete,
  editingRecipe,
  setEditingRecipe,
  updateMutation,
}: {
  recipe: Recipe;
  canEdit: boolean;
  inventoryItems: InventoryItem[];
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  editingRecipe: Recipe | null;
  setEditingRecipe: (recipe: Recipe | null) => void;
  updateMutation: ReturnType<typeof useMutation>;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-recipe-${recipe.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              <Link href={`/recipes/${recipe.id}`} className="hover:underline" data-testid={`link-recipe-${recipe.id}`}>
                {recipe.name}
              </Link>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex gap-1 flex-shrink-0">
              <Dialog open={editingRecipe?.id === recipe.id} onOpenChange={(open) => !open && setEditingRecipe(null)}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(recipe)} data-testid={`button-edit-recipe-${recipe.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Recipe</DialogTitle>
                  </DialogHeader>
                  <RecipeForm
                    recipe={recipe}
                    inventoryItems={inventoryItems}
                    onSubmit={(data) => updateMutation.mutate({ id: recipe.id, data })}
                    onCancel={() => setEditingRecipe(null)}
                    isSubmitting={updateMutation.isPending}
                  />
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid={`button-delete-recipe-${recipe.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{recipe.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(recipe.id)}
                      data-testid="button-confirm-delete"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1">
          {recipe.ingredients.slice(0, 3).map((ing, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {ing.name}
            </Badge>
          ))}
          {recipe.ingredients.length > 3 && (
            <Badge variant="outline" className="text-xs">+{recipe.ingredients.length - 3}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({
  category,
  recipes,
  canEdit,
  inventoryItems,
  editingRecipe,
  setEditingRecipe,
  updateMutation,
  deleteMutation,
}: {
  category: Category;
  recipes: Recipe[];
  canEdit: boolean;
  inventoryItems: InventoryItem[];
  editingRecipe: Recipe | null;
  setEditingRecipe: (recipe: Recipe | null) => void;
  updateMutation: ReturnType<typeof useMutation>;
  deleteMutation: ReturnType<typeof useMutation>;
}) {
  const Icon = categoryIcons[category];

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No {category.toLowerCase()} recipes yet</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          canEdit={canEdit}
          inventoryItems={inventoryItems}
          onEdit={setEditingRecipe}
          onDelete={(id) => deleteMutation.mutate(id)}
          editingRecipe={editingRecipe}
          setEditingRecipe={setEditingRecipe}
          updateMutation={updateMutation}
        />
      ))}
    </div>
  );
}

export default function RecipesPage() {
  const { canModifyRecipes: canEdit } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: recipesData, isLoading: recipesLoading } = useQuery<{ recipes: Recipe[] }>({
    queryKey: ["/api/recipes"],
  });

  const { data: inventoryData } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ["/api/inventory"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string | null; instructions: string; ingredients: RecipeIngredient[] }) => {
      return apiRequest("POST", "/api/recipes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsCreateOpen(false);
      toast({ title: "Recipe created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create recipe", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Recipe> }) => {
      return apiRequest("PATCH", `/api/recipes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setEditingRecipe(null);
      toast({ title: "Recipe updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update recipe", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/recipes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete recipe", variant: "destructive" });
    },
  });

  const recipes = recipesData?.recipes || [];
  const inventoryItems = inventoryData?.items || [];

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const query = searchQuery.toLowerCase();
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.ingredients.some((ing) => ing.name.toLowerCase().includes(query))
    );
  }, [recipes, searchQuery]);

  // Group recipes by category
  const recipesByCategory = useMemo(() => {
    const grouped: Record<string, Recipe[]> = {
      Bowl: [],
      Wrap: [],
      Bread: [],
      Other: [],
    };
    filteredRecipes.forEach((recipe) => {
      const cat = recipe.category?.trim();
      // Normalize category (case insensitive matching)
      if (cat?.toLowerCase() === "bowl") {
        grouped.Bowl.push(recipe);
      } else if (cat?.toLowerCase() === "wrap" || cat?.toLowerCase() === "wraps") {
        grouped.Wrap.push(recipe);
      } else if (cat?.toLowerCase() === "bread") {
        grouped.Bread.push(recipe);
      } else {
        grouped.Other.push(recipe);
      }
    });
    return grouped;
  }, [filteredRecipes]);

  const categoryCounts = useMemo(() => ({
    all: filteredRecipes.length,
    Bowl: recipesByCategory.Bowl.length,
    Wrap: recipesByCategory.Wrap.length,
    Bread: recipesByCategory.Bread.length,
  }), [filteredRecipes, recipesByCategory]);

  if (recipesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <ChefHat className="h-5 w-5 md:h-6 md:w-6" />
                Recipes
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">Quick access by category</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 md:w-64"
                data-testid="input-search-recipes"
              />
            </div>
            {canEdit && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-recipe">
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">New Recipe</span>
                    <span className="sm:hidden">New</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Recipe</DialogTitle>
                  </DialogHeader>
                  <RecipeForm
                    inventoryItems={inventoryItems}
                    onSubmit={(data) => createMutation.mutate(data)}
                    onCancel={() => setIsCreateOpen(false)}
                    isSubmitting={createMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto" data-testid="tabs-categories">
            <TabsTrigger value="all" className="gap-1" data-testid="tab-all">
              <ChefHat className="h-4 w-4" />
              All
              <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts.all}</Badge>
            </TabsTrigger>
            {CATEGORIES.map((cat) => {
              const Icon = categoryIcons[cat];
              return (
                <TabsTrigger key={cat} value={cat} className="gap-1" data-testid={`tab-${cat.toLowerCase()}`}>
                  <Icon className="h-4 w-4" />
                  {cat}
                  <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts[cat]}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {filteredRecipes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ChefHat className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg">
                    {searchQuery ? "No recipes match your search" : "No recipes yet"}
                  </p>
                  {canEdit && !searchQuery && <p className="text-muted-foreground">Create your first recipe to get started</p>}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {CATEGORIES.map((cat) => {
                  const catRecipes = recipesByCategory[cat];
                  if (catRecipes.length === 0) return null;
                  const Icon = categoryIcons[cat];
                  return (
                    <div key={cat}>
                      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {cat}
                        <Badge variant="outline" className="text-xs">{catRecipes.length}</Badge>
                      </h2>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {catRecipes.map((recipe) => (
                          <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            canEdit={canEdit}
                            inventoryItems={inventoryItems}
                            onEdit={setEditingRecipe}
                            onDelete={(id) => deleteMutation.mutate(id)}
                            editingRecipe={editingRecipe}
                            setEditingRecipe={setEditingRecipe}
                            updateMutation={updateMutation}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {recipesByCategory.Other.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <UtensilsCrossed className="h-5 w-5" />
                      Other
                      <Badge variant="outline" className="text-xs">{recipesByCategory.Other.length}</Badge>
                    </h2>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {recipesByCategory.Other.map((recipe) => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          canEdit={canEdit}
                          inventoryItems={inventoryItems}
                          onEdit={setEditingRecipe}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          editingRecipe={editingRecipe}
                          setEditingRecipe={setEditingRecipe}
                          updateMutation={updateMutation}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {CATEGORIES.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-0">
              <CategorySection
                category={cat}
                recipes={recipesByCategory[cat]}
                canEdit={canEdit}
                inventoryItems={inventoryItems}
                editingRecipe={editingRecipe}
                setEditingRecipe={setEditingRecipe}
                updateMutation={updateMutation}
                deleteMutation={deleteMutation}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
