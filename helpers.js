// helpers.js
// Derived numbers (amount raised, amount utilized, donor lifetime total) are
// always computed from the underlying donation/utilization records rather
// than stored redundantly. This is a deliberate design choice: it means the
// ledger of donations is the single source of truth, and totals can never
// drift out of sync with it — a common real-world bug in donation systems.

function campaignRaised(data, campaignId) {
  return data.donations
    .filter((d) => d.campaign_id === campaignId)
    .reduce((sum, d) => sum + d.amount, 0);
}

function campaignUtilized(data, campaignId) {
  return data.utilizations
    .filter((u) => u.campaign_id === campaignId)
    .reduce((sum, u) => sum + u.amount, 0);
}

function donorTotalDonated(data, donorId) {
  return data.donations
    .filter((d) => d.donor_id === donorId)
    .reduce((sum, d) => sum + d.amount, 0);
}

function enrichCampaign(data, campaign) {
  const raised = campaignRaised(data, campaign.id);
  const utilized = campaignUtilized(data, campaign.id);
  const goal = campaign.goal_amount || 0;
  return {
    ...campaign,
    raised_amount: raised,
    utilized_amount: utilized,
    balance_amount: raised - utilized,
    progress_pct: goal > 0 ? Math.min(100, Math.round((raised / goal) * 1000) / 10) : 0,
    donor_count: new Set(data.donations.filter((d) => d.campaign_id === campaign.id).map((d) => d.donor_id)).size
  };
}

function enrichDonor(data, donor) {
  const donorDonations = data.donations.filter((d) => d.donor_id === donor.id);
  return {
    ...donor,
    total_donated: donorDonations.reduce((s, d) => s + d.amount, 0),
    donation_count: donorDonations.length,
    last_donation_date: donorDonations.length
      ? donorDonations.map((d) => d.date).sort().slice(-1)[0]
      : null
  };
}

function findOr404(res, arr, id, label) {
  const item = arr.find((x) => x.id === id);
  if (!item) {
    res.status(404).json({ error: `${label} not found` });
    return null;
  }
  return item;
}

module.exports = {
  campaignRaised,
  campaignUtilized,
  donorTotalDonated,
  enrichCampaign,
  enrichDonor,
  findOr404
};
