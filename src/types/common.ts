export interface Pagination {
  totalItems: number;
  totalItemsPerPage: number;
  currentPage: number;
  pageRanges: number;
}

export interface DeviceId {
  id: string;
  isGuest: boolean;
}

export interface CateCtr {
  _id?: string;
  name: string;
  slug: string;
}

export interface ActivityData {
  day: string;
  hours: number;
}

export interface GenreData {
  name: string;
  value: number;
  color: string;
}

export interface DashboardStats {
  totalHours: number;
  growthPercentage: number;
  streakDays: number;
  activityData: ActivityData[];
  genreData: GenreData[];
}

export interface ApiResponse {
  success: boolean;
  data: DashboardStats;
  error?: string;
}
