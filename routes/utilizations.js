const { Router } = require("../mini-http");
const db = require("../db");
const { findOr404, campaignRaised, campaignUtilized } = require("../helpers");

const router = Router();

function withNames(data, u) {
  const campaign = data.campaigns.find((c) => c.id === u.campaign_id);
  return { ...u, campaign_title: campaign ? campaign.title : "Unknown campaign" };
}

// GET /api/utilizations — how raised funds have actually been spent
router.get("/", (req, res) => {
  const data = db.load();
  const list = [...data.utilizations].sort((a, b) => (a.date < b.date ? 1 : -1)).map((u) => withNames(data, u));
  res.json(list);
});

// POST /api/utilizations — log an expense against a campaign.
// We warn (via a flag in the response) rather than block when an
// organization records utilization beyond what has actually been raised —
// that situation happens in practice (e.g. bridge funding) and should be
// visible, not silently disallowed.
router.post("/", (req, res) => {
  const { campaign_id, amount, category, description, date } = req.body;
  if (!campaign_id || !amount || !date) {
    return res.status(400).json({ error: "campaign_id, amount and date are required" });
  }
  const data = db.load();
  const campaign = findOr404(res, data.campaigns, Number(campaign_id), "Campaign");
  if (!campaign) return;
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than zero" });
  }

  const utilization = {
    id: db.nextId(data, "utilization"),
    campaign_id: Number(campaign_id),
    amount: Number(amount),
    category: category || "General",
    description: description || "",
    date
  };
  data.utilizations.push(utilization);
  db.save(data);

  const raised = campaignRaised(data, campaign.id);
  const utilized = campaignUtilized(data, campaign.id);
  res.status(201).json({ ...withNames(data, utilization), over_budget: utilized > raised });
});

module.exports = router;
