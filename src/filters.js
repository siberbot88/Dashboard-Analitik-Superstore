import { FILTER_CONFIG, METRIC_OPTIONS, escapeHtml, metricLabel } from "./utils.js";

const LEGACY_DEFAULT_FILTERS = Object.freeze({
  year: "all",
  market: "all",
  market2: "all",
  region: "all",
  segment: "all",
  category: "all",
  subCategory: "all",
  shipMode: "all",
  orderPriority: "all",
  metric: "Sales",
});

export function applyFilters(data, filters) {
  return data.filter((row) => {
    return FILTER_CONFIG.every((config) => {
      const selected = filters[config.key];
      if (!selected || selected === "all") {
        return true;
      }

      return String(row[config.field]) === String(selected);
    });
  });
}

export function populateFilters(data, filters, onChange) {
  FILTER_CONFIG.forEach((config) => {
    const select = document.querySelector(`#${config.id}`);
    if (!select) {
      return;
    }

    const values = getUniqueValues(data, config);
    select.innerHTML = [
      `<option value="all">Semua ${escapeHtml(config.label)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    ].join("");

    select.value = values.includes(String(filters[config.key])) ? String(filters[config.key]) : "all";
    select.onchange = (event) => onChange(config.key, event.target.value);
  });

  const metricSelect = document.querySelector("#filter-metric");
  if (metricSelect) {
    metricSelect.innerHTML = METRIC_OPTIONS.map((metric) => {
      return `<option value="${metric.value}">${escapeHtml(metric.label)}</option>`;
    }).join("");
    metricSelect.value = filters.metric || LEGACY_DEFAULT_FILTERS.metric;
    metricSelect.onchange = (event) => onChange("metric", event.target.value);
  }

  updateFilterSummary(filters);
}

export function syncFilterControls(filters) {
  FILTER_CONFIG.forEach((config) => {
    const select = document.querySelector(`#${config.id}`);
    if (select) {
      select.value = filters[config.key] || "all";
    }
  });

  const metricSelect = document.querySelector("#filter-metric");
  if (metricSelect) {
    metricSelect.value = filters.metric || LEGACY_DEFAULT_FILTERS.metric;
  }

  updateFilterSummary(filters);
}

export function resetFilterState(state) {
    state.filters = { ...LEGACY_DEFAULT_FILTERS };
}

export function updateFilterSummary(filters) {
  const summary = document.querySelector("#filter-summary");
  if (!summary) {
    return;
  }

  const activeFilters = FILTER_CONFIG.filter((config) => filters[config.key] !== "all").map((config) => {
    return `${config.label}: ${filters[config.key]}`;
  });

  const metricText = `Metrik: ${metricLabel(filters.metric)}`;
  summary.textContent =
    activeFilters.length > 0 ? `${activeFilters.join(" | ")} | ${metricText}` : `Semua data | ${metricText}`;
}

function getUniqueValues(data, config) {
  const values = Array.from(new Set(data.map((row) => row[config.field]).filter(Boolean))).map(String);

  if (config.numeric) {
    return values.sort((a, b) => Number(a) - Number(b));
  }

  return values.sort((a, b) => a.localeCompare(b));
}
