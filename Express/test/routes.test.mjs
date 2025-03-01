import { expect } from 'chai';
import request from 'supertest';
import sinon from 'sinon';
import app from '../server.js';
import pkg from 'pg';  // Import entire pg module
import argon2 from 'argon2';
const { Pool } = pkg;

describe('🔍 Backend Route Tests', () => {
  let dbStub;

  // Mock database before each test
  beforeEach(() => {
    //dbStub.restore(); // Ensure no previous stub lingers
    dbStub = sinon.stub(Pool.prototype, 'query');
  });
  

  // Restore the original database behavior after each test
  afterEach(() => {
    dbStub.restore();
  });

  /** Authentication Routes **/
  describe('POST /login', () => {
    it('should return 400 if username or password is missing', async () => {
      const res = await request(app).post('/login').send({ username: 'user' });
      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('Username and password are required.');
    });
  
    it('should return 200 on successful login', async () => {
      const hashedPassword = await argon2.hash('testPass'); // Hash password before mocking DB
      dbStub.resolves({ rows: [{ id: 1, username: 'testUser', password: hashedPassword }] });
  
      const res = await request(app).post('/login').send({ username: 'testUser', password: 'testPass' });
  
      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal('Login successful.');
    });
  
    it('should return 401 for an incorrect password', async () => {
      const hashedPassword = await argon2.hash('correctPass'); // Hash the real stored password
      dbStub.resolves({ rows: [{ id: 1, username: 'testUser', password: hashedPassword }] });
  
      const res = await request(app).post('/login').send({ username: 'testUser', password: 'wrongPass' });
  
      expect(res.status).to.equal(401);
      expect(res.body.message).to.equal('Invalid username or password.');
    });
  
    it('should return 401 if user does not exist', async () => {
      dbStub.resolves({ rows: [] });
  
      const res = await request(app).post('/login').send({ username: 'nonExistentUser', password: 'somePass' });
  
      expect(res.status).to.equal(401);
      expect(res.body.message).to.equal('Invalid username or password.');
    });
  });
  

  describe('POST /signup', () => {
    it('should return 400 when username or password is missing', async () => {
      const res = await request(app).post('/signup').send({ username: 'testUser' });
      expect(res.status).to.equal(400);
    });

    it('should return 201 on successful user creation', async () => {
      dbStub.resolves({ rows: [] });

      const res = await request(app).post('/signup').send({
        username: 'newUser',
        password: 'securePass',
        email: 'test@example.com',
      });
      expect(res.status).to.equal(201);
      expect(res.body.message).to.equal('User created successfully.');
    });
  });

  /** User Data Routes **/
  describe('GET /userbyusername', () => {
    it('should return 400 if username is missing', async () => {
      const res = await request(app).get('/userbyusername');
      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('Username query parameter is required.');
    });

    it('should return 200 and user data when username exists', async () => {
      dbStub.resolves({ rows: [{ id: 1, username: 'testUser', email: 'test@example.com' }] });
      const res = await request(app).get('/userbyusername').query({ username: 'testUser' });
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array').that.is.not.empty;
    });
  });

  describe('GET /user', () => {
    it('should return 400 if ID is missing', async () => {
      const res = await request(app).get('/user');
      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('ID query parameter is required.');
    });

    it('should return 200 and user data when ID exists', async () => {
      dbStub.resolves({ rows: [{ id: 1, username: 'testUser', email: 'test@example.com' }] });
      const res = await request(app).get('/user').query({ id: 1 });
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array').that.is.not.empty;
    });
  });

  /** Recipes Routes **/
  describe('GET /recipes', () => {
    it('should fetch all recipes', async () => {
      dbStub.resolves({ rows: [{ id: 1, title: 'Chocolate Cake' }] });
      const res = await request(app).get('/recipes');
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
    });
  });

  describe('POST /recipes', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/recipes').send({ title: 'Cake' });
      expect(res.status).to.equal(400);
    });

    it('should return 201 when a recipe is created successfully', async () => {
      dbStub.resolves({ rows: [{ id: 1, title: 'Chocolate Cake' }] });

      const res = await request(app).post('/recipes').send({
        author: 'Chef Max',
        title: 'Chocolate Cake',
        ingredients: 'Flour, Sugar, Cocoa',
        instructions: 'Mix and bake.',
        tag: 'dessert',
      });
      expect(res.status).to.equal(201);
      expect(res.body.message).to.equal('Recipe created successfully.');
    });
  });

  /** Calendar Routes **/
  describe('POST /calendar', () => {
    beforeEach(() => {
      dbStub.restore();
      dbStub = sinon.stub(Pool.prototype, 'query');
    }); 
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app).post('/calendar').send({ user_ids: [1] });
      expect(res.status).to.equal(400);
    });

    it('should return 201 when a new calendar entry is created', async () => {
      dbStub.callsFake(async (query, values) => {
        if (query.includes('SELECT * FROM calendar WHERE start_date')) {
          return { rows: [] };  // Ensure no existing record is found
        }
        if (query.includes('INSERT INTO calendar')) {
          return { rows: [{ id: 99, start_date: values[0] }] };  // Simulate new entry
        }
      });
    
      const res = await request(app).post('/calendar').send({
        user_ids: [1],
        week: { monday: [], tuesday: [] }, // Updated week structure
        start_date: '2025-03-01',
      });
    
      expect(res.status).to.equal(201);
      expect(res.body.message).to.equal('Calendar created successfully.');
    });

    it('should return 200 when an existing calendar entry is updated', async () => {
      dbStub.onFirstCall().resolves({ rows: [{ id: 1, start_date: '2025-03-01' }] }); // Simulate existing entry
      dbStub.onSecondCall().resolves({ rows: [{ id: 1, start_date: '2025-03-01' }] }); // Simulate update success

      const res = await request(app).post('/calendar').send({
        user_ids: [1],
        week: 'Week 10',
        start_date: '2025-03-01',
      });
      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal('Calendar updated successfully.');
    });
  });
});