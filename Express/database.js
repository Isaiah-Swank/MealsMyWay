require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');


// Log environment variables to check they are being loaded correctly
console.log(process.env.DB_HOST);
console.log(process.env.DB_PORT);
console.log(process.env.DB_USER);
console.log(process.env.DB_PASSWORD);
console.log(process.env.DB_NAME);

// Set up the database connection using environment variables
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,  // Directly specify the database you want to connect to
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

// Function to list all users from the 'users' table
async function listUsers() {
  try {
    const result = await db.query('SELECT * FROM users');
    console.log('Users in the users table:');
    result.rows.forEach(user => {
      console.log(user);
    });
  } catch (err) {
    console.error('Error retrieving users:', err.stack);
  }
}

async function listRecipes() {
  try {
    const result = await db.query('SELECT * FROM Recipes');
    console.log('Recipes in the recipes table:');
    result.rows.forEach(user => {
      console.log(user);
    });
  } catch (err) {
    console.error('Error retrieving recipes:', err.stack);
  }
}

async function listRecipeDetails() {
  try {
    const result = await db.query('SELECT * FROM Recipes');
    console.log('Recipes in the recipes table:');

    for (const recipe of result.rows) {
      console.log(`Title: ${recipe.title}`);
      
      if (recipe.api_id) {
        const response = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipe.api_id}`);
        const meal = response.data.meals[0];

        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
          const ingredient = meal[`strIngredient${i}`];
          const measure = meal[`strMeasure${i}`];
          if (ingredient && ingredient.trim()) {
            ingredients.push(`${ingredient} (${measure || 'to taste'})`);
          }
        }

        console.log('Ingredients (from API):');
        console.log(ingredients.join(', '));
        console.log('Instructions (from API):');
        console.log(meal.strInstructions);
      } else {
        console.log('Ingredients (from database):');
        console.log(recipe.ingredients || 'No ingredients provided');
        console.log('Instructions (from database):');
        console.log(recipe.instructions || 'No instructions provided');
      }

      console.log('-----------------------------------');
    }
  } catch (err) {
    console.error('Error retrieving recipes:', err.stack);
  }
}

// Call the function to print all users
//listUsers();
//listRecipes();
listRecipeDetails();

module.exports = db;
