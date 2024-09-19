const express = require("express");
const multer = require("multer");
const cors = require("cors");

const { DocumentProcessorServiceClient } = require("@google-cloud/documentai");
const fs = require("fs");
const path = require("path");

// Google Cloud credentials
// const projectId = "doodle-ai-435618";
const projectId = "678973263733";
const location = "us";
const processorId = "e4de3e67a875e26b";
const keyFilePath = path.join(__dirname, "serviceAccount.json");

// Initialize Document AI client
const client = new DocumentProcessorServiceClient({
  keyFilename: keyFilePath,
});

const app = express();
app.use(cors());

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.options("/upload", cors());
const upload = multer({ dest: "uploads/" });

// Endpoint to handle document upload
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filePath = req.file.path;

  try {
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    // Read the file into memory.
    const fs = require("fs").promises;
    const imageFile = await fs.readFile(filePath);

    // Convert the image data to a Buffer and base64 encode it.
    const encodedImage = Buffer.from(imageFile).toString("base64");

    const request = {
      name,
      rawDocument: {
        content: encodedImage,
        mimeType: "application/pdf",
      },
    };

    // Recognizes text entities in the PDF document
    const [result] = await client.processDocument(request);
    const { document } = result;

    // Get all of the document text as one big string
    const { text } = document;

    // Extract shards from the text field
    const getText = (textAnchor) => {
      if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
        return "";
      }

      const startIndex = textAnchor.textSegments[0].startIndex || 0;
      const endIndex = textAnchor.textSegments[0].endIndex;

      return text.substring(startIndex, endIndex);
    };

    const paragraphsData = document.pages.map((page) => {
      return page.paragraphs.map((paragraph) => ({
        text: getText(paragraph.layout.textAnchor),
      }));
    });

    // Extract features from the document
    const features = document.pages.map((page) => {
      return {
        pageNumber: page.pageNumber,
        paragraphs: page.paragraphs.map((paragraph) => ({
          text: getText(paragraph.layout.textAnchor),
          layout: paragraph.layout,
        })),
        // tables: page.tables.map((table) => ({
        //   headerRows: table.headerRows,
        //   bodyRows: table.bodyRows,
        // })),
        // images: page.images.map((image) => ({
        //   content: image.content,
        //   layout: image.layout,
        // })),
      };
    });

    // Send the extracted data as JSON
    res.status(200).json({
      features: features,
    });
  } catch (err) {
    console.error("Error processing document:", err);
    res.status(500).json({ error: "Error processing document." });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
