const path = require("path");
const { createApp } = require("./mini-http");

const donorsRouter = require("./routes/donors");
const campaignsRouter = require("./routes/campaigns");
const donationsRouter = require("./routes/donations");
const utilizationsRouter = require("./routes/utilizations");
const communicationsRouter = require("./routes/communications");
const dashboardRouter = require("./routes/dashboard");

const app = createApp();
const PORT = process.env.PORT || 3000;

app.serveStatic(path.join(__dirname, "public"));

app.use("/api/donors", donorsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/donations", donationsRouter);
app.use("/api/utilizations", utilizationsRouter);
app.use("/api/communications", communicationsRouter);
app.use("/api/dashboard", dashboardRouter);

app.listen(PORT, () => {
  console.log(`Nidhi — Donation Manager running at http://localhost:${PORT}`);
});
