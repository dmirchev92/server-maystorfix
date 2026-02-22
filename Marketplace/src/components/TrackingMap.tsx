import React, { useEffect, useState, useMemo } from 'react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';
import io, { Socket } from 'socket.io-client';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://snapfix.bg';

interface TrackingMapProps {
  caseId: string;
  customerLocation: { lat: number; lng: number; address?: string };
  providerLocation?: { lat: number; lng: number }; // Initial provider location
  customerBudget?: string; // Initial budget
  agreedPrice?: string; // SP Accepted price
  providerName?: string;
}

export default function TrackingMap({
  caseId,
  customerLocation,
  providerLocation: initialProviderLocation,
  customerBudget,
  agreedPrice,
  providerName
}: TrackingMapProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [providerPos, setProviderPos] = useState<{ lat: number; lng: number } | null>(
    initialProviderLocation || null
  );
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    // Initialize Socket.IO
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
      path: '/socket.io'
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to tracking socket');
      setConnectionStatus('connected');
      newSocket.emit('join_case_room', caseId);
    });

    newSocket.on('tracking_update', (data: any) => {
      console.log('📍 Received tracking update:', data);
      if (data.latitude && data.longitude) {
        setProviderPos({
          lat: parseFloat(data.latitude),
          lng: parseFloat(data.longitude)
        });
      }
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('leave_case_room', caseId);
        newSocket.disconnect();
      }
    };
  }, [caseId]);

  const center = useMemo(() => customerLocation, [customerLocation]);

  if (!isLoaded) return <div className="text-white">Loading Map...</div>;

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden shadow-xl border border-slate-600 isolate">
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={center}
        zoom={14}
        options={{
          mapId: "DEMO_MAP_ID", // Enables Vector Map & Advanced Markers
          disableDefaultUI: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          ]
        }}
      >
        {/* Customer Location (Destination) */}
        <Marker
          position={customerLocation}
          title="Вашият адрес"
          label="🏠"
        />

        {/* Provider Location */}
        {providerPos && (
          <Marker
            position={providerPos}
            title={providerName || "Изпълнител"}
            label="🚗"
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: "#3b82f6", // Blue
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
              rotation: 0 // TODO: Add heading support
            }}
          />
        )}
      </GoogleMap>

      {/* Financial Info Overlay */}
      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-md border border-slate-600 rounded-lg p-4 shadow-lg min-w-[200px]">
        <h3 className="text-white font-semibold mb-3 border-b border-slate-600 pb-2">
          Детайли за плащане
        </h3>
        
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400 uppercase">Вашият бюджет</p>
            <p className="text-lg font-bold text-white">
              {customerBudget ? `${customerBudget} €` : 'Не е зададен'}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-slate-400 uppercase">Договорена цена</p>
            <p className="text-xl font-bold text-green-400">
              {agreedPrice ? `${agreedPrice} €` : 'По договаряне'}
            </p>
          </div>
        </div>

        {providerName && (
          <div className="mt-3 pt-2 border-t border-slate-600">
            <p className="text-xs text-slate-400">Изпълнител</p>
            <p className="text-sm text-white font-medium">{providerName}</p>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">
            {connectionStatus === 'connected' ? 'На живо' : 'Свързване...'}
          </span>
        </div>
      </div>
    </div>
  );
}
