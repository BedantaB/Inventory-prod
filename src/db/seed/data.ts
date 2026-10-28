/** Sample data for a grocery/FMCG wholesaler. Money here is in RUPEES for readability. */

export const seedCategories = [
  "Rice & Grains",
  "Dal & Pulses",
  "Atta & Flour",
  "Edible Oil & Ghee",
  "Masala & Spices",
  "Sugar, Salt & Gur",
  "Tea & Coffee",
  "Biscuits & Namkeen",
  "Soap & Detergent",
  "Household",
] as const;

type Category = (typeof seedCategories)[number];
type Unit = "pcs" | "box" | "kg" | "litre" | "dozen" | "bundle";

/** Stock-in bills, oldest first. `daysAgo` backdates them so history and dashboard look lived-in. */
export const seedStockEntries = [
  { key: "opening", reference: "INV-4521", note: "Opening stock", daysAgo: 28, by: "owner" },
  { key: "second", reference: "BILL-8834", note: "Agarwal Wholesale, Delhi", daysAgo: 15, by: "ramesh" },
  { key: "third", reference: "GR-1102", note: "Local mandi purchase", daysAgo: 7, by: "sunita" },
  { key: "latest", reference: "BILL-9015", note: "Agarwal Wholesale, Delhi", daysAgo: 2, by: "ramesh" },
] as const;

type EntryKey = (typeof seedStockEntries)[number]["key"];

export type SeedItem = {
  sku: string;
  name: string;
  category: Category;
  unit: Unit;
  packSize?: string;
  sell: number;
  lowStock: number;
  /** [stock entry, quantity, cost per unit in ₹] */
  buys: [EntryKey, number, number][];
};

