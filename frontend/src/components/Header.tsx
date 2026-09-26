import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item"
import { useDebounce } from "@/hooks/debounse";
import { ArrowRight, MapPin, Navigation, Navigation2, Search, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button";

interface Location {
    id: number | string;
    name: string;
    city: string;
    state?: string;
    country?: string;
    lat: number;
    lon: number;
}

interface Coordinates {
    lat: number;
    lon: number;
}

interface HeaderProps {
    onRouteCalculated?: (routeData: any) => void;
}

function Header({ onRouteCalculated }: HeaderProps) {
    const [sourceResults, setSourceResults] = useState<Location[]>([]);
    const [destResults, setDestResults] = useState<Location[]>([]);

    const [sourceLoading, setSourceLoading] = useState(false);
    const [destLoading, setDestLoading] = useState(false);

    const [selectedSource, setSelectedSource] = useState<Location | null>(null);
    const [selectedDest, setSelectedDest] = useState<Location | null>(null);

    const [sourceCoordinates, setSourceCoordinates] = useState<Coordinates | null>(null);
    const [destCoordinates, setDestCoordinates] = useState<Coordinates | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleGetRoute = async () => {
        if (!sourceCoordinates || !destCoordinates) {
            alert("Please select both Origin and Destination first.");
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await fetch("http://localhost:5000/route", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cordinate: [
                        [sourceCoordinates.lat, sourceCoordinates.lon],
                        [destCoordinates.lat, destCoordinates.lon],
                    ],
                }),
            });

            const data = await response.json();
            // console.log("Response from /route:", data);

            if (data?.data?.routes && data.data.routes.length > 0) {
                onRouteCalculated?.(data.data.routes);
            }
        } catch (error) {
            console.error("Error sending route request:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Keep active coordinates logged/accessible for map routing integrations
    useEffect(() => {
        if (sourceCoordinates) {
            console.log("Selected Origin Coordinates:", sourceCoordinates);
        }
    }, [sourceCoordinates]);

    useEffect(() => {
        if (destCoordinates) {
            console.log("Selected Destination Coordinates:", destCoordinates);
        }
    }, [destCoordinates]);

    const [srcSearch, setSrcSearch] = useState<string>('');
    const [destSearch, setDestSearch] = useState<string>('');

    const srcDebounceSearch = useDebounce<string>(srcSearch, 400);
    const destDebounceSearch = useDebounce<string>(destSearch, 400);

    const fetchLocations = async (text: string): Promise<Location[]> => {
        if (!text || text.trim().length < 3) {
            return [];
        }

        try {
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text.trim())}&limit=8`);
            if (!response.ok) return [];
            const data = await response.json();

            return (data.features || []).map((feature: any, index: number) => ({
                id: feature.properties.osm_id ?? `${feature.geometry.coordinates[0]}-${feature.geometry.coordinates[1]}-${index}`,
                name: feature.properties.name || feature.properties.city || feature.properties.country || 'Unknown location',
                city: feature.properties.city || '',
                state: feature.properties.state || '',
                country: feature.properties.country || '',
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
            }));
        } catch (error) {
            console.error("Error fetching locations:", error);
            return [];
        }
    };

    useEffect(() => {
        let isCurrent = true;
        if (!srcDebounceSearch || srcDebounceSearch.trim().length < 3) {
            setSourceResults([]);
            setSourceLoading(false);
            return;
        }

        setSourceLoading(true);
        fetchLocations(srcDebounceSearch).then((results) => {
            if (isCurrent) {
                setSourceResults(results);
                setSourceLoading(false);
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [srcDebounceSearch]);

    useEffect(() => {
        let isCurrent = true;
        if (!destDebounceSearch || destDebounceSearch.trim().length < 3) {
            setDestResults([]);
            setDestLoading(false);
            return;
        }

        setDestLoading(true);
        fetchLocations(destDebounceSearch).then((results) => {
            if (isCurrent) {
                setDestResults(results);
                setDestLoading(false);
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [destDebounceSearch]);

    const formatSubtitle = (loc: Location) => {
        const parts = [loc.city, loc.state, loc.country].filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
    };

    return (
        <div className="flex w-full items-center gap-2 px-2">
            {/* Origin / Source Field */}
            <div className="relative flex-1">
                <Combobox<Location>
                    items={sourceResults}
                    itemToStringLabel={(item) => (item ? item.name : "")}
                    value={selectedSource}
                    onValueChange={(location) => {
                        setSelectedSource(location);
                        if (location) {
                            setSourceCoordinates({ lat: location.lat, lon: location.lon });
                        } else {
                            setSourceCoordinates(null);
                            setSrcSearch('');
                            setSourceResults([]);
                        }
                    }}
                >
                    <div className="relative flex items-center">
                        <Navigation2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-600 dark:text-emerald-400 z-10" />
                        <ComboboxInput
                            className="w-full h-10 pl-9 pr-8 bg-muted/40 hover:bg-muted/60 focus-within:bg-background rounded-xl border-border/80 transition-all text-sm"
                            onChange={(e) => setSrcSearch(e.target.value)}
                            placeholder="Starting point (origin)..."
                            showTrigger={false}
                            showClear={!!selectedSource || !!srcSearch}
                            onClick={(e) => {
                                if ((e.target as HTMLElement).closest('[data-slot="combobox-clear"]')) {
                                    setSrcSearch('');
                                    setSelectedSource(null);
                                    setSourceCoordinates(null);
                                    setSourceResults([]);
                                }
                            }}
                        />
                        {sourceLoading && (
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                        )}
                    </div>

                    <ComboboxContent className="w-(--anchor-width) min-w-70 p-1.5 shadow-xl rounded-xl border border-border/60 backdrop-blur-md bg-popover/95">
                        <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground items-center justify-center gap-1.5">
                            <Search className="size-3.5 opacity-60" />
                            {srcSearch.length < 3 ? "Type at least 3 letters to search..." : "No places found."}
                        </ComboboxEmpty>
                        <ComboboxList className="max-h-64 overflow-y-auto divide-y divide-border/20">
                            {(item) => (
                                <ComboboxItem
                                    key={item.id}
                                    value={item}
                                    className="cursor-pointer rounded-lg px-2 py-1.5 data-highlighted:bg-accent/70 transition-colors"
                                >
                                    <Item size="xs" className="p-0 border-0">
                                        <ItemMedia variant="icon" className="text-emerald-600 dark:text-emerald-400 mt-0.5">
                                            <MapPin className="size-4" />
                                        </ItemMedia>
                                        <ItemContent className="gap-0.5">
                                            <ItemTitle className="font-medium text-foreground text-sm">
                                                {item.name}
                                            </ItemTitle>
                                            <ItemDescription className="text-xs text-muted-foreground line-clamp-1">
                                                {formatSubtitle(item)}
                                            </ItemDescription>
                                        </ItemContent>
                                    </Item>
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            </div>

            {/* Direction Arrow Divider */}
            <div className="flex items-center justify-center text-muted-foreground/60 shrink-0">
                <ArrowRight className="size-4" />
            </div>

            {/* Destination Field */}
            <div className="relative flex-1">
                <Combobox<Location>
                    items={destResults}
                    itemToStringLabel={(item) => (item ? item.name : "")}
                    value={selectedDest}
                    onValueChange={(location) => {
                        setSelectedDest(location);
                        if (location) {
                            setDestCoordinates({ lat: location.lat, lon: location.lon });
                        } else {
                            setDestCoordinates(null);
                            setDestSearch('');
                            setDestResults([]);
                        }
                    }}
                >
                    <div className="relative flex items-center">
                        <Navigation className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-rose-600 dark:text-rose-400 z-10" />
                        <ComboboxInput
                            className="w-full h-10 pl-9 pr-8 bg-muted/40 hover:bg-muted/60 focus-within:bg-background rounded-xl border-border/80 transition-all text-sm"
                            onChange={(e) => setDestSearch(e.target.value)}
                            placeholder="Destination..."
                            showTrigger={false}
                            showClear={!!selectedDest || !!destSearch}
                            onClick={(e) => {
                                if ((e.target as HTMLElement).closest('[data-slot="combobox-clear"]')) {
                                    setDestSearch('');
                                    setSelectedDest(null);
                                    setDestCoordinates(null);
                                    setDestResults([]);
                                }
                            }}
                        />
                        {destLoading && (
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                        )}
                    </div>

                    <ComboboxContent className="w-(--anchor-width) min-w-70 p-1.5 shadow-xl rounded-xl border border-border/60 backdrop-blur-md bg-popover/95">
                        <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground items-center justify-center gap-1.5">
                            <Search className="size-3.5 opacity-60" />
                            {destSearch.length < 3 ? "Type at least 3 letters to search..." : "No places found."}
                        </ComboboxEmpty>
                        <ComboboxList className="max-h-64 overflow-y-auto divide-y divide-border/20">
                            {(item) => (
                                <ComboboxItem
                                    key={item.id}
                                    value={item}
                                    className="cursor-pointer rounded-lg px-2 py-1.5 data-highlighted:bg-accent/70 transition-colors"
                                >
                                    <Item size="xs" className="p-0 border-0">
                                        <ItemMedia variant="icon" className="text-rose-600 dark:text-rose-400 mt-0.5">
                                            <MapPin className="size-4" />
                                        </ItemMedia>
                                        <ItemContent className="gap-0.5">
                                            <ItemTitle className="font-medium text-foreground text-sm">
                                                {item.name}
                                            </ItemTitle>
                                            <ItemDescription className="text-xs text-muted-foreground line-clamp-1">
                                                {formatSubtitle(item)}
                                            </ItemDescription>
                                        </ItemContent>
                                    </Item>
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            </div>

            {/* Route Button */}
            <Button
                onClick={handleGetRoute}
                disabled={isSubmitting || !sourceCoordinates || !destCoordinates}
                className="h-10 px-4 rounded-xl shrink-0 font-medium cursor-pointer shadow-sm hover:shadow transition-all"
            >
                {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <>
                        <Send className="size-4 mr-1" />
                        <span>Route</span>
                    </>
                )}
            </Button>
        </div>
    );
}

export default Header;
