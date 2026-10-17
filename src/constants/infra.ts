// Infrastructure marker types on the live map (same list as the website).
// Custom types created in the admin editor (infra_types table) are merged in at runtime.

export interface InfraTypeMeta {
  emoji: string;
  label: string;
  color: string;
}

export const BUILT_IN_INFRA: Record<string, InfraTypeMeta> = {
  bridge: { emoji: '🌉', label: 'Bridge', color: '#3b6ea5' },
  highway_bridge: { emoji: '🛣️', label: 'Highway Bridge', color: '#8f6f42' },
  flyover: { emoji: '🎢', label: 'Flyover', color: '#7a5c9e' },
  bullet_train: { emoji: '🚄', label: 'Bullet Train Station', color: '#b5484c' },
  metro: { emoji: '🚇', label: 'Metro Station', color: '#3f8f6b' },
  metro_line: { emoji: '🚇', label: 'Metro Line', color: '#3f8f6b' },
  railway_station: { emoji: '🚉', label: 'Railway Station', color: '#5b7c99' },
  hotel: { emoji: '🏨', label: 'Hotel', color: '#a0527a' },
  hospital: { emoji: '🏥', label: 'Hospital', color: '#c0392b' },
  underpass: { emoji: '🔽', label: 'Underpass', color: '#5c6670' },
  proposed_road: { emoji: '🚧', label: 'Proposed Road', color: '#c98a2c' },
  school: { emoji: '🏫', label: 'School', color: '#5c8a3f' },
  garden: { emoji: '🌳', label: 'Garden', color: '#22c55e' },
};

export const INFRA_SIZES: Record<string, { px: number; font: number }> = {
  small: { px: 26, font: 13 },
  medium: { px: 36, font: 18 },
  large: { px: 48, font: 24 },
};

export const ROAD_WEIGHTS: Record<string, number> = { small: 3, medium: 5, large: 8 };

export const isBridgeLike = (type?: string) => type === 'bridge' || type === 'highway_bridge' || type === 'flyover';
