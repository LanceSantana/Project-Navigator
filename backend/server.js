require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 📌 Step 1: Add a default route for the root URL
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.post('/upload-pdf', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Read the uploaded PDF file
        const pdfBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(pdfBuffer);

        // Return extracted text
        res.json({ text: pdfData.text });

        // Optional: Delete file after processing to save storage
        fs.unlinkSync(req.file.path);
    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ error: 'Error processing PDF' });
    }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));