const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer();

// **MongoDB Connection**
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// **Middleware to Verify JWT**
const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    try {
        const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        req.user = decoded; // Attach user data to the request
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token." });
    }
};

// **Database Models**
const UserSchema = new mongoose.Schema({
    email: String,
    password: String
});
const User = mongoose.model("User", UserSchema);

const ProjectSchema = new mongoose.Schema({
    userId: String,
    name: String,
    conversation: Array
});
const Project = mongoose.model("Project", ProjectSchema);

// **User Signup**
app.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        res.json({ message: "✅ User registered successfully!" });
    } catch (error) {
        res.status(500).json({ error: "❌ Error registering user." });
    }
});

// **User Login**
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "❌ Invalid credentials" });
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: "❌ Error logging in." });
    }
});

// **Upload and Process PDF (Protected Route)**
app.post('/upload-pdf', authMiddleware, upload.single('pdfFile'), async (req, res) => {
    const userId = req.user.userId; // Extract user ID from JWT
    const { projectId } = req.body;

    if (!req.file) return res.status(400).json({ error: "❌ No file uploaded." });

    try {
        const data = await pdfParse(req.file.buffer);
        const extractedText = data.text;

        const chatGptResponse = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are an AI following PMBOK best practices for project management analysis." },
                { role: "user", content: `Analyze this project data:\n${extractedText}` }
            ]
        }, {
            headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }
        });

        const reply = chatGptResponse.data.choices[0].message.content;

        let project = await Project.findOne({ _id: projectId, userId });
        if (!project) {
            project = new Project({ userId, name: `Project ${Date.now()}`, conversation: [] });
        }
        project.conversation.push({ role: "user", content: extractedText });
        project.conversation.push({ role: "assistant", content: reply });
        await project.save();

        res.json({ extractedText, chatGptReply: reply, conversation: project.conversation });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: "Failed to process PDF" });
    }
});

// **Get User's Projects (Protected Route)**
app.get('/projects', authMiddleware, async (req, res) => {
    const userId = req.user.userId; // Extract user ID from JWT
    try {
        const projects = await Project.find({ userId });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: "❌ Error fetching projects." });
    }
});

// **Continue a Project Conversation (Protected Route)**
app.post('/chat', authMiddleware, async (req, res) => {
    const userId = req.user.userId; // Extract user ID from JWT
    const { projectId, message } = req.body;

    try {
        let project = await Project.findOne({ _id: projectId, userId });
        if (!project) return res.status(404).json({ error: "❌ Project not found." });

        project.conversation.push({ role: "user", content: message });

        const chatGptResponse = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4",
            messages: project.conversation
        }, {
            headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }
        });

        const reply = chatGptResponse.data.choices[0].message.content;
        project.conversation.push({ role: "assistant", content: reply });
        await project.save();

        res.json({ chatGptReply: reply, conversation: project.conversation });
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: "Failed to continue chat." });
    }
});

// **Start the Server**
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

