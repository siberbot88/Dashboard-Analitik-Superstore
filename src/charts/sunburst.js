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
} from "../utils.js?v=sunburst-label-fix-v2";

const SUNBURST_CONFIG = {
  height: 720,
  topProductsPerSubCategory: 5,
  remainderLabel: "Produk lainnya",
};

export function renderSunburst(data, options = {}) {
  const selector = options.selector || "#sunburst";
  const metric = options.metric || "Sales";
  const container = d3.select(selector);
  clearChart(container);

  if (!data.length) {
    showEmptyState(container);
    return;
  }

  const { width, height } = getChartSize(selector, SUNBURST_CONFIG.height);
  const size = Math.max(520, Math.min(width, height));
  const radius = size / 2;
  const rootData = buildProductHierarchy(data, metric);
  const root = d3
    .hierarchy(rootData)
    .sum((node) => (node.children?.length ? 0 : node.sizeValue || 0))
    .sort((a, b) => d3.descending(a.value, b.value));

  if (!root.value) {
    showEmptyState(container, "Metrik terpilih tidak memiliki nilai positif untuk ukuran sunburst.");
    return;
  }

  d3.partition().size([2 * Math.PI, root.height + 1])(root);
  root.each((d) => {
    d.current = d;
  });

  const categories = root.children?.map((node) => node.data.name) || [];
  const color = getColorScale(categories);
  const arc = d3
    .arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.006))
    .padRadius(radius * 1.5)
    .innerRadius((d) => d.y0 * radius / (root.height + 1))
    .outerRadius((d) => Math.max(d.y0 * radius / (root.height + 1), d.y1 * radius / (root.height + 1) - 1));

  const svg = container
    .append("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("role", "img")
    .attr("aria-label", "Zoomable sunburst produk terlaris");

  const path = svg
    .append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
    .attr("class", "sunburst-segment")
    .attr("fill", (d) => color(categoryName(d)))
    .attr("fill-opacity", (d) => arcVisible(d.current) ? (d.children ? 0.72 : 0.9) : 0)
    .attr("pointer-events", (d) => arcVisible(d.current) ? "auto" : "none")
    .attr("d", (d) => arc(d.current))
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("stroke", "#191B24").attr("stroke-width", 1.8).attr("fill-opacity", 1);
      showProductTooltip(event, d, metric, root.value);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function (event, d) {
      d3.select(this)
        .attr("stroke", "rgba(255,255,255,0.68)")
        .attr("stroke-width", 1)
        .attr("fill-opacity", arcVisible(d.current) ? (d.children ? 0.72 : 0.9) : 0);
      hideTooltip();
    })
    .on("click", clicked);

  path
    .filter((d) => d.children)
    .style("cursor", "pointer");

  const labelData = root.descendants().filter((d) => {
    return labelVisible(d.current || d, d);
  });

  const label = svg
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(labelData)
    .join("text")
    .attr("class", (d) => `sunburst-label depth-${d.depth}${d.depth >= 3 ? " product-label" : ""}`)
    .attr("dy", "0.35em")
    .attr("fill-opacity", 1)
    .attr("transform", (d) => labelTransform(d.current, radius, root.height))
    .text((d) => truncateLabel(d.data.name, d.depth === 1 ? 18 : 14));

  const parent = svg
    .append("circle")
    .datum(root)
    .attr("class", "sunburst-center")
    .attr("r", radius / (root.height + 1))
    .attr("fill", "#ffffff")
    .attr("stroke", "rgba(25,27,36,0.18)")
    .attr("pointer-events", "all")
    .on("click", clicked);

  const centerLabel = svg
    .append("text")
    .attr("class", "sunburst-center-label")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.2em")
    .text("Superstore");

  const centerValue = svg
    .append("text")
    .attr("class", "ring-label")
    .attr("text-anchor", "middle")
    .attr("dy", "1.25em")
    .text(formatMetric(rootData.value, metric));

  renderLegend(container, categories, color);

  function clicked(event, p) {
    parent.datum(p.parent || root);
    centerLabel.text(p.depth ? truncateLabel(p.data.name, 18) : "Superstore");
    centerValue.text(formatMetric(p.data.value || rootData.value, metric));

    root.each((d) => {
      d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth),
      };
    });

    const transition = svg.transition().duration(650);

    path
      .transition(transition)
      .tween("data", (d) => {
        const interpolator = d3.interpolate(d.current, d.target);
        return (t) => {
          d.current = interpolator(t);
        };
      })
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", (d) => arcVisible(d.target) ? (d.children ? 0.72 : 0.9) : 0)
      .attr("pointer-events", (d) => arcVisible(d.target) ? "auto" : "none")
      .attrTween("d", (d) => () => arc(d.current));

    label
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target, d);
      })
      .transition(transition)
      .attr("fill-opacity", (d) => +labelVisible(d.target, d))
      .attrTween("transform", (d) => () => labelTransform(d.current, radius, root.height));
  }
}

function buildProductHierarchy(data, metric) {
  const children = d3
    .groups(data, (row) => row.Category || "Tidak diketahui")
    .map(([category, categoryRows]) => ({
      name: category,
      level: "Kategori",
      category,
      subCategory: "Semua",
      product: "",
      ...summarizeRows(categoryRows, metric),
      children: d3
        .groups(categoryRows, (row) => row.SubCategory || "Tidak diketahui")
        .map(([subCategory, subRows]) => ({
          name: subCategory,
          level: "Subkategori",
          category,
          subCategory,
          product: "",
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
    product: "",
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
      product: productName,
      ...summarizeRows(productRows, metric),
    }))
    .sort((a, b) => d3.descending(a.sizeValue, b.sizeValue));

  const visible = products.slice(0, SUNBURST_CONFIG.topProductsPerSubCategory);
  const rest = products.slice(SUNBURST_CONFIG.topProductsPerSubCategory);

  if (rest.length > 0) {
    visible.push({
      name: SUNBURST_CONFIG.remainderLabel,
      level: "Produk",
      category,
      subCategory,
      product: SUNBURST_CONFIG.remainderLabel,
      value: d3.sum(rest, (item) => item.value),
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
    records: rows.length,
    sizeValue: sanitizeTreemapValue(value),
  };
}

function showProductTooltip(event, node, metric, total) {
  showTooltip(
    event,
    tooltipHtml(node.data.name, [
      ["Kategori", node.data.category || "-"],
      ["Subkategori", node.data.subCategory || "-"],
      ["Produk", node.data.product || node.data.name],
      ["Metrik", metricLabel(metric)],
      ["Nilai", formatFullMetric(node.data.value, metric)],
      ["Kontribusi", formatPercent((node.value || 0) / (total || 1))],
      ["Jumlah data", d3.format(",")(node.data.records || 0)],
    ]),
  );
}

function categoryName(node) {
  return node.ancestors().find((ancestor) => ancestor.depth === 1)?.data.name || node.data.name;
}

function arcVisible(d) {
  return d.y1 <= 4 && d.y0 >= 1 && d.x1 > d.x0;
}

function labelVisible(layout, node = layout) {
  return node.depth > 0 && node.depth <= 2 && layout.y1 <= 3 && layout.y0 >= 1 && layout.x1 - layout.x0 > 0.09;
}

function labelTransform(d, radius, height) {
  const x = ((d.x0 + d.x1) / 2) * 180 / Math.PI;
  const y = ((d.y0 + d.y1) / 2) * radius / (height + 1);
  return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
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
