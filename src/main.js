import { loadData } from "./data.js";
import { renderRadialTree } from "./charts/radialTree.js?v=sunburst-label-fix-v2";
import { renderSunburst } from "./charts/sunburst.js?v=sunburst-label-fix-v2";
import { renderRadialStackedBar } from "./charts/radialStackedBar.js?v=sunburst-label-fix-v2";
import { DEFAULT_PAGE_FILTERS, resetPageFilters, setPageFilter, state } from "./state.js";
import {
  formatCurrency,
  formatFullMetric,
  formatInteger,
  formatMetric,
  getMetricValue,
  metricLabel,
} from "./utils.js?v=sunburst-label-fix-v2";

console.log("Dashboard build: sunburst-label-fix-v2");

const METRIC_OPTIONS_BASIC = [
  { value: "Sales", label: "Penjualan" },
  { value: "Profit", label: "Laba" },
  { value: "Quantity", label: "Jumlah Barang" },
];

const PAGE_CONFIG = {
  location: {
    summaryId: "location-filter-summary",
    kpiId: "location-kpis",
    filters: [
      { key: "market", field: "Market", id: "location-filter-market", label: "Pasar" },
      { key: "region", field: "Region", id: "location-filter-region", label: "Wilayah" },
      { key: "country", field: "Country", id: "location-filter-country", label: "Negara" },
      { key: "state", field: "State", id: "location-filter-state", label: "Provinsi/Wilayah" },
      { key: "city", field: "City", id: "location-filter-city", label: "Kota" },
      { key: "metric", id: "location-filter-metric", label: "Metrik", options: METRIC_OPTIONS_BASIC },
    ],
    cascadeOrder: ["market", "region", "country", "state", "city"],
    resetChildren: {
      market: ["region", "country", "state", "city"],
      region: ["country", "state", "city"],
      country: ["state", "city"],
      state: ["city"],
    },
  },
  product: {
    summaryId: "product-filter-summary",
    kpiId: "product-kpis",
    filters: [
      { key: "category", field: "Category", id: "product-filter-category", label: "Kategori" },
      { key: "subCategory", field: "SubCategory", id: "product-filter-subCategory", label: "Subkategori" },
      { key: "product", field: "ProductName", id: "product-filter-product", label: "Produk" },
      { key: "segment", field: "Segment", id: "product-filter-segment", label: "Segmen" },
      { key: "metric", id: "product-filter-metric", label: "Metrik", options: METRIC_OPTIONS_BASIC },
    ],
    cascadeOrder: ["category", "subCategory", "product"],
    resetChildren: {
      category: ["subCategory", "product"],
      subCategory: ["product"],
    },
  },
  demand: {
    summaryId: "demand-filter-summary",
    kpiId: "demand-kpis",
    filters: [
      { key: "year", field: "Year", id: "demand-filter-year", label: "Tahun", numeric: true },
      { key: "week", field: "WeekNum", id: "demand-filter-week", label: "Minggu", numeric: true, formatOption: (value) => `Minggu ${value}` },
      { key: "market", field: "Market", id: "demand-filter-market", label: "Pasar" },
      { key: "segment", field: "Segment", id: "demand-filter-segment", label: "Segmen" },
      { key: "category", field: "Category", id: "demand-filter-category", label: "Kategori" },
      {
        key: "timeLevel",
        id: "demand-filter-timeLevel",
        label: "Level Waktu",
        options: [
          { value: "year", label: "Tahun" },
          { value: "week", label: "Minggu" },
        ],
      },
    ],
    cascadeOrder: ["year", "week", "market", "segment", "category"],
    resetChildren: {
      year: ["week"],
      market: ["segment", "category"],
      segment: ["category"],
    },
  },
};

let resizeTimer = null;

init();

