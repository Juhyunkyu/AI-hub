export interface LocationData {
  id: string;
  name: string;
  address: string;
  category?: string;
  phone?: string;
  url?: string;
  x: string; // longitude
  y: string; // latitude
}

export interface MapLocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (location: LocationData) => void;
}

export interface MapViewProps {
  selectedLocation?: LocationData;
  onLocationClick?: (location: LocationData) => void;
}

export interface SearchResultsProps {
  results: LocationData[];
  selectedId?: string;
  onSelect: (location: LocationData) => void;
  isLoading?: boolean;
  error?: string | null;
}

// Kakao Maps API 타입 확장
declare global {
  interface Window {
    kakao: {
      maps: {
        Map: any;
        LatLng: any;
        Marker: any;
        load: (callback: () => void) => void;
        services: {
          Places: any;
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
        };
      };
    };
  }
}