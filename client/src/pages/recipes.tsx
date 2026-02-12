import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, ChefHat, ArrowLeft, Loader2, Search, Salad, Wheat, UtensilsCrossed, Clock, Leaf, Wine, ImagePlus, X } from "lucide-react";

const KITCHEN_CATEGORIES = ["Bowl", "Wrap", "Bread"] as const;
const BAR_CATEGORIES = ["Shakes", "Bowls", "Juices", "Schorle", "Lattes"] as const;

const categoryIcons: Record<string, typeof Salad> = {
  Bowl: Salad,
  Wrap: UtensilsCrossed,
  Bread: Wheat,
  "Shakes": UtensilsCrossed,
  "Bowls": Salad,
  "Juices": Leaf,
  "Schorle": Wine,
  "Lattes": Clock,
};

interface RecipeFormData {
  name: string;
  category: string | null;
  dishBase: string | null;
  dishSauce: string | null;
  diet: string | null;
  timingMinutes: number | null;
  instructions: string | null;
  imageUrl: string | null;
}

function RecipeForm({
  recipe,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  recipe?: Recipe;
  onSubmit: (data: RecipeFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(recipe?.name || "");
  const [category, setCategory] = useState<string>(recipe?.category || "");
  const [dishBase, setDishBase] = useState(recipe?.dishBase || "");
  const [dishSauce, setDishSauce] = useState(recipe?.dishSauce || "");
  const [diet, setDiet] = useState(recipe?.diet || "");
  const [timingMinutes, setTimingMinutes] = useState<string>(
    recipe?.timingMinutes?.toString() || ""
  );
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [imageUrl, setImageUrl] = useState<string | null>(recipe?.imageUrl || null);
  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/recipes/upload-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.imageUrl);
    } catch {
      setImagePreview(null);
      setImageUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name,
      category: category || null,
      dishBase: dishBase || null,
      dishSauce: dishSauce || null,
      diet: diet || null,
      timingMinutes: timingMinutes ? parseInt(timingMinutes, 10) : null,
      instructions: instructions || null,
      imageUrl: imageUrl || null,
    });
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
              {KITCHEN_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dishBase">Base</Label>
          <Input
            id="dishBase"
            value={dishBase}
            onChange={(e) => setDishBase(e.target.value)}
            placeholder="e.g., Flatbread wrap, Rice bowl"
            data-testid="input-dish-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dishSauce">Sauce</Label>
          <Input
            id="dishSauce"
            value={dishSauce}
            onChange={(e) => setDishSauce(e.target.value)}
            placeholder="e.g., Mango chili sauce"
            data-testid="input-dish-sauce"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="diet">Diet Type</Label>
          <Select value={diet} onValueChange={setDiet}>
            <SelectTrigger data-testid="select-diet">
              <SelectValue placeholder="Select diet type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Omnivore">Omnivore</SelectItem>
              <SelectItem value="Vegetarian">Vegetarian</SelectItem>
              <SelectItem value="Vegan">Vegan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timingMinutes">Prep Time (minutes)</Label>
          <Input
            id="timingMinutes"
            type="number"
            min="1"
            value={timingMinutes}
            onChange={(e) => setTimingMinutes(e.target.value)}
            placeholder="e.g., 10"
            data-testid="input-timing"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Recipe Picture</Label>
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Recipe preview"
              className="w-full h-48 object-cover rounded-md"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2"
              onClick={handleRemoveImage}
              data-testid="button-remove-image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="recipe-image"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover-elevate"
            data-testid="label-upload-image"
          >
            <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click to upload an image</span>
            <input
              id="recipe-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              data-testid="input-recipe-image"
            />
          </label>
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

function BarRecipeForm({
  recipe,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  recipe?: Recipe;
  onSubmit: (data: RecipeFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(recipe?.name || "");
  const [category, setCategory] = useState<string>(recipe?.category || "");
  const [dishBase, setDishBase] = useState(recipe?.dishBase || "");
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [imageUrl, setImageUrl] = useState<string | null>(recipe?.imageUrl || null);
  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/recipes/upload-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.imageUrl);
    } catch {
      setImagePreview(null);
      setImageUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name,
      category: category || null,
      dishBase: dishBase || null,
      dishSauce: null,
      diet: null,
      timingMinutes: null,
      instructions: instructions || null,
      imageUrl: imageUrl || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bar-name">Drink Name</Label>
          <Input
            id="bar-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Blue Magic, The OG"
            data-testid="input-bar-recipe-name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bar-category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-bar-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {BAR_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bar-ingredients">Ingredients</Label>
        <Input
          id="bar-ingredients"
          value={dishBase}
          onChange={(e) => setDishBase(e.target.value)}
          placeholder="e.g., Oat milk, Banana, Mango, Protein"
          data-testid="input-bar-ingredients"
        />
      </div>

      <div className="space-y-2">
        <Label>Picture</Label>
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Recipe preview"
              className="w-full h-48 object-cover rounded-md"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2"
              onClick={handleRemoveImage}
              data-testid="button-remove-bar-image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="bar-recipe-image"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-md cursor-pointer hover-elevate"
            data-testid="label-upload-bar-image"
          >
            <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click to upload an image</span>
            <input
              id="bar-recipe-image"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              data-testid="input-bar-recipe-image"
            />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bar-instructions">Recipe / Preparation Steps</Label>
        <Textarea
          id="bar-instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={"Mixer:\n80g Oats\n1 Coconut milk\n1 Chia seeds\n\nToppings:\nBanana\nBlueberries\nApple"}
          rows={8}
          data-testid="input-bar-instructions"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-bar-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="button-save-bar-recipe">
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
  onEdit,
  onDelete,
  editingRecipe,
  setEditingRecipe,
  onUpdate,
  isUpdating,
}: {
  recipe: Recipe;
  canEdit: boolean;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  editingRecipe: Recipe | null;
  setEditingRecipe: (recipe: Recipe | null) => void;
  onUpdate: (id: string, data: RecipeFormData) => void;
  isUpdating: boolean;
}) {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <>
      <Card 
        className="hover-elevate cursor-pointer relative overflow-hidden" 
        data-testid={`card-recipe-${recipe.id}`}
        onClick={() => setShowInstructions(true)}
      >
        {recipe.imageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${recipe.imageUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
          </div>
        )}
        <CardHeader className={`pb-2 relative z-10 ${recipe.imageUrl ? 'text-white' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className={`text-base truncate ${recipe.imageUrl ? 'text-white drop-shadow-md' : ''}`}>
                {recipe.name}
              </CardTitle>
            </div>
            {canEdit && (
              <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Dialog open={editingRecipe?.id === recipe.id} onOpenChange={(open) => !open && setEditingRecipe(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(recipe)} data-testid={`button-edit-recipe-${recipe.id}`} className={recipe.imageUrl ? 'text-white hover:bg-white/20' : ''}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Edit Recipe</DialogTitle>
                    </DialogHeader>
                    <RecipeForm
                      recipe={recipe}
                      onSubmit={(data) => onUpdate(recipe.id, data)}
                      onCancel={() => setEditingRecipe(null)}
                      isSubmitting={isUpdating}
                    />
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-delete-recipe-${recipe.id}`} className={recipe.imageUrl ? 'hover:bg-white/20' : ''}>
                      <Trash2 className={`h-4 w-4 ${recipe.imageUrl ? 'text-red-300' : 'text-destructive'}`} />
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
        <CardContent className={`pt-0 space-y-2 relative z-10 ${recipe.imageUrl ? 'text-white' : ''}`}>
          <div className="flex flex-wrap gap-2">
            {recipe.dishBase && (
              <Badge variant={recipe.imageUrl ? "secondary" : "outline"} className={`text-xs ${recipe.imageUrl ? 'bg-white/20 text-white border-white/30' : ''}`}>
                {recipe.dishBase}
              </Badge>
            )}
            {recipe.dishSauce && (
              <Badge variant="secondary" className={`text-xs ${recipe.imageUrl ? 'bg-white/20 text-white border-white/30' : ''}`}>
                {recipe.dishSauce}
              </Badge>
            )}
          </div>
          <div className={`flex items-center gap-3 text-xs ${recipe.imageUrl ? 'text-white/90 drop-shadow' : 'text-muted-foreground'}`}>
            {recipe.diet && (
              <span className="flex items-center gap-1">
                <Leaf className="h-3 w-3" />
                {recipe.diet}
              </span>
            )}
            {recipe.timingMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {recipe.timingMinutes} min
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className={`max-w-lg max-h-[80vh] overflow-y-auto p-0 ${recipe.imageUrl ? 'border-0' : ''}`}>
          {recipe.imageUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center rounded-lg"
              style={{ backgroundImage: `url(${recipe.imageUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80 rounded-lg" />
            </div>
          )}
          <div className={`relative z-10 p-6 ${recipe.imageUrl ? 'text-white' : ''}`}>
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${recipe.imageUrl ? 'text-white' : ''}`}>
                <ChefHat className="h-5 w-5" />
                {recipe.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2">
                {recipe.dishBase && (
                  <Badge variant="outline" className={recipe.imageUrl ? 'bg-white/15 text-white border-white/30' : ''}>{recipe.dishBase}</Badge>
                )}
                {recipe.dishSauce && (
                  <Badge variant="secondary" className={recipe.imageUrl ? 'bg-white/15 text-white border-white/30' : ''}>{recipe.dishSauce}</Badge>
                )}
                {recipe.diet && (
                  <Badge variant="outline" className={`flex items-center gap-1 ${recipe.imageUrl ? 'bg-white/15 text-white border-white/30' : ''}`}>
                    <Leaf className="h-3 w-3" />
                    {recipe.diet}
                  </Badge>
                )}
                {recipe.timingMinutes && (
                  <Badge variant="outline" className={`flex items-center gap-1 ${recipe.imageUrl ? 'bg-white/15 text-white border-white/30' : ''}`}>
                    <Clock className="h-3 w-3" />
                    {recipe.timingMinutes} min
                  </Badge>
                )}
              </div>
              {recipe.instructions ? (
                <div className={`rounded-md p-4 ${recipe.imageUrl ? 'bg-white/10' : 'bg-muted/50'}`}>
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <p className="text-sm whitespace-pre-wrap">{recipe.instructions}</p>
                </div>
              ) : (
                <p className={`text-sm ${recipe.imageUrl ? 'text-white/70' : 'text-muted-foreground'}`}>No instructions available for this recipe.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategorySection({
  category,
  recipes,
  canEdit,
  editingRecipe,
  setEditingRecipe,
  onUpdate,
  onDelete,
  isUpdating,
}: {
  category: string;
  recipes: Recipe[];
  canEdit: boolean;
  editingRecipe: Recipe | null;
  setEditingRecipe: (recipe: Recipe | null) => void;
  onUpdate: (id: string, data: RecipeFormData) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
}) {
  const Icon = categoryIcons[category] || Salad;

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
          onEdit={setEditingRecipe}
          onDelete={onDelete}
          editingRecipe={editingRecipe}
          setEditingRecipe={setEditingRecipe}
          onUpdate={onUpdate}
          isUpdating={isUpdating}
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
  const [activeTab, setActiveTab] = useState<string>(KITCHEN_CATEGORIES[0]);
  const [postType, setPostType] = useState<"Kitchen" | "Bar">("Kitchen");

  // Reset active tab when switching post type
  const handlePostTypeChange = (newPostType: "Kitchen" | "Bar") => {
    setPostType(newPostType);
    setActiveTab(newPostType === "Kitchen" ? KITCHEN_CATEGORIES[0] : BAR_CATEGORIES[0]);
  };

  const { data: recipesData, isLoading: recipesLoading } = useQuery<{ recipes: Recipe[] }>({
    queryKey: ["/api/recipes"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: RecipeFormData) => {
      return apiRequest("POST", "/api/recipes", { ...data, postType });
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<RecipeFormData> }) => {
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

  // First filter by post type
  const recipesByPostType = useMemo(() => {
    return recipes.filter((r) => r.postType === postType);
  }, [recipes, postType]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipesByPostType;
    const query = searchQuery.toLowerCase();
    return recipesByPostType.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.dishBase?.toLowerCase().includes(query) ||
        r.dishSauce?.toLowerCase().includes(query) ||
        r.diet?.toLowerCase().includes(query)
    );
  }, [recipesByPostType, searchQuery]);

  const categories = postType === "Kitchen" ? KITCHEN_CATEGORIES : BAR_CATEGORIES;

  const recipesByCategory = useMemo(() => {
    const grouped: Record<string, Recipe[]> = {};
    categories.forEach((cat) => {
      grouped[cat] = [];
    });
    grouped.Other = [];
    
    filteredRecipes.forEach((recipe) => {
      const cat = recipe.category?.trim();
      const matchedCategory = categories.find(
        (c) => c.toLowerCase() === cat?.toLowerCase()
      );
      if (matchedCategory) {
        grouped[matchedCategory].push(recipe);
      } else {
        grouped.Other.push(recipe);
      }
    });
    return grouped;
  }, [filteredRecipes, categories]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredRecipes.length };
    categories.forEach((cat) => {
      counts[cat] = recipesByCategory[cat]?.length || 0;
    });
    return counts;
  }, [filteredRecipes, recipesByCategory, categories]);

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
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => navigate("/landing")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                {postType === "Kitchen" ? <ChefHat className="h-5 w-5 md:h-6 md:w-6" /> : <Wine className="h-5 w-5 md:h-6 md:w-6" />}
                Recipes
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">Quick access by category</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-muted rounded-md p-1">
            <Button
              variant={postType === "Kitchen" ? "default" : "ghost"}
              size="sm"
              onClick={() => handlePostTypeChange("Kitchen")}
              className="gap-1"
              data-testid="button-post-type-kitchen"
            >
              <ChefHat className="h-4 w-4" />
              Kitchen
            </Button>
            <Button
              variant={postType === "Bar" ? "default" : "ghost"}
              size="sm"
              onClick={() => handlePostTypeChange("Bar")}
              className="gap-1"
              data-testid="button-post-type-bar"
            >
              <Wine className="h-4 w-4" />
              Bar
            </Button>
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
                    <DialogTitle>{postType === "Bar" ? "Create New Bar Recipe" : "Create New Recipe"}</DialogTitle>
                  </DialogHeader>
                  {postType === "Bar" ? (
                    <BarRecipeForm
                      onSubmit={(data) => createMutation.mutate(data)}
                      onCancel={() => setIsCreateOpen(false)}
                      isSubmitting={createMutation.isPending}
                    />
                  ) : (
                    <RecipeForm
                      onSubmit={(data) => createMutation.mutate(data)}
                      onCancel={() => setIsCreateOpen(false)}
                      isSubmitting={createMutation.isPending}
                    />
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Tabs value={activeTab || categories[0]} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 w-full justify-start flex-wrap" data-testid="tabs-categories">
            {categories.map((cat) => {
              const Icon = categoryIcons[cat] || Salad;
              return (
                <TabsTrigger key={cat} value={cat} className="gap-1" data-testid={`tab-${cat.toLowerCase().replace(/\s+/g, '-')}`}>
                  <Icon className="h-4 w-4" />
                  {cat}
                  <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts[cat]}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-0">
              <CategorySection
                category={cat}
                recipes={recipesByCategory[cat] || []}
                canEdit={canEdit}
                editingRecipe={editingRecipe}
                setEditingRecipe={setEditingRecipe}
                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                onDelete={(id) => deleteMutation.mutate(id)}
                isUpdating={updateMutation.isPending}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
