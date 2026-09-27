// app.js — a small hand-rolled SPA. No framework/build step on purpose:
// this keeps the whole thing runnable by opening `npm start` and a browser,
// which matters for a live walkthrough on unfamiliar hardware.

const state = { view: "dashboard", donors: [], campaigns: [] };

/* ---------------------------- helpers ---------------------------- */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

function money(n) {
  return "\u20b9" + Number(n || 0).toLocaleString("en-IN");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function badge(text, cls) {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function openModal(html) {
  document.getElementById("modal").innerHTML = html;
  document.getElementById("modal-backdrop").classList.add("open");
}
function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("open");
  document.getElementById("modal").innerHTML = "";
}
document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});

function formError(msg) {
  const el = document.querySelector(".form-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}

function donorOptions(selectedId) {
  return state.donors
    .map((d) => `<option value="${d.id}" ${d.id === selectedId ? "selected" : ""}>${esc(d.name)}</option>`)
    .join("");
}
function campaignOptions(selectedId) {
  return state.campaigns
    .map((c) => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${esc(c.title)}</option>`)
    .join("");
}

/* ---------------------------- nav ---------------------------- */

document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (!btn) return;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadView(btn.dataset.view);
});

async function loadView(view) {
  state.view = view;
  const content = document.getElementById("content");
  content.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    [state.donors, state.campaigns] = await Promise.all([api("/donors"), api("/campaigns")]);
    const renderers = {
      dashboard: renderDashboard,
      donors: renderDonors,
      campaigns: renderCampaigns,
      donations: renderDonations,
      utilizations: renderUtilizations,
      communications: renderCommunications
    };
    await renderers[view]();
  } catch (err) {
    content.innerHTML = `<p class="muted">Could not load this view: ${esc(err.message)}</p>`;
  }
}

/* ---------------------------- DASHBOARD ---------------------------- */

async function renderDashboard() {
  const d = await api("/dashboard");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p>A live snapshot of your drive — funds raised, put to use, and where each campaign stands.</p>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Total raised</div><div class="stat-value success">${money(d.total_raised)}</div></div>
      <div class="stat-card"><div class="stat-label">Total utilized</div><div class="stat-value accent">${money(d.total_utilized)}</div></div>
      <div class="stat-card"><div class="stat-label">Balance in hand</div><div class="stat-value">${money(d.total_balance)}</div></div>
      <div class="stat-card"><div class="stat-label">Donors</div><div class="stat-value">${d.donor_count}</div></div>
      <div class="stat-card"><div class="stat-label">Active campaigns</div><div class="stat-value">${d.active_campaigns} <span class="muted" style="font-size:13px;">/ ${d.campaign_count}</span></div></div>
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h2>Campaign progress</h2></div>
        ${d.campaigns.map(campaignProgressRow).join("") || `<p class="muted">No campaigns yet.</p>`}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Top donors</h2></div>
        ${
          d.top_donors.length
            ? d.top_donors.map((donor) => `
              <div class="campaign-row-top" style="padding:8px 0;">
                <span>${esc(donor.name)}</span>
                <strong>${money(donor.total_donated)}</strong>
              </div>`).join("")
            : `<p class="muted">No donations recorded yet.</p>`
        }
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Recent donations</h2></div>
      <table>
        <thead><tr><th>Date</th><th>Donor</th><th>Campaign</th><th class="num">Amount</th><th>Receipt</th></tr></thead>
        <tbody>
          ${
            d.recent_donations.length
              ? d.recent_donations.map((don) => `
                <tr>
                  <td>${esc(don.date)}</td>
                  <td>${esc(don.donor_name)}</td>
                  <td>${esc(don.campaign_title)}</td>
                  <td class="num">${money(don.amount)}</td>
                  <td>${esc(don.receipt_no)}</td>
                </tr>`).join("")
              : `<tr class="empty-row"><td colspan="5">No donations recorded yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function campaignProgressRow(c) {
  const over = c.raised_amount >= c.goal_amount;
  return `
    <div class="campaign-row">
      <div class="campaign-row-top">
        <span>${esc(c.title)}</span>
        <span class="muted">${money(c.raised_amount)} of ${money(c.goal_amount)}</span>
      </div>
      <div class="progress-track"><div class="progress-fill ${over ? "over" : ""}" style="width:${c.progress_pct}%"></div></div>
      <div class="muted" style="font-size:12px;">${c.progress_pct}% funded &middot; ${c.donor_count} donor(s)</div>
    </div>`;
}

/* ---------------------------- DONORS ---------------------------- */

async function renderDonors() {
  const donors = await api("/donors");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-head">
      <div><h1>Donors</h1><p>Everyone who has contributed to the drive, individuals and organizations alike.</p></div>
      <button class="btn" id="add-donor">Add donor</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th class="num">Total given</th><th>Last donation</th><th></th></tr></thead>
        <tbody>
          ${
            donors.length
              ? donors.map((d) => `
                <tr>
                  <td>${esc(d.name)}</td>
                  <td>${badge(d.type, d.type.toLowerCase())}</td>
                  <td class="muted">${esc(d.email || d.phone || "—")}</td>
                  <td class="num">${money(d.total_donated)}</td>
                  <td class="muted">${esc(d.last_donation_date || "—")}</td>
                  <td class="row-actions">
                    <button class="btn secondary small" data-history="${d.id}">History</button>
                    <button class="btn secondary small" data-edit-donor="${d.id}">Edit</button>
                  </td>
                </tr>`).join("")
              : `<tr class="empty-row"><td colspan="6">No donors yet — add the first one.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
  document.getElementById("add-donor").onclick = () => openDonorForm();
  content.querySelectorAll("[data-edit-donor]").forEach((btn) =>
    btn.addEventListener("click", () => openDonorForm(donors.find((d) => d.id === Number(btn.dataset.editDonor))))
  );
  content.querySelectorAll("[data-history]").forEach((btn) =>
    btn.addEventListener("click", () => openDonorHistory(Number(btn.dataset.history)))
  );
}

function openDonorForm(donor) {
  const isEdit = !!donor;
  openModal(`
    <h2>${isEdit ? "Edit donor" : "Add donor"}</h2>
    <div class="modal-sub">${isEdit ? "Update this donor's profile." : "Register a new individual or organization donor."}</div>
    <div class="form-error"></div>
    <form id="donor-form">
      <div class="field"><label>Name</label><input name="name" required value="${esc(donor?.name || "")}" /></div>
      <div class="field">
        <label>Type</label>
        <select name="type">
          <option value="Individual" ${donor?.type === "Individual" ? "selected" : ""}>Individual</option>
          <option value="Organization" ${donor?.type === "Organization" ? "selected" : ""}>Organization</option>
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(donor?.email || "")}" /></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(donor?.phone || "")}" /></div>
      </div>
      <div class="field"><label>Address</label><input name="address" value="${esc(donor?.address || "")}" /></div>
      <div class="field"><label>PAN (for receipts, optional)</label><input name="pan" value="${esc(donor?.pan || "")}" /></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cancel">Cancel</button>
        <button type="submit" class="btn">${isEdit ? "Save changes" : "Add donor"}</button>
      </div>
    </form>
  `);
  document.getElementById("cancel").onclick = closeModal;
  document.getElementById("donor-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (isEdit) await api(`/donors/${donor.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/donors", { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      showToast(isEdit ? "Donor updated" : "Donor added");
      renderDonors();
    } catch (err) {
      formError(err.message);
    }
  });
}

async function openDonorHistory(donorId) {
  const donor = state.donors.find((d) => d.id === donorId);
  const [donations, comms] = await Promise.all([api("/donations"), api(`/communications?donor_id=${donorId}`)]);
  const donorDonations = donations.filter((d) => d.donor_id === donorId);
  openModal(`
    <h2>${esc(donor.name)}</h2>
    <div class="modal-sub">Donation and communication history</div>
    <h3 style="font-size:13px; margin-bottom:8px;">Donations</h3>
    ${
      donorDonations.length
        ? donorDonations.map((d) => `<div class="campaign-row-top" style="padding:6px 0;"><span>${esc(d.date)} &middot; ${esc(d.campaign_title)}</span><strong>${money(d.amount)}</strong></div>`).join("")
        : `<p class="muted" style="font-size:13px;">No donations yet.</p>`
    }
    <h3 style="font-size:13px; margin:16px 0 8px;">Communications</h3>
    ${
      comms.length
        ? comms.map((c) => `<div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:13px;">${badge(c.type, c.type.toLowerCase().replace(" ", ""))} <strong>${esc(c.subject)}</strong><br><span class="muted">${esc(c.date)} — ${esc(c.message)}</span></div>`).join("")
        : `<p class="muted" style="font-size:13px;">No communications logged yet.</p>`
    }
    <div class="modal-actions"><button class="btn secondary" id="close-history">Close</button></div>
  `);
  document.getElementById("close-history").onclick = closeModal;
}

/* ---------------------------- CAMPAIGNS ---------------------------- */

async function renderCampaigns() {
  const campaigns = await api("/campaigns");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-head">
      <div><h1>Campaigns</h1><p>Every drive or fund, its goal, and how close it is to being fully funded.</p></div>
      <button class="btn" id="add-campaign">New campaign</button>
    </div>
    <div class="campaign-cards">
      ${campaigns.map((c) => `
        <div class="campaign-card">
          <div class="cat">${esc(c.category)}</div>
          <h3>${esc(c.title)}</h3>
          <div class="desc">${esc(c.description)}</div>
          <div class="progress-track"><div class="progress-fill ${c.raised_amount >= c.goal_amount ? "over" : ""}" style="width:${c.progress_pct}%"></div></div>
          <div class="figures">
            <span>Raised<br><strong>${money(c.raised_amount)}</strong></span>
            <span>Goal<br><strong>${money(c.goal_amount)}</strong></span>
            <span>Utilized<br><strong>${money(c.utilized_amount)}</strong></span>
          </div>
          <div class="card-foot">
            ${badge(c.status, c.status.toLowerCase())}
            <button class="btn secondary small" data-edit-campaign="${c.id}">Edit</button>
          </div>
        </div>
      `).join("") || `<p class="muted">No campaigns yet — create the first one.</p>`}
    </div>
  `;
  document.getElementById("add-campaign").onclick = () => openCampaignForm();
  content.querySelectorAll("[data-edit-campaign]").forEach((btn) =>
    btn.addEventListener("click", () => openCampaignForm(campaigns.find((c) => c.id === Number(btn.dataset.editCampaign))))
  );
}

function openCampaignForm(campaign) {
  const isEdit = !!campaign;
  openModal(`
    <h2>${isEdit ? "Edit campaign" : "New campaign"}</h2>
    <div class="modal-sub">${isEdit ? "Update campaign details or status." : "Set up a new fundraising campaign for the drive."}</div>
    <div class="form-error"></div>
    <form id="campaign-form">
      <div class="field"><label>Title</label><input name="title" required value="${esc(campaign?.title || "")}" /></div>
      <div class="field-row">
        <div class="field"><label>Category</label><input name="category" value="${esc(campaign?.category || "")}" /></div>
        <div class="field"><label>Goal amount (&#8377;)</label><input name="goal_amount" type="number" min="1" required value="${campaign?.goal_amount || ""}" /></div>
      </div>
      <div class="field"><label>Description</label><textarea name="description">${esc(campaign?.description || "")}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input name="start_date" type="date" required value="${campaign?.start_date || ""}" /></div>
        <div class="field"><label>End date</label><input name="end_date" type="date" required value="${campaign?.end_date || ""}" /></div>
      </div>
      ${isEdit ? `
      <div class="field"><label>Status</label>
        <select name="status">
          ${["Draft", "Active", "Completed", "Closed"].map((s) => `<option ${campaign.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cancel">Cancel</button>
        <button type="submit" class="btn">${isEdit ? "Save changes" : "Create campaign"}</button>
      </div>
    </form>
  `);
  document.getElementById("cancel").onclick = closeModal;
  document.getElementById("campaign-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (isEdit) await api(`/campaigns/${campaign.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/campaigns", { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      showToast(isEdit ? "Campaign updated" : "Campaign created");
      renderCampaigns();
    } catch (err) {
      formError(err.message);
    }
  });
}

/* ---------------------------- DONATIONS ---------------------------- */

async function renderDonations() {
  const donations = await api("/donations");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-head">
      <div><h1>Donations</h1><p>The full donation ledger. Every entry issues a receipt automatically.</p></div>
      <button class="btn" id="add-donation" ${state.donors.length && state.campaigns.length ? "" : "disabled"}>Record donation</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Date</th><th>Donor</th><th>Campaign</th><th class="num">Amount</th><th>Mode</th><th>Receipt</th><th></th></tr></thead>
        <tbody>
          ${
            donations.length
              ? donations.map((d) => `
                <tr>
                  <td>${esc(d.date)}</td>
                  <td>${esc(d.donor_name)}</td>
                  <td>${esc(d.campaign_title)}</td>
                  <td class="num">${money(d.amount)}</td>
                  <td class="muted">${esc(d.payment_mode)}</td>
                  <td>${esc(d.receipt_no)}</td>
                  <td class="row-actions"><a class="btn secondary small" href="/api/donations/${d.id}/receipt" target="_blank">View receipt</a></td>
                </tr>`).join("")
              : `<tr class="empty-row"><td colspan="7">No donations recorded yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
  if (state.donors.length && state.campaigns.length) {
    document.getElementById("add-donation").onclick = () => openDonationForm();
  }
}

function openDonationForm() {
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <h2>Record donation</h2>
    <div class="modal-sub">A receipt number is generated automatically and a thank-you note is logged for the donor.</div>
    <div class="form-error"></div>
    <form id="donation-form">
      <div class="field"><label>Donor</label><select name="donor_id">${donorOptions()}</select></div>
      <div class="field"><label>Campaign</label><select name="campaign_id">${campaignOptions()}</select></div>
      <div class="field-row">
        <div class="field"><label>Amount (&#8377;)</label><input name="amount" type="number" min="1" required /></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${today}" required /></div>
      </div>
      <div class="field"><label>Payment mode</label>
        <select name="payment_mode">
          <option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Cash</option><option>Card</option>
        </select>
      </div>
      <div class="field"><label>Notes (optional)</label><input name="notes" /></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cancel">Cancel</button>
        <button type="submit" class="btn">Record donation</button>
      </div>
    </form>
  `);
  document.getElementById("cancel").onclick = closeModal;
  document.getElementById("donation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api("/donations", { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      showToast("Donation recorded and receipt generated");
      renderDonations();
    } catch (err) {
      formError(err.message);
    }
  });
}

/* ---------------------------- UTILIZATION ---------------------------- */

async function renderUtilizations() {
  const [utils, campaigns] = await Promise.all([api("/utilizations"), api("/campaigns")]);
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-head">
      <div><h1>Fund utilization</h1><p>How raised money has actually been spent, campaign by campaign.</p></div>
      <button class="btn" id="add-util" ${state.campaigns.length ? "" : "disabled"}>Log utilization</button>
    </div>
    <div class="two-col">
      <div class="panel">
        <div class="panel-head"><h2>Expense log</h2></div>
        <table>
          <thead><tr><th>Date</th><th>Campaign</th><th>Category</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${
              utils.length
                ? utils.map((u) => `<tr><td>${esc(u.date)}</td><td>${esc(u.campaign_title)}</td><td class="muted">${esc(u.category)}</td><td class="num">${money(u.amount)}</td></tr>`).join("")
                : `<tr class="empty-row"><td colspan="4">No utilization logged yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Raised vs. utilized</h2></div>
        ${campaigns.map((c) => `
          <div class="campaign-row">
            <div class="campaign-row-top"><span>${esc(c.title)}</span><span class="muted">${money(c.utilized_amount)} / ${money(c.raised_amount)}</span></div>
            <div class="progress-track"><div class="progress-fill ${c.utilized_amount > c.raised_amount ? "over" : ""}" style="width:${c.raised_amount > 0 ? Math.min(100, Math.round((c.utilized_amount / c.raised_amount) * 100)) : 0}%"></div></div>
            ${c.utilized_amount > c.raised_amount ? `<div style="font-size:12px; color:var(--danger);">Utilized exceeds raised by ${money(c.utilized_amount - c.raised_amount)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  if (state.campaigns.length) document.getElementById("add-util").onclick = () => openUtilForm();
}

function openUtilForm() {
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <h2>Log fund utilization</h2>
    <div class="modal-sub">Record how money raised for a campaign was spent.</div>
    <div class="form-error"></div>
    <form id="util-form">
      <div class="field"><label>Campaign</label><select name="campaign_id">${campaignOptions()}</select></div>
      <div class="field-row">
        <div class="field"><label>Amount (&#8377;)</label><input name="amount" type="number" min="1" required /></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${today}" required /></div>
      </div>
      <div class="field"><label>Category</label><input name="category" placeholder="e.g. Blankets, Logistics" /></div>
      <div class="field"><label>Description</label><textarea name="description"></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cancel">Cancel</button>
        <button type="submit" class="btn">Log expense</button>
      </div>
    </form>
  `);
  document.getElementById("cancel").onclick = closeModal;
  document.getElementById("util-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const result = await api("/utilizations", { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      showToast(result.over_budget ? "Logged — note: this exceeds funds raised so far" : "Utilization logged");
      renderUtilizations();
    } catch (err) {
      formError(err.message);
    }
  });
}

