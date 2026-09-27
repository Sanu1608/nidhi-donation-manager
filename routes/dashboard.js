const { Router } = require("../mini-http");
const db = require("../db");
const { enrichCampaign, enrichDonor } = require("../helpers");

const router = Router();

// GET /api/dashboard — the numbers a campaign coordinator checks first
router.get("/", (req, res) => {
  const data = db.load();
  const campaigns = data.campaigns.map((c) => enrichCampaign(data, c));
  const donors = data.donors.map((d) => enrichDonor(data, d));

  const totalRaised = data.donations.reduce((s, d) => s + d.amount, 0);
  const totalUtilized = data.utilizations.reduce((s, u) => s + u.amount, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "Active").length;

  const topDonors = [...donors].sort((a, b) => b.total_donated - a.total_donated).slice(0, 5);

  const recentDonations = [...data.donations]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6)
    .map((don) => ({
      ...don,
      donor_name: (data.donors.find((d) => d.id === don.donor_id) || {}).name || "Unknown",
      campaign_title: (data.campaigns.find((c) => c.id === don.campaign_id) || {}).title || "Unknown"
    }));

  res.json({
    total_raised: totalRaised,
    total_utilized: totalUtilized,
    total_balance: totalRaised - totalUtilized,
    donor_count: data.donors.length,
    campaign_count: data.campaigns.length,
    active_campaigns: activeCampaigns,
    donation_count: data.donations.length,
    campaigns,
    top_donors: topDonors,
    recent_donations: recentDonations
  });
});

module.exports = router;
