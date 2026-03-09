// Run once: node generate-icons.js
// Generates simple PNG icons for the extension using canvas (requires npm install canvas)
// OR just creates placeholder files so the extension loads without errors.
// For production, replace icons/ with proper branded icons.

const fs = require("fs");
const path = require("path");

// Minimal 1x1 transparent PNG (base64) used as placeholder
// In production replace with real branded icons
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, "icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
  const file = path.join(iconsDir, `icon${size}.png`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, PNG_1x1);
    console.log(`Created placeholder ${file}`);
  }
}
console.log("Icons ready. Replace with branded icons for production.");
