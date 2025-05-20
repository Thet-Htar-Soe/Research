const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pdfPoppler = require("pdf-poppler");
const Tesseract = require("tesseract.js");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({ dest: "uploads/" });

const systemPrompt = `
You are a JSON data extractor. You only return valid JSON and no explanation.

Extract the following fields:
- full_name
- email
- position

If a field is not found, set it to null.
Return ONLY the following JSON object with no additional text:
{
  "full_name": string | null,
  "email": string | null,
  "position": string | null
}
`;

// =====With Tesseract===========
async function pdfToTextViaOCR(pdfBuffer) {
  const ocrResult = await Tesseract.recognize(pdfBuffer, "eng", {
    logger: (m) => console.log(m),
  });

  return ocrResult.data.text;
}

//===With Poppler
const convertPdfToImageWithPoppler = async (pdfPath, outputDir) => {
  const opts = {
    format: "png",
    out_dir: outputDir,
    out_prefix: path.parse(pdfPath).name,
    page: 1,
    resolution: 150,
  };

  try {
    await pdfPoppler.convert(pdfPath, opts);
    const outputImagePath = path.join(outputDir, `${opts.out_prefix}-1.png`);
    console.log("PDF successfully converted.", outputImagePath);
    return outputImagePath;
  } catch (error) {
    console.error("Conversion error:", error);
  }
};

app.post("/extract-data", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const dataBuffer = require("fs").readFileSync(req.file.path);
    let pdfText = (await pdfParse(dataBuffer)).text;

    if (pdfText.trim().length < 30) {
      const originalPath = req.file.path;
      const ext = path.extname(originalPath).toLowerCase();
      const tempPdfPath = ext === ".pdf" ? originalPath : `${originalPath}.pdf`;

      if (tempPdfPath !== originalPath) {
        fs.renameSync(originalPath, tempPdfPath);
      }

      const outputPath = "./output";
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
      }

      // With Pdfpoppler
      const imagePath = await convertPdfToImageWithPoppler(tempPdfPath, outputPath);
      console.log("This is image Path", imagePath);
      pdfText = await pdfToTextViaOCR(imagePath);
    }

    const userPrompt = `Extract information from the following resume:\n"""\n${pdfText}\n"""`;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",

      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    });

    let rawContent = chatResponse.choices[0].message.content.trim();

    if (rawContent.startsWith("```")) {
      rawContent = rawContent.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, "$1");
    }
    const extracted = JSON.parse(rawContent);
    res.json({ extracted });
  } catch (error) {
    console.error("Extraction error:", error.message);
    res.status(500).json({ error: "Extraction failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
