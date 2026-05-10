export const METRIC_OPTIONS = [
  { value: "Sales", label: "Penjualan", type: "currency" },
  { value: "Profit", label: "Laba", type: "currency" },
  { value: "Quantity", label: "Jumlah Barang", type: "number" },
  { value: "ShippingCost", label: "Biaya Pengiriman", type: "currency" },
];

export const FILTER_CONFIG = [
  { key: "year", field: "Year", id: "filter-year", label: "Tahun", numeric: true },
  { key: "market", field: "Market", id: "filter-market", label: "Pasar" },
  { key: "market2", field: "Market2", id: "filter-market2", label: "Kelompok Pasar" },
  { key: "region", field: "Region", id: "filter-region", label: "Wilayah" },
  { key: "segment", field: "Segment", id: "filter-segment", label: "Segmen" },
  { key: "category", field: "Category", id: "filter-category", label: "Kategori" },
  { key: "subCategory", field: "SubCategory", id: "filter-subCategory", label: "Subkategori" },
  { key: "shipMode", field: "ShipMode", id: "filter-shipMode", label: "Metode Pengiriman" },
  {
    key: "orderPriority",
    field: "OrderPriority",
    id: "filter-orderPriority",
    label: "Prioritas Pesanan",
  },
];

export const CHART_COLORS = [
  "#2D5AFE",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#E11D48",
  "#0891B2",
  "#7C3AED",
  "#65A30D",
  "#D97706",
  "#2563EB",
  "#DB2777",
  "#0F766E",
];

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const percentNumber = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function getMetricValue(row, metric) {
  switch (metric) {
    case "Profit":
      return safeNumber(row.Profit);
    case "Quantity":
      return safeNumber(row.Quantity);
    case "ShippingCost":
    case "Shipping.Cost":
      return safeNumber(row.ShippingCost);
    case "Sales":
    default:
      return safeNumber(row.Sales);
  }
}

export function metricLabel(metric) {
  return METRIC_OPTIONS.find((item) => item.value === metric)?.label || "Penjualan";
}

export function formatMetric(value, metric) {
  if (metric === "Quantity") {
    return compactNumber.format(safeNumber(value));
  }

  return compactCurrency.format(safeNumber(value));
}

export function formatFullMetric(value, metric) {
  if (metric === "Quantity") {
    return integerNumber.format(safeNumber(value));
  }

  return fullCurrency.format(safeNumber(value));
}

export function formatCurrency(value) {
  return compactCurrency.format(safeNumber(value));
}

export function formatNumber(value) {
  return compactNumber.format(safeNumber(value));
}

export function formatInteger(value) {
  return integerNumber.format(safeNumber(value));
}

export function formatPercent(value) {
  return percentNumber.format(safeNumber(value));
}

export function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeTreemapValue(value) {
  return Math.max(0, safeNumber(value));
}

export function sanitizeStackValue(value) {
  return Math.max(0, safeNumber(value));
}

export function truncateLabel(label, maxLength = 18) {
  const text = String(label ?? "Tidak diketahui");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

export function clearChart(container) {
  const selection = typeof container === "string" ? d3.select(container) : container;
  selection.selectAll("*").remove();
}

export function showEmptyState(container, message = "Tidak ada data yang cocok dengan filter terpilih.") {
  const selection = typeof container === "string" ? d3.select(container) : container;
  clearChart(selection);

  selection
    .append("div")
    .attr("class", "empty-state")
    .html(`<div><strong>Data tidak tersedia</strong><span>${escapeHtml(message)}</span></div>`);
}

export function getChartSize(selector, fallbackHeight = 560) {
  const node = document.querySelector(selector);
  const rect = node?.getBoundingClientRect();
  const width = Math.max(280, Math.floor(rect?.width || 720));
  const height = Math.max(360, Math.floor(rect?.height || fallbackHeight));

  return { width, height };
}

export function buildHierarchy(data, levels, metric, rootName = "Superstore") {
  const buildLevel = (rows, depth) => {
    if (depth >= levels.length) {
      return undefined;
    }

    const field = levels[depth];
    const grouped = d3.group(rows, (row) => row[field] || "Tidak diketahui");

    return Array.from(grouped, ([name, values]) => {
      const children = buildLevel(values, depth + 1);
      return {
        name,
        field,
        level: field,
        value: d3.sum(values, (row) => getMetricValue(row, metric)),
        records: values.length,
        children,
      };
    }).sort((a, b) => d3.descending(Math.abs(a.value), Math.abs(b.value)));
  };

  return {
    name: rootName,
    field: "Root",
    level: "Root",
    value: d3.sum(data, (row) => getMetricValue(row, metric)),
    records: data.length,
    children: buildLevel(data, 0) || [],
  };
}

export function rollupBy(data, groupKeys, metric) {
  const reducer = (rows) => ({
    value: d3.sum(rows, (row) => getMetricValue(row, metric)),
    sales: d3.sum(rows, (row) => row.Sales),
    profit: d3.sum(rows, (row) => row.Profit),
    quantity: d3.sum(rows, (row) => row.Quantity),
    shippingCost: d3.sum(rows, (row) => row.ShippingCost),
    records: rows.length,
  });

  return d3.rollups(data, reducer, ...groupKeys.map((key) => (row) => row[key] || "Tidak diketahui"));
}

export function getColorScale(domain) {
  return d3.scaleOrdinal().domain(domain).range(CHART_COLORS);
}

export function tooltipHtml(title, rows) {
  const body = rows
    .map(([label, value]) => {
      return `<div class="tooltip-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    })
    .join("");

  return `<div class="tooltip-title">${escapeHtml(title)}</div>${body}`;
}

export function showTooltip(firstArg, secondArg) {
  const event = typeof firstArg === "string" ? secondArg : firstArg;
  const html = typeof firstArg === "string" ? firstArg : secondArg;
  const tooltip = getTooltip();
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  moveTooltip(event);
}

export function moveTooltip(event) {
  const tooltip = getTooltip();
  if (!tooltip || tooltip.hidden || !event) {
    return;
  }

  const offset = 14;
  const padding = 12;
  const rect = tooltip.getBoundingClientRect();
  let x = event.clientX + offset;
  let y = event.clientY + offset;

  if (x + rect.width > window.innerWidth - padding) {
    x = event.clientX - rect.width - offset;
  }

  if (y + rect.height > window.innerHeight - padding) {
    y = event.clientY - rect.height - offset;
  }

  tooltip.style.left = `${Math.max(padding, x)}px`;
  tooltip.style.top = `${Math.max(padding, y)}px`;
}

export function hideTooltip() {
  const tooltip = getTooltip();
  tooltip.classList.remove("is-visible");
  tooltip.hidden = true;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTooltip() {
  let tooltip = document.getElementById("chart-tooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "chart-tooltip";
    tooltip.className = "chart-tooltip";
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
  }

  return tooltip;
}
