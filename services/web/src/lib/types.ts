// The API's request and response shapes (services/api/src/api/schemas.py). Keep them in step.

export type StyleId = "japandi" | "scandinavian" | "industrial" | "modern";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** A presigned POST: the browser sends the photo straight to S3 with these form fields. */
export interface UploadTicket {
  upload_id: string;
  url: string;
  fields: Record<string, string>;
  expires_in: number;
}

/** Rule R2. `score` is the share of the original room's edges still there after staging. */
export interface StructureCheck {
  score: number;
  flagged: boolean;
}

export interface FurnitureItem {
  name: string;
  category: string;
  color: string;
  material: string;
  search_query: string;
}

export interface Staging {
  id: string;
  style: StyleId;
  label: string;
  created_at: string;
  provider: string;
  original_url: string;
  staged_url: string;
  structure: StructureCheck;
  furniture: FurnitureItem[] | null;
}

export interface ListingFacts {
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number | null;
  location: string;
  notes: string;
}

export interface Listing {
  headline: string;
  description: string;
  highlights: string[];
}