export const seedItems: SeedItem[] = [
  // Rice & Grains
  { sku: "RICE-BAS-25", name: "Basmati Rice Premium", category: "Rice & Grains", unit: "pcs", packSize: "25 kg bag", sell: 2450, lowStock: 10, buys: [["opening", 40, 2150], ["second", 30, 2190]] },
  { sku: "RICE-SON-26", name: "Sona Masoori Rice", category: "Rice & Grains", unit: "pcs", packSize: "26 kg bag", sell: 1550, lowStock: 10, buys: [["opening", 35, 1380]] },
  { sku: "RICE-KOL", name: "Kolam Rice (loose)", category: "Rice & Grains", unit: "kg", sell: 52, lowStock: 100, buys: [["opening", 500, 46], ["third", 250, 47.5]] },
  { sku: "POHA-1", name: "Poha Thick 1 kg", category: "Rice & Grains", unit: "pcs", packSize: "1 kg packet", sell: 62, lowStock: 30, buys: [["opening", 120, 54]] },
  { sku: "DALIA-500", name: "Daliya 500 g", category: "Rice & Grains", unit: "pcs", packSize: "500 g packet", sell: 38, lowStock: 24, buys: [["opening", 18, 32]] },

  // Dal & Pulses (sold loose by kg)
  { sku: "DAL-TOOR", name: "Toor Dal", category: "Dal & Pulses", unit: "kg", sell: 165, lowStock: 50, buys: [["opening", 300, 148], ["second", 200, 152.5]] },
  { sku: "DAL-CHANA", name: "Chana Dal", category: "Dal & Pulses", unit: "kg", sell: 92, lowStock: 50, buys: [["opening", 250, 82]] },
  { sku: "DAL-MOONG", name: "Moong Dal (Yellow)", category: "Dal & Pulses", unit: "kg", sell: 125, lowStock: 40, buys: [["opening", 180, 110], ["latest", 100, 114]] },
  { sku: "DAL-MASOOR", name: "Masoor Dal", category: "Dal & Pulses", unit: "kg", sell: 98, lowStock: 40, buys: [["opening", 150, 86]] },
  { sku: "DAL-URAD", name: "Urad Dal (Dhuli)", category: "Dal & Pulses", unit: "kg", sell: 135, lowStock: 40, buys: [["opening", 32.5, 120]] },
  { sku: "KABULI", name: "Kabuli Chana", category: "Dal & Pulses", unit: "kg", sell: 140, lowStock: 30, buys: [["opening", 120, 124]] },
  { sku: "RAJMA", name: "Rajma Chitra", category: "Dal & Pulses", unit: "kg", sell: 150, lowStock: 30, buys: [["second", 90, 132]] },

  // Atta & Flour
  { sku: "ATTA-10", name: "Chakki Atta", category: "Atta & Flour", unit: "pcs", packSize: "10 kg bag", sell: 450, lowStock: 20, buys: [["opening", 80, 405], ["third", 40, 398]] },
  { sku: "MAIDA-50", name: "Maida", category: "Atta & Flour", unit: "pcs", packSize: "50 kg bag", sell: 1950, lowStock: 5, buys: [["opening", 12, 1780]] },
  { sku: "BESAN-1", name: "Besan 1 kg", category: "Atta & Flour", unit: "pcs", packSize: "1 kg packet", sell: 105, lowStock: 24, buys: [["opening", 96, 92]] },
  { sku: "SOOJI-1", name: "Sooji (Rava) 1 kg", category: "Atta & Flour", unit: "pcs", packSize: "1 kg packet", sell: 52, lowStock: 24, buys: [["opening", 60, 45]] },

  // Edible Oil & Ghee
  { sku: "OIL-MUS-1", name: "Kachi Ghani Mustard Oil 1 L", category: "Edible Oil & Ghee", unit: "pcs", packSize: "1 L bottle", sell: 175, lowStock: 24, buys: [["opening", 120, 158], ["latest", 60, 161]] },
  { sku: "OIL-SOY-15", name: "Refined Soyabean Oil", category: "Edible Oil & Ghee", unit: "pcs", packSize: "15 L tin", sell: 1950, lowStock: 5, buys: [["opening", 25, 1810]] },
  { sku: "OIL-GNUT-5", name: "Groundnut Oil", category: "Edible Oil & Ghee", unit: "pcs", packSize: "5 L can", sell: 1050, lowStock: 6, buys: [["opening", 20, 960]] },
  { sku: "OIL-SUN", name: "Sunflower Oil (loose)", category: "Edible Oil & Ghee", unit: "litre", sell: 140, lowStock: 30, buys: [["opening", 150, 128], ["third", 75.5, 131]] },
  { sku: "GHEE-1", name: "Desi Ghee 1 L", category: "Edible Oil & Ghee", unit: "pcs", packSize: "1 L tin", sell: 640, lowStock: 12, buys: [["opening", 48, 585]] },

  // Masala & Spices
  { sku: "HALDI-500", name: "Haldi Powder 500 g", category: "Masala & Spices", unit: "pcs", packSize: "500 g packet", sell: 120, lowStock: 24, buys: [["opening", 72, 98]] },
  { sku: "MIRCH-500", name: "Lal Mirch Powder 500 g", category: "Masala & Spices", unit: "pcs", packSize: "500 g packet", sell: 160, lowStock: 24, buys: [["opening", 72, 135]] },
  { sku: "DHANIYA-500", name: "Dhaniya Powder 500 g", category: "Masala & Spices", unit: "pcs", packSize: "500 g packet", sell: 95, lowStock: 24, buys: [["opening", 60, 78]] },
  { sku: "JEERA", name: "Jeera (Whole)", category: "Masala & Spices", unit: "kg", sell: 520, lowStock: 10, buys: [["opening", 25, 470], ["latest", 15, 489]] },
  { sku: "GARAM-100", name: "Garam Masala 100 g", category: "Masala & Spices", unit: "pcs", packSize: "100 g box", sell: 75, lowStock: 24, buys: [["opening", 96, 60]] },
  { sku: "RAI-1", name: "Rai (Mustard Seeds) 1 kg", category: "Masala & Spices", unit: "pcs", packSize: "1 kg packet", sell: 95, lowStock: 12, buys: [["opening", 30, 82]] },
  { sku: "HING-50", name: "Hing 50 g", category: "Masala & Spices", unit: "dozen", packSize: "12 × 50 g", sell: 1080, lowStock: 2, buys: [["opening", 6, 864]] },
  { sku: "KALI-MIRCH", name: "Kali Mirch (Black Pepper)", category: "Masala & Spices", unit: "kg", sell: 780, lowStock: 5, buys: [["opening", 3.5, 700]] },
  { sku: "ELAICHI", name: "Elaichi (Green Cardamom)", category: "Masala & Spices", unit: "kg", sell: 2900, lowStock: 2, buys: [] },

  // Sugar, Salt & Gur
  { sku: "SUGAR-LOOSE", name: "Sugar (loose)", category: "Sugar, Salt & Gur", unit: "kg", sell: 46, lowStock: 200, buys: [["opening", 600, 42]] },
  { sku: "SUGAR-50", name: "Sugar", category: "Sugar, Salt & Gur", unit: "pcs", packSize: "50 kg bag", sell: 2250, lowStock: 10, buys: [["opening", 30, 2080], ["second", 20, 2105]] },
  { sku: "SALT-1-B25", name: "Iodised Salt 1 kg", category: "Sugar, Salt & Gur", unit: "bundle", packSize: "25 × 1 kg", sell: 525, lowStock: 4, buys: [["opening", 20, 470]] },
  { sku: "SENDHA-1", name: "Sendha Namak 1 kg", category: "Sugar, Salt & Gur", unit: "pcs", packSize: "1 kg packet", sell: 70, lowStock: 12, buys: [["opening", 40, 58]] },
  { sku: "GUR", name: "Gur (Jaggery)", category: "Sugar, Salt & Gur", unit: "kg", sell: 62, lowStock: 25, buys: [["third", 80, 54]] },

  // Tea & Coffee
  { sku: "TEA-CTC-1", name: "CTC Tea 1 kg", category: "Tea & Coffee", unit: "pcs", packSize: "1 kg packet", sell: 420, lowStock: 12, buys: [["opening", 50, 375]] },
  { sku: "TEA-250-DZ", name: "Tea 250 g", category: "Tea & Coffee", unit: "dozen", packSize: "12 × 250 g", sell: 1260, lowStock: 3, buys: [["opening", 10, 1140]] },
  { sku: "COFFEE-100", name: "Instant Coffee 100 g Jar", category: "Tea & Coffee", unit: "pcs", packSize: "100 g jar", sell: 330, lowStock: 12, buys: [["opening", 8, 295]] },

  // Biscuits & Namkeen
  { sku: "BISC-GLU-48", name: "Glucose Biscuits", category: "Biscuits & Namkeen", unit: "box", packSize: "48 packets", sell: 480, lowStock: 5, buys: [["opening", 30, 432], ["latest", 20, 436]] },
  { sku: "BISC-CRM-24", name: "Cream Biscuits", category: "Biscuits & Namkeen", unit: "box", packSize: "24 packets", sell: 576, lowStock: 4, buys: [["opening", 15, 520]] },
  { sku: "BHUJIA-1", name: "Aloo Bhujia 1 kg", category: "Biscuits & Namkeen", unit: "pcs", packSize: "1 kg packet", sell: 260, lowStock: 12, buys: [["opening", 36, 228]] },
  { sku: "MIXTURE-DZ", name: "Namkeen Mixture 400 g", category: "Biscuits & Namkeen", unit: "dozen", packSize: "12 × 400 g", sell: 1080, lowStock: 3, buys: [["second", 12, 960]] },
  { sku: "RUSK-DZ", name: "Elaichi Rusk 300 g", category: "Biscuits & Namkeen", unit: "dozen", packSize: "12 × 300 g", sell: 600, lowStock: 3, buys: [["opening", 2, 528]] },

  // Soap & Detergent
  { sku: "DET-PWD-1", name: "Detergent Powder 1 kg", category: "Soap & Detergent", unit: "pcs", packSize: "1 kg packet", sell: 95, lowStock: 24, buys: [["opening", 120, 82]] },
  { sku: "DET-BAR-40", name: "Detergent Bar 250 g", category: "Soap & Detergent", unit: "box", packSize: "40 bars", sell: 980, lowStock: 3, buys: [["opening", 15, 880]] },
  { sku: "SOAP-BATH-DZ", name: "Bathing Soap 100 g", category: "Soap & Detergent", unit: "dozen", packSize: "12 bars", sell: 420, lowStock: 5, buys: [["opening", 25, 372]] },
  { sku: "DISHWASH-DZ", name: "Dishwash Bar 500 g", category: "Soap & Detergent", unit: "dozen", packSize: "12 bars", sell: 540, lowStock: 4, buys: [["opening", 18, 480]] },
  { sku: "PHENYL-5", name: "Phenyl Floor Cleaner", category: "Soap & Detergent", unit: "pcs", packSize: "5 L can", sell: 390, lowStock: 6, buys: [["third", 15, 330]] },

  // Household
  { sku: "AGARBATTI-DZ", name: "Agarbatti (Rose)", category: "Household", unit: "dozen", packSize: "12 packets", sell: 300, lowStock: 5, buys: [["opening", 40, 252]] },
  { sku: "MATCH-BDL", name: "Matchbox", category: "Household", unit: "bundle", packSize: "10 packs × 10 boxes", sell: 100, lowStock: 10, buys: [["opening", 60, 86]] },
  { sku: "CANDLE-BOX", name: "White Candles", category: "Household", unit: "box", packSize: "6 candles", sell: 120, lowStock: 10, buys: [["opening", 40, 100]] },
  { sku: "JHADU", name: "Jhadu (Grass Broom)", category: "Household", unit: "pcs", sell: 120, lowStock: 10, buys: [["second", 30, 95]] },
  { sku: "FOIL-9M", name: "Aluminium Foil 9 m", category: "Household", unit: "pcs", packSize: "9 m roll", sell: 85, lowStock: 12, buys: [["opening", 5, 70]] },
  { sku: "GARBAGE-BDL", name: "Garbage Bags (Medium)", category: "Household", unit: "bundle", packSize: "10 rolls", sell: 180, lowStock: 5, buys: [] },
];

