const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const argon2 = require('argon2');

// Express Middleware Configuration
app.use(cors());
app.use(express.json());

// PostgreSQL Database Connection Configuration
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

// Test Database Connection
db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to the PostgreSQL database');
  }
});

// User Authentication Routes

// POST /login
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

// DeepSeek API Proxy Route
app.post('/api/deepseek', async (req, res) => {
  try {
    console.log("Made it to back end");
    const requestBody = req.body;
    console.log("Request Body:", requestBody);

    // Format the request body to include the `model` and `messages` fields
    const deepSeekRequestBody = {
      model: "deepseek-chat", // Replace with the correct model name
      messages: [
        {
          role: "user",
          content: requestBody.prompt, // Use the prompt from the frontend
        },
      ],
      max_tokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
    };

    const deepSeekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepSeekRequestBody),
    });

    console.log("DeepSeek Response Status:", deepSeekResponse.status);
    console.log("DeepSeek Response Headers:", deepSeekResponse.headers);

    if (!deepSeekResponse.ok) {
      const errorMessage = await deepSeekResponse.text();
      console.error('DeepSeek API Error:', errorMessage);
      return res.status(deepSeekResponse.status).send({ error: errorMessage });
    }

    const responseData = await deepSeekResponse.json();
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    res.status(500).send({ error: 'Server error while calling DeepSeek API.' });
  }
});

// POST /signup
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
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 2
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

// User Data Routes

// GET /userbyusername
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

// GET /users
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

