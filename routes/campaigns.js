const { Router } = require("../mini-http");
const db = require("../db");
const { enrichCampaign, findOr404 } = require("../helpers");

const router = Router();

// GET /api/campaigns
router.get("/", (req, res) => {
  const data = db.load();
  const campaigns = data.campaigns.map((c) => enrichCampaign(data, c));
  res.json(campaigns);
});

// GET /api/campaigns/:id
router.get("/:id", (req, res) => {
  const data = db.load();
  const campaign = findOr404(res, data.campaigns, Number(req.params.id), "Campaign");
  if (!campaign) return;
  res.json(enrichCampaign(data, campaign));
});

// POST /api/campaigns
router.post("/", (req, res) => {
  const { title, category, description, goal_amount, start_date, end_date } = req.body;
  if (!title || !goal_amount || !start_date || !end_date) {
    return res.status(400).json({ error: "title, goal_amount, start_date and end_date are required" });
  }
  const data = db.load();
  const campaign = {
    id: db.nextId(data, "campaign"),
    title,
    category: category || "General",
    description: description || "",
    goal_amount: Number(goal_amount),
    start_date,
    end_date,
    status: "Active"
  };
  data.campaigns.push(campaign);
  db.save(data);
  res.status(201).json(enrichCampaign(data, campaign));
});

// PUT /api/campaigns/:id — edit details or change status (Active/Closed/Completed/Draft)
router.put("/:id", (req, res) => {
  const data = db.load();
  const campaign = findOr404(res, data.campaigns, Number(req.params.id), "Campaign");
  if (!campaign) return;
  const { title, category, description, goal_amount, start_date, end_date, status } = req.body;
  if (title !== undefined) campaign.title = title;
  if (category !== undefined) campaign.category = category;
  if (description !== undefined) campaign.description = description;
  if (goal_amount !== undefined) campaign.goal_amount = Number(goal_amount);
  if (start_date !== undefined) campaign.start_date = start_date;
  if (end_date !== undefined) campaign.end_date = end_date;
  if (status !== undefined) campaign.status = status;
  db.save(data);
  res.json(enrichCampaign(data, campaign));
});

// DELETE /api/campaigns/:id — blocked once donations exist against it
router.delete("/:id", (req, res) => {
  const data = db.load();
  const id = Number(req.params.id);
  const campaign = findOr404(res, data.campaigns, id, "Campaign");
  if (!campaign) return;
  const hasDonations = data.donations.some((d) => d.campaign_id === id);
  if (hasDonations) {
    return res.status(409).json({ error: "Cannot delete a campaign that already has donations recorded against it. Close it instead." });
  }
  data.campaigns = data.campaigns.filter((c) => c.id !== id);
  db.save(data);
  res.status(204).end();
});

module.exports = router;
