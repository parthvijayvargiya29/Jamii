import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Recipe } from "@shared/schema";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChefHat, Loader2 } from "lucide-react";

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<{ recipe: Recipe }>({
    queryKey: [`/api/recipes/${params.id}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.recipe) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-4xl">
          <Button variant="ghost" onClick={() => navigate("/recipes")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Recipes
          </Button>
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive text-lg">Recipe not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { recipe } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/recipes")} className="mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Recipes
        </Button>

        <Card data-testid={`card-recipe-detail-${recipe.id}`}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ChefHat className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl" data-testid="text-recipe-name">{recipe.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Ingredients</h3>
              {recipe.ingredients.length === 0 ? (
                <p className="text-muted-foreground">No ingredients listed</p>
              ) : (
                <div className="grid gap-2">
                  {recipe.ingredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`ingredient-${idx}`}
                    >
                      <span className="font-medium">{ing.name}</span>
                      <Badge variant="secondary">
                        {ing.quantity} {ing.unit}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Instructions</h3>
              {recipe.instructions ? (
                <div className="whitespace-pre-wrap text-muted-foreground" data-testid="text-instructions">
                  {recipe.instructions}
                </div>
              ) : (
                <p className="text-muted-foreground">No instructions provided</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