// GET /user
app.get('/user', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send({ message: 'ID query parameter is required.' });
  }

  try {
    const query = 'SELECT id, username, email, privacy, shared_plans, invites FROM users WHERE id = $1';
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

// PUT /user/privacy
app.put('/user/privacy', async (req, res) => {
  const { userId, privacy } = req.body;
  if (typeof userId === 'undefined' || typeof privacy !== 'boolean') {
    return res.status(400).send({ message: 'userId and privacy (boolean) are required.' });
  }
  try {
    const query = 'UPDATE users SET privacy = $1 WHERE id = $2 RETURNING id, username, email, privacy, shared_plans, invites';
    const result = await db.query(query, [privacy, userId]);
    if (result.rows.length > 0) {
      console.log(`[PUT /user/privacy] 200 - Privacy updated for user ${userId}`);
      return res.status(200).send({ message: 'Privacy updated successfully.', user: result.rows[0] });
    } else {
      return res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error updating privacy:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// PUT /user/password
app.put('/user/password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).send({ message: 'userId, oldPassword, and newPassword are required.' });
  }
  try {
    // Fetch the user to retrieve the current password hash
    const userQuery = 'SELECT * FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).send({ message: 'User not found.' });
    }
    const user = userResult.rows[0];
    
    // Verify the provided oldPassword against the stored hash
    const isValid = await argon2.verify(user.password, oldPassword);
    if (!isValid) {
      return res.status(401).send({ message: 'Old password is incorrect.' });
    }

    // Hash the new password before storing
    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 2
    });
    const updateQuery = 'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username, email, privacy, shared_plans, invites';
    const result = await db.query(updateQuery, [hashedPassword, userId]);
    if (result.rows.length > 0) {
      console.log(`[PUT /user/password] 200 - Password updated for user ${userId}`);
      return res.status(200).send({ message: 'Password updated successfully.', user: result.rows[0] });
    } else {
      return res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error updating password:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// Recipes Routes

// GET /recipes
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

// POST /recipes
app.post('/recipes', async (req, res) => {
  const { author, title, ingredients, instructions, tag, pantry } = req.body; // Include pantry
  if (!author || !title || !ingredients || !instructions) {
    return res.status(400).send({ message: 'All fields (author, title, ingredients, instructions) are required.' });
  }

  try {
    const query = `
      INSERT INTO Recipes (author, title, ingredients, instructions, tag, pantry) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `;
    const values = [author, title, ingredients, instructions, tag || null, pantry]; // Now six values
    const result = await db.query(query, values);
    return res.status(201).send({ message: 'Recipe created successfully.', recipe: result.rows[0] });
  } catch (error) {
    console.error('Error creating recipe:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});


// PUT /recipes/:id
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

// DELETE /recipes/:id
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

// Calendar Routes

// POST /calendar
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

// PUT /calendar
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

// GET /calendar
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

// Pantry Routes

// GET /pantry
app.get('/pantry', async (req, res) => {
  const userId = parseInt(req.query.userId);
  if (isNaN(userId)) {
    return res.status(400).send({ message: 'Valid User ID is required' });
  }

  try {
    const checkQuery = 'SELECT item_list FROM pantry_freezer WHERE user_id = $1 AND pf_flag = false';
    const result = await db.query(checkQuery, [userId]);

    if (result.rows.length > 0) {
      console.log(`[PANTRY] SUCCESS - Pantry found for user ID=${userId}`);
      return res.status(200).json(result.rows[0]);
    } else {
      console.log(`[PANTRY] INFO - No pantry found for user ID=${userId}. Creating a new one...`);
      const emptyPantry = { pantry: [], freezer: [] };
      const insertQuery = `
        INSERT INTO pantry_freezer (user_id, pf_flag, item_list)
        VALUES ($1, $2, $3) RETURNING *
      `;
      const insertResult = await db.query(insertQuery, [userId, false, JSON.stringify(emptyPantry)]);
      console.log(`[PANTRY] SUCCESS - New empty pantry created for user ID=${userId}`);
      return res.status(201).json(insertResult.rows[0]);
    }
  } catch (err) {
    console.error(`[PANTRY] ERROR fetching pantry for user ID=${userId}:`, err);
    return res.status(500).send({ message: 'Error retrieving pantry items.' });
  }
});

// POST /pantry
app.post('/pantry', async (req, res) => {
  const { user_id, pf_flag, item_list } = req.body;

  if (!Number.isInteger(user_id) || typeof pf_flag !== 'boolean' || !item_list) {
    console.log('[POST /pantry] 400 - Missing or invalid required fields');
    return res.status(400).send({ message: 'Missing or invalid required fields: user_id, pf_flag, item_list.' });
  }

  try {
    const checkQuery = 'SELECT * FROM pantry_freezer WHERE user_id = $1 AND pf_flag = $2';
    const existingPantry = await db.query(checkQuery, [user_id, pf_flag]);

    if (existingPantry.rows.length > 0) {
      const updateQuery = `
        UPDATE pantry_freezer
        SET item_list = $1
        WHERE user_id = $2 AND pf_flag = $3
        RETURNING *
      `;
      const result = await db.query(updateQuery, [JSON.stringify(item_list), user_id, pf_flag]);
      console.log(`[POST /pantry] 200 - Pantry updated for user ID=${user_id}`);
      return res.status(200).send({ message: 'Pantry updated successfully.', pantry: result.rows[0] });
    } else {
      const insertQuery = `
        INSERT INTO pantry_freezer (user_id, pf_flag, item_list)
        VALUES ($1, $2, $3) RETURNING *
      `;
      const result = await db.query(insertQuery, [user_id, pf_flag, JSON.stringify(item_list)]);
      console.log(`[PANTRY] 201 - New pantry created for user ID=${user_id}`);
      return res.status(201).send({ message: 'Pantry created successfully.', pantry: result.rows[0] });
    }
  } catch (error) {
    console.error('[POST /pantry] 500 - Server error:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// PUT /pantry
app.put('/pantry', async (req, res) => {
  const { user_id, pf_flag, item_list } = req.body;

  if (!Number.isInteger(user_id) || typeof pf_flag !== 'boolean' || !item_list) {
    console.log('[PUT /pantry] 400 - Missing or invalid required fields');
    return res.status(400).send({ message: 'Missing or invalid required fields: user_id, pf_flag, item_list.' });
  }

  try {
    const updateQuery = `
      UPDATE pantry_freezer
      SET item_list = $1
      WHERE user_id = $2 AND pf_flag = $3
      RETURNING *
    `;
    const result = await db.query(updateQuery, [JSON.stringify(item_list), user_id, pf_flag]);

    if (result.rows.length > 0) {
      console.log(`[PUT /pantry] 200 - Pantry updated for user ID=${user_id}`);
      return res.status(200).send({ message: 'Pantry updated successfully.', pantry: result.rows[0] });
    } else {
      console.log(`[PUT /pantry] 404 - Pantry not found for user ID=${user_id}`);
      return res.status(404).send({ message: 'Pantry not found.' });
    }
  } catch (error) {
    console.error('[PUT /pantry] 500 - Server error:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// DELETE /pantry
app.delete('/pantry', async (req, res) => {
  const userId = parseInt(req.query.userId);
  if (isNaN(userId)) {
    console.log('[PANTRY] 400 - Invalid user ID');
    return res.status(400).send({ message: 'Valid User ID is required.' });
  }

  try {
    const deleteQuery = 'DELETE FROM pantry_freezer WHERE user_id = $1 RETURNING *';
    const result = await db.query(deleteQuery, [userId]);

    if (result.rows.length > 0) {
      console.log(`[PANTRY] 200 - Pantry deleted for user ${userId}`);
      return res.status(200).json({ message: 'Pantry deleted successfully.', pantry: result.rows[0] });
    } else {
      console.log(`[PANTRY] 404 - No pantry found for user ${userId}`);
      return res.status(404).send({ message: 'No pantry found for this user.' });
    }
  } catch (error) {
    console.error(`[PANTRY] 500 - Server error while deleting pantry for user ${userId}:`, error.stack);
    return res.status(500).send({ message: 'Error deleting pantry.', error: error.stack });
  }
});

// -------------------- New Route: Send Calendar Invite --------------------
// Instead of directly adding a user, this route updates the recipient's "invites" column
// in the users table by appending the senderId.
app.post('/user/send-invite', async (req, res) => {
  const { senderId, recipientId, plan } = req.body;
  if (!senderId || !recipientId) {
    return res.status(400).send({ message: 'senderId and recipientId are required.' });
  }
  try {
    // Update the recipient's invites column. Cast the array literal to integer[]
    const updateQuery = `
      UPDATE users 
      SET invites = CASE 
        WHEN invites IS NULL THEN ARRAY[$1]::integer[] 
        ELSE array_append(invites, $1) 
      END
      WHERE id = $2
      RETURNING *;
    `;
    const result = await db.query(updateQuery, [senderId, recipientId]);
    if (result.rows.length > 0) {
      console.log('Invite sent:', result.rows[0]);
      return res.status(200).send({ message: 'Invite sent successfully.', user: result.rows[0] });
    } else {
      return res.status(404).send({ message: 'Recipient not found.' });
    }
  } catch (error) {
    console.error('Error sending invite:', error.stack);
    return res.status(500).send({ message: 'Server error while sending invite.' });
  }
});

// Retrieves the invites array from the user's record.
app.get('/user/pending-invites', async (req, res) => {
  const userId = parseInt(req.query.userId);
  if (!userId) {
    return res.status(400).send({ message: 'userId is required.' });
  }
  try {
    const query = 'SELECT invites FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    if (result.rows.length > 0) {
      // Return the invites array; if null, return an empty array.
      const invites = result.rows[0].invites || [];
      return res.status(200).json(invites);
    } else {
      return res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error fetching pending invites:', error.stack);
    return res.status(500).send({ message: 'Server error fetching pending invites.' });
  }
});

// -------------------- New Route: Update Sender's Calendars with Shared Users --------------------
// This endpoint updates every calendar that the sender owns by merging the sender's shared_plans list into user_ids.
app.put('/calendar/update-shared', async (req, res) => {
  const { senderId } = req.body;
  if (!senderId) {
    return res.status(400).send({ message: 'senderId is required.' });
  }
  try {
    // Retrieve the sender's shared_plans list.
    const userResult = await db.query('SELECT shared_plans FROM users WHERE id = $1', [senderId]);
    if (userResult.rows.length === 0) {
      return res.status(404).send({ message: 'Sender not found.' });
    }
    const sharedUsers = userResult.rows[0].shared_plans || [];
    // Update every calendar that the sender owns by merging sharedUsers into user_ids.
    const updateQuery = `
      UPDATE calendar
      SET user_ids = (
        SELECT array_agg(DISTINCT uid)
        FROM unnest(user_ids || $1::int[]) AS uid
      )
      WHERE $2 = ANY(user_ids)
      RETURNING *;
    `;
    const calResult = await db.query(updateQuery, [sharedUsers, senderId]);
    return res.status(200).send({ message: 'Calendars updated with shared users.', calendars: calResult.rows });
  } catch (error) {
    console.error('Error updating calendars with shared users:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// PUT /user/shared-plans
// Updates the shared_plans array for a user.
app.put('/user/shared-plans', async (req, res) => {
  const { userId, shared_plans } = req.body;
  if (!userId || !Array.isArray(shared_plans)) {
    return res.status(400).send({ message: 'userId and shared_plans (array) are required.' });
  }
  try {
    const updateQuery = 'UPDATE users SET shared_plans = $1 WHERE id = $2 RETURNING id, username, email, privacy, shared_plans';
    const result = await db.query(updateQuery, [shared_plans, userId]);
    if (result.rows.length > 0) {
      console.log(`[PUT /user/shared-plans] 200 - Updated shared_plans for user ${userId}`);
      return res.status(200).send({ message: 'Shared plans updated successfully.', user: result.rows[0] });
    } else {
      return res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error updating shared plans:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});

// --------------------  Get Multiple Users by IDs --------------------
// GET /user/multiple
app.get('/user/multiple', async (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) {
    return res.status(400).send({ message: 'ids query parameter is required.' });
  }
  try {
    // Convert the comma-separated string into an array of numbers
    const ids = idsParam.split(',').map(Number);
    const query = 'SELECT id, username, email FROM users WHERE id = ANY($1)';
    const result = await db.query(query, [ids]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching multiple users:', error.stack);
    return res.status(500).send({ message: 'Server error fetching multiple users.' });
  }
});

// --------------------  Get Users Sharing With Me --------------------
// GET /user/shared-with
app.get('/user/shared-with', async (req, res) => {
  const userId = parseInt(req.query.userId);
  if (!userId) {
    return res.status(400).send({ message: 'userId is required.' });
  }
  try {
    const query = 'SELECT id, username, email FROM users WHERE $1 = ANY(shared_plans)';
    const result = await db.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching shared-with data:', error.stack);
    return res.status(500).send({ message: 'Server error.' });
  }
});



// Log Available Routes
app._router.stack.forEach((layer) => {
  if (layer.route && layer.route.path) {
    console.log(`Route available: ${layer.route.stack[0].method.toUpperCase()} ${layer.route.path}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
