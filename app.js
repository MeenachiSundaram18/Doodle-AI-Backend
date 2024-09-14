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
    return res.status(400).send("No file uploaded.");
  }

  const filePath = req.file.path;

  try {
    // Read the file into memory
    const document = fs.readFileSync(filePath);

    // Call Google Cloud Document AI
    const request = {
      name: `projects/${projectId}/locations/${location}/processors/${processorId}`,
      rawDocument: {
        content: document.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    // Recognizes text entities in the PDF document
    const [result] = await client.processDocument(request);
    const { document: resultDocument } = result;

    // Get all of the document text as one big string
    const { text } = resultDocument;

    // Extract shards from the text field
    const getText = (textAnchor) => {
      if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
        return "";
      }

      // First shard in resultDocument doesn't have startIndex property
      const startIndex = textAnchor.textSegments[0].startIndex || 0;
      const endIndex = textAnchor.textSegments[0].endIndex;

      return text.substring(startIndex, endIndex);
    };

    // Read the text recognition output from the processor
    console.log("The resultDocument contains the following paragraphs:");
    const [page1] = resultDocument.pages;
    const { paragraphs } = page1;

    for (const paragraph of paragraphs) {
      const paragraphText = getText(paragraph.layout.textAnchor);
      console.log(`Paragraph text:\n${paragraphText}`);
    }
  } catch (err) {
    console.error("Error processing resultDocument:", err);
    res.status(500).send("Error processing resultDocument.");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
