const REQUIRED_COLUMNS = [
  "Category",
  "Market",
  "Region",
  "Segment",
  "Sales",
  "Profit",
  "Quantity",
  "Shipping.Cost",
  "Sub.Category",
  "Year",
];

export async function loadData() {
  const rows = await d3.csv("./data/superstore.csv", normalizeRow);
  validateColumns(rows.columns || []);

  return rows.filter((row) => {
    return row.Year && row.Category && Number.isFinite(row.Sales);
  });
}

function validateColumns(columns) {
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));

  if (missing.length > 0) {
    throw new Error(`Missing required CSV columns: ${missing.join(", ")}`);
  }
}

function normalizeRow(d) {
  const orderDate = parseDate(d["Order.Date"]);
  const shipDate = parseDate(d["Ship.Date"]);
  const year = parseNumber(d.Year) || (orderDate ? orderDate.getFullYear() : null);

  return {
    Category: cleanText(d.Category),
    City: cleanText(d.City),
    Country: cleanText(d.Country),
    CustomerID: cleanText(d["Customer.ID"]),
    CustomerName: cleanText(d["Customer.Name"]),
    Discount: parseNumber(d.Discount),
    Market: cleanText(d.Market),
    Market2: cleanText(d.Market2 || d.Market),
    OrderDate: orderDate,
    OrderID: cleanText(d["Order.ID"]),
    OrderPriority: cleanText(d["Order.Priority"]),
    ProductID: cleanText(d["Product.ID"]),
    ProductName: cleanText(d["Product.Name"]),
    Profit: parseNumber(d.Profit),
    Quantity: parseNumber(d.Quantity),
    Region: cleanText(d.Region),
    RowID: parseNumber(d["Row.ID"]),
    Sales: parseNumber(d.Sales),
    Segment: cleanText(d.Segment),
    ShipDate: shipDate,
    ShipMode: cleanText(d["Ship.Mode"]),
    ShippingCost: parseNumber(d["Shipping.Cost"]),
    State: cleanText(d.State),
    SubCategory: cleanText(d["Sub.Category"]),
    Year: year,
    WeekNum: parseNumber(d.weeknum) || null,
  };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || "Tidak diketahui";
}
