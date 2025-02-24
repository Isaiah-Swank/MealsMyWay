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

// Login Route
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
      // User found; send user data in the response
      return res.status(200).send({ message: 'Login successful', user: result.rows[0] });
    } else {
      return res.status(401).send({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error executing query', error.stack);
    return res.status(500).send({ message: 'Server error' });
  }
});

app.get('/userbyusername', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).send({ message: 'Username query parameter is required' });
  }
  try {
    const result = await db.query(
      'SELECT id, username, email, privacy, shared_plans FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length > 0) {
      res.json(result.rows);
    } else {
      return res.status(404).send({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user by username:', error.stack);
    return res.status(500).send({ message: 'Server error' });
  }
});

// GET Route for User Data by ID
app.get('/user', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send({ message: 'ID query parameter is required' });
  }
  try {
    const result = await db.query(
      'SELECT id, username, email, privacy, shared_plans FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length > 0) {
      res.json(result.rows);
    } else {
      return res.status(404).send({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user', error.stack);
    return res.status(500).send({ message: 'Server error' });
  }
});

// Signup Route
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

// Recipes Routes
app.get('/recipes', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM Recipes');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).send('Error fetching recipes');
  }
});

app.post('/recipes', async (req, res) => {
  const { author, title, ingredients, instructions } = req.body;

  if (!author || !title || !ingredients || !instructions) {
    return res.status(400).send({ message: 'All fields (author, title, ingredients, instructions) are required' });
  }

  try {
    const insertRecipeQuery = 'INSERT INTO Recipes (author, title, ingredients, instructions) VALUES ($1, $2, $3, $4) RETURNING *';
    const insertRecipeValues = [author, title, ingredients, instructions];
    const result = await db.query(insertRecipeQuery, insertRecipeValues);
    res.status(201).send({ message: 'Recipe created successfully' });
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send({ message: 'Server error' });
  }
});

// Calendar Routes

// POST Route for Saving Calendar Data
app.post('/calendar', async (req, res) => {
  const { user_ids, week, start_date } = req.body;
  if (!user_ids || !week || !start_date) {
    return res.status(400).send({ message: 'Missing required fields: user_ids, week, and start_date' });
  }
  try {
    // Check if a calendar for this week already exists for the first user (assuming one user per calendar)
    const checkQuery = 'SELECT * FROM calendar WHERE start_date = $1 AND $2 = ANY(user_ids)';
    const checkValues = [start_date, user_ids[0]];
    const existingCalendar = await db.query(checkQuery, checkValues);

    if (existingCalendar.rows.length > 0) {
      // If found, update the existing record
      const updateQuery = 'UPDATE calendar SET week = $1 WHERE start_date = $2 AND $3 = ANY(user_ids) RETURNING *';
      const updateValues = [week, start_date, user_ids[0]];
      const result = await db.query(updateQuery, updateValues);
      return res.status(200).send({ message: 'Calendar updated successfully', calendar: result.rows[0] });
    } else {
      // Otherwise, insert a new record
      const insertCalendarQuery = 'INSERT INTO calendar (user_ids, week, start_date) VALUES ($1, $2, $3) RETURNING *';
      const result = await db.query(insertCalendarQuery, [user_ids, week, start_date]);
      return res.status(201).send({ message: 'Calendar created successfully', calendar: result.rows[0] });
    }
  } catch (error) {
    console.error('Error saving calendar:', error.stack);
    res.status(500).send({ message: 'Server error' });
  }
});

// GET Route for Retrieving Calendar Data for a Specific Week and User
app.get('/calendar', async (req, res) => {
  const { start_date, user_id } = req.query;
  if (!user_id) {
    return res.status(400).send({ message: 'Missing user_id query parameter' });
  }
  try {
    if (start_date) {
      const query = 'SELECT * FROM calendar WHERE start_date = $1 AND $2 = ANY(user_ids)';
      const values = [start_date, Number(user_id)];
      const result = await db.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).send({ message: 'No calendar found for the given week and user' });
      }
      return res.status(200).json(result.rows);
    } else {
      const query = 'SELECT * FROM calendar WHERE $1 = ANY(user_ids) ORDER BY start_date DESC';
      const result = await db.query(query, [Number(user_id)]);
      return res.status(200).json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching calendar data:', error.stack);
    return res.status(500).send({ message: 'Server error' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
