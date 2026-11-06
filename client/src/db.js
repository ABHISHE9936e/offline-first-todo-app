import { openDB } from 'idb';

export async function initClientDB() {
  return openDB('OfflineTodoDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('todos')) {
        db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function getLocalTodos() {
  const db = await initClientDB();
  return db.getAll('todos');
}

export async function saveLocalTodo(text) {
  const db = await initClientDB();
  return db.add('todos', { 
    text, 
    completed: false, 
    synced: false, // Marked as unsynced until uploaded to Express server
    createdAt: new Date() 
  });
}

export async function markTodoAsSynced(id) {
  const db = await initClientDB();
  const tx = db.transaction('todos', 'readwrite');
  const store = tx.objectStore('todos');
  const todo = await store.get(id);
  if (todo) {
    todo.synced = true;
    await store.put(todo);
  }
  await tx.done;
}