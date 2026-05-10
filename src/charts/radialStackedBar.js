import {
  clearChart,
  formatFullMetric,
  formatMetric,
  formatPercent,
  getChartSize,
  getColorScale,
  hideTooltip,
  moveTooltip,
  showEmptyState,
  showTooltip,
  tooltipHtml,
  truncateLabel,
} from "../utils.js";

const MAX_PERIOD_LABELS = 24;

export function renderRadialStackedBar(data, options = {}) {
  const selector = options.selector || "#radial-stacked-bar";
  const timeLevel = options.timeLevel || "year";
  const metric = "Quantity";
  const container = d3.select(selector);
  clearChart(container);

  if (!data.length) {
    showEmptyState(container);
    return;
  }

  const categories = Array.from(new Set(data.map((row) => row.Category || "Tidak diketahui"))).sort(d3.ascending);
  const matrix = buildDemandMatrix(data, categories, timeLevel);

  if (!matrix.length || d3.max(matrix, (row) => row.total) <= 0) {
    showEmptyState(container, "Tidak ada nilai demand positif untuk filter terpilih.");
    return;
  }

  const { width, height } = getChartSize(selector, 620);
  const legendHeight = 54;
  const svgHeight = Math.max(420, height - legendHeight);
  const outerRadius = Math.min(width, svgHeight) / 2 - 76;
  const innerRadius = Math.max(62, outerRadius * 0.28);
  const color = getColorScale(categories);
  const stack = d3.stack().keys(categories);
  const series = stack(matrix);
  const maxTotal = d3.max(matrix, (row) => row.total) || 1;

  const x = d3
    .scaleBand()
    .domain(matrix.map((row) => row.periodKey))
    .range([0, 2 * Math.PI])
    .align(0)
    .paddingInner(0.08);

  const y = d3.scaleRadial().domain([0, maxTotal]).range([innerRadius, outerRadius]);

  const arc = d3
    .arc()
    .innerRadius((d) => y(d[0]))
    .outerRadius((d) => y(d[1]))
    .startAngle((d) => x(d.data.periodKey))
    .endAngle((d) => x(d.data.periodKey) + x.bandwidth())
    .padAngle(0.006)
    .padRadius(innerRadius);

  const svg = container
    .append("svg")
    .attr("viewBox", [-width / 2, -svgHeight / 2, width, svgHeight])
    .attr("role", "img")
    .attr("aria-label", "Diagram batang bertumpuk radial untuk demand produk");

  renderRings(svg, y, maxTotal);

  svg
    .append("g")
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("fill", (d) => color(d.key))
    .selectAll("path")
    .data((d) => d.map((item) => ({ ...item, key: d.key })))
    .join("path")
    .attr("class", "stack-segment")
    .attr("data-category", (d) => d.key)
    .attr("d", arc)
    .attr("stroke", "rgba(255,255,255,0.72)")
    .attr("stroke-width", 0.7)
    .attr("fill-opacity", 0.9)
    .on("mouseenter", function (event, d) {
      const value = d.data.actualValues[d.key] || 0;
      d3.select(this).attr("stroke", "#191B24").attr("stroke-width", 1.8).attr("fill-opacity", 1);
      showTooltip(
        event,
        tooltipHtml(`${d.data.periodLabel} / ${d.key}`, [
          [timeLevel === "week" ? "Minggu" : "Tahun", d.data.periodLabel],
          ["Kategori", d.key],
          ["Metrik", "Jumlah Barang"],
          ["Jumlah barang", formatFullMetric(value, metric)],
          ["Total demand periode", formatFullMetric(d.data.total || 0, metric)],
          ["Kontribusi kategori", formatPercent(value / (d.data.total || 1))],
        ]),
      );
    })
    .on("mousemove", moveTooltip)
    .on("mouseleave", function () {
      d3.select(this).attr("stroke", "rgba(255,255,255,0.72)").attr("stroke-width", 0.7).attr("fill-opacity", 0.9);
      hideTooltip();
    });

  renderPeriodLabels(svg, matrix, x, outerRadius);
  renderLegend(container, categories, color);
}