async function init() {
  bindTabs();
  bindResetButtons();
  bindIntroToggle();
  setStatus("Memuat CSV...", "loading");

  try {
    state.rawData = await loadData();
    Object.keys(state.pages).forEach((page) => {
      populatePageFilters(page);
      applyPageFilters(page);
    });
    renderAllPages();
    setupResizeObserver();
    setStatus(`Berhasil memuat ${formatInteger(state.rawData.length)} baris`, "success");
  } catch (error) {
    console.error(error);
    setStatus("CSV gagal dimuat", "error");
    showMessage("CSV gagal dimuat. Jalankan project melalui local server dan pastikan data/superstore.csv tersedia.");
  }
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      setActiveTab(tab);
    });
  });
}

function bindResetButtons() {
  document.querySelectorAll("[data-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.reset;
      resetPageFilters(page);
      syncPageControls(page);
      applyPageFilters(page);
      renderPage(page);
    });
  });
}

function bindIntroToggle() {
  const intro = document.querySelector(".dashboard-intro");
  const button = document.querySelector("#intro-toggle");
  const body = document.querySelector("#intro-body");

  if (!intro || !button || !body) {
    return;
  }

  button.addEventListener("click", () => {
    const isCollapsed = intro.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!isCollapsed));
    body.hidden = isCollapsed;
    button.textContent = isCollapsed ? "Tampilkan Deskripsi" : "Sembunyikan Deskripsi";
  });
}

function setActiveTab(tab) {
  if (!state.pages[tab]) {
    return;
  }

  state.activeTab = tab;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const isActive = panel.dataset.panel === tab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });

  renderPage(tab);
  updateStatusForActiveTab();
}

function populatePageFilters(page) {
  const config = PAGE_CONFIG[page];
  const filters = state.pages[page].filters;

  config.filters.forEach((filter) => {
    const select = document.querySelector(`#${filter.id}`);
    if (!select) {
      return;
    }

    select.onchange = (event) => {
      handlePageFilterChange(page, filter.key, event.target.value);
    };
  });

  refreshPageFilterOptions(page);
  updatePageSummary(page);
}

function syncPageControls(page) {
  refreshPageFilterOptions(page);
  updatePageSummary(page);
}

function handlePageFilterChange(page, key, value) {
  setPageFilter(page, key, value);
  resetDependentFilters(page, key);
  refreshPageFilterOptions(page);
  applyPageFilters(page);
  updatePageSummary(page);
  renderPage(page);
  updateStatusForActiveTab();
}

function refreshPageFilterOptions(page) {
  const config = PAGE_CONFIG[page];
  const filters = state.pages[page].filters;

  config.filters.forEach((filter) => {
    const select = document.querySelector(`#${filter.id}`);
    if (!select) {
      return;
    }

    if (filter.options) {
      select.innerHTML = filter.options
        .map((option) => `<option value="${escapeAttribute(option.value)}">${escapeText(option.label)}</option>`)
        .join("");
      select.value = filters[filter.key] || DEFAULT_PAGE_FILTERS[page][filter.key];
      return;
    }

    const values = getFilterOptions(page, filter);
    const currentValue = filters[filter.key] || "all";
    if (currentValue !== "all" && !values.includes(String(currentValue))) {
      setPageFilter(page, filter.key, "all");
    }

    select.innerHTML = [
      `<option value="all">Semua ${escapeText(filter.label)}</option>`,
      ...values.map((value) => {
        const label = filter.formatOption ? filter.formatOption(value) : value;
        return `<option value="${escapeAttribute(value)}">${escapeText(label)}</option>`;
      }),
    ].join("");
    select.value = state.pages[page].filters[filter.key] || "all";
  });
}

function resetDependentFilters(page, key) {
  const childKeys = PAGE_CONFIG[page].resetChildren?.[key] || [];
  childKeys.forEach((childKey) => {
    setPageFilter(page, childKey, "all");
  });
}

function applyPageFilters(page) {
  const filters = state.pages[page].filters;
  const config = PAGE_CONFIG[page];

  state.pages[page].filteredData = state.rawData.filter((row) => {
    return config.filters.every((filter) => {
      if (!filter.field) {
        return true;
      }

      const selected = filters[filter.key];
      if (!selected || selected === "all") {
        return true;
      }

      return String(row[filter.field]) === String(selected);
    });
  });
}

