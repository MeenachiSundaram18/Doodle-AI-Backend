const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { OpenAI } = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// const upload = multer({ dest: "uploads/" });

const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    // Check for the correct file type (PDF in this case)
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
  },
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5002;

app.post("/process-pdf", upload.single("file"), async (req, res) => {
  const originalExtension = path.extname(req.file.originalname);
  console.log("originalExtension", originalExtension);
  const filename = `${req.file.path}${originalExtension}`;

  fs.renameSync(req.file.path, filename);
  const prompt =
    "Extract the content from the file provided without altering it. Just output its exact content and nothing else.";

  try {
    // Create the assistant
    const pdfAssistant = await openai.beta.assistants.create({
      model: "gpt-3.5-turbo",
      description: "An assistant to extract the contents of PDF files.",
      tools: [{ type: "file_search" }],
      name: "PDF assistant",
    });

    const thread = await openai.beta.threads.create();

    const file = await openai.files.create({
      file: fs.createReadStream(filename),
      purpose: "assistants",
    });

    // Create a message in the thread with the file attachment
    const mainResponse = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      attachments: [
        {
          file_id: file.id,
          tools: [{ type: "file_search" }],
        },
      ],
      content: prompt,
    });

    console.log("mainResponse", mainResponse);

    // Run the thread
    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: pdfAssistant.id,
    });

    console.log("run", run);
    if (run.status !== "completed") {
      throw new Error("Run failed: " + run.status);
    }

    const allMessages = await client.beta.threads.messages.list(thread.id);

    console.log("allMessages", allMessages);
    // Retrieve messages from the thread
    const messagesCursor = await openai.beta.threads.messages.list({
      thread_id: thread.id,
    });

    console.log("messagesCursor", messagesCursor);
    const messages = messagesCursor.messages;

    // Output the extracted text
    const resTxt = messages[0].content[0].text.value;

    // Clean up: remove the uploaded file
    fs.unlinkSync(filename);

    // Send the extracted content as the response
    res.json({ extractedContent: resTxt });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res
      .status(500)
      .json({ error: "Error processing PDF", details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
