const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "quotes.json");
if (fs.existsSync(filePath)) {
  const quotes = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let count = 0;
  quotes.forEach((q) => {
    if (q.pi_payment_terms && !["Advance", "Immediate"].includes(q.pi_payment_terms)) {
      q.pi_payment_terms = q.pi_payment_terms.toLowerCase().includes("immediate") ? "Immediate" : "Advance";
      count++;
    }
    if (q.payment_terms && !["Advance", "Immediate"].includes(q.payment_terms)) {
      q.payment_terms = q.payment_terms.toLowerCase().includes("immediate") ? "Immediate" : "Advance";
    }
  });
  fs.writeFileSync(filePath, JSON.stringify(quotes, null, 2), "utf8");
  console.log(`Successfully normalized ${count} quotes in quotes.json`);
} else {
  console.log("data/quotes.json not found");
}
