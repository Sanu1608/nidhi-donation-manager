// db.js
// Tiny file-based persistence layer. No external database is required —
// this keeps the app trivial to run anywhere (just `npm install && npm start`)
// which matters for a live demo on a laptop that may not have MySQL/Postgres
// installed. All reads/writes go through load()/save() so there is a single
// source of truth and every route stays simple.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

function seedData() {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return iso(d);
  };
  const daysFromNow = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  return {
    meta: { receiptSeq: 4, nextIds: { donor: 5, campaign: 4, donation: 4, utilization: 3, communication: 5 } },
    donors: [
      { id: 1, name: "Ananya Rao", type: "Individual", email: "ananya.rao@example.com", phone: "9820011223", address: "Pune, MH", pan: "ABCDE1234F", created_at: daysAgo(40) },
      { id: 2, name: "Vikram Shah", type: "Individual", email: "vikram.shah@example.com", phone: "9911002233", address: "Pimpri, MH", pan: "PQRSX5678K", created_at: daysAgo(35) },
      { id: 3, name: "Bright Minds Foundation", type: "Organization", email: "contact@brightminds.org", phone: "02066011234", address: "Mumbai, MH", pan: "AAFCB1234Q", created_at: daysAgo(30) },
      { id: 4, name: "Rohan Deshpande", type: "Individual", email: "rohan.d@example.com", phone: "9833445566", address: "Pune, MH", pan: "", created_at: daysAgo(12) }
    ],
    campaigns: [
      {
        id: 1, title: "Campus Winter Relief Drive 2026", category: "Community Welfare",
        description: "Winter essentials — blankets, warm clothing and hot meals — for families near the campus.",
        goal_amount: 200000, start_date: daysAgo(25), end_date: daysFromNow(20), status: "Active"
      },
      {
        id: 2, title: "Library for Rural School", category: "Education",
        description: "Setting up a reading corner with books and furniture at a partner rural school.",
        goal_amount: 120000, start_date: daysAgo(60), end_date: daysAgo(5), status: "Completed"
      },
      {
        id: 3, title: "Student Emergency Medical Fund", category: "Healthcare",
        description: "A standing fund to help students cover unexpected medical expenses.",
        goal_amount: 150000, start_date: daysAgo(10), end_date: daysFromNow(80), status: "Active"
      }
    ],
    donations: [
      { id: 1, donor_id: 1, campaign_id: 1, amount: 5000, date: daysAgo(20), payment_mode: "UPI", receipt_no: "REC-2026-0001", notes: "" },
      { id: 2, donor_id: 3, campaign_id: 1, amount: 25000, date: daysAgo(15), payment_mode: "Bank Transfer", receipt_no: "REC-2026-0002", notes: "Quarterly CSR contribution" },
      { id: 3, donor_id: 2, campaign_id: 2, amount: 15000, date: daysAgo(50), payment_mode: "Cheque", receipt_no: "REC-2026-0003", notes: "" }
    ],
    utilizations: [
      { id: 1, campaign_id: 2, amount: 40000, category: "Books & Furniture", description: "Purchased 300 books and 10 reading tables", date: daysAgo(20) },
      { id: 2, campaign_id: 1, amount: 8000, category: "Blankets", description: "120 blankets distributed at Sector 7 relief camp", date: daysAgo(10) }
    ],
    communications: [
      { id: 1, donor_id: 1, type: "Thank You", subject: "Thank you for your donation", message: "Dear Ananya Rao, thank you for your generous contribution of ₹5000 towards Campus Winter Relief Drive 2026.", date: daysAgo(20), donation_id: 1 },
      { id: 2, donor_id: 3, type: "Thank You", subject: "Thank you for your donation", message: "Dear Bright Minds Foundation, thank you for your generous contribution of ₹25000 towards Campus Winter Relief Drive 2026.", date: daysAgo(15), donation_id: 2 },
      { id: 3, donor_id: 2, type: "Thank You", subject: "Thank you for your donation", message: "Dear Vikram Shah, thank you for your generous contribution of ₹15000 towards Library for Rural School.", date: daysAgo(50), donation_id: 3 },
      { id: 4, donor_id: 3, type: "Update", subject: "Winter Drive — halfway update", message: "We have reached 15% of our goal and started distributing blankets. Thank you for making this possible.", date: daysAgo(9), donation_id: null }
    ]
  };
}

function ensureFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(seedData(), null, 2));
  }
}

function load() {
  ensureFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function nextId(data, collection) {
  const id = data.meta.nextIds[collection];
  data.meta.nextIds[collection] = id + 1;
  return id;
}

function nextReceiptNo(data) {
  const seq = data.meta.receiptSeq;
  data.meta.receiptSeq = seq + 1;
  const year = new Date().getFullYear();
  return `REC-${year}-${String(seq).padStart(4, "0")}`;
}

function resetToSeed() {
  save(seedData());
}

module.exports = { load, save, nextId, nextReceiptNo, resetToSeed, DB_PATH };
