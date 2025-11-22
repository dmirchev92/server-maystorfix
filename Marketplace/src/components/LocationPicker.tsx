import React, { useState, useMemo } from 'react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';

// REPLACE WITH YOUR GOOGLE MAPS API KEY
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

const libraries: ("places")[] = ["places"];

interface LocationPickerProps {
  onLocationSelect: (location: {
    address: string;
    latitude: number;
    longitude: number;
    city?: string;
  }) => void;
  initialLocation?: { lat: number; lng: number };
}

export default function LocationPicker({ onLocationSelect, initialLocation }: LocationPickerProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  if (!isLoaded) return <div className="text-white">Loading Maps...</div>;
  if (!GOOGLE_MAPS_API_KEY) return <div className="text-red-400">Missing Google Maps API Key</div>;

  return <Map onLocationSelect={onLocationSelect} initialLocation={initialLocation} />;
}

function Map({ onLocationSelect, initialLocation }: LocationPickerProps) {
  // Sofia center as default
  const center = useMemo(() => initialLocation || { lat: 42.6977, lng: 23.3219 }, [initialLocation]);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(initialLocation || null);

  const {
    ready,
    value,
    setValue,
    suggestions: { status, data },
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'bg' }, // Restrict to Bulgaria only
    },
    debounce: 300,
  });

  const handleSelect = async (address: string) => {
    setValue(address, false);
    clearSuggestions();

    try {
      const results = await getGeocode({ address });
      const { lat, lng } = await getLatLng(results[0]);
      const location = { lat, lng };
      
      setSelected(location);
      
      // Try to extract city
      let city = '';
      results[0].address_components.forEach(comp => {
        if (comp.types.includes('locality')) {
          city = comp.long_name;
        }
      });

      onLocationSelect({
        address,
        latitude: lat,
        longitude: lng,
        city
      });
    } catch (error) {
      console.error("Error: ", error);
    }
  };

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setSelected({ lat, lng });

    // Reverse geocode to get address
    try {
      const results = await getGeocode({ location: { lat, lng } });
      if (results[0]) {
        const address = results[0].formatted_address;
        setValue(address, false);
        
        let city = '';
        results[0].address_components.forEach(comp => {
          if (comp.types.includes('locality')) {
            city = comp.long_name;
          }
        });

        onLocationSelect({
          address,
          latitude: lat,
          longitude: lng,
          city
        });
      }
    } catch (error) {
      console.error("Reverse geocode error: ", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!ready}
          placeholder="Въведете адрес..."
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {status === "OK" && (
          <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-lg mt-1 shadow-lg max-h-60 overflow-auto">
            {data.map(({ place_id, description }) => (
              <li
                key={place_id}
                onClick={() => handleSelect(description)}
                className="px-3 py-2 hover:bg-slate-600 cursor-pointer text-white text-sm"
              >
                {description}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-64 w-full rounded-lg overflow-hidden border border-slate-600 isolate">
        <GoogleMap
          zoom={selected ? 15 : 12}
          center={selected || center}
          mapContainerClassName="w-full h-full"
          onClick={handleMapClick}
          options={{
            mapId: "DEMO_MAP_ID", // Enables Vector Map
            disableDefaultUI: true,
            zoomControl: true,
            restriction: {
              latLngBounds: {
                north: 44.2,
                south: 41.2,
                west: 22.3,
                east: 28.6,
              },
              strictBounds: false,
            },
            styles: [
              { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            ]
          }}
        >
          {selected && <Marker position={selected} />}
        </GoogleMap>
      </div>
      <p className="text-xs text-slate-400">
        📍 Кликнете върху картата или потърсете адрес, за да посочите точното местоположение.
      </p>
    </div>
  );
}