/* ---------------------------- COMMUNICATIONS ---------------------------- */

async function renderCommunications() {
  const comms = await api("/communications");
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="page-head">
      <div><h1>Donor communications</h1><p>Thank-you notes are logged automatically on donation; log updates and appeals here.</p></div>
      <button class="btn" id="add-comm" ${state.donors.length ? "" : "disabled"}>Log communication</button>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>Date</th><th>Donor</th><th>Type</th><th>Subject</th></tr></thead>
        <tbody>
          ${
            comms.length
              ? comms.map((c) => `
                <tr>
                  <td class="muted">${esc(c.date)}</td>
                  <td>${esc(c.donor_name)}</td>
                  <td>${badge(c.type, c.type.toLowerCase().replace(" ", ""))}</td>
                  <td>${esc(c.subject)}</td>
                </tr>`).join("")
              : `<tr class="empty-row"><td colspan="4">Nothing logged yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
  if (state.donors.length) document.getElementById("add-comm").onclick = () => openCommForm();
}

function openCommForm() {
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <h2>Log communication</h2>
    <div class="modal-sub">Record an update or appeal sent to a donor.</div>
    <div class="form-error"></div>
    <form id="comm-form">
      <div class="field"><label>Donor</label><select name="donor_id">${donorOptions()}</select></div>
      <div class="field-row">
        <div class="field"><label>Type</label><select name="type"><option>Update</option><option>Appeal</option><option>Thank You</option></select></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${today}" required /></div>
      </div>
      <div class="field"><label>Subject</label><input name="subject" required /></div>
      <div class="field"><label>Message</label><textarea name="message" required></textarea></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cancel">Cancel</button>
        <button type="submit" class="btn">Log communication</button>
      </div>
    </form>
  `);
  document.getElementById("cancel").onclick = closeModal;
  document.getElementById("comm-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api("/communications", { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      showToast("Communication logged");
      renderCommunications();
    } catch (err) {
      formError(err.message);
    }
  });
}

/* ---------------------------- init ---------------------------- */

loadView("dashboard");
