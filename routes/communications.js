const { Router } = require("../mini-http");
const db = require("../db");
const { findOr404 } = require("../helpers");

const router = Router();

function withNames(data, c) {
  const donor = data.donors.find((d) => d.id === c.donor_id);
  return { ...c, donor_name: donor ? donor.name : "Unknown donor" };
}

// GET /api/communications — full log, newest first. Optional ?donor_id= filter.
router.get("/", (req, res) => {
  const data = db.load();
  let list = data.communications;
  if (req.query.donor_id) {
    list = list.filter((c) => c.donor_id === Number(req.query.donor_id));
  }
  list = [...list].sort((a, b) => (a.date < b.date ? 1 : -1)).map((c) => withNames(data, c));
  res.json(list);
});

// POST /api/communications — log an outbound message to a donor
// (e.g. a campaign update or an appeal). Thank-you notes for donations are
// created automatically when a donation is recorded (see routes/donations.js).
router.post("/", (req, res) => {
  const { donor_id, type, subject, message, date } = req.body;
  if (!donor_id || !type || !subject || !message || !date) {
    return res.status(400).json({ error: "donor_id, type, subject, message and date are required" });
  }
  const data = db.load();
  const donor = findOr404(res, data.donors, Number(donor_id), "Donor");
  if (!donor) return;

  const communication = {
    id: db.nextId(data, "communication"),
    donor_id: Number(donor_id),
    type,
    subject,
    message,
    date,
    donation_id: null
  };
  data.communications.push(communication);
  db.save(data);
  res.status(201).json(withNames(data, communication));
});

module.exports = router;
