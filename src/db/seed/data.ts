/**
 * Sample data for a stationery wholesaler (DOMS price list from PRANTIK, Agartala).
 * Money here is in RUPEES for readability.
 *
 * MRP comes from the price list. Sample prices: usual selling price = 85% of MRP and
 * cost price = 70% of MRP (second purchases at 72%). These are made-up numbers for trying
 * the app — replace them with real ones.
 */

export const seedCategories = [
  "Markers & Ink",
  "Glue & Gum",
  "Pencils",
  "Colour Pencils & Crayons",
  "Paints & Pastels",
  "Brushes",
  "Geometry & Scales",
  "Art Kits & Clay",
  "Pens",
  "Erasers & Sharpeners",
  "Highlighters & Correction",
  "Chalk & Boards",
  "Notebooks & Sketch Books",
] as const;

export const seedBrands = ["DOMS"] as const;

type Category = (typeof seedCategories)[number];
type Unit = "pcs" | "box" | "set" | "pkt" | "jar";

/** Stock-in bills, oldest first. `daysAgo` backdates them so history and dashboard look lived-in. */
export const seedStockEntries = [
  { key: "opening", reference: "OPENING", note: "Opening stock", daysAgo: 28, by: "owner" },
  { key: "second", reference: "DOMS-INV-88341", note: "DOMS distributor, Kolkata", daysAgo: 15, by: "ramesh" },
  { key: "third", reference: "GR-1102", note: "Local purchase", daysAgo: 7, by: "sunita" },
  { key: "latest", reference: "DOMS-INV-90215", note: "DOMS distributor, Kolkata", daysAgo: 2, by: "ramesh" },
] as const;

type EntryKey = (typeof seedStockEntries)[number]["key"];

export type SeedItem = {
  sku: string;
  name: string;
  variant?: string;
  brand: (typeof seedBrands)[number];
  category: Category;
  unit: Unit;
  packSize?: string;
  mrp: number;
  sell: number;
  lowStock: number;
  /** [stock entry, quantity, cost per unit in ₹] */
  buys: [EntryKey, number, number][];
};

// [list no, name, pack size, MRP, unit, category, colours/variants]
type Row = [number, string, string | null, number, Unit, Category, string[]?];

const C = {
  markers: "Markers & Ink",
  glue: "Glue & Gum",
  pencils: "Pencils",
  colourPencils: "Colour Pencils & Crayons",
  paints: "Paints & Pastels",
  brushes: "Brushes",
  geometry: "Geometry & Scales",
  art: "Art Kits & Clay",
  pens: "Pens",
  erasers: "Erasers & Sharpeners",
  highlight: "Highlighters & Correction",
  chalk: "Chalk & Boards",
  books: "Notebooks & Sketch Books",
} as const satisfies Record<string, Category>;

const ACRYLIC_SHADES = [
  "White", "Black", "Yellow", "Light Green", "Blue", "Orange",
  "Red", "Silver", "Golden", "Brown", "Sap Green", "Pink",
];

