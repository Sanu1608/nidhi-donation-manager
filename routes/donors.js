const { Router } = require("../mini-http");
const db = require("../db");
const { enrichDonor, findOr404 } = require("../helpers");

const router = Router();

// GET /api/donors — list all donors with computed lifetime totals
router.get("/", (req, res) => {
  const data = db.load();
  const donors = data.donors.map((d) => enrichDonor(data, d));
  res.json(donors);
});

// GET /api/donors/:id
router.get("/:id", (req, res) => {
  const data = db.load();
  const donor = findOr404(res, data.donors, Number(req.params.id), "Donor");
  if (!donor) return;
  res.json(enrichDonor(data, donor));
});

// POST /api/donors — register a new donor
router.post("/", (req, res) => {
  const { name, type, email, phone, address, pan } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: "name and type are required" });
  }
  const data = db.load();
  const donor = {
    id: db.nextId(data, "donor"),
    name,
    type, // "Individual" | "Organization"
    email: email || "",
    phone: phone || "",
    address: address || "",
    pan: pan || "",
    created_at: new Date().toISOString().slice(0, 10)
  };
  data.donors.push(donor);
  db.save(data);
  res.status(201).json(enrichDonor(data, donor));
});

// PUT /api/donors/:id — update donor profile
router.put("/:id", (req, res) => {
  const data = db.load();
  const donor = findOr404(res, data.donors, Number(req.params.id), "Donor");
  if (!donor) return;
  const { name, type, email, phone, address, pan } = req.body;
  if (name !== undefined) donor.name = name;
  if (type !== undefined) donor.type = type;
  if (email !== undefined) donor.email = email;
  if (phone !== undefined) donor.phone = phone;
  if (address !== undefined) donor.address = address;
  if (pan !== undefined) donor.pan = pan;
  db.save(data);
  res.json(enrichDonor(data, donor));
});

// DELETE /api/donors/:id — only allowed when donor has no donation history,
// to keep the donation ledger and receipts trail intact.
router.delete("/:id", (req, res) => {
  const data = db.load();
  const id = Number(req.params.id);
  const donor = findOr404(res, data.donors, id, "Donor");
  if (!donor) return;
  const hasDonations = data.donations.some((d) => d.donor_id === id);
  if (hasDonations) {
    return res.status(409).json({ error: "Cannot delete a donor with recorded donations. Their giving history must be preserved." });
  }
  data.donors = data.donors.filter((d) => d.id !== id);
  db.save(data);
  res.status(204).end();
});

module.exports = router;
