const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const argon2 = require('argon2');


// Middleware
app.use(cors());
app.use(express.json());

// Configure PostgreSQL connection using environment variables
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

// Test the database connection
db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to the PostgreSQL database');
  }
});

/**
 * User Authentication Routes
 */

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    console.log(`[LOGIN] 400 - Username or password missing`);
    return res.status(400).send({ message: 'Username and password are required.' });
  }

  try {
    // Fetch the user by username
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await db.query(query, [username]);

    if (result.rows.length === 0) {
      console.log(`[LOGIN] 401 - Invalid credentials`);
      return res.status(401).send({ message: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const storedHash = user.password;

    // Verify password using Argon2
    const isPasswordValid = await argon2.verify(storedHash, password);

    if (!isPasswordValid) {
      console.log(`[LOGIN] 401 - Invalid credentials`);
      return res.status(401).send({ message: 'Invalid username or password.' });
    }

    console.log(`[LOGIN] 200 - User logged in:`, user);
    return res.status(200).send({ message: 'Login successful.', user });
  } catch (error) {
    console.error(`[LOGIN] 500 - Server error:`, error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});


// Signup Route
// Signup Route with Password Hashing
app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).send({ message: 'Username and password are required.' });
  }

  try {
    // Check if the username already exists
    const checkUserQuery = 'SELECT * FROM users WHERE username = $1';
    const existingUser = await db.query(checkUserQuery, [username]);

    if (existingUser.rows.length > 0) {
      return res.status(400).send({ message: 'Username already exists.' });
    }

    // Hash the password before storing
    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64MB memory usage (resistant to GPU attacks)
      timeCost: 3,         // Iterations (adjust for performance/security)
      parallelism: 2       // Parallel threads
    });

    // Insert the user with the hashed password
    const insertUserQuery = 'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)';
    await db.query(insertUserQuery, [username, hashedPassword, email]);

    return res.status(201).send({ message: 'User created successfully.' });
  } catch (error) {
    console.error('Error during signup:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});


/**
 * User Data Routes
 */

// Retrieve user by username
app.get('/userbyusername', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).send({ message: 'Username query parameter is required.' });
  }

  try {
    const query = 'SELECT id, username, email, privacy, shared_plans FROM users WHERE username = $1';
    const result = await db.query(query, [username]);

    if (result.rows.length > 0) {
      return res.json(result.rows);
    } else {
      return res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error fetching user by username:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// Retrieve user by ID
app.get('/user', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send({ message: 'ID query parameter is required.' });
  }

  try {
    const query = 'SELECT id, username, email, privacy, shared_plans FROM users WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length > 0) {
      return res.json(result.rows);
    } else {
      return res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error fetching user:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

/**
 * Recipes Routes
 */

// Retrieve recipes with optional tag filtering
app.get('/recipes', async (req, res) => {
  const { tag } = req.query;
  try {
    let query = 'SELECT * FROM Recipes';
    const values = [];
    if (tag) {
      query += ' WHERE tag = $1';
      values.push(tag);
    }
    const result = await db.query(query, values);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    return res.status(500).send('Error fetching recipes.');
  }
});

// Create a new recipe with an optional tag
app.post('/recipes', async (req, res) => {
  const { author, title, ingredients, instructions, tag } = req.body;
  if (!author || !title || !ingredients || !instructions) {
    return res.status(400).send({ message: 'All fields (author, title, ingredients, instructions) are required.' });
  }

  try {
    const query = `
      INSERT INTO Recipes (author, title, ingredients, instructions, tag) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [author, title, ingredients, instructions, tag || null];
    const result = await db.query(query, values);
    return res.status(201).send({ message: 'Recipe created successfully.', recipe: result.rows[0] });
  } catch (error) {
    console.error('Error creating recipe:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// Update an existing recipe
app.put('/recipes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, ingredients, instructions, tag } = req.body;
  if (!title || !ingredients || !instructions) {
    return res.status(400).send({ message: 'All fields are required.' });
  }

  try {
    const query = `
      UPDATE Recipes 
      SET title = $1, ingredients = $2, instructions = $3, tag = $4
      WHERE id = $5 RETURNING *
    `;
    const values = [title, ingredients, instructions, tag, id];
    const result = await db.query(query, values);

    if (result.rows.length > 0) {
      return res.status(200).send({ message: 'Recipe updated successfully.', recipe: result.rows[0] });
    } else {
      return res.status(404).send({ message: 'Recipe not found.' });
    }
  } catch (error) {
    console.error('Error updating recipe:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// Delete a recipe
app.delete('/recipes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM Recipes WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);

    if (result.rows.length > 0) {
      return res.status(200).send({ message: 'Recipe deleted successfully.' });
    } else {
      return res.status(404).send({ message: 'Recipe not found.' });
    }
  } catch (error) {
    console.error('Error deleting recipe:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

/**
 * Calendar Routes
 */

// Save or update calendar data
app.post('/calendar', async (req, res) => {
  const { user_ids, week, start_date } = req.body;
  
  if (!user_ids || !week || !start_date) {
    console.log(`[POST /calendar] 400 - Missing required fields`);
    return res.status(400).send({ message: 'Missing required fields: user_ids, week, and start_date.' });
  }

  try {
    const checkQuery = 'SELECT * FROM calendar WHERE start_date = $1 AND $2 = ANY(user_ids)';
    const existingCalendar = await db.query(checkQuery, [start_date, user_ids[0]]);

    if (existingCalendar.rows.length > 0) {
      const updateQuery = 'UPDATE calendar SET week = $1 WHERE start_date = $2 AND $3 = ANY(user_ids) RETURNING *';
      const result = await db.query(updateQuery, [week, start_date, user_ids[0]]);
      
      console.log(`[POST /calendar] 200 - Calendar updated for user ${user_ids[0]}`);
      return res.status(200).send({ message: 'Calendar updated successfully.', calendar: result.rows[0] });
    } else {
      const insertQuery = 'INSERT INTO calendar (user_ids, week, start_date) VALUES ($1, $2, $3) RETURNING *';
      const result = await db.query(insertQuery, [user_ids, week, start_date]);

      console.log(`[POST /calendar] 201 - New calendar created for user ${user_ids[0]}`);
      return res.status(201).send({ message: 'Calendar created successfully.', calendar: result.rows[0] });
    }
  } catch (error) {
    console.error(`[POST /calendar] 500 - Server error:`, error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});


// Retrieve calendar data for a specific week and user, or all calendars for a user
app.get('/calendar', async (req, res) => {
  const { start_date, user_id } = req.query;
  if (!user_id) {
    return res.status(400).send({ message: 'Missing user_id query parameter.' });
  }

  try {
    if (start_date) {
      const query = 'SELECT * FROM calendar WHERE start_date = $1 AND $2 = ANY(user_ids)';
      const result = await db.query(query, [start_date, Number(user_id)]);
      if (result.rows.length === 0) {
        return res.status(404).send({ message: 'No calendar found for the specified week and user.' });
      }
      return res.status(200).json(result.rows);
    } else {
      const query = 'SELECT * FROM calendar WHERE $1 = ANY(user_ids) ORDER BY start_date DESC';
      const result = await db.query(query, [Number(user_id)]);
      return res.status(200).json(result.rows);
    }
  } catch (error) {
    console.error('Error fetching calendar data:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

/**
 * Log all available routes
 */
app._router.stack.forEach((layer) => {
  if (layer.route && layer.route.path) {
    console.log(`Route available: ${layer.route.stack[0].method.toUpperCase()} ${layer.route.path}`);
  }
});

/**
 * Start the server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