// Names lightly cleaned up from the price list (spelling, capitals) so search works well.
const rows: Row[] = [
  [1, "CD/DVD/OHP Marker", "Pkt of 10", 10, "pcs", C.markers, ["Black", "Blue"]],
  [2, "Permanent Marker", "Pkt of 10", 20, "pcs", C.markers, ["Black", "Blue", "Red"]],
  [3, "White Board Marker", "Pkt of 10", 25, "pcs", C.markers, ["Black", "Blue", "Red", "Green"]],
  [4, "White Board Marker Ink", null, 35, "pcs", C.markers, ["Blue", "Black"]],
  [5, "White Glue", "20 g", 10, "pcs", C.glue],
  [6, "White Glue", "45 g", 20, "pcs", C.glue],
  [7, "White Glue", "105 g", 45, "pcs", C.glue],
  [8, "Glue Stick", "8 g", 25, "pcs", C.glue],
  [9, "Glue Stick", "15 g", 40, "pcs", C.glue],
  [10, "Gum", "20 ml", 5, "pcs", C.glue],
  [11, "Gum", "50 ml", 10, "pcs", C.glue],
  [12, "Neon Pencils", "Pkt of 10", 5, "pcs", C.pencils],
  [13, "X1 Pencils", "Pkt of 10", 5, "pcs", C.pencils],
  [14, "A1 Pencils", "Pkt of 10", 5, "pcs", C.pencils],
  [15, "Y1 Pencils", "Pkt of 10", 5, "pcs", C.pencils],
  [16, "Karbon Pencils", "Pkt of 10", 7, "pcs", C.pencils],
  [17, "Groove Pencils", "Pkt of 10", 5.8, "pcs", C.pencils],
  [18, "Fusion Pencils", "Pkt of 10", 7, "pcs", C.pencils],
  [19, "Zillon Pencils", "Pkt of 11", 6, "pcs", C.pencils],
  [20, "Luxe Pencils", "Pkt of 10", 6, "pcs", C.pencils],
  [21, "Heritage Pencils", "Pkt of 10", 4, "pcs", C.pencils],
  [22, "Superio Pencils", "Pkt of 10", 125, "pkt", C.pencils],
  [23, "Drawing Pencil Set", "HB, 2B, 4B, 6B, 8B, 10B", 48, "set", C.pencils],
  [24, "Mechanical Pencil", "0.7 mm", 10, "pcs", C.pencils],
  [25, "Colour Pencils", "12 Colours", 29, "box", C.colourPencils],
  [26, "Colour Pencils (Large Size)", "12 Colours", 60, "box", C.colourPencils],
  [27, "Colour Pencils", "24 Shades", 120, "box", C.colourPencils],
  [28, "Colour Pencils (Small Box)", "12 Colours", 40, "box", C.colourPencils],
  [29, "Colour Pencils (Large Box)", "12 Colours", 107, "box", C.colourPencils],
  [30, "Wax Crayons", "Pkt of 10", 10, "box", C.colourPencils],
  [31, "Wax Crayons (Extra Long)", "16 + 1 Shades", 40, "box", C.colourPencils],
  [32, "Plastic Crayons", "Pkt of 10", 60, "box", C.colourPencils],
  [33, "Oil Pastels (Plastic Box)", "12 Shades", 20, "box", C.paints],
  [34, "Oil Pastels", "12 Shades", 50, "box", C.paints],
  [35, "Oil Pastels", "16 Shades", 65, "box", C.paints],
  [36, "Oil Pastels (Plastic Box)", "25 Shades", 120, "box", C.paints],
  [37, "Oil Pastels", "25 Shades", 100, "box", C.paints],
  [38, "Oil Pastels (Plastic Box)", "50 Shades", 230, "box", C.paints],
  [39, "Oil Pastels", "50 Shades", 190, "box", C.paints],
  [40, "Tempera Colours", "12 Shades", 20, "box", C.paints],
  [41, "Poster Colours", "6 Shades", 100, "box", C.paints],
  [42, "Poster Colours", "12 Shades", 190, "box", C.paints],
  [43, "Poster Colours", "14 Shades", 220, "box", C.paints],
  [44, "Colourmate Round Brush", "Set of 5", 50, "set", C.brushes],
  [45, "Colourmate Flat Brush", "Set of 4", 50, "set", C.brushes],
  [46, "Colourmate Combo Brush", "Set of 7", 90, "set", C.brushes],
  [47, "Artistic Brush (0, 2, 4, 6)", "Set of 4", 85, "set", C.brushes],
  [48, "Studio Round Brush (0–12)", "Set of 7", 250, "set", C.brushes],
  [49, "Studio Flat Brush (1–12)", "Set of 7", 400, "set", C.brushes],
  [50, "Geometry Box (Geofine)", null, 80, "pcs", C.geometry],
  [51, "Geometry Box (Geommy)", null, 100, "pcs", C.geometry],
  [52, "Geometry Box (Geomiti)", null, 100, "pcs", C.geometry],
  [53, "Geometry Box (Geotron)", null, 110, "pcs", C.geometry],
  [54, "Geometry Box (X1 Premium)", null, 150, "pcs", C.geometry],
  [55, "All The Best Art Kit", null, 20, "pcs", C.art],
  [56, "Speedz Art Kit", null, 30, "pcs", C.art],
  [57, "Unicorn Art Kit", null, 150, "pcs", C.art],
  [58, "Art Kit", "₹99 kit", 99, "pcs", C.art],
  [59, "Art Kit", "₹149 kit", 149, "pcs", C.art],
  [60, "Art Kit", "₹199 kit", 199, "pcs", C.art],
  [61, "Exam Essential Kit", null, 300, "pcs", C.art],
  [62, "Art Apps NXT", null, 425, "pcs", C.art],
  [63, "Clay Bucket", "Small", 40, "pcs", C.art],
  [64, "Clay Bucket", "Medium", 85, "pcs", C.art],
  [65, "Clay Bucket", "Large", 150, "pcs", C.art],
  [66, "Clay", "Small", 60, "pcs", C.art],
  [67, "Clay", "Medium", 100, "pcs", C.art],
  [68, "Clay", "Large", 175, "pcs", C.art],
  [69, "Sketch Pens", "Pkt of 20", 15, "pkt", C.pens],
  [70, "Sketch Pens (Large Size)", "Pkt of 10", 40, "pkt", C.pens],
  [71, "Sketch Pens (Box)", null, 125, "box", C.pens],
  [72, "Brush Pens", "₹200 set", 200, "set", C.pens],
  [73, "Brush Pens", "₹400 set", 400, "set", C.pens],
  [74, "Colour Cake (Small Size)", null, 65, "pcs", C.paints],
  [75, "Colour Cake (Large Size)", null, 100, "pcs", C.paints],
  [76, "Colour Cake", null, 150, "pcs", C.paints],
  [77, "M-Tech Erasers", "Pkt of 10", 10, "pcs", C.erasers],
  [78, "Dust Free Erasers", "Pkt of 10", 5, "pcs", C.erasers],
  [79, "Neon Eraser (Hexagon)", "Pkt of 10", 5, "pcs", C.erasers],
  [80, "Car Eraser", "Pkt of 12", 10, "pcs", C.erasers],
  [81, "Tom & Jerry Eraser", "Pkt of 10", 10, "pcs", C.erasers],
  [82, "Eraser (Tyre)", "Pkt of 40", 5, "pcs", C.erasers],
  [83, "Eraser (Tyre)", "Pkt of 20", 10, "pcs", C.erasers],
  [84, "Groove Erasers", "Pkt of 10", 25, "pcs", C.erasers],
  [85, "Sharpeners (Long)", "Pkt of 20", 5, "pcs", C.erasers],
  [86, "Dust Collector Sharpeners", "Pkt of 10", 10, "pcs", C.erasers],
  [87, "Rocket Point Erasner", "Pkt of 10", 20, "pcs", C.erasers],
  [88, "Super Point Sharpeners", "Pkt of 10", 20, "pcs", C.erasers],
  [89, "3HX Sharpeners", "Pkt of 12", 30, "pcs", C.erasers],
  [90, "2 in 1 E-Racer Erasner", "Pkt of 20", 15, "pcs", C.erasers],
  [91, "2 in 1 Buddy Erasner", "Pkt of 10", 15, "pcs", C.erasers],
  [92, "Erasner", "Pkt of 20", 10, "pcs", C.erasers],
  [93, "Pepcils Erasers", "Pkt of 20", 10, "pcs", C.erasers],
  [94, "Highlighter", "Pkt of 5", 25, "pcs", C.highlight],
  [95, "Correction Pen", "Pkt of 10", 25, "pcs", C.highlight],
  [96, "Acrylic Colour (Single)", null, 25, "pcs", C.paints, ACRYLIC_SHADES],
  [97, "Acrylic Colours", "6 Shades", 100, "box", C.paints],
  [98, "Acrylic Colours", "12 Shades", 250, "box", C.paints],
  [99, "Inxklik Pen", "Pkt of 5", 5, "pcs", C.pens],
  [100, "Inxtra Pen", "Pkt of 5", 5, "pcs", C.pens, ["Blue", "Black", "Red"]],
  [101, "Inxtra Fine Pen", "Pkt of 5", 5, "pcs", C.pens],
  [102, "Inxtra Glass Pen", "Pkt of 5", 5, "pcs", C.pens],
  [103, "Inxtra Candy Pen", "Pkt of 5", 5, "pcs", C.pens],
  [104, "Inxfy Pen", "Pkt of 5", 5, "pcs", C.pens, ["Blue", "Black"]],
  [105, "Inxfy Softy Pen", "Pkt of 5", 5, "pcs", C.pens],
  [106, "Inxfy Plus Pen", "Pkt of 5", 5, "pcs", C.pens],
  [107, "Inxfy Pen Jar", "100 pens", 500, "jar", C.pens],
  [108, "Inxfy Softy Pen Jar", "100 pens", 500, "jar", C.pens],
  [109, "Inxtra Candy Pen Jar", "100 pens", 500, "jar", C.pens],
  [110, "Kika Pen Jar", "25 pens", 125, "jar", C.pens],
  [111, "Inxon Pen", "Pkt of 10", 10, "pcs", C.pens],
  [112, "Inxglo Pen", "Pkt of 10", 10, "pcs", C.pens],
  [113, "Inxo Classic Pen", "Pkt of 10", 10, "pcs", C.pens],
  [114, "Inxpop Pen", "Pkt of 10", 10, "pcs", C.pens],
  [115, "White Chalk", "Pkt of 10", 20, "pkt", C.chalk],
  [116, "Colour Chalk", "Pkt of 10", 25, "pkt", C.chalk],
  [117, "Glitter Colours", null, 35, "pcs", C.paints],
  [118, "Water Colour Tube", null, 100, "pcs", C.paints],
  [119, "Transparent Exam Board", null, 150, "pcs", C.chalk],
  [120, "Compass", "Pkt of 10", 25, "pcs", C.geometry],
  [121, "Scale (15 cm)", "Pkt of 10", 5, "pcs", C.geometry],
  [122, "Scale (30 cm)", "Pkt of 10", 12, "pcs", C.geometry],
  [123, "Spiral Notebook Pocket (10.5 × 7.4 cm)", "100 pages", 20, "pcs", C.books],
  [124, "Spiral Notebook (21.6 × 14 cm)", "160 pages", 106, "pcs", C.books],
  [125, "Spiral Notebook (25 × 17.8 cm)", "300 pages", 250, "pcs", C.books],
  [126, "Sketch Book A5 (21 × 14.8 cm)", "72 pages", 77, "pcs", C.books],
  [127, "Sketch Book A4 (21 × 29.7 cm)", "72 pages", 145, "pcs", C.books],
  [128, "Sketch Book (27.5 × 34.7 cm)", "72 pages", 210, "pcs", C.books],
  [129, "Sketch Book A3 (29.7 × 42 cm)", "72 pages", 270, "pcs", C.books],
];

