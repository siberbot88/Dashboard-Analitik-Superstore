import {
  clearChart,
  formatFullMetric,
  formatMetric,
  getChartSize,
  getColorScale,
  getMetricValue,
  hideTooltip,
  metricLabel,
  moveTooltip,
  showEmptyState,
  showTooltip,
  tooltipHtml,
  truncateLabel,
} from "../utils.js?v=sunburst-label-fix-v2";

const RADIAL_TREE_CONFIG = {
  width: 900,
  height: 900,
  topCitiesPerState: 10,
  remainderLabel: "Lainnya",
};

const LOCATION_LEVELS = [
  { field: "Market", level: "Pasar" },
  { field: "Region", level: "Wilayah" },
  { field: "Country", level: "Negara" },
  { field: "State", level: "Provinsi/Wilayah" },
  { field: "City", level: "Kota" },
];

export function renderRadialTree(data, options = {}) {
  const selector = options.selector || "#radial-tree";
  const metric = options.metric || "Sales";
  const container = d3.select(selector);
  clearChart(container);

  if (!data.length) {
    showEmptyState(container);
    return;
  }

  const measuredSize = getChartSize(selector, RADIAL_TREE_CONFIG.height);
  const width = Math.max(RADIAL_TREE_CONFIG.width, measuredSize.width);
  const height = Math.max(RADIAL_TREE_CONFIG.height, measuredSize.height);
  const radius = Math.max(300, Math.min(width, height) / 2 - 92);
  const hierarchyData = buildLocationHierarchy(data, metric);
  const root = d3
    .hierarchy(hierarchyData)
    .sum((node) => (node.children?.length ? 0 : node.sizeValue || Math.abs(node.value || 0)))
    .sort((a, b) => d3.descending(a.value, b.value));

  d3.tree().size([2 * Math.PI, radius]).separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(root);

  const marketNames = Array.from(new Set(data.map((row) => row.Market))).sort(d3.ascending);
  const color = getColorScale([...marketNames, ...LOCATION_LEVELS.map((item) => item.level)]);
  const leafExtent = d3.extent(root.leaves(), (node) => node.value || 0);
  const nodeRadius = d3
    .scaleSqrt()
    .domain([leafExtent[0] || 0, leafExtent[1] || 1])
    .range([4, 11]);
  const labelThreshold =
    d3.quantile(
      root
        .leaves()
        .map((node) => node.value || 0)
        .sort(d3.ascending),
      0.78,
    ) || 0;
  const linkGenerator = d3
    .linkRadial()
    .angle((node) => node.x)
    .radius((node) => node.y);

  const svg = container
    .append("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("role", "img")
    .attr("aria-label", "Diagram pohon radial penjualan berdasarkan lokasi");

  const linksData = root.links();

  const link = svg
    .append("g")
    .selectAll("path")
    .data(linksData)
    .join("path")
    .attr("class", "radial-link")
    .attr("d", linkGenerator);

  const node = svg
    .append("g")
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("class", "radial-node")
    .attr("transform", (d) => {
      const [x, y] = d3.pointRadial(d.x, d.y);
      return `translate(${x},${y})`;
    });

  svg
    .append("g")
    .selectAll("path")
    .data(linksData)
    .join("path")
    .attr("class", "radial-link-hit")
    .attr("d", linkGenerator)
    .on("mouseenter", (event, d) => {
      highlightBranch(d.target, link, node);
      showLocationTooltip(event, d.target, metric);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", () => {
      clearHighlight(link, node);
      hideTooltip();
    });

  node
    .append("circle")
    .attr("r", (d) => (d.children ? 5 + Math.min(d.depth, 3) : nodeRadius(d.value || 0)))
    .attr("fill", (d) => nodeColor(d, color));

  node
    .filter((d) => shouldShowLabel(d, labelThreshold))
    .append("text")
    .attr("dy", "0.32em")
    .attr("x", (d) => (d.x < Math.PI ? 10 : -10))
    .attr("text-anchor", (d) => (d.x < Math.PI ? "start" : "end"))
    .text((d) => truncateLabel(d.data.name, d.depth <= 2 ? 22 : 16));

  node
    .on("mouseenter", function (event, d) {
      highlightBranch(d, link, node);
      showLocationTooltip(event, d, metric);
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function () {
      clearHighlight(link, node);
      hideTooltip();
    });

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.3em")
    .attr("class", "axis-label")
    .style("font-size", "13px")
    .style("font-weight", 700)
    .text("Lokasi");

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "1.1em")
    .attr("class", "ring-label")
    .text(formatMetric(hierarchyData.value, metric));
}

function buildLocationHierarchy(data, metric) {
  return createLocationNode("Superstore", "Akar", "Root", data, metric, 0, {});
}

function createLocationNode(name, level, field, rows, metric, depth, context) {
  const node = summarizeNode(name, level, field, rows, metric, context);
  const nextLevel = LOCATION_LEVELS[depth];

  if (!nextLevel) {
    return node;
  }

  const grouped = d3.group(rows, (row) => row[nextLevel.field] || "Tidak diketahui");
  let children = Array.from(grouped, ([groupName, groupRows]) => {
    const nextContext = {
      ...context,
      [nextLevel.field]: groupName,
    };
    return createLocationNode(groupName, nextLevel.level, nextLevel.field, groupRows, metric, depth + 1, nextContext);
  }).sort((a, b) => d3.descending(Math.abs(a.value), Math.abs(b.value)));

  if (nextLevel.field === "City") {
    const visibleChildren = children.slice(0, RADIAL_TREE_CONFIG.topCitiesPerState);
    const hiddenChildren = children.slice(RADIAL_TREE_CONFIG.topCitiesPerState);

    if (hiddenChildren.length > 0) {
      visibleChildren.push(
        mergeNodes(RADIAL_TREE_CONFIG.remainderLabel, nextLevel.level, nextLevel.field, hiddenChildren, context),
      );
    }

    children = visibleChildren;
  }

  node.children = children;
  return node;
}

function summarizeNode(name, level, field, rows, metric, context) {
  const value = d3.sum(rows, (row) => getMetricValue(row, metric));

  return {
    name,
    level,
    field,
    value,
    sizeValue: Math.abs(value),
    records: rows.length,
    Market: context.Market || "",
    Region: context.Region || "",
    Country: context.Country || "",
    State: context.State || "",
    City: context.City || "",
  };
}

function mergeNodes(name, level, field, nodes, context) {
  const value = d3.sum(nodes, (node) => node.value);
  const records = d3.sum(nodes, (node) => node.records);

  return {
    name,
    level,
    field,
    value,
    sizeValue: Math.abs(value),
    records,
    Market: context.Market || "",
    Region: context.Region || "",
    Country: context.Country || "",
    State: context.State || "",
    City: name,
  };
}

function shouldShowLabel(node, threshold) {
  return node.depth > 0 && (node.depth <= 4 || (!node.children && node.value >= threshold));
}

function showLocationTooltip(event, node, metric) {
  showTooltip(
    event,
    tooltipHtml(node.data.name, [
      ["Nama lokasi", node.data.name],
      ["Level lokasi", node.data.level || "Akar"],
      ["Pasar", node.data.Market || "-"],
      ["Wilayah", node.data.Region || "-"],
      ["Negara", node.data.Country || "-"],
      ["Provinsi/Wilayah", node.data.State || "-"],
      ["Kota", node.data.City || "-"],
      ["Metrik", metricLabel(metric)],
      ["Nilai", formatFullMetric(node.data.value, metric)],
      ["Jumlah data", d3.format(",")(node.data.records || 0)],
    ]),
  );
}

function highlightBranch(targetNode, link, node) {
  const ancestors = new Set(targetNode.ancestors());
  link.classed("is-active", (item) => ancestors.has(item.target));
  node.classed("is-active", (item) => ancestors.has(item));
}

function clearHighlight(link, node) {
  link.classed("is-active", false);
  node.classed("is-active", false);
}

function nodeColor(node, color) {
  const marketNode = node.ancestors().find((ancestor) => ancestor.data.field === "Market");
  if (marketNode) {
    return color(marketNode.data.name);
  }

  if (node.depth === 0) {
    return "#191B24";
  }

  return color(node.data.level || node.depth);
}
