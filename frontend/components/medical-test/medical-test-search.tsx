"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ButtonLoader } from "@/components/ui/medora-loader";

interface MedicalTestOption {
  id: number;
  display_name: string;
  normalized_name: string;
}

interface MedicalTestSearchProps {
  value: string;
  onChange: (testName: string, testId?: number) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Debounce hook for delayed search
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Medical Test Search/Autocomplete Component
 * Shows dropdown of tests from database with search functionality
 */
export function MedicalTestSearch({ 
  value, 
  onChange, 
  placeholder = "Search or type test name...",
  className = ""
}: MedicalTestSearchProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MedicalTestOption[]>([]);
  const [allTests, setAllTests] = useState<MedicalTestOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 200);

  // Fetch all tests on mount for scrollable list
  useEffect(() => {
    async function fetchAllTests() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const response = await fetch(`${backendUrl}/medical-test/all?limit=500`);
        if (response.ok) {
          const data = await response.json();
          setAllTests(data);
        }
      } catch (error) {
        console.error("Failed to fetch medical tests:", error);
      }
    }
    fetchAllTests();
  }, []);

  // Search tests when query changes
  useEffect(() => {
    async function searchTests() {
      if (debouncedQuery.length < 2) {
        // Show all tests when query is short
        setOptions(allTests.slice(0, 50));
        return;
      }

      setLoading(true);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const response = await fetch(
          `${backendUrl}/medical-test/search?q=${encodeURIComponent(debouncedQuery)}&limit=30`
        );
        if (response.ok) {
          const data = await response.json();
          setOptions(data.results || []);
        }
      } catch (error) {
        console.error("Failed to search medical tests:", error);
        // Filter locally as fallback
        const filtered = allTests.filter(t => 
          t.display_name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          t.normalized_name.includes(debouncedQuery.toLowerCase())
        );
        setOptions(filtered.slice(0, 30));
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      searchTests();
    }
  }, [debouncedQuery, isOpen, allTests]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update query when value prop changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue, undefined); // Clear test_id when typing custom
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (test: MedicalTestOption) => {
    setQuery(test.display_name);
    onChange(test.display_name, test.id);
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    if (options.length === 0) {
      setOptions(allTests.slice(0, 50));
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange("", undefined);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pr-16 border-border focus:border-purple-500 focus:ring-purple-500 text-foreground placeholder:text-muted-foreground"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <ButtonLoader className="h-4 w-4 text-muted-foreground" />}
          {query && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-muted rounded"
          >
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-purple-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {options.length === 0 && !loading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {query.length > 0 ? (
                <>
                  <span className="text-foreground">No matching tests found.</span> <br />
                  <span className="text-xs text-muted-foreground">You can still type a custom test name.</span>
                </>
              ) : (
                <span className="text-muted-foreground">Start typing to search tests...</span>
              )}
            </div>
          ) : (
            <ul className="py-1">
              {options.map((test) => (
                <li key={test.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(test)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-purple-50 transition-colors text-foreground ${
                      query.toLowerCase() === test.display_name.toLowerCase() 
                        ? "bg-purple-100 text-purple-700 font-medium" 
                        : ""
                    }`}
                  >
                    {test.display_name}
                  </button>
                </li>
              ))}
              {options.length >= 30 && (
                <li className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-purple-100 bg-muted/30">
                  Type more to narrow results...
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