/** List numbers with no stock at all (to show "Out of stock"). */
const OUT_OF_STOCK = new Set([22, 62, 110, 129]);
/** List numbers with only a little stock (to show "Low stock"). */
const LOW_STOCK = new Set([9, 27, 54, 73, 125]);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Opening quantity by unit, varied a little by list number so the numbers look real. */
function openingQty(no: number, unit: Unit): number {
  const spread = (no * 37) % 7; // 0–6
  switch (unit) {
    case "pcs":
      return 100 + spread * 50; // 100–400 pieces
    case "jar":
      return 3 + (spread % 4);
    default:
      return 20 + spread * 5; // 20–50 boxes / sets / packets
  }
}

function lowStockLevel(unit: Unit): number {
  return unit === "pcs" ? 50 : unit === "jar" ? 2 : 10;
}

/** Short colour codes for SKUs (DOMS-002-BLK). */
const COLOUR_CODES: Record<string, string> = {
  Black: "BLK", Blue: "BLU", Red: "RED", Green: "GRN", White: "WHT", Yellow: "YEL",
  "Light Green": "LGR", "Sap Green": "SGR", Orange: "ORG", Silver: "SLV", Golden: "GLD",
  Brown: "BRN", Pink: "PNK",
};

function buildItem(row: Row, variant?: string): SeedItem {
  const [no, name, packSize, mrp, unit, category] = row;
  const code = variant ? (COLOUR_CODES[variant] ?? variant.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()) : null;
  const sku = `DOMS-${String(no).padStart(3, "0")}${code ? `-${code}` : ""}`;
  const cost = round2(mrp * 0.7);
  const low = lowStockLevel(unit);
  let buys: SeedItem["buys"] = [["opening", openingQty(no, unit), cost]];
  if (OUT_OF_STOCK.has(no)) buys = [];
  else if (LOW_STOCK.has(no)) buys = [["opening", Math.max(1, Math.floor(low / 3)), cost]];
  else if (no % 4 === 0) buys.push(["second", Math.round(openingQty(no, unit) / 2), round2(mrp * 0.72)]);
  else if (no % 9 === 0) buys.push(["third", Math.round(openingQty(no, unit) / 3), round2(mrp * 0.71)]);
  else if (no % 11 === 0) buys.push(["latest", Math.round(openingQty(no, unit) / 4), round2(mrp * 0.72)]);

  return {
    sku,
    name,
    variant,
    brand: "DOMS",
    category,
    unit,
    packSize: packSize ?? undefined,
    mrp,
    sell: round2(mrp * 0.85),
    lowStock: low,
    buys,
  };
}