/** The businesses you sell to ("Customers" in the app). Phone numbers are fictitious. */
export const seedVendors = [
  { businessName: "Sharma Kirana Store", contactPerson: "Rajesh Sharma", phone: "9829012345", city: "Jaipur", address: "12, Johari Bazaar" },
  { businessName: "Gupta General Stores", contactPerson: "Anil Gupta", phone: "9415023456", city: "Lucknow", address: "45, Aminabad Market" },
  { businessName: "Patel Provision Mart", contactPerson: "Hiren Patel", phone: "9825034567", city: "Ahmedabad", address: "7, Maninagar Char Rasta" },
  { businessName: "Sri Lakshmi Traders", contactPerson: "K. Srinivas", phone: "9848045678", city: "Hyderabad", address: "3-4-112, Kachiguda" },
  { businessName: "Murugan Stores", contactPerson: "S. Murugan", phone: "9840056789", city: "Chennai", address: "22, Ranganathan Street, T. Nagar" },
  { businessName: "Das Brothers", contactPerson: "Subhash Das", phone: "9830067890", city: "Kolkata", address: "18, Burrabazar" },
  { businessName: "Joshi Super Mart", contactPerson: "Meera Joshi", phone: "9822078901", city: "Pune", address: "Shop 4, Kothrud Depot" },
  { businessName: "Singh Departmental Store", contactPerson: "Harpreet Singh", phone: "9814089012", city: "Ludhiana", address: "Ghumar Mandi" },
  { businessName: "Reddy Wholesale", contactPerson: "Venkata Reddy", phone: "9849090123", city: "Vijayawada", address: "Wholesale Market, One Town" },
  { businessName: "Khan Kirana", contactPerson: "Imran Khan", phone: "9826001234", city: "Bhopal", address: "Ibrahimpura, Old City" },
  { businessName: "Bora Enterprises", contactPerson: "Pranjal Bora", phone: "9864012345", city: "Guwahati", address: "Fancy Bazaar" },
  { businessName: "Nair Stores", contactPerson: "Suresh Nair", phone: "9847023456", city: "Kochi", address: "Broadway, Ernakulam" },
  { businessName: "Agarwal Traders", contactPerson: "Pankaj Agarwal", phone: "9336034567", city: "Kanpur", address: "Collectorganj" },
  { businessName: "Deshmukh Provisions", contactPerson: "Sanjay Deshmukh", phone: "9823045678", city: "Nagpur", address: "Itwari Market" },
  { businessName: "Mehta & Sons", contactPerson: "Kunal Mehta", phone: "9824056789", city: "Surat", address: "Ring Road, Textile Market" },
] as const;

export const seedUsers = [
  { key: "owner", username: "owner", fullName: "Shop Owner", role: "ADMIN" },
  { key: "ramesh", username: "ramesh", fullName: "Ramesh Kumar", role: "STAFF" },
  { key: "sunita", username: "sunita", fullName: "Sunita Devi", role: "STAFF" },
] as const;
