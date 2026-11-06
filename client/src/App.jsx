import React, { useState, useEffect } from 'react';
import { openDB } from 'idb';

// --- Local IndexedDB Helpers ---
async function initClientDB() {
  return openDB('OfflineTodoDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('todos')) {
        db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

async function getLocalTodos() {
  const db = await initClientDB();
  return db.getAll('todos');
}

async function saveLocalTodo(text) {
  const db = await initClientDB();
  return db.add('todos', { 
    text, 
    completed: false, 
    synced: false, 
    createdAt: new Date() 
  });
}

// --- API Endpoints ---
const API_URL = 'http://localhost:5000/api';

async function loginUser(username, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

async function registerUser(username, password) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

async function fetchServerTodos(token) {
  const res = await fetch(`${API_URL}/todos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}

async function createServerTodo(token, text) {
  const res = await fetch(`${API_URL}/todos`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ text })
  });
  return res.json();
}

// --- Main App Component ---
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load todos from IndexedDB or Server on startup
  useEffect(() => {
    async function loadData() {
      if (token && isOnline) {
        try {
          const serverTodos = await fetchServerTodos(token);
          if (Array.isArray(serverTodos)) {
            setTodos(serverTodos);
            return;
          } else {
            console.warn('Server returned non-array data, falling back to local DB', serverTodos);
            if (serverTodos && serverTodos.error) {
              setToken('');
              localStorage.removeItem('token');
            }
          }
        } catch (err) {
          console.warn('Failed to fetch from server, falling back to IndexedDB');
        }
      }
      
      // Fallback / Offline Load from IndexedDB
      const localTodos = await getLocalTodos();
      setTodos(Array.isArray(localTodos) ? localTodos : []);
    }
    loadData();
  }, [token, isOnline]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isLoginMode) {
        const data = await loginUser(username, password);
        if (data.token) {
          setToken(data.token);
          localStorage.setItem('token', data.token);
          alert('Logged in successfully!');
        } else {
          alert(data.error || 'Login failed');
        }
      } else {
        const data = await registerUser(username, password);
        if (data.userId) {
          alert('Registration successful! Please log in.');
          setIsLoginMode(true);
        } else {
          alert(data.error || 'Registration failed');
        }
      }
    } catch (err) {
      alert('Network or server error');
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 1. Save locally to IndexedDB immediately (Works Offline!)
    await saveLocalTodo(input);
    const updatedLocal = await getLocalTodos();
    setTodos(Array.isArray(updatedLocal) ? updatedLocal : []);
    setInput('');

    // 2. If online and authenticated, push immediately to server
    if (isOnline && token) {
      try {
        await createServerTodo(token, input);
        const serverTodos = await fetchServerTodos(token);
        if (Array.isArray(serverTodos)) {
          setTodos(serverTodos);
        }
      } catch (err) {
        console.error('Failed to sync new todo to server', err);
      }
    }
  };

  if (!token) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px', margin: 'auto' }}>
        <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <button type="submit">{isLoginMode ? 'Login' : 'Register'}</button>
        </form>
        <p onClick={() => setIsLoginMode(!isLoginMode)} style={{ cursor: 'pointer', color: 'blue', marginTop: '10px' }}>
          {isLoginMode ? "Don't have an account? Register" : "Already have an account? Login"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h2>My Offline-First Todo App</h2>
      <p>Status: <span style={{ color: isOnline ? 'green' : 'red', fontWeight: 'bold' }}>{isOnline ? '🟢 Online' : '🔴 Offline'}</span></p>
      
      <button onClick={() => { setToken(''); localStorage.removeItem('token'); }} style={{ marginBottom: '1rem' }}>
        Logout
      </button>

      <form onSubmit={addTodo} style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
        <input 
          type="text"
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="What needs to be done?" 
          style={{ flex: 1, padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>Add Todo</button>
      </form>

      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {Array.isArray(todos) && todos.map((todo) => (
          <li key={todo.id || todo._id} style={{ padding: '10px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
            <span>{todo.text}</span>
            <span style={{ fontSize: '0.8rem', color: todo.synced === false && !isOnline ? 'orange' : 'gray' }}>
              {isOnline ? '☁️ Synced' : '💾 Local Only'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}