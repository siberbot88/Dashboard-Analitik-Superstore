export const DEFAULT_PAGE_FILTERS = Object.freeze({
  location: {
    market: "all",
    region: "all",
    country: "all",
    state: "all",
    city: "all",
    metric: "Sales",
  },
  product: {
    category: "all",
    subCategory: "all",
    product: "all",
    segment: "all",
    metric: "Sales",
  },
  demand: {
    year: "all",
    week: "all",
    market: "all",
    segment: "all",
    category: "all",
    timeLevel: "year",
  },
});

export const state = {
  rawData: [],
  activeTab: "location",
  pages: {
    location: {
      filteredData: [],
      filters: { ...DEFAULT_PAGE_FILTERS.location },
    },
    product: {
      filteredData: [],
      filters: { ...DEFAULT_PAGE_FILTERS.product },
    },
    demand: {
      filteredData: [],
      filters: { ...DEFAULT_PAGE_FILTERS.demand },
    },
  },
};

export function setPageFilter(page, key, value) {
  const pageState = state.pages[page];
  if (!pageState || !(key in pageState.filters)) {
    return;
  }

  pageState.filters[key] = value || DEFAULT_PAGE_FILTERS[page][key] || "all";
}

export function resetPageFilters(page) {
  if (!state.pages[page]) {
    return;
  }

  state.pages[page].filters = { ...DEFAULT_PAGE_FILTERS[page] };
}