function renderAllPages() {
  Object.keys(state.pages).forEach((page) => {
    renderPage(page);
  });
  updateStatusForActiveTab();
}

function renderPage(page) {
  const pageState = state.pages[page];
  if (!pageState) {
    return;
  }

  hideMessage();

  if (page === "location") {
    renderLocationPage(pageState.filteredData, pageState.filters);
  }

  if (page === "product") {
    renderProductPage(pageState.filteredData, pageState.filters);
  }

  if (page === "demand") {
    renderDemandPage(pageState.filteredData, pageState.filters);
  }
}

function renderLocationPage(data, filters) {
  const metric = filters.metric;
  const topCity = topBy(data, "City", metric);

  renderKpiCards("location-kpis", [
    { label: `Total ${metricLabel(metric)}`, value: formatMetric(d3.sum(data, (row) => getMetricValue(row, metric)), metric), note: "Berdasarkan filter lokasi" },
    { label: "Kota Teratas", value: topCity.name, note: topCity.value ? formatFullMetric(topCity.value, metric) : "Tidak ada data" },
    { label: "Total Penjualan", value: formatCurrency(d3.sum(data, (row) => row.Sales)), note: "Nilai penjualan" },
    { label: "Jumlah Data", value: formatInteger(data.length), note: "Baris hasil filter" },
  ]);

  renderRadialTree(data, {
    selector: "#radial-tree",
    metric,
  });
}

function renderProductPage(data, filters) {
  const metric = filters.metric;
  const topProduct = topBy(data, "ProductName", metric);
  const categories = new Set(data.map((row) => row.Category)).size;
  const subCategories = new Set(data.map((row) => row.SubCategory)).size;

  renderKpiCards("product-kpis", [
    { label: `Total ${metricLabel(metric)}`, value: formatMetric(d3.sum(data, (row) => getMetricValue(row, metric)), metric), note: "Berdasarkan filter produk" },
    { label: "Produk Teratas", value: topProduct.name, note: topProduct.value ? formatFullMetric(topProduct.value, metric) : "Tidak ada data" },
    { label: "Kategori", value: formatInteger(categories), note: `${formatInteger(subCategories)} subkategori` },
    { label: "Jumlah Data", value: formatInteger(data.length), note: "Baris hasil filter" },
  ]);

  renderSunburst(data, {
    selector: "#sunburst",
    metric,
  });
}

function renderDemandPage(data, filters) {
  const totalDemand = d3.sum(data, (row) => row.Quantity);
  const topCategory = topBy(data, "Category", "Quantity");
  const periodField = filters.timeLevel === "week" ? "WeekNum" : "Year";
  const topPeriod = topBy(data, periodField, "Quantity", filters.timeLevel === "week" ? "Minggu " : "");

  renderKpiCards("demand-kpis", [
    { label: "Total Demand", value: formatInteger(totalDemand), note: "Jumlah barang" },
    { label: "Kategori Teratas", value: topCategory.name, note: topCategory.value ? formatInteger(topCategory.value) : "Tidak ada data" },
    { label: filters.timeLevel === "week" ? "Minggu Tertinggi" : "Tahun Tertinggi", value: topPeriod.name, note: topPeriod.value ? formatInteger(topPeriod.value) : "Tidak ada data" },
    { label: "Jumlah Data", value: formatInteger(data.length), note: "Baris hasil filter" },
  ]);

  renderRadialStackedBar(data, {
    selector: "#radial-stacked-bar",
    timeLevel: filters.timeLevel,
  });
}

function renderKpiCards(containerId, cards) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) {
    return;
  }

  container.innerHTML = cards
    .map((card) => {
      return `
        <article class="kpi-card">
          <span>${escapeText(card.label)}</span>
          <strong>${escapeText(card.value)}</strong>
          <small>${escapeText(card.note)}</small>
        </article>
      `;
    })
    .join("");
}

