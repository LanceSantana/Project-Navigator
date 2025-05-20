require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch((error) => console.error('MongoDB connection error:', error));

// User Schema
const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    }
});

// Project Schema
const projectSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    currentPhase: {
        type: String,
        enum: ['Planning', 'Execution', 'Monitoring', 'Closure'],
        default: 'Planning'
    },
    phaseDetails: {
        planning: {
            startDate: Date,
            endDate: Date,
            completed: Boolean,
            deliverables: [String],
            risks: [String],
            stakeholders: [String]
        },
        execution: {
            startDate: Date,
            endDate: Date,
            completed: Boolean,
            milestones: [{
                name: String,
                dueDate: Date,
                status: {
                    type: String,
                    enum: ['Not Started', 'In Progress', 'Completed', 'Delayed'],
                    default: 'Not Started'
                }
            }],
            resources: [{
                name: String,
                type: String,
                status: String
            }]
        },
        monitoring: {
            startDate: Date,
            endDate: Date,
            completed: Boolean,
            metrics: [{
                name: String,
                target: Number,
                current: Number,
                unit: String
            }],
            risks: [{
                description: String,
                impact: String,
                probability: String,
                mitigation: String,
                status: String
            }]
        },
        closure: {
            startDate: Date,
            endDate: Date,
            completed: Boolean,
            deliverables: [{
                name: String,
                status: String,
                reviewNotes: String
            }],
            lessonsLearned: [String]
        }
    },
    status: {
        type: String,
        enum: ['On Track', 'At Risk', 'Off Track', 'Completed'],
        default: 'On Track'
    },
    tasks: [{
        title: String,
        description: String,
        status: {
            type: String,
            enum: ['To Do', 'In Progress', 'Done'],
            default: 'To Do'
        },
        dueDate: Date,
        assignedTo: String,
        phase: {
            type: String,
            enum: ['Planning', 'Execution', 'Monitoring', 'Closure'],
            required: true
        }
    }],
    documents: [{
        name: String,
        type: String,
        content: String,
        phase: {
            type: String,
            enum: ['Planning', 'Execution', 'Monitoring', 'Closure'],
            required: true
        },
        uploadDate: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Chat Message Schema
const chatMessageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isUser: {
        type: Boolean,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Create new project
app.post('/projects', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;
        const project = new Project({
            userId: req.user.userId,
            name,
            description
        });
        await project.save();
        res.json(project);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Error creating project' });
    }
});

// Get user's projects
app.get('/projects', authenticateToken, async (req, res) => {
    try {
        const projects = await Project.find({ userId: req.user.userId });
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Error fetching projects' });
    }
});

// Get project details
app.get('/projects/:projectId', authenticateToken, async (req, res) => {
    try {
        const project = await Project.findOne({
            _id: req.params.projectId,
            userId: req.user.userId
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Error fetching project' });
    }
});

// Update project
app.put('/projects/:projectId', authenticateToken, async (req, res) => {
    try {
        const project = await Project.findOneAndUpdate(
            { _id: req.params.projectId, userId: req.user.userId },
            { $set: req.body },
            { new: true }
        );
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Error updating project' });
    }
});

// Signup endpoint
app.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create and store user
        const user = new User({
            email,
            password: hashedPassword
        });
        await user.save();

        res.json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Get chat history endpoint
app.get('/chat-history/:projectId', authenticateToken, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ 
            userId: req.user.userId,
            projectId: req.params.projectId
        })
        .sort({ timestamp: 1 })
        .limit(50);
        
        res.json({ messages });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Error fetching chat history' });
    }
});

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/generate-gantt', authenticateToken, async (req, res) => {
  try {
    const { projectId, viewMode, filters } = req.body;
    const project = await Project.findOne({ _id: projectId, userId: req.user.userId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Get tasks based on filters
    let tasks = project.tasks;
    
    if (filters) {
      if (filters.phase) {
        tasks = tasks.filter(task => task.phase === filters.phase);
      }
      
      if (filters.sprint) {
        const today = new Date();
        const currentSprintStart = new Date(today);
        currentSprintStart.setDate(today.getDate() - today.getDay()); // Start of current week
        
        const currentSprintEnd = new Date(currentSprintStart);
        currentSprintEnd.setDate(currentSprintStart.getDate() + 13); // 2 weeks sprint
        
        if (filters.sprint === 'current') {
          tasks = tasks.filter(task => {
            const taskDate = new Date(task.dueDate);
            return taskDate >= currentSprintStart && taskDate <= currentSprintEnd;
          });
        } else if (filters.sprint === 'next') {
          const nextSprintStart = new Date(currentSprintEnd);
          nextSprintStart.setDate(currentSprintEnd.getDate() + 1);
          
          const nextSprintEnd = new Date(nextSprintStart);
          nextSprintEnd.setDate(nextSprintStart.getDate() + 13);
          
          tasks = tasks.filter(task => {
            const taskDate = new Date(task.dueDate);
            return taskDate >= nextSprintStart && taskDate <= nextSprintEnd;
          });
        }
      }
    }

    // Group tasks by phase
    const phaseGroups = {};
    ['Planning', 'Execution', 'Monitoring', 'Closure'].forEach(phase => {
      const phaseTasks = tasks.filter(task => task.phase === phase);
      if (phaseTasks.length > 0) {
        phaseGroups[phase] = phaseTasks;
      }
    });

    // Convert tasks to Gantt format
    const ganttData = [];
    let taskId = 1;

    // Add phase groups
    Object.entries(phaseGroups).forEach(([phase, phaseTasks]) => {
      const groupId = `phase-${phase}`;
      ganttData.push({
        id: groupId,
        name: phase,
        start: new Date(Math.min(...phaseTasks.map(t => new Date(t.dueDate)))),
        end: new Date(Math.max(...phaseTasks.map(t => new Date(t.dueDate)))),
        progress: 0,
        type: 'group',
        hideChildren: false
      });

      // Add tasks under each phase
      phaseTasks.forEach(task => {
        const startDate = new Date(task.dueDate);
        startDate.setDate(startDate.getDate() - 1); // Assume 1-day duration for tasks
        
        // Fallback for missing title/name
        const taskTitle = task.title || task.name || 'Untitled Task';

        ganttData.push({
          id: `task-${taskId++}`,
          name: taskTitle,
          start: startDate,
          end: new Date(task.dueDate),
          progress: task.status === 'Done' ? 100 : task.status === 'In Progress' ? 50 : 0,
          parent: groupId,
          type: 'task'
        });
      });
    });

    res.json({ ganttData });
  } catch (err) {
    console.error('Gantt error:', err);
    res.status(500).json({ error: 'Failed to generate Gantt chart' });
  }
});

