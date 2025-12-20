/**
 * Inventory Search Box Component
 * 
 * A searchable autocomplete input for finding inventory items.
 * Uses cmdk (Command) component for fast, case-insensitive search.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, Loader2, Package } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InventoryItem } from "@shared/schema";

interface InventorySearchBoxProps {
  value?: string;
  onSelect: (item: InventoryItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function InventorySearchBox({
  value,
  onSelect,
  placeholder = "Search inventory...",
  disabled = false,
  className,
}: InventorySearchBoxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Debounce the search query for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results using credentials for auth
  const { data, isLoading } = useQuery<{ items: InventoryItem[] }>({
    queryKey: [`/api/inventory/search?q=${encodeURIComponent(debouncedQuery)}`],
    enabled: debouncedQuery.length > 0,
  });

  const items = data?.items || [];

  const handleSelect = useCallback(
    (item: InventoryItem) => {
      setSelectedItem(item);
      onSelect(item);
      setOpen(false);
      setSearchQuery("");
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    setSelectedItem(null);
    onSelect(null);
    setSearchQuery("");
  }, [onSelect]);

  // Update selected item when value prop changes
  useEffect(() => {
    if (!value) {
      setSelectedItem(null);
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selectedItem && "text-muted-foreground",
            className
          )}
          data-testid="button-inventory-search"
        >
          <div className="flex items-center gap-2 truncate">
            {selectedItem ? (
              <>
                <Package className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedItem.name}</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 shrink-0" />
                <span>{placeholder}</span>
              </>
            )}
          </div>
          {selectedItem && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              data-testid="button-clear-search"
            >
              x
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
            data-testid="input-inventory-search"
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && debouncedQuery.length > 0 && items.length === 0 && (
              <CommandEmpty>No items found.</CommandEmpty>
            )}
            {!isLoading && debouncedQuery.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type to search inventory...
              </div>
            )}
            {items.length > 0 && (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                    data-testid={`item-inventory-${item.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedItem?.id === item.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.category} - {item.quantity} {item.unit}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
