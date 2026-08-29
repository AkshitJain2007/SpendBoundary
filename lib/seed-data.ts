// Synthetic Demo Seed Data for SpendBoundary (Zero real financial data)

export interface SeedProduct {
  id: string;
  name: string;
  category: string;
  pricePaise: number;
  stock: number;
  allowed: boolean;
  description: string;
}

export interface SeedPolicy {
  id: string;
  merchantId: string;
  maxOrderPaise: number;
  dailyLimitPaise: number;
  velocityCount: number;
  velocityWindowSeconds: number;
  allowedCategories: string[];
  approvalThresholdPaise: number;
  version: string;
}

export const DEMO_PRODUCTS: SeedProduct[] = [
  {
    id: "prod_notebook",
    name: "Executive Hardcover Notebook",
    category: "Office Supplies",
    pricePaise: 35000, // ₹350
    stock: 50,
    allowed: true,
    description: "Premium A5 dot-grid notebook with 120gsm fountain-pen friendly paper.",
  },
  {
    id: "prod_pen_set",
    name: "Archival Gel Pen Set (Pack of 5)",
    category: "Office Supplies",
    pricePaise: 15000, // ₹150
    stock: 100,
    allowed: true,
    description: "0.5mm precision black gel pens for smudge-free office notes.",
  },
  {
    id: "prod_usb_cable",
    name: "Braided 100W USB-C Cable (2m)",
    category: "Electronics",
    pricePaise: 49900, // ₹499
    stock: 40,
    allowed: true,
    description: "Durable braided nylon high-speed charging and 480Mbps data cable.",
  },
  {
    id: "prod_desk_lamp",
    name: "Smart Dimmable LED Desk Lamp",
    category: "Home Office",
    pricePaise: 150000, // ₹1,500 (Triggers REVIEW since > ₹1,000 threshold)
    stock: 25,
    allowed: true,
    description: "Touch-controlled adjustable color temperature desk light with wireless charging base.",
  },
  {
    id: "prod_chair",
    name: "Ergonomic Mesh Task Chair",
    category: "Furniture",
    pricePaise: 800000, // ₹8,000 (Triggers DENY since > ₹2,000 max order limit)
    stock: 10,
    allowed: true,
    description: "High-back lumbar support office chair with 3D armrests.",
  },
  {
    id: "prod_crypto_miner",
    name: "USB Hardware Mining Key",
    category: "Restricted",
    pricePaise: 500000, // ₹5,000 (Triggers DENY since allowed: false & category restricted)
    stock: 5,
    allowed: false,
    description: "Restricted hardware device. Blocked by merchant store policy.",
  },
];

export const DEMO_POLICY: SeedPolicy = {
  id: "policy_default",
  merchantId: "merchant_apex_01",
  maxOrderPaise: 200000,       // ₹2,000 maximum single transaction
  dailyLimitPaise: 500000,     // ₹5,000 maximum cumulative daily spend
  velocityCount: 3,            // Max 3 purchase requests
  velocityWindowSeconds: 60,   // Within 60 seconds
  allowedCategories: ["Office Supplies", "Electronics", "Home Office", "Furniture"],
  approvalThresholdPaise: 100000, // Orders over ₹1,000 require human review
  version: "v1.0",
};

export const DEMO_MERCHANT = {
  id: "merchant_apex_01",
  name: "Apex Supplies Ltd",
  currency: "INR",
  mode: "DEMO / TEST",
};

export const DEMO_AGENT = {
  id: "agent_buyer_01",
  name: "Autonomous Purchasing Agent (ProcureBot)",
  role: "Office Supplies Buyer",
  status: "ACTIVE",
};
