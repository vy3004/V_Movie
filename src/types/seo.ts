export interface SeoSchema {
  "@context": string;
  "@type": string;
  name: string;
  dateModified: string;
  dateCreated: string;
  url: string;
  datePublished: string;
  image: string;
  director: string;
}

export interface SeoOnPage {
  titleHead: string;
  descriptionHead: string;
  seoSchema?: SeoSchema;
  og_type: string;
  og_image: string[];
  og_url: string;
}

export interface BreadCrumb {
  name: string;
  slug?: string;
  isCurrent?: boolean;
  position: number;
}