export const seedItems: SeedItem[] = rows.flatMap((row) => {
  const variants = row[6];
  return variants ? variants.map((v) => buildItem(row, v)) : [buildItem(row)];
});

/** The shops and schools you sell to ("Customers" in the app). Phone numbers are fictitious. */
export const seedVendors = [
  { businessName: "Sarkar Book Stall", contactPerson: "Biplab Sarkar", phone: "9436012345", city: "Agartala", address: "Battala Market" },
  { businessName: "Das Stationers", contactPerson: "Tapan Das", phone: "9436023456", city: "Agartala", address: "Post Office Chowmuhani" },
  { businessName: "Debnath Book House", contactPerson: "Sujit Debnath", phone: "9862034567", city: "Udaipur", address: "Rajarbag Road" },
  { businessName: "Saha Stationery", contactPerson: "Mitali Saha", phone: "9774045678", city: "Dharmanagar", address: "Station Road" },
  { businessName: "Chakraborty Stores", contactPerson: "Partha Chakraborty", phone: "9436056789", city: "Kailashahar", address: "Main Road" },
  { businessName: "Bhowmik Book Centre", contactPerson: "Ranjit Bhowmik", phone: "9862067890", city: "Belonia", address: "Court Road" },
  { businessName: "Roy Stationery Mart", contactPerson: "Ananya Roy", phone: "9774078901", city: "Khowai", address: "Bazar Road" },
  { businessName: "Paul Book Depot", contactPerson: "Swapan Paul", phone: "9436089012", city: "Ambassa", address: "Near Bus Stand" },
  { businessName: "Majumder Enterprises", contactPerson: "Sanjib Majumder", phone: "9862090123", city: "Teliamura", address: "Netaji Market" },
  { businessName: "Dey Stationers", contactPerson: "Kakali Dey", phone: "9774001234", city: "Sonamura", address: "College Road" },
  { businessName: "Nath Book Stall", contactPerson: "Pradip Nath", phone: "9436012340", city: "Bishalgarh", address: "Thana Road" },
  { businessName: "Acharjee Traders", contactPerson: "Gautam Acharjee", phone: "9862023450", city: "Kumarghat", address: "Station Bazar" },
  { businessName: "Ghosh Paper House", contactPerson: "Subrata Ghosh", phone: "9774034560", city: "Agartala", address: "Motor Stand Road" },
  { businessName: "Sen Stationery", contactPerson: "Rupa Sen", phone: "9436045670", city: "Sabroom", address: "Main Bazar" },
  { businessName: "Banik Book Corner", contactPerson: "Amit Banik", phone: "9862056780", city: "Amarpur", address: "School Road" },
] as const;

