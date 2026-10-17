// Data shapes returned by the existing Mappingg API (checked against
// www.mappingg.com responses). Raw rows are loosely typed because they come from
// JSON documents; services normalise them into the stricter app types below.

export type FieldVisibility = Partial<Record<VisibilityField, boolean>> | null;

/** Field ids the admin can hide on a project's public card ("Public Card Visibility"). */
export type VisibilityField =
  | 'name'
  | 'developer'
  | 'location'
  | 'status'
  | 'type'
  | 'rera'
  | 'configuration'
  | 'price'
  | 'possession'
  | 'key_usp'
  | 'enquire'
  | 'whatsapp';

export interface CustomField {
  id?: string;
  label?: string;
  value?: string;
  visible?: boolean;
}

/** A public map pin ("project"), normalised. */
export interface Pin {
  id: string;
  number: number;
  lat: number;
  lng: number;
  title: string;
  type: string;
  status: string;
  price: string;
  description: string;
  configuration: string;
  sqft: string;
  possessionTimeline: string;
  launchDate: string;
  whatsAvailable: string;
  highlighted: boolean;
  size: 'small' | 'medium' | 'large';
  developer: string;
  location: string;
  keyUsp: string;
  fieldVisibility: FieldVisibility;
  customFields: CustomField[];
  youtubeVideoUrl: string;
  reraNumber: string;
  /** Absolute image URL (logo / cover) or null. */
  image: string | null;
  brochureImage: string | null;
  updatedAt: string;
  createdAt: string;
  /** Derived. */
  slug: string;
  locality: string;
  isProject: boolean;
}

export interface InfraMarker {
  id: string;
  lat: number;
  lng: number;
  type: string;
  size: string;
  color: string | null;
  title: string;
  notes: string;
  iconImage: string | null;
}

export interface Road {
  id: string;
  type: string;
  color: string | null;
  title: string;
  notes: string;
  weight: number;
  /** [lat, lng] pairs as stored. */
  points: [number, number][];
}

export interface AreaBoundary {
  id: string;
  label: string;
  match: string[];
  boundary: [number, number][] | null;
  fallbackLat: number | null;
  fallbackLng: number | null;
  fallbackZoom: number;
}

export interface InfraTypeRow {
  key: string;
  label: string;
  emoji: string;
  color: string;
}

export interface MapSettings {
  /** Main radius boundary drawn in the admin, [lat, lng] pairs. */
  boundary: [number, number][];
  youtubeVideoUrl: string;
}

export interface MapData {
  infra: InfraMarker[];
  roads: Road[];
  areas: AreaBoundary[];
  infraTypes: InfraTypeRow[];
  settings: MapSettings;
}

export interface DeveloperDirectoryEntry {
  id: string;
  name: string;
  logo: string | null;
}

export type Role = 'buyer' | 'developer' | 'agent' | 'admin' | 'employee';

export interface SessionUser {
  id: string;
  email: string;
  role: Role | string;
  name: string;
  verified: boolean;
  mobile: string;
  needsMobile: boolean;
}

export interface EnquireResult {
  ok: boolean;
  lead: boolean;
  already?: boolean;
  name?: string;
  whatsapp?: string;
  email?: string;
  role?: string;
  project?: string;
}

export interface BuyerProfile {
  name: string;
  email: string;
  mobile: string;
  profile: Record<string, string>;
  created_at: string;
  google: boolean;
}

export interface DeveloperProject {
  id: string;
  number: number | null;
  title: string;
  location: string;
  status: string;
  type: string;
  price: string;
  configuration: string;
  description: string;
  lat: number | null;
  lng: number | null;
  review: 'pending' | 'rejected' | 'live';
  created_at: string;
  review_note: string;
  reviewed_at: string;
  delete_requested: boolean;
  delete_note: string;
}

export interface DeveloperNotification {
  id: string;
  project_id: string;
  state: 'pending' | 'approved' | 'rejected';
  detail: string;
  at: string;
  unread: boolean;
}
