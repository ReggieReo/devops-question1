// src/index.js - Updated with better static file serving
const express = require("express");
const path = require("path");
const fs = require("fs");

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

const PORT = process.env.PORT;

async function main() {
    const app = express();

    // Debug log to verify the path
    const imagesPath = path.join(__dirname, "../public/images");
    console.log("Images directory path:", imagesPath);

    // List available images at startup
    try {
        const files = fs.readdirSync(imagesPath);
        console.log("Available images:", files);
    } catch (err) {
        console.error("Error reading images directory:", err);
    }

    // Serve static files (for direct image access)
    app.use("/images", express.static(imagesPath));

    // Add a direct route for each image to ensure they're accessible
    app.get("/images/:imageName", (req, res) => {
        const imageName = req.params.imageName;
        const imagePath = path.join(imagesPath, imageName);

        console.log(`Serving image: ${imagePath}`);

        // Check if file exists
        if (fs.existsSync(imagePath)) {
            res.sendFile(imagePath);
        } else {
            console.error(`Image not found: ${imagePath}`);
            res.status(404).send('Image not found');
        }
    });

    // In the advertise service
    app.get("/ads", (req, res) => {
        try {
            const imagesPath = path.join(__dirname, "../public/images");

            // Read and encode images
            const shopeeImage = fs.readFileSync(path.join(imagesPath, "shopee.jpg"));
            const lazadaImage = fs.readFileSync(path.join(imagesPath, "lazada.jpg"));
            const kaideeImage = fs.readFileSync(path.join(imagesPath, "kaidee.jpg"));

            const ads = [
                {
                    id: "shopee",
                    name: "Shopee",
                    imageData: `data:image/jpeg;base64,${shopeeImage.toString('base64')}`,
                    websiteUrl: "https://shopee.com"
                },
                {
                    id: "lazada",
                    name: "Lazada",
                    imageData: `data:image/jpeg;base64,${lazadaImage.toString('base64')}`,
                    websiteUrl: "https://lazada.com"
                },
                {
                    id: "kaidee",
                    name: "Kaidee",
                    imageData: `data:image/jpeg;base64,${kaideeImage.toString('base64')}`,
                    websiteUrl: "https://kaidee.com"
                }
            ];

            res.json({ ads });
        } catch (error) {
            console.error("Error serving ads:", error);
            res.status(500).json({ error: "Failed to load advertisements" });
        }
    });

    app.listen(PORT, () => {
        console.log(`Advertise microservice online on port ${PORT}`);
    });
}

main()
    .catch(err => {
        console.error("Advertise microservice failed to start.");
        console.error(err && err.stack || err);
    });

