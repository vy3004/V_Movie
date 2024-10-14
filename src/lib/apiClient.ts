import axios from "axios";

import { apiConfig, WEB_TITLE } from "@/lib/configs";
import { PageMoviesData } from "@/lib/types";

export const fetchMovies = async (
  slug: string,
  page: number
): Promise<PageMoviesData> => {
  try {
    const { data } = await axios.get(
      `${apiConfig.MOVIES_URL}${slug}?page=${page}`
    );

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
    };
  }
};

export const fetchDetailMovie = async ({ slug }: { slug: string }) => {
  try {
    const response = await axios.get(`${apiConfig.MOVIE_URL}${slug}`);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching detail movie:", error);
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
