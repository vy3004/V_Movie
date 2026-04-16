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
