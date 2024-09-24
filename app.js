const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { OpenAI } = require("openai");
const multer = require("multer");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5002;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: `key_here`,
});

// API endpoint to process PDF files
app.post("/process-pdf", upload.single("file"), async (req, res) => {
  const filename = req.file.path;
  const prompt =
    "Extract the content from the file provided without altering it. Just output its exact content and nothing else.";

  try {
    // Create the assistant

    const pdfAssistant = await openai.beta.assistants.create({
      model: "gpt-3.5-turbo", // Updated model name
      description: "An assistant to extract the contents of PDF files.",
      tools: [{ type: "file_search" }],
      name: "PDF assistant",
    });

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Upload the PDF file
    // sundar18final.pdf;
    const file = await openai.files.create({
      file: fs.createReadStream("sundar18final.pdf"),
      // file: fs.createReadStream(filename),x
      purpose: "assistants",
    });

    // console.log(file);
    // const file = await openai.files.create({
    //   file: fs.createReadStream(filename),
    //   purpose: "assistants",
    // });

    // console.log("file", file);
    // Create a message in the thread with the file attachment
    await openai.beta.threads.messages.create(thread.id, {
      // thread_id: thread.id,
      role: "user",
      attachments: [
        {
          file_id: file.id,
          tools: [{ type: "file_search" }],
        },
      ],
      content: prompt,
    });

    // Run the thread
    const run = await openai.beta.threads.runs.createAndPoll({
      thread_id: thread.id,
      assistant_id: pdfAssistant.id,
    });

    if (run.status !== "completed") {
      throw new Error("Run failed: " + run.status);
    }

    // Retrieve messages from the thread
    const messagesCursor = await openai.beta.threads.messages.list({
      thread_id: thread.id,
    });

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