/**
 * Past orders, created through the real checkout (oldest first, mixed in with the stock bills).
 * [SKU, quantity]; prices are each item's usual selling price.
 */
export const seedOrders: {
  daysAgo: number;
  hour: number;
  customer: (typeof seedVendors)[number]["businessName"];
  by: "owner" | "ramesh" | "sunita";
  discount?: { kind: "AMOUNT" | "PERCENT"; value: number };
  lines: [string, number][];
}[] = [
  { daysAgo: 26, hour: 11, customer: "Sarkar Book Stall", by: "owner", lines: [["DOMS-013", 40], ["DOMS-002-BLU", 20], ["DOMS-121", 30]] },
  { daysAgo: 24, hour: 12, customer: "Das Stationers", by: "ramesh", lines: [["DOMS-003-BLK", 24], ["DOMS-003-BLU", 24], ["DOMS-094", 20]] },
  { daysAgo: 21, hour: 15, customer: "Debnath Book House", by: "sunita", discount: { kind: "PERCENT", value: 500 }, lines: [["DOMS-025", 4], ["DOMS-034", 3], ["DOMS-012", 30]] },
  { daysAgo: 19, hour: 10, customer: "Saha Stationery", by: "ramesh", lines: [["DOMS-100-BLU", 50], ["DOMS-100-BLK", 30], ["DOMS-085", 40]] },
  { daysAgo: 16, hour: 16, customer: "Ghosh Paper House", by: "owner", discount: { kind: "AMOUNT", value: 5000 }, lines: [["DOMS-124", 20], ["DOMS-005", 25]] },
  { daysAgo: 13, hour: 11, customer: "Chakraborty Stores", by: "sunita", lines: [["DOMS-002-BLK", 15], ["DOMS-002-RED", 10], ["DOMS-013", 20]] },
  { daysAgo: 11, hour: 13, customer: "Sarkar Book Stall", by: "ramesh", lines: [["DOMS-094", 15], ["DOMS-121", 20], ["DOMS-100-RED", 20]] },
  { daysAgo: 9, hour: 12, customer: "Roy Stationery Mart", by: "sunita", lines: [["DOMS-034", 2], ["DOMS-025", 3]] },
  { daysAgo: 6, hour: 17, customer: "Bhowmik Book Centre", by: "ramesh", lines: [["DOMS-003-RED", 12], ["DOMS-003-GRN", 12], ["DOMS-004-BLU", 6]] },
  { daysAgo: 4, hour: 10, customer: "Paul Book Depot", by: "owner", discount: { kind: "PERCENT", value: 1000 }, lines: [["DOMS-124", 15], ["DOMS-012", 25]] },
  { daysAgo: 3, hour: 14, customer: "Das Stationers", by: "sunita", lines: [["DOMS-085", 30], ["DOMS-005", 20]] },
  { daysAgo: 1, hour: 11, customer: "Majumder Enterprises", by: "ramesh", lines: [["DOMS-100-BLU", 40], ["DOMS-104-BLU", 40]] },
  { daysAgo: 0, hour: -2, customer: "Sarkar Book Stall", by: "ramesh", lines: [["DOMS-013", 30], ["DOMS-002-BLU", 10]] },
  { daysAgo: 0, hour: -1, customer: "Dey Stationers", by: "sunita", lines: [["DOMS-094", 10], ["DOMS-121", 25]] },
];

export const seedUsers = [
  { key: "owner", username: "owner", fullName: "Shop Owner", role: "ADMIN" },
  { key: "ramesh", username: "ramesh", fullName: "Ramesh Kumar", role: "STAFF" },
  { key: "sunita", username: "sunita", fullName: "Sunita Devi", role: "STAFF" },
] as const;
