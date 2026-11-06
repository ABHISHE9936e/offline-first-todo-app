import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import cors from 'cors';
import dotenv from 'dotenv';
import User from './todoSchema.js';
import Todo from './Todo.js';
import { todoSchema } from './todoValidator.js';
import { verifyToken } from './middleware.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Connect to MongoDB
if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in environment variables.');
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Register User
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: 'User created successfully', userId: user._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login User & Issue JWT Token
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET missing.' });
    }

    // Sign JWT token valid for 1 hour
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected Route: Get Todos (Extracts userId securely from decoded token)
app.get('/api/todos', verifyToken, async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.user.userId });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected Route: Create Todo with Zod Validation
app.post('/api/todos', verifyToken, async (req, res) => {
  const result = todoSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  try {
    const newTodo = await Todo.create({ 
      userId: req.user.userId, 
      text: req.body.text 
    });
    res.status(201).json(newTodo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