function updatePageSummary(page) {
  const config = PAGE_CONFIG[page];
  const filters = state.pages[page].filters;
  const summary = document.querySelector(`#${config.summaryId}`);

  if (!summary) {
    return;
  }

  const active = config.filters
    .filter((filter) => filters[filter.key] && filters[filter.key] !== "all")
    .map((filter) => {
      const value = labelForFilterValue(filter, filters[filter.key]);
      return `${filter.label}: ${value}`;
    });

  summary.textContent = active.length ? active.join(" | ") : "Semua data";
}

function labelForFilterValue(filter, value) {
  if (filter.key === "metric") {
    return metricLabel(value);
  }

  if (filter.key === "timeLevel") {
    return value === "week" ? "Minggu" : "Tahun";
  }

  if (filter.formatOption) {
    return filter.formatOption(value);
  }

  return value;
}

function updateStatusForActiveTab() {
  const pageState = state.pages[state.activeTab];
  if (!pageState || !state.rawData.length) {
    return;
  }

  setStatus(`${formatInteger(pageState.filteredData.length)} dari ${formatInteger(state.rawData.length)} baris`, "success");
}

function setupResizeObserver() {
  const hosts = document.querySelectorAll(".chart-host");
  if (!("ResizeObserver" in window) || hosts.length === 0) {
    return;
  }

  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.rawData.length) {
        renderPage(state.activeTab);
      }
    }, 180);
  });

  hosts.forEach((host) => observer.observe(host));
}

function getFilterOptions(page, targetFilter) {
  const config = PAGE_CONFIG[page];
  const filters = state.pages[page].filters;
  const ignoredKeys = new Set([targetFilter.key, ...getDescendantFilterKeys(config, targetFilter.key)]);
  const narrowedData = state.rawData.filter((row) => {
    return config.filters.every((filter) => {
      if (!filter.field || ignoredKeys.has(filter.key)) {
        return true;
      }

      const selected = filters[filter.key];
      if (!selected || selected === "all") {
        return true;
      }

      return String(row[filter.field]) === String(selected);
    });
  });

  return uniqueValues(narrowedData, targetFilter.field, targetFilter.numeric);
}

function getDescendantFilterKeys(config, key) {
  const descendants = new Set(config.resetChildren?.[key] || []);
  Array.from(descendants).forEach((childKey) => {
    getDescendantFilterKeys(config, childKey).forEach((grandChildKey) => descendants.add(grandChildKey));
  });
  return Array.from(descendants);
}

function uniqueValues(data, field, numeric = false) {
  const values = Array.from(new Set(data.map((row) => row[field]).filter(Boolean))).map(String);
  return numeric ? values.sort((a, b) => Number(a) - Number(b)) : values.sort((a, b) => a.localeCompare(b));
}

function topBy(data, field, metric, prefix = "") {
  if (!data.length) {
    return { name: "-", value: 0 };
  }

  const rows = d3
    .rollups(
      data,
      (items) => d3.sum(items, (row) => getMetricValue(row, metric)),
      (row) => row[field] || "Tidak diketahui",
    )
    .sort((a, b) => d3.descending(a[1], b[1]));

  const [name, value] = rows[0] || ["-", 0];
  return {
    name: `${prefix}${name}`,
    value,
  };
}

function setStatus(message, type) {
  const status = document.querySelector("#data-status");
  const dot = document.querySelector("#data-status-dot");

  if (status) {
    status.textContent = message;
  }

  if (dot) {
    dot.className = "status-dot";
    dot.classList.add(`status-dot-${type}`);
  }
}

function showMessage(message) {
  const node = document.querySelector("#app-message");
  if (!node) {
    return;
  }

  node.textContent = message;
  node.hidden = false;
}

function hideMessage() {
  const node = document.querySelector("#app-message");
  if (node) {
    node.hidden = true;
  }
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}