function buildDemandMatrix(data, categories, timeLevel) {
  const periodAccessor =
    timeLevel === "week"
      ? (row) => Number(row.WeekNum) || 0
      : (row) => Number(row.Year) || 0;

  const labelAccessor =
    timeLevel === "week"
      ? (period) => `Minggu ${period}`
      : (period) => String(period);

  return d3
    .groups(data, periodAccessor)
    .filter(([period]) => period)
    .map(([period, periodRows]) => {
      const groupedByCategory = d3.group(periodRows, (row) => row.Category || "Tidak diketahui");
      const row = {
        period,
        periodKey: String(period),
        periodLabel: labelAccessor(period),
        actualValues: {},
        total: 0,
      };

      categories.forEach((category) => {
        const rows = groupedByCategory.get(category) || [];
        const quantity = d3.sum(rows, (item) => item.Quantity);
        row[category] = Math.max(0, quantity);
        row.actualValues[category] = quantity;
        row.total += Math.max(0, quantity);
      });

      return row;
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => d3.ascending(a.period, b.period));
}

function renderRings(svg, y, maxTotal) {
  const ticks = y.ticks(4).filter((tick) => tick > 0);

  const ring = svg.append("g");

  ring
    .selectAll("circle")
    .data(ticks)
    .join("circle")
    .attr("class", "ring-line")
    .attr("r", (tick) => y(tick));

  ring
    .selectAll("text")
    .data(ticks)
    .join("text")
    .attr("class", "ring-label")
    .attr("x", 6)
    .attr("y", (tick) => -y(tick))
    .attr("dy", "0.32em")
    .text((tick) => formatMetric(tick, "Quantity"));

  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("dy", "-0.25em")
    .style("font-size", "13px")
    .style("font-weight", 700)
    .text("Jumlah Barang");

  svg
    .append("text")
    .attr("class", "ring-label")
    .attr("text-anchor", "middle")
    .attr("dy", "1.1em")
    .text(`Maks ${formatMetric(maxTotal, "Quantity")}`);
}

function renderPeriodLabels(svg, matrix, x, outerRadius) {
  const stride = Math.max(1, Math.ceil(matrix.length / MAX_PERIOD_LABELS));
  const labeledPeriods = new Set(matrix.filter((_, index) => index % stride === 0).map((row) => row.periodKey));

  svg
    .append("g")
    .selectAll("text")
    .data(matrix.filter((row) => labeledPeriods.has(row.periodKey)))
    .join("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", (d) => {
      const angle = x(d.periodKey) + x.bandwidth() / 2;
      const radius = outerRadius + 28;
      const [px, py] = d3.pointRadial(angle, radius);
      const rotation = (angle * 180) / Math.PI - 90;
      const flip = angle > Math.PI ? 180 : 0;
      return `translate(${px},${py}) rotate(${rotation + flip})`;
    })
    .text((d) => truncateLabel(d.periodLabel, 12));
}

function renderLegend(container, categories, color) {
  const legend = container.append("div").attr("class", "chart-legend");

  legend
    .selectAll("span")
    .data(categories)
    .join("span")
    .attr("class", "legend-item")
    .on("mouseenter", function (event, category) {
      d3.select("#radial-stacked-bar")
        .selectAll(".stack-segment")
        .attr("fill-opacity", function () {
          return this.getAttribute("data-category") === category ? 1 : 0.22;
        });
    })
    .on("mouseleave", function () {
      d3.select("#radial-stacked-bar").selectAll(".stack-segment").attr("fill-opacity", 0.9);
    })
    .html((category) => {
      return `<i class="legend-swatch" style="background:${color(category)}"></i>${category}`;
    });
}
