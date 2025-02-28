const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Set up the database connection using environment variables
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test the connection
db.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Connected to the PostgreSQL database');
  }
});

// 📌 Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send({ message: 'Username and password are required' });
  }

  try {
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    const values = [username, password];
    const result = await db.query(query, values);

    if (result.rows.length > 0) {
      return res.status(200).send({ message: 'Login successful', user: result.rows[0] });
    } else {
      return res.status(401).send({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error executing query', error.stack);
    return res.status(500).send({ message: 'Server error' });
  }
});

// 📌 Signup Route
app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).send({ message: 'Username and password are required' });
  }

  try {
    const checkUserQuery = 'SELECT * FROM users WHERE username = $1';
    const checkUserValues = [username];
    const result = await db.query(checkUserQuery, checkUserValues);

    if (result.rows.length > 0) {
      return res.status(400).send({ message: 'Username already exists' });
    }

    const insertUserQuery = 'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)';
    const insertUserValues = [username, password, email];
    await db.query(insertUserQuery, insertUserValues);

    res.status(201).send({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send({ message: 'Server error' });
  }
});

// 📌 GET Recipes
app.get('/recipes', async (req, res) => {
  const { tag } = req.query;

  try {
    let query = 'SELECT * FROM Recipes';
    let values = [];

    if (tag) {
      query += ' WHERE tag = $1';
      values.push(tag);
    }

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).send('Error fetching recipes');
  }
});

// 📌 POST Create Recipe
app.post('/recipes', async (req, res) => {
  const { author, title, ingredients, instructions, tag } = req.body;

  if (!author || !title || !ingredients || !instructions) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const insertQuery = `
      INSERT INTO Recipes (author, title, ingredients, instructions, tag) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const values = [author, title, ingredients, instructions, tag || null];

    const result = await db.query(insertQuery, values);
    res.status(201).json({ message: 'Recipe created successfully', recipe: result.rows[0] });
  } catch (error) {
    console.error('Error inserting recipe:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/recipes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, ingredients, instructions, tag } = req.body;

  console.log(`🔹 Received update request for ID: ${id}`);
  console.log(`🔹 Request Body:`, req.body);

  if (!title || !ingredients || !instructions) {
    return res.status(400).send({ message: '⚠️ All fields are required' });
  }

  try {
    const updateQuery = `
      UPDATE Recipes SET title = $1, ingredients = $2, instructions = $3, tag = $4
      WHERE id = $5 RETURNING *`;
    const values = [title, ingredients, instructions, tag, id];

    const result = await db.query(updateQuery, values);
    if (result.rows.length > 0) {
      res.status(200).send({ message: '✅ Recipe updated successfully', recipe: result.rows[0] });
    } else {
      res.status(404).send({ message: '⚠️ Recipe not found' });
    }
  } catch (error) {
    console.error('❌ Error updating recipe:', error);
    res.status(500).send({ message: 'Server error' });
  }
});



// 📌 DELETE Recipe
app.delete('/recipes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = 'DELETE FROM Recipes WHERE id = $1 RETURNING *';
    const result = await db.query(deleteQuery, [id]);

    if (result.rows.length > 0) {
      res.status(200).send({ message: 'Recipe deleted successfully' });
    } else {
      res.status(404).send({ message: 'Recipe not found' });
    }
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).send({ message: 'Server error' });
  }
});

// Start Server
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`Route available: ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`);
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;



