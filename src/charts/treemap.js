import {
  clearChart,
  formatFullMetric,
  formatMetric,
  formatPercent,
  getChartSize,
  getColorScale,
  getMetricValue,
  hideTooltip,
  metricLabel,
  moveTooltip,
  sanitizeTreemapValue,
  showEmptyState,
  showTooltip,
  tooltipHtml,
  truncateLabel,
} from "../utils.js";

const TREEMAP_CONFIG = {
  height: 650,
  topProductsPerSubCategory: 3,
  remainderLabel: "Produk lainnya",
};

export function renderTreemap(data, options = {}) {
  const selector = options.selector || "#treemap";
  const metric = options.metric || "Sales";
  const container = d3.select(selector);
  clearChart(container);

  if (!data.length) {
    showEmptyState(container);
    return;
  }

  const { width, height } = getChartSize(selector, TREEMAP_CONFIG.height);
  const legendHeight = 48;
  const svgHeight = Math.max(TREEMAP_CONFIG.height - legendHeight, height - legendHeight);
  const rootData = buildTreemapHierarchy(data, metric);
  const root = d3.hierarchy(rootData).sum((node) => (node.children?.length ? 0 : node.sizeValue || 0));

  if (!root.value) {
    showEmptyState(container, "Metrik terpilih tidak memiliki nilai positif untuk ukuran area treemap.");
    return;
  }

  d3
    .treemap()
    .size([width, svgHeight])
    .paddingOuter(10)
    .paddingInner(4)
    .paddingTop((d) => (d.depth === 1 ? 24 : d.depth === 2 ? 6 : 0))
    .round(true)(root);

  const categories = root.children?.map((node) => node.data.name) || [];
  const color = getColorScale(categories);
  const totalAreaValue = root.value || 1;

  const svg = container
    .append("svg")
    .attr("viewBox", [0, 0, width, svgHeight])
    .attr("role", "img")
    .attr("aria-label", "Treemap kontribusi kategori, subkategori, dan produk");

  const leaves = root.leaves().filter((node) => node.x1 > node.x0 && node.y1 > node.y0);

  const cell = svg
    .append("g")
    .selectAll("g")
    .data(leaves)
    .join("g")
    .attr("class", "treemap-cell")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  cell
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("rx", 8)
    .attr("fill", (d) => color(d.data.category))
    .attr("fill-opacity", (d) => (d.data.level === "Other" ? 0.62 : 0.9))
    .attr("stroke", "rgba(255,255,255,0.72)")
    .attr("stroke-width", 1);

  cell
    .filter((d) => hasRoomForLabel(d))
    .append("text")
    .attr("x", 10)
    .attr("y", 18)
    .attr("class", "treemap-label")
    .text((d) => truncateLabel(d.data.name, Math.max(8, Math.floor((d.x1 - d.x0) / 8))));

  cell
    .filter((d) => hasRoomForValue(d))
    .append("text")
    .attr("x", 10)
    .attr("y", 36)
    .attr("class", "treemap-value")
    .text((d) => formatMetric(d.data.value, metric));

  cell
    .on("mouseenter", function (event, d) {
      d3.select(this).select("rect").attr("stroke", "#191B24").attr("stroke-width", 2);
      showTooltip(
        event,
        tooltipHtml(d.data.name, [
          ["Kategori", d.data.category],
          ["Subkategori", d.data.subCategory],
          ["Produk", d.data.name],
          ["Metrik", metricLabel(metric)],
          ["Nilai", formatFullMetric(d.data.value, metric)],
          ["Kontribusi", formatPercent((d.value || 0) / totalAreaValue)],
        ]),
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function () {
      d3.select(this).select("rect").attr("stroke", "rgba(255,255,255,0.72)").attr("stroke-width", 1);
      hideTooltip();
    })
    .on("click", function (event, d) {
      if (typeof options.onFilter === "function") {
        options.onFilter({
          category: d.data.category,
          subCategory: d.data.subCategory,
        });
      }
    });

  renderCategoryBoundaries(svg, root.children || []);
  renderLegend(container, categories, color);
}

function buildTreemapHierarchy(data, metric) {
  const children = d3
    .groups(data, (row) => row.Category || "Tidak diketahui")
    .map(([category, categoryRows]) => ({
      name: category,
      level: "Kategori",
      category,
      subCategory: "Semua",
      ...summarizeRows(categoryRows, metric),
      children: d3
        .groups(categoryRows, (row) => row.SubCategory || "Tidak diketahui")
        .map(([subCategory, subRows]) => ({
          name: subCategory,
          level: "Subkategori",
          category,
          subCategory,
          ...summarizeRows(subRows, metric),
          children: getProductChildren(subRows, category, subCategory, metric),
        }))
        .sort((a, b) => d3.descending(a.sizeValue, b.sizeValue)),
    }))
    .sort((a, b) => d3.descending(a.sizeValue, b.sizeValue));

  return {
    name: "Superstore",
    level: "Akar",
    category: "Semua",
    subCategory: "Semua",
    ...summarizeRows(data, metric),
    children,
  };
}

function getProductChildren(rows, category, subCategory, metric) {
  const products = d3
    .groups(rows, (row) => row.ProductName || "Produk tidak diketahui")
    .map(([productName, productRows]) => ({
      name: productName,
      level: "Produk",
      category,
      subCategory,
      ...summarizeRows(productRows, metric),
    }))
    .sort((a, b) => d3.descending(a.sizeValue, b.sizeValue));

  const visible = products.slice(0, TREEMAP_CONFIG.topProductsPerSubCategory);
  const rest = products.slice(TREEMAP_CONFIG.topProductsPerSubCategory);

  if (rest.length > 0) {
    visible.push({
      name: TREEMAP_CONFIG.remainderLabel,
      level: "Other",
      category,
      subCategory,
      value: d3.sum(rest, (item) => item.value),
      sales: d3.sum(rest, (item) => item.sales),
      profit: d3.sum(rest, (item) => item.profit),
      quantity: d3.sum(rest, (item) => item.quantity),
      shippingCost: d3.sum(rest, (item) => item.shippingCost),
      records: d3.sum(rest, (item) => item.records),
      sizeValue: d3.sum(rest, (item) => item.sizeValue),
    });
  }

  return visible;
}

function summarizeRows(rows, metric) {
  const value = d3.sum(rows, (row) => getMetricValue(row, metric));
  return {
    value,
    sales: d3.sum(rows, (row) => row.Sales),
    profit: d3.sum(rows, (row) => row.Profit),
    quantity: d3.sum(rows, (row) => row.Quantity),
    shippingCost: d3.sum(rows, (row) => row.ShippingCost),
    records: rows.length,
    sizeValue: sanitizeTreemapValue(value),
  };
}

function hasRoomForLabel(node) {
  return node.x1 - node.x0 > 74 && node.y1 - node.y0 > 34;
}

function hasRoomForValue(node) {
  return node.x1 - node.x0 > 96 && node.y1 - node.y0 > 54;
}

function renderCategoryBoundaries(svg, categoryNodes) {
  const boundary = svg.append("g");

  boundary
    .selectAll("rect")
    .data(categoryNodes)
    .join("rect")
    .attr("class", "treemap-category-boundary")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("rx", 10);

  boundary
    .selectAll("text")
    .data(categoryNodes.filter((d) => d.x1 - d.x0 > 90 && d.y1 - d.y0 > 44))
    .join("text")
    .attr("class", "treemap-category-label")
    .attr("x", (d) => d.x0 + 10)
    .attr("y", (d) => d.y0 + 17)
    .text((d) => truncateLabel(d.data.name, Math.max(8, Math.floor((d.x1 - d.x0) / 10))));
}

function renderLegend(container, categories, color) {
  const legend = container.append("div").attr("class", "chart-legend");

  legend
    .selectAll("span")
    .data(categories)
    .join("span")
    .attr("class", "legend-item")
    .html((category) => {
      return `<i class="legend-swatch" style="background:${color(category)}"></i>${category}`;
    });
}
