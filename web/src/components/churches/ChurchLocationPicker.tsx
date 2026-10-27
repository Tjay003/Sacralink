import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Search, Navigation, RotateCcw, Compass, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface ChurchLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number; address?: string }) => void;
  initialAddress?: string;
  disabled?: boolean;
  className?: string;
  onAddressSelect?: (address: string) => void;
}

/**
 * Official Geographic Bounding Box for the City of San Jose del Monte (CSJDM), Bulacan, Philippines
 * South: 14.7500° N
 * North: 14.9000° N
 * West:  120.9800° E
 * East:  121.1600° E
 */
export {
  SJDM_BOUNDS,
  DEFAULT_CSJDM_LAT,
  DEFAULT_CSJDM_LNG,
  MIN_SJDM_ZOOM,
  MAX_SJDM_ZOOM,
  isWithinSjdmBounds,
} from '../../lib/geo';
import {
  SJDM_BOUNDS,
  DEFAULT_CSJDM_LAT,
  DEFAULT_CSJDM_LNG,
  MIN_SJDM_ZOOM,
  MAX_SJDM_ZOOM,
  isWithinSjdmBounds,
} from '../../lib/geo';
const DEFAULT_ZOOM = 13;
const FOCUSED_ZOOM = 16;

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

// Create custom church marker icon
const createChurchIcon = () => {
  return L.divIcon({
    className: 'custom-church-marker',
    html: `
      <div style="position: relative; width: 36px; height: 44px; transform: translate(-18px, -42px); cursor: grab;">
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50% 50% 50% 0;
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
          border: 2px solid #ffffff;
        ">
          <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 20V10a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v10"></path>
              <path d="M4 20h16"></path>
              <path d="M12 4v4"></path>
              <path d="M10 6h4"></path>
            </svg>
          </div>
        </div>
        <div style="
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 3px;
          background: rgba(15, 23, 42, 0.25);
          border-radius: 50%;
          filter: blur(1px);
        "></div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
};

export default function ChurchLocationPicker({
  latitude,
  longitude,
  onChange,
  initialAddress = '',
  disabled = false,
  className = '',
  onAddressSelect,
}: ChurchLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Track the most recent valid coordinate within SJDM bounds to snap back upon invalid drag/input
  const lastValidPosRef = useRef<{ lat: number; lng: number }>({
    lat: latitude !== null && longitude !== null && isWithinSjdmBounds(latitude, longitude)
      ? latitude
      : DEFAULT_CSJDM_LAT,
    lng: latitude !== null && longitude !== null && isWithinSjdmBounds(latitude, longitude)
      ? longitude
      : DEFAULT_CSJDM_LNG,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialAddress);
  const [searchResults, setSearchResults] = useState<NominatimSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Boundary alert state
  const [boundaryWarning, setBoundaryWarning] = useState<string | null>(() => {
    if (latitude !== null && longitude !== null && !isWithinSjdmBounds(latitude, longitude)) {
      return 'Location must be within the City of San Jose del Monte, Bulacan.';
    }
    return null;
  });

  // Manual fine-tune coordinates state
  const [inputLat, setInputLat] = useState<string>(
    latitude !== null && longitude !== null && isWithinSjdmBounds(latitude, longitude)
      ? latitude.toFixed(6)
      : DEFAULT_CSJDM_LAT.toFixed(6)
  );
  const [inputLng, setInputLng] = useState<string>(
    latitude !== null && longitude !== null && isWithinSjdmBounds(latitude, longitude)
      ? longitude.toFixed(6)
      : DEFAULT_CSJDM_LNG.toFixed(6)
  );
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [coordError, setCoordError] = useState<string | null>(null);

  // Reverse geocoding helper
  const performReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        setIsReverseGeocoding(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'SacraLink-ParishSuite/1.0',
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.display_name) {
            setResolvedAddress(data.display_name);
            return data.display_name;
          }
        }
      } catch (err) {
        console.warn('Reverse geocoding error:', err);
      } finally {
        setIsReverseGeocoding(false);
      }
      return undefined;
    },
    []
  );

  // Handle marker dragend: snap back if outside SJDM
  const handleMarkerDragEnd = useCallback(
    async (marker: L.Marker) => {
      const pos = marker.getLatLng();
      if (!isWithinSjdmBounds(pos.lat, pos.lng)) {
        const fallback = lastValidPosRef.current;
        marker.setLatLng([fallback.lat, fallback.lng]);
        setInputLat(fallback.lat.toFixed(6));
        setInputLng(fallback.lng.toFixed(6));
        setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
        return;
      }

      setBoundaryWarning(null);
      setCoordError(null);
      lastValidPosRef.current = { lat: pos.lat, lng: pos.lng };
      setInputLat(pos.lat.toFixed(6));
      setInputLng(pos.lng.toFixed(6));
      const address = await performReverseGeocode(pos.lat, pos.lng);
      onChange({ latitude: pos.lat, longitude: pos.lng, address });
    },
    [onChange, performReverseGeocode]
  );

  // Update marker position on map (with SJDM boundary enforcement)
  const setPinPosition = useCallback(
    (lat: number, lng: number, fly = true, reverseLookup = false) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (!isWithinSjdmBounds(lat, lng)) {
        setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
        if (markerRef.current) {
          markerRef.current.setLatLng([lastValidPosRef.current.lat, lastValidPosRef.current.lng]);
          setInputLat(lastValidPosRef.current.lat.toFixed(6));
          setInputLng(lastValidPosRef.current.lng.toFixed(6));
        }
        return;
      }

      setBoundaryWarning(null);
      setCoordError(null);
      lastValidPosRef.current = { lat, lng };
      const newLatLng = L.latLng(lat, lng);

      if (!markerRef.current) {
        const marker = L.marker(newLatLng, {
          icon: createChurchIcon(),
          draggable: !disabled,
        });

        marker.on('dragend', (e) => {
          void handleMarkerDragEnd(e.target as L.Marker);
        });

        marker.addTo(map);
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(newLatLng);
        if (!disabled) {
          markerRef.current.dragging?.enable();
        } else {
          markerRef.current.dragging?.disable();
        }
      }

      if (fly) {
        map.flyTo(newLatLng, Math.max(map.getZoom(), FOCUSED_ZOOM), {
          duration: 1.2,
        });
      }

      setInputLat(lat.toFixed(6));
      setInputLng(lng.toFixed(6));

      if (reverseLookup) {
        void performReverseGeocode(lat, lng).then((addr) => {
          onChange({ latitude: lat, longitude: lng, address: addr });
        });
      } else {
        onChange({ latitude: lat, longitude: lng });
      }
    },
    [disabled, handleMarkerDragEnd, onChange, performReverseGeocode]
  );

  // Update input text and internal state when external props change
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      if (isWithinSjdmBounds(latitude, longitude)) {
        setInputLat(latitude.toFixed(6));
        setInputLng(longitude.toFixed(6));
        lastValidPosRef.current = { lat: latitude, lng: longitude };
        setBoundaryWarning(null);
      } else {
        setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
      }
    }
  }, [latitude, longitude]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const hasValidInitial =
      latitude !== null &&
      longitude !== null &&
      isWithinSjdmBounds(latitude, longitude);

    const initialLat = hasValidInitial ? latitude : DEFAULT_CSJDM_LAT;
    const initialLng = hasValidInitial ? longitude : DEFAULT_CSJDM_LNG;
    const initialZoom = hasValidInitial ? FOCUSED_ZOOM : DEFAULT_ZOOM;

    const sjdmBounds = L.latLngBounds(
      [SJDM_BOUNDS.south, SJDM_BOUNDS.west],
      [SJDM_BOUNDS.north, SJDM_BOUNDS.east]
    );

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      minZoom: MIN_SJDM_ZOOM,
      maxBounds: sjdmBounds,
      maxBoundsViscosity: 1.0,
      zoomControl: true,
      scrollWheelZoom: 'center',
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: MAX_SJDM_ZOOM,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Initial marker if valid coordinates exist within SJDM
    if (hasValidInitial) {
      lastValidPosRef.current = { lat: initialLat, lng: initialLng };
      const marker = L.marker([initialLat, initialLng], {
        icon: createChurchIcon(),
        draggable: !disabled,
      });

      marker.on('dragend', (e) => {
        void handleMarkerDragEnd(e.target as L.Marker);
      });

      marker.addTo(map);
      markerRef.current = marker;
    } else if (latitude !== null && longitude !== null && !isWithinSjdmBounds(latitude, longitude)) {
      setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
    }

    // Map click handler to drop/move pin (guarded by SJDM bounds)
    map.on('click', async (e: L.LeafletMouseEvent) => {
      if (disabled) return;
      const { lat, lng } = e.latlng;
      if (!isWithinSjdmBounds(lat, lng)) {
        setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
        return;
      }
      setBoundaryWarning(null);
      setPinPosition(lat, lng, false, true);
    });

    mapInstanceRef.current = map;

    // Trigger map invalidation after layout settles
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronize marker when external lat/lng change
  useEffect(() => {
    if (latitude !== null && longitude !== null && mapInstanceRef.current) {
      if (!isWithinSjdmBounds(latitude, longitude)) {
        setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
        return;
      }
      setBoundaryWarning(null);
      const currentPos = markerRef.current?.getLatLng();
      if (!currentPos || currentPos.lat !== latitude || currentPos.lng !== longitude) {
        lastValidPosRef.current = { lat: latitude, lng: longitude };
        if (!markerRef.current) {
          const marker = L.marker([latitude, longitude], {
            icon: createChurchIcon(),
            draggable: !disabled,
          });

          marker.on('dragend', (e) => {
            void handleMarkerDragEnd(e.target as L.Marker);
          });

          marker.addTo(mapInstanceRef.current);
          markerRef.current = marker;
        } else {
          markerRef.current.setLatLng([latitude, longitude]);
        }
      }
    }
  }, [latitude, longitude, disabled, handleMarkerDragEnd]);

  // Geocode address search strictly bounded to City of San Jose del Monte, Bulacan
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setShowDropdown(true);

    try {
      // Nominatim search strictly bounded to SJDM bounding box
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=10&countrycodes=ph&viewbox=${SJDM_BOUNDS.west},${SJDM_BOUNDS.north},${SJDM_BOUNDS.east},${SJDM_BOUNDS.south}&bounded=1`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SacraLink-ParishSuite/1.0',
        },
      });

      const data: NominatimSearchResult[] = await response.json();

      // Enforce SJDM bounding box filter on returned results
      const sjdmResults = (data || []).filter((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        return !isNaN(lat) && !isNaN(lng) && isWithinSjdmBounds(lat, lng);
      });

      if (sjdmResults.length > 0) {
        setSearchResults(sjdmResults);
      } else {
        setSearchResults([]);
        setSearchError('No locations found within San Jose del Monte, Bulacan. Please refine your search.');
      }
    } catch (err) {
      console.error('Geocoding search failed:', err);
      setSearchError('Unable to connect to geocoding service. Please try again or drop pin manually.');
    } finally {
      setIsSearching(false);
    }
  };

  // Select search result
  const handleSelectResult = (result: NominatimSearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (!isWithinSjdmBounds(lat, lng)) {
      setSearchError('Selected location is outside San Jose del Monte, Bulacan.');
      setBoundaryWarning('Location must be within the City of San Jose del Monte, Bulacan.');
      return;
    }

    setBoundaryWarning(null);
    setSearchError(null);
    setResolvedAddress(result.display_name);
    setShowDropdown(false);
    setPinPosition(lat, lng, true, false);

    if (onAddressSelect) {
      onAddressSelect(result.display_name);
    }
    onChange({ latitude: lat, longitude: lng, address: result.display_name });
  };

  // Use Browser Geolocation (GPS) with SJDM geo-fence validation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: userLat, longitude: userLng } = position.coords;
        setIsLocating(false);

        if (!isWithinSjdmBounds(userLat, userLng)) {
          const outOfBoundsMsg = 'Your current GPS location is outside San Jose del Monte, Bulacan.';
          setGeoError(outOfBoundsMsg);
          setBoundaryWarning(outOfBoundsMsg);
          return;
        }

        setGeoError(null);
        setBoundaryWarning(null);
        setPinPosition(userLat, userLng, true, true);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError('Location access was denied. Please allow permissions in your browser.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError('Location information is currently unavailable.');
            break;
          case error.TIMEOUT:
            setGeoError('Location request timed out. Please try again.');
            break;
          default:
            setGeoError('Failed to retrieve current location.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Reset to CSJDM Center
  const handleResetToDefault = () => {
    setBoundaryWarning(null);
    setCoordError(null);
    setGeoError(null);
    setSearchError(null);
    setPinPosition(DEFAULT_CSJDM_LAT, DEFAULT_CSJDM_LNG, true, true);
  };

  // Apply manual fine-tune inputs (with SJDM boundary enforcement)
  const handleApplyCoordinates = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCoordError(null);
    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCoordError('Please enter a valid latitude between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setCoordError('Please enter a valid longitude between -180 and 180.');
      return;
    }

    if (!isWithinSjdmBounds(lat, lng)) {
      const msg = 'Location must be within the City of San Jose del Monte, Bulacan.';
      setCoordError(msg);
      setBoundaryWarning(msg);
      return;
    }

    setBoundaryWarning(null);
    setCoordError(null);
    setPinPosition(lat, lng, true, true);
  };

  const hasCoordinates =
    latitude !== null &&
    longitude !== null &&
    isWithinSjdmBounds(latitude, longitude);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          <span className="font-semibold text-sm text-foreground">Parish Map Location & Coordinates</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={disabled || isLocating}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg transition-colors border border-primary-200 disabled:opacity-50 cursor-pointer"
            title="Use current GPS location"
          >
            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            <span>{isLocating ? 'Locating...' : 'Use Current GPS'}</span>
          </button>
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg transition-colors border border-secondary-200 disabled:opacity-50 cursor-pointer"
            title="Center on City of San Jose del Monte (Bulacan)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Center CSJDM</span>
          </button>
        </div>
      </div>

      {/* Address Geocoding Search Box */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              disabled={disabled || isSearching}
              placeholder="Search church address, landmark, or barangay in CSJDM..."
              className="input w-full !pl-10 !pr-9 text-sm h-11 rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={disabled || isSearching || !searchQuery.trim()}
            className="btn-primary h-11 px-5 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs w-full sm:w-auto"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{isSearching ? 'Searching...' : 'Search Location'}</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-border rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-border/60">
            <div className="p-2 bg-secondary-50 text-[11px] font-semibold text-muted flex items-center justify-between">
              <span>Matching Places in CSJDM ({searchResults.length})</span>
              <button
                type="button"
                onClick={() => setShowDropdown(false)}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full text-left p-3 hover:bg-primary-50/70 transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground line-clamp-1">
                    {result.display_name.split(',')[0]}
                  </p>
                  <p className="text-[11px] text-muted line-clamp-2 mt-0.5">
                    {result.display_name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search Error Alert */}
        {searchError && (
          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Geolocation Error Alert */}
        {geoError && (
          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{geoError}</span>
          </div>
        )}

        {/* Geo-fence Boundary Warning Alert */}
        {boundaryWarning && (
          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-800">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span className="font-medium">{boundaryWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setBoundaryWarning(null)}
              className="text-amber-700 hover:text-amber-900 text-xs px-1 cursor-pointer font-bold shrink-0"
              title="Dismiss warning"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Map Container Viewport */}
      <div className="relative rounded-xl overflow-hidden border border-border shadow-sm bg-secondary-100">
        <div
          ref={mapContainerRef}
          className="w-full h-80 sm:h-96 z-10"
          style={{ minHeight: '320px' }}
        />

        {/* Map Overlay Helper Badge */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none bg-white/95 backdrop-blur-md px-2.5 py-1.5 sm:px-3 rounded-lg border border-border text-[10px] sm:text-[11px] font-medium text-foreground shadow-sm flex items-center gap-1.5 max-w-[calc(100%-1.5rem)]">
          <Compass className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Geo-fenced to CSJDM<span className="hidden sm:inline">, Bulacan (Min Zoom 12)</span></span>
        </div>

        {/* Coordinate Status Badge */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none max-w-[calc(100%-4.5rem)]">
          {hasCoordinates ? (
            <div className="bg-emerald-600 text-white px-2.5 py-1 sm:px-3 rounded-full text-[10px] sm:text-[11px] font-bold shadow-md flex items-center gap-1 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">PIN SET: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</span>
            </div>
          ) : (
            <div className="bg-amber-500 text-white px-2.5 py-1 sm:px-3 rounded-full text-[10px] sm:text-[11px] font-bold shadow-md flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>NO PIN SET</span>
            </div>
          )}
        </div>
      </div>

      {/* Reverse Geocode Address Notification Banner */}
      {resolvedAddress && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-primary-900">Pin Location Address:</p>
              <p className="text-primary-800 mt-0.5 line-clamp-2">{resolvedAddress}</p>
            </div>
          </div>
          {onAddressSelect && (
            <button
              type="button"
              onClick={() => onAddressSelect(resolvedAddress)}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-primary text-white font-medium rounded-lg text-xs hover:bg-primary-700 transition-colors shrink-0 shadow-sm cursor-pointer text-center"
            >
              Use as Address
            </button>
          )}
        </div>
      )}

      {/* Coordinate Fine-Tuning Inputs */}
      <div className="p-4 bg-secondary-50 rounded-xl border border-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Coordinates Fine-Tuning (WGS84)
          </span>
          {isReverseGeocoding && (
            <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Resolving address...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Latitude (° N/S) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={inputLat}
              onChange={(e) => setInputLat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCoordinates();
                }
              }}
              disabled={disabled}
              placeholder="e.g., 14.813500"
              className="input w-full font-mono text-xs rounded-xl h-10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Longitude (° E/W) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={inputLng}
              onChange={(e) => setInputLng(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCoordinates();
                }
              }}
              disabled={disabled}
              placeholder="e.g., 121.045300"
              className="input w-full font-mono text-xs rounded-xl h-10"
            />
          </div>
        </div>

        {coordError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{coordError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted break-words">
            {hasCoordinates
              ? `Stored: ${latitude?.toFixed(6)}°, ${longitude?.toFixed(6)}° (SJDM)`
              : 'Default center: CSJDM, Bulacan (14.813500, 121.045300)'}
          </p>
          <button
            type="button"
            onClick={() => handleApplyCoordinates()}
            disabled={disabled}
            className="w-full sm:w-auto px-3 py-1.5 bg-secondary-200 hover:bg-secondary-300 text-secondary-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center"
          >
            Apply Coordinates
          </button>
        </div>
      </div>
    </div>
  );
}
