const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const argon2 = require('argon2');


/**
 * Express Middleware Configuration
 * -------------------------------
 * - cors: Enables Cross-Origin Resource Sharing to allow requests from different domains.
 * - express.json: Built-in middleware to parse incoming JSON requests.
 */
app.use(cors());
app.use(express.json());

/**
 * PostgreSQL Database Connection Configuration
 * ----------------------------------------------
 * The database connection is established using the 'pg' library's Pool class.
 * Connection parameters (host, port, user, password, and database name) are read from environment variables.
 * SSL is enabled with 'rejectUnauthorized: false' for compatibility with managed environments.
 */
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

/**
 * Test Database Connection
 * --------------------------
 * Attempts to connect to the PostgreSQL database.
 * Logs an error message if the connection fails; otherwise, logs a success message.
 */
db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to the PostgreSQL database');
  }
});

/**
 * User Authentication Routes
 * ---------------------------
 * Contains endpoints for user login and signup functionality.
 */

/**
 * POST /login
 * -----------
 * Authenticates a user based on username and password.
 * - Expects a JSON payload containing 'username' and 'password'.
 * - Returns HTTP 400 if required fields are missing.
 * - Queries the 'users' table to verify credentials.
 * - Returns HTTP 200 with user data on success, or HTTP 401 for invalid credentials.
 */
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

/**
 * POST /signup
 * ------------
 * Registers a new user.
 * - Expects a JSON payload with 'username', 'password', and optionally 'email'.
 * - Validates required fields and checks if the username already exists.
 * - Inserts a new user record into the 'users' table.
 * - Returns HTTP 201 on successful user creation, or appropriate error statuses.
 */
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
 * ----------------
 * Endpoints for retrieving user information based on different criteria.
 */

/**
 * GET /userbyusername
 * -------------------
 * Retrieves user details by a specific username.
 * - Expects a query parameter 'username'.
 * - Returns selected fields (id, username, email, privacy, shared_plans) if found.
 * - Returns HTTP 404 if the user is not found.
 */
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

/**
 * GET /users
 * ----------
 * Searches for users with a username that partially matches the provided query.
 * - Expects a query parameter 'username'.
 * - Uses case-insensitive pattern matching (ILIKE) to find similar usernames.
 * - Returns basic user details (id, username, email) or HTTP 404 if no users match.
 */
app.get('/users', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).send({ message: 'Username query parameter is required.' });
  }

  try {
    const query = 'SELECT id, username, email FROM users WHERE username ILIKE $1';
    const result = await db.query(query, [`%${username}%`]);

    if (result.rows.length > 0) {
      return res.json(result.rows);
    } else {
      return res.status(404).send({ message: 'No users found.' });
    }
  } catch (error) {
    console.error('Error fetching users:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

/**
 * GET /user
 * ---------
 * Retrieves user information based on a unique user ID.
 * - Expects a query parameter 'id'.
 * - Returns selected user fields or HTTP 404 if the user does not exist.
 */
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
 * --------------
 * Endpoints for managing recipes.
 * Includes routes for retrieving, creating, updating, and deleting recipes.
 */

/**
 * GET /recipes
 * ------------
 * Retrieves a list of recipes, optionally filtered by a tag.
 * - Optional query parameter 'tag' to filter recipes by category.
 * - Returns all recipes if no tag is provided.
 */
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

/**
 * POST /recipes
 * -------------
 * Creates a new recipe entry.
 * - Expects a JSON payload containing 'author', 'title', 'ingredients', and 'instructions'.
 * - Optional field 'tag' for categorizing the recipe.
 * - Returns HTTP 201 with the created recipe data on success.
 */
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

/**
 * PUT /recipes/:id
 * ----------------
 * Updates an existing recipe identified by its ID.
 * - URL parameter 'id' identifies the recipe to update.
 * - Expects a JSON payload with updated 'title', 'ingredients', 'instructions', and optionally 'tag'.
 * - Returns HTTP 200 with the updated recipe data on success, or HTTP 404 if the recipe is not found.
 */
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

/**
 * DELETE /recipes/:id
 * -------------------
 * Deletes a recipe identified by its ID.
 * - URL parameter 'id' is used to identify the recipe.
 * - Returns HTTP 200 on successful deletion, or HTTP 404 if the recipe is not found.
 */
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
 * ---------------
 * Endpoints to manage calendar data associated with users.
 * Allows saving, updating, and retrieving calendar entries.
 */

/**
 * POST /calendar
 * ----------------
 * Saves or updates calendar data for a user.
 * - Expects a JSON payload containing 'user_ids' (an array), 'week', and 'start_date'.
 * - Checks if a calendar entry already exists for the given 'start_date' and the first user ID in 'user_ids':
 *   - If an entry exists, updates the 'week' field.
 *   - Otherwise, creates a new calendar entry.
 * - Returns HTTP 200 for updates and HTTP 201 for new entries.
 */
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

/**
 * PUT /calendar
 * ---------------
 * Updates an existing calendar entry.
 * - Expects a JSON payload with 'user_ids', 'week', and 'start_date'.
 * - Updates the calendar entry matching the provided 'start_date'.
 * - Returns the updated calendar entry on success, or HTTP 404 if not found.
 */
app.put('/calendar', async (req, res) => {
  const { user_ids, week, start_date } = req.body;
  if (!user_ids || !week || !start_date) {
    return res.status(400).send({ message: 'user_ids, week, and start_date are required.' });
  }

  try {
    const query = `
      UPDATE calendar
      SET user_ids = $1, week = $2
      WHERE start_date = $3
      RETURNING *;
    `;
    const values = [user_ids, week, start_date];
    const result = await db.query(query, values);

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    } else {
      return res.status(404).send({ message: 'Calendar entry not found.' });
    }
  } catch (error) {
    console.error('Error updating calendar:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

/**
 * GET /calendar
 * ---------------
 * Retrieves calendar entries.
 * - If 'start_date' is provided as a query parameter, returns calendar data for that specific week and user.
 * - If 'start_date' is not provided, returns all calendar entries for the given 'user_id', ordered by start_date descending.
 * - Expects a query parameter 'user_id' and returns HTTP 400 if missing.
 */
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
 * Log Available Routes
 * --------------------
 * Iterates through the Express router stack and logs all available routes with their corresponding HTTP methods.
 * This is useful during development to verify that all API endpoints are registered correctly.
 */
app._router.stack.forEach((layer) => {
  if (layer.route && layer.route.path) {
    console.log(`Route available: ${layer.route.stack[0].method.toUpperCase()} ${layer.route.path}`);
  }
});

/**
 * Start the Server
 * ----------------
 * Configures the application to listen on the port specified by the environment variable PORT or defaults to 3000.
 * Logs the server URL once the server starts successfully.
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
