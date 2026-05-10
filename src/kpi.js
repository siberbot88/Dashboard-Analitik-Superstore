import {
  formatCurrency,
  formatInteger,
  formatPercent,
} from "./utils.js";

export function renderKpis(data) {
  const totalSales = d3.sum(data, (row) => row.Sales);
  const totalProfit = d3.sum(data, (row) => row.Profit);
  const totalQuantity = d3.sum(data, (row) => row.Quantity);
  const totalOrders = new Set(data.map((row) => row.OrderID).filter(Boolean)).size;
  const avgDiscount = data.length ? d3.mean(data, (row) => row.Discount) : 0;
  const avgShipping = data.length ? d3.mean(data, (row) => row.ShippingCost) : 0;

  setText("kpi-sales", formatCurrency(totalSales));
  setText("kpi-profit", formatCurrency(totalProfit));
  setText("kpi-quantity", formatInteger(totalQuantity));
  setText("kpi-orders", formatInteger(totalOrders));
  setText("kpi-discount", formatPercent(avgDiscount || 0));
  setText("kpi-shipping", formatCurrency(avgShipping || 0));

  setText("kpi-sales-note", `${formatInteger(data.length)} baris`);
  setText("kpi-profit-note", totalProfit < 0 ? "Laba hasil filter bernilai negatif" : "Laba hasil filter");
  setText("kpi-quantity-note", "Item terjual");
  setText("kpi-orders-note", "Pesanan unik");
  setText("kpi-discount-note", "Rata-rata per baris");
  setText("kpi-shipping-note", "Rata-rata per baris");

  const profitNode = document.querySelector("#kpi-profit");
  if (profitNode) {
    profitNode.classList.toggle("kpi-negative", totalProfit < 0);
    profitNode.classList.toggle("kpi-positive", totalProfit >= 0 && data.length > 0);
  }
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) {
    node.textContent = value;
  }
}
