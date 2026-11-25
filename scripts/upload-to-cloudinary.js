const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dwvi432ol";
const apiKey = process.env.CLOUDINARY_API_KEY || "728157961344236";
const apiSecret = process.env.CLOUDINARY_API_SECRET || "rPC2LOuu9o7w44byrwRcZVJYwpY";
const targetFolder = process.env.CLOUDINARY_FOLDER || "new_erp";

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

async function uploadAssets() {
  const assetsDir = path.join(__dirname, "..", "public", "assets");
  if (!fs.existsSync(assetsDir)) {
    console.error("Assets directory not found:", assetsDir);
    return;
  }

  const files = fs.readdirSync(assetsDir);
  const imageFiles = files.filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f));

  console.log(`Found ${imageFiles.length} image files to upload to Cloudinary under '${targetFolder}'...`);

  const results = {};

  for (const file of imageFiles) {
    const filePath = path.join(assetsDir, file);
    const publicId = path.basename(file, path.extname(file));
    try {
      console.log(`Uploading ${file} ...`);
      const res = await cloudinary.uploader.upload(filePath, {
        folder: targetFolder,
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });
      console.log(`✓ Uploaded ${file} -> ${res.secure_url}`);
      results[file] = res.secure_url;
    } catch (err) {
      console.error(`✗ Error uploading ${file}:`, err.message);
    }
  }

  const manifestPath = path.join(__dirname, "..", "data", "cloudinary-assets.json");
  const dataDir = path.dirname(manifestPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nCloudinary asset manifest saved to ${manifestPath}`);
}

uploadAssets()
  .then(() => console.log("Cloudinary sync complete."))
  .catch((e) => console.error("Cloudinary sync failed:", e));
