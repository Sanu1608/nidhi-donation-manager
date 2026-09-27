const { Router } = require("../mini-http");
const db = require("../db");
const { findOr404 } = require("../helpers");

const router = Router();

function withNames(data, donation) {
  const donor = data.donors.find((d) => d.id === donation.donor_id);
  const campaign = data.campaigns.find((c) => c.id === donation.campaign_id);
  return {
    ...donation,
    donor_name: donor ? donor.name : "Unknown donor",
    campaign_title: campaign ? campaign.title : "Unknown campaign"
  };
}

// GET /api/donations — full donation ledger, newest first
router.get("/", (req, res) => {
  const data = db.load();
  const list = [...data.donations].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => withNames(data, d));
  res.json(list);
});

// GET /api/donations/:id
router.get("/:id", (req, res) => {
  const data = db.load();
  const donation = findOr404(res, data.donations, Number(req.params.id), "Donation");
  if (!donation) return;
  res.json(withNames(data, donation));
});

// POST /api/donations — record a new donation.
// Side effects (deliberate, mirrors the real business process):
//   1. A sequential receipt number is issued.
//   2. A "Thank You" communication is auto-logged for the donor.
// The campaign's raised amount is NOT stored here — it is always derived
// live from this donation ledger (see helpers.enrichCampaign).
router.post("/", (req, res) => {
  const { donor_id, campaign_id, amount, date, payment_mode, notes } = req.body;
  if (!donor_id || !campaign_id || !amount || !date || !payment_mode) {
    return res.status(400).json({ error: "donor_id, campaign_id, amount, date and payment_mode are required" });
  }
  const data = db.load();
  const donor = findOr404(res, data.donors, Number(donor_id), "Donor");
  if (!donor) return;
  const campaign = findOr404(res, data.campaigns, Number(campaign_id), "Campaign");
  if (!campaign) return;
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than zero" });
  }

  const donation = {
    id: db.nextId(data, "donation"),
    donor_id: Number(donor_id),
    campaign_id: Number(campaign_id),
    amount: Number(amount),
    date,
    payment_mode,
    receipt_no: db.nextReceiptNo(data),
    notes: notes || ""
  };
  data.donations.push(donation);

  const communication = {
    id: db.nextId(data, "communication"),
    donor_id: donor.id,
    type: "Thank You",
    subject: "Thank you for your donation",
    message: `Dear ${donor.name}, thank you for your generous contribution of \u20b9${donation.amount} towards ${campaign.title}. Your receipt number is ${donation.receipt_no}.`,
    date: donation.date,
    donation_id: donation.id
  };
  data.communications.push(communication);

  // If a campaign has just reached or passed its goal, mark it Completed
  const raisedNow = data.donations.filter((d) => d.campaign_id === campaign.id).reduce((s, d) => s + d.amount, 0);
  if (raisedNow >= campaign.goal_amount && campaign.status === "Active") {
    campaign.status = "Completed";
  }

  db.save(data);
  res.status(201).json(withNames(data, donation));
});

// GET /api/donations/:id/receipt — printable HTML receipt (opens in a new
// tab; the user can Ctrl/Cmd+P to save as PDF for the donor).
router.get("/:id/receipt", (req, res) => {
  const data = db.load();
  const donation = findOr404(res, data.donations, Number(req.params.id), "Donation");
  if (!donation) return;
  const donor = data.donors.find((d) => d.id === donation.donor_id);
  const campaign = data.campaigns.find((c) => c.id === donation.campaign_id);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt ${donation.receipt_no}</title>
<style>
  body { font-family: 'Georgia', serif; max-width: 640px; margin: 48px auto; color: #16233D; }
  .receipt { border: 1px solid #DEDAD0; padding: 40px; }
  h1 { font-size: 22px; letter-spacing: 0.02em; margin: 0 0 4px; }
  .muted { color: #5B6472; font-size: 13px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  td { padding: 10px 0; border-bottom: 1px solid #EFEBE3; font-size: 15px; }
  td.label { color: #5B6472; width: 40%; }
  .amount { font-size: 28px; font-weight: bold; color: #3E6E58; margin: 20px 0; }
  .footer { margin-top: 32px; font-size: 12px; color: #5B6472; }
  button { margin-top: 24px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <div class="receipt">
    <h1>Donation Receipt</h1>
    <div class="muted">Nidhi — Donation &amp; Charity Management</div>
    <table>
      <tr><td class="label">Receipt No.</td><td>${donation.receipt_no}</td></tr>
      <tr><td class="label">Date</td><td>${donation.date}</td></tr>
      <tr><td class="label">Donor</td><td>${donor ? donor.name : "-"}</td></tr>
      <tr><td class="label">PAN</td><td>${donor && donor.pan ? donor.pan : "-"}</td></tr>
      <tr><td class="label">Campaign</td><td>${campaign ? campaign.title : "-"}</td></tr>
      <tr><td class="label">Payment mode</td><td>${donation.payment_mode}</td></tr>
    </table>
    <div class="amount">&#8377;${donation.amount.toLocaleString("en-IN")}</div>
    <div class="footer">This receipt confirms that the above contribution has been received. Thank you for supporting this cause.</div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

module.exports = router;