app.post('/generate-wbs', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.body;
    const project = await Project.findOne({ _id: projectId, userId: req.user.userId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const prompt = `Generate a Work Breakdown Structure (WBS) in flat JSON array format for a project with this description: ${project.description}. Use { id, parent, text } format.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const json = response.choices[0].message.content.match(/```json\s*([\s\S]+?)\s*```/);
    const wbsData = JSON.parse(json ? json[1] : response.choices[0].message.content);

    res.json({ wbsData });
  } catch (err) {
    console.error('WBS error:', err);
    res.status(500).json({ error: 'Failed to generate WBS' });
  }
});

// Helper to ensure every task has a title
function ensureTaskTitles(tasks) {
    let untitledCount = 1;
    return tasks.map(task => {
        if (!task.title && task.name) {
            task.title = task.name;
        }
        if (!task.title) {
            task.title = `Untitled Task ${untitledCount++}`;
        }
        return task;
    });
}

// OpenAI API Endpoint (protected)
app.post('/chat', authenticateToken, async (req, res) => {
    try {
        const { projectId, message } = req.body;
        let newTasks = [];
        
        // Verify project exists and belongs to user
        const project = await Project.findOne({
            _id: projectId,
            userId: req.user.userId
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Store user's message
        await ChatMessage.create({
            userId: req.user.userId,
            projectId,
            message,
            isUser: true
        });

        // Get detailed project context for ChatGPT
        const projectContext = `
            Project Name: ${project.name}
            Description: ${project.description}
            Current Phase: ${project.currentPhase}
            Overall Status: ${project.status}
            
            Phase Details:
            ${JSON.stringify(project.phaseDetails[project.currentPhase.toLowerCase()], null, 2)}
            
            Tasks in Current Phase:
            ${JSON.stringify(project.tasks.filter(t => t.phase === project.currentPhase), null, 2)}
            
            Documents in Current Phase:
            ${JSON.stringify(project.documents.filter(d => d.phase === project.currentPhase), null, 2)}
        `;

        // --- SYSTEM PROMPT UPGRADE ---
        const systemPrompt = `You are a project management assistant that understands project phases and workflows. 
You are currently in the ${project.currentPhase} phase of the project.
Your responses should be contextual to the current phase and project status.
You can suggest phase-specific actions, track progress, and provide relevant insights.
Here is the current project context: ${projectContext}

If the user asks for a new task, always reply with an UPDATE_PROJECT: block containing the new task, with your best guess for phase and due date. If the user is vague, infer reasonable values.`;

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                }
            }
        );

        let aiResponse = response.data.choices[0].message.content;
        
        // Remove UPDATE_PROJECT block from the AI response before sending to the user and before saving to the database
        let displayResponse = aiResponse;
        if (displayResponse.includes('UPDATE_PROJECT:')) {
            // Try to extract the new tasks for a friendly confirmation
            let friendlyMsg = '';
            try {
                // Try to parse the block for both 'tasks' and 'newTasks' keys
                let updateJson = null;
                const match = displayResponse.match(/UPDATE_PROJECT:\s*({[\s\S]+})/);
                if (match) {
                    updateJson = JSON.parse(match[1]);
                }
                if (updateJson) {
                    if (Array.isArray(updateJson.newTasks)) {
                        newTasks = updateJson.newTasks;
                    } else if (Array.isArray(updateJson.tasks)) {
                        newTasks = updateJson.tasks;
                    }
                }
                if (newTasks.length > 0) {
                    const taskNames = newTasks.map(t => t.name || t.title).join(', ');
                    friendlyMsg = `\n\nThe following tasks have been added to your project: ${taskNames}.`;
                }
            } catch (e) {
                // fallback: generic confirmation
                friendlyMsg = '\n\nYour tasks have been added to the project.';
            }
            displayResponse = displayResponse.split('UPDATE_PROJECT:')[0].trim();
            // Remove trailing preamble if present
            displayResponse = displayResponse.replace(/Here is the updated project block:?$/i, '').trim();
            if (friendlyMsg) displayResponse += friendlyMsg;
        }

        // Store AI's response (cleaned)
        await ChatMessage.create({
            userId: req.user.userId,
            projectId,
            message: displayResponse,
            isUser: false
        });

        // --- PHASE TRANSITION LOGIC (unchanged) ---
        if (displayResponse.includes('TRANSITION_PHASE:')) {
            const newPhase = displayResponse.split('TRANSITION_PHASE:')[1].trim();
            if (['Planning', 'Execution', 'Monitoring', 'Closure'].includes(newPhase)) {
                await Project.findOneAndUpdate(
                    { _id: projectId },
                    { 
                        $set: { 
                            currentPhase: newPhase,
                            [`phaseDetails.${project.currentPhase.toLowerCase()}.completed`]: true,
                            [`phaseDetails.${newPhase.toLowerCase()}.startDate`]: new Date()
                        }
                    }
                );
            }
        }

        // In /chat endpoint, before pushing new tasks to MongoDB
        if (newTasks.length > 0) {
            newTasks = ensureTaskTitles(newTasks);
            await Project.findOneAndUpdate(
                { _id: projectId },
                { $push: { tasks: { $each: newTasks } } }
            );
        }

        res.json({ reply: displayResponse });

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Test endpoint to check MongoDB connection and data
app.get('/test-db', async (req, res) => {
    try {
        // Check connection
        const connectionState = mongoose.connection.readyState;
        const connectionStatus = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        }[connectionState];

        // Get counts from collections
        const userCount = await User.countDocuments();
        const projectCount = await Project.countDocuments();
        const messageCount = await ChatMessage.countDocuments();

        res.json({
            status: 'success',
            connection: connectionStatus,
            collections: {
                users: userCount,
                projects: projectCount,
                messages: messageCount
            }
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.delete('/projects/:id', authenticateToken, async (req, res) => { //delete project endpoint
    const projectId = req.params.id;
    const userId = req.user.userId;
  
    try {
      const result = await Project.deleteOne({ _id: projectId, userId });
  
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Project not found or not authorized." });
      }
  
      // optionally, delete associated chat history
      await ChatMessage.deleteMany({ projectId });
  
      res.json({ message: "Project deleted successfully." });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Internal server error." });
    }
});
  
const pdfParse = require('pdf-parse');

app.post('/upload-pdf', authenticateToken, upload.single('file'), async (req, res) => { //upload pdf endpoint
  try {
    const { projectId } = req.body;
    const file = req.file;

    if (!file || !projectId) {
      return res.status(400).json({ error: 'Missing file or projectId' });
    }

    // Verify ownership
    const project = await Project.findOne({ _id: projectId, userId: req.user.userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Parse PDF text
    const parsed = await pdfParse(file.buffer);
    const extractedText = parsed.text.trim();

    await ChatMessage.create({
      userId: req.user.userId,
      projectId,
      message: `PDF Uploaded:\n${extractedText.slice(0, 1000)}${extractedText.length > 1000 ? '...' : ''}`,
      isUser: true
    });

    res.json({ message: 'PDF uploaded and content parsed into chat history.' });

  } catch (err) {
    console.error('Error uploading/parsing PDF:', err);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});


app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
