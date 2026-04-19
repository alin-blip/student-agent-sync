import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface AddressLookupInputProps {
  postcode: string;
  address: string;
  onPostcodeChange: (postcode: string) => void;
  onAddressChange: (address: string) => void;
  onCityChange?: (city: string) => void;
}

interface PostcodeSuggestion {
  postcode: string;
  admin_ward: string;
  admin_district: string;
  region: string;
  country: string;
}

export function AddressLookupInput({
  postcode,
  address,
  onPostcodeChange,
  onAddressChange,
  onCityChange,
}: AddressLookupInputProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const autocomplete = useCallback(async (query: string) => {
    const cleaned = query.trim();
    if (cleaned.length < 2) { setSuggestions([]); return; }

    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}/autocomplete`);
      const json = await res.json();
      if (json.status === 200 && json.result) {
        setSuggestions(json.result);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handlePostcodeInput = (value: string) => {
    const upper = value.toUpperCase();
    onPostcodeChange(upper);
    setError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => autocomplete(upper), 300);
  };

  const selectPostcode = async (selected: string) => {
    setShowSuggestions(false);
    setSuggestions([]);
    onPostcodeChange(selected);
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(selected)}`);
      const json = await res.json();

      if (json.status === 200 && json.result) {
        const r = json.result;
        const parts = [r.admin_ward, r.admin_district, r.region || r.country, r.postcode].filter(Boolean);
        onPostcodeChange(r.postcode);
        onAddressChange(parts.join(", "));
        if (onCityChange) {
          onCityChange(r.admin_district || r.admin_ward || "");
        }
      } else {
        setError("Could not resolve this postcode.");
      }
    } catch {
      setError("Lookup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectPostcode(suggestions[0]);
      } else if (postcode.trim()) {
        selectPostcode(postcode.trim());
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2" ref={containerRef}>
        <Label>Postcode</Label>
        <div className="relative">
          <div className="flex items-center gap-2">
            <Input
              value={postcode}
              onChange={(e) => handlePostcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Start typing a UK postcode…"
              className="flex-1"
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => selectPostcode(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Address will auto-fill after postcode selection, or type manually"
          rows={2}
        />
      </div>
    </div>
  );
}
