import axios from "axios";

import { apiConfig, WEB_TITLE } from "@/lib/configs";
import { PageMovieData, PageMoviesData } from "@/lib/types";

export const fetchMovies = async (
  slug: string,
  page?: string,
  year?: string,
  category?: string,
  country?: string,
  type?: string
): Promise<PageMoviesData> => {
  try {
    const queryParams = new URLSearchParams();

    if (page) queryParams.append("page", page);
    if (year) queryParams.append("year", year);
    if (category) queryParams.append("category", category);
    if (country) queryParams.append("country", country);
    if (type) queryParams.append("type", type);

    const url = `${apiConfig.MOVIES_URL}${slug}?${queryParams.toString()}`;
    const { data } = await axios.get(url);

    return {
      ...data.data,
      seoOnPage: {
        ...data.data.seoOnPage,
        titleHead: `${WEB_TITLE} | ${data.data.seoOnPage.titleHead}`,
      },
      titlePage: `${WEB_TITLE} | ${data.data.titlePage}`,
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      seoOnPage: {
        titleHead: WEB_TITLE,
        descriptionHead: "",
        og_image: [],
        og_url: "",
        og_type: "website",
      },
      breadCrumb: [],
      titlePage: WEB_TITLE,
      items: [],
      params: {
        type_slug: slug,
        filterCategory: [],
        filterCountry: [],
        filterYear: "",
        filterType: "",
        sortField: "",
        sortType: "",
        pagination: {
          totalItems: 0,
          totalItemsPerPage: 0,
          currentPage: 0,
          pageRanges: 0,
        },
      },
    };
  }
};

export const fetchDetailMovie = async ({
  slug,
}: {
  slug: string;
}): Promise<PageMovieData> => {
  try {
    const { data } = await axios.get(`${apiConfig.MOVIE_URL}${slug}`);

    return {
      ...data.data,
      seoOnPage: {
        ...data.data.seoOnPage,
        titleHead: `${WEB_TITLE} | ${data.data.seoOnPage.titleHead}`,
      },
    };
  } catch (error) {
    console.error("Error fetching detail movie:", error);
    return {
      seoOnPage: {
        titleHead: WEB_TITLE,
        descriptionHead: "",
        og_image: [],
        og_url: "",
        og_type: "video.movie",
      },
      breadCrumb: [],
      params: { slug },
      item: null,
    };
  }
};

export const fetchCategories = async () => {
  const response = await axios.get(apiConfig.CATEGORIES_URL);
  return response.data.data.items;
};

export const fetchCountries = async () => {
  const response = await axios.get(apiConfig.COUNTRIES_URL);
  return response.data.data.items;
};
