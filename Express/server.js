const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { Pool } = require('pg');  // Use the Pool from pg for DB connections
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON request bodies

// Set up the database connection using environment variables
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false, // Allows self-signed certificates
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
    // Query the users table to check if the username and password exist
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    const values = [username, password];
    const result = await db.query(query, values); // Use db.query here

    if (result.rows.length > 0) {
      // User found, respond with success
      return res.status(200).send({ message: 'Login successful' });
    } else {
      // User not found
      return res.status(401).send({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error executing query', error.stack);
    return res.status(500).send({ message: 'Server error' });
  }
});


app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).send({ message: 'Username and password are required' });
  }

  try {
    // Check if the username already exists
    const checkUserQuery = 'SELECT * FROM users WHERE username = $1';
    const checkUserValues = [username];
    const result = await db.query(checkUserQuery, checkUserValues);

    if (result.rows.length > 0) {
      // Username already exists
      return res.status(400).send({ message: 'Username already exists' });
    }

    // Insert the new user into the database, including email
    const insertUserQuery = 'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)';
    const insertUserValues = [username, password, email];
    await db.query(insertUserQuery, insertUserValues);

    // Respond with success
    res.status(201).send({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send({ message: 'Server error' });
  }
});

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

  // Validate the input data
  if (!author || !title || !ingredients || !instructions) {
    return res.status(400).send({ message: 'All fields (author, title, ingredients, instructions) are required' });
  }

  try {
    // Split ingredients by comma and trim spaces if necessary
    //const ingredientList = ingredients.split(',').map(ingredient => ingredient.trim());

    // Insert the new recipe into the database
    const insertRecipeQuery = 'INSERT INTO Recipes (author, title, ingredients, instructions) VALUES ($1, $2, $3, $4) RETURNING *';
    const insertRecipeValues = [author, title, ingredients, instructions];
    //console.log(ingredients);
    const result = await db.query(insertRecipeQuery, insertRecipeValues);

    // Get the newly inserted recipe (optional if you want to return it)
    const newRecipe = result.rows[0];

    // Return the success response
    res.status(201).send({ message: 'Recipe created successfully' });
  } catch (error) {
    console.error('Error executing query', error.stack);
    res.status(500).send({ message: 'Server error' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


