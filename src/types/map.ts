/* Tipe layer Peta Aset. */

export interface NetworkNode {
  node_id: number;
  node_code: string;
  node_name: string;
  node_type: string;
  branch_id: number | null;
  lat: number;
  lng: number;
}

export interface NetworkArc {
  edge_id: number;
  edge_code: string;
  edge_name: string;
  connection_type: string;
  status: string;
  severity: string;
  bandwidth_label: string | null;
  distance_km: number;
  source: NetworkNode;
  target: NetworkNode;
}

export interface WeatherPoint {
  id: number;
  point_code: string;
  point_name: string;
  branch_id: number;
  branch_name?: string;
  lat: number;
  lng: number;
  condition_key?: string;
  weather_label?: string;
  temperature_c?: number;
  humidity_pct?: number;
  wind_kph?: number;
  is_stale?: boolean;
}

export interface VehicleTypeRef {
  id: number;
  type_code: string;
  type_name: string;
  icon_path: string | null;
  is_active?: number;
}

export interface LiveVehicle {
  vehicle_id: number;
  node: string;
  label: string;
  vehicle_type?: string;
  vehicle_type_ref?: VehicleTypeRef | null;
  branch_id: number;
  branch_name?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  movement_status?: string;
  gps_status?: string;
  bearing?: number;
}
