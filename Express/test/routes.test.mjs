import { expect } from 'chai';
import request from 'supertest';
import app from '../server.js';


describe('🔍 Backend Route Tests', () => {

  // 📌 Test /login route
  describe('POST /login', () => {
    it('should return 400 if username or password is missing', async () => {
      const res = await request(app).post('/login').send({ username: 'user' });
      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('Username and password are required');
    });
  });

  // 📌 Test /signup route
  describe('POST /signup', () => {
    it('should return 400 when username or password is missing', async () => {
      const res = await request(app).post('/signup').send({ username: 'testUser' });
      expect(res.status).to.equal(400);
    });
  });

  // 📌 Test GET /recipes
  describe('GET /recipes', () => {
    it('should fetch all recipes', async () => {
      const res = await request(app).get('/recipes');
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
    });

    it('should fetch recipes with specific tag', async () => {
      const res = await request(app).get('/recipes').query({ tag: 'dessert' });
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
    });
  });

  // 📌 Test POST /recipes
  describe('POST /recipes', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/recipes').send({ title: 'Cake' });
      expect(res.status).to.equal(400);
    });

    it('should create a new recipe', async () => {
      const newRecipe = {
        author: 'Chef Max',
        title: 'Chocolate Cake',
        ingredients: 'Flour, Sugar, Cocoa',
        instructions: 'Mix and bake.',
        tag: 'dessert'
      };
      const res = await request(app).post('/recipes').send(newRecipe);
      expect(res.status).to.equal(201);
      expect(res.body.message).to.equal('Recipe created successfully');
    });
  });

  // 📌 Test PUT /recipes/:id
  describe('PUT /recipes/:id', () => {
    it('should return 400 if fields are missing', async () => {
      const res = await request(app).put('/recipes/1').send({ title: 'Updated Cake' });
      expect(res.status).to.equal(400);
    });
  });

  // 📌 Test DELETE /recipes/:id
  describe('DELETE /recipes/:id', () => {
    it('should return 404 for non-existent recipe', async () => {
      const res = await request(app).delete('/recipes/999');
      expect(res.status).to.equal(404);
      expect(res.body.message).to.equal('Recipe not found');
    });
  });
});
