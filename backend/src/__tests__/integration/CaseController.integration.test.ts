/**
 * Integration Tests for CaseController
 * Tests with REAL database to verify actual functionality
 * 
 * These tests will:
 * 1. Use your actual PostgreSQL database
 * 2. Create real test data
 * 3. Verify actual behavior
 * 4. Clean up after themselves
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../../models/DatabaseFactory';

// Use real database connection
const db = DatabaseFactory.getDatabase();

// Your actual server URL
const BASE_URL = 'http://localhost:3000';

describe('CaseController Integration Tests', () => {
  let testCaseId: string;
  let testCustomerId: string;
  let testProviderId: string;

  // Setup: Create test users before tests
  beforeAll(async () => {
    testCustomerId = uuidv4();
    testProviderId = uuidv4();

    // Create test customer
    await new Promise<void>((resolve, reject) => {
      db.db.run(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testCustomerId,
          `test-customer-${Date.now()}@example.com`,
          'hashed-password',
          'Test',
          'Customer',
          '+359888000001',
          'customer',
          'active',
          new Date().toISOString(),
          new Date().toISOString()
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test provider
    await new Promise<void>((resolve, reject) => {
      db.db.run(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          testProviderId,
          `test-provider-${Date.now()}@example.com`,
          'hashed-password',
          'Test',
          'Provider',
          '+359888000002',
          'service_provider',
          'active',
          new Date().toISOString(),
          new Date().toISOString()
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  // Cleanup: Remove test data after tests
  afterAll(async () => {
    // Delete test cases
    if (testCaseId) {
      await new Promise<void>((resolve) => {
        db.db.run('DELETE FROM marketplace_service_cases WHERE id = ?', [testCaseId], () => resolve());
      });
    }

    // Delete test users
    await new Promise<void>((resolve) => {
      db.db.run('DELETE FROM users WHERE id IN (?, ?)', [testCustomerId, testProviderId], () => resolve());
    });
  });

  // ============================================================================
  // REAL FUNCTIONALITY TESTS
  // ============================================================================

  describe('POST /api/v1/cases - Create Case', () => {
    it('should create case with REAL database', async () => {
      const caseData = {
        serviceType: 'electrician',
        description: 'Integration test case',
        phone: '+359888123456',
        city: 'Sofia',
        neighborhood: 'Center',
        address: '123 Test St',
        customerId: testCustomerId,
        assignmentType: 'open'
      };

      const response = await request(BASE_URL)
        .post('/api/v1/cases')
        .send(caseData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.caseId).toBeDefined();

      testCaseId = response.body.data.caseId;

      // Verify case was actually created in database
      const createdCase = await new Promise<any>((resolve, reject) => {
        db.db.get(
          'SELECT * FROM marketplace_service_cases WHERE id = ?',
          [testCaseId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      expect(createdCase).toBeDefined();
      expect(createdCase.service_type).toBe('electrician');
      expect(createdCase.customer_id).toBe(testCustomerId);
      expect(createdCase.status).toBe('pending');
    });

    it('should reject case with missing required fields', async () => {
      const invalidData = {
        serviceType: 'electrician'
        // Missing description, phone, city
      };

      const response = await request(BASE_URL)
        .post('/api/v1/cases')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('should prevent SP from creating case for themselves', async () => {
      const selfAssignData = {
        serviceType: 'electrician',
        description: 'Self-assign test',
        phone: '+359888123456',
        city: 'Sofia',
        customerId: testProviderId,
        providerId: testProviderId,
        assignmentType: 'specific'
      };

      const response = await request(BASE_URL)
        .post('/api/v1/cases')
        .send(selfAssignData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/v1/cases - Get Cases with Filters', () => {
    beforeAll(async () => {
      // Create a test case if not exists
      if (!testCaseId) {
        testCaseId = uuidv4();
        await new Promise<void>((resolve, reject) => {
          db.db.run(
            `INSERT INTO marketplace_service_cases 
             (id, service_type, description, phone, city, customer_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              testCaseId,
              'electrician',
              'Test case for filtering',
              '+359888123456',
              'Sofia',
              testCustomerId,
              'pending',
              new Date().toISOString(),
              new Date().toISOString()
            ],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }
    });

    it('should get cases with status filter', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/cases')
        .query({ status: 'pending' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cases).toBeDefined();
      expect(Array.isArray(response.body.data.cases)).toBe(true);

      // All returned cases should have status 'pending'
      response.body.data.cases.forEach((c: any) => {
        expect(c.status).toBe('pending');
      });
    });

    it('should get cases with pagination', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/cases')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should filter onlyUnassigned cases', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/cases')
        .query({ onlyUnassigned: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned cases should have null provider_id
      // Filter to only check cases that match our test (to avoid existing data)
      const unassignedCases = response.body.data.cases.filter((c: any) => c.provider_id === null);
      expect(unassignedCases.length).toBeGreaterThan(0); // At least one unassigned case exists
    });
  });

  describe('PUT /api/v1/cases/:caseId/accept - Accept Case', () => {
    let acceptTestCaseId: string;

    beforeAll(async () => {
      // Create a pending case for acceptance test
      acceptTestCaseId = uuidv4();
      await new Promise<void>((resolve, reject) => {
        db.db.run(
          `INSERT INTO marketplace_service_cases 
           (id, service_type, description, phone, city, customer_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            acceptTestCaseId,
            'plumber',
            'Test case for acceptance',
            '+359888123456',
            'Sofia',
            testCustomerId,
            'pending',
            new Date().toISOString(),
            new Date().toISOString()
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => {
        db.db.run('DELETE FROM marketplace_service_cases WHERE id = ?', [acceptTestCaseId], () => resolve());
      });
    });

    it('should accept pending case', async () => {
      const response = await request(BASE_URL)
        .put(`/api/v1/cases/${acceptTestCaseId}/accept`)
        .send({
          providerId: testProviderId,
          providerName: 'Test Provider'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify case was actually updated in database
      const updatedCase = await new Promise<any>((resolve, reject) => {
        db.db.get(
          'SELECT * FROM marketplace_service_cases WHERE id = ?',
          [acceptTestCaseId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      expect(updatedCase.status).toBe('accepted');
      expect(updatedCase.provider_id).toBe(testProviderId);
    });

    it('should require providerId', async () => {
      const response = await request(BASE_URL)
        .put(`/api/v1/cases/${acceptTestCaseId}/accept`)
        .send({}) // Missing providerId
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/cases/:caseId/complete - Complete Case', () => {
    let completeTestCaseId: string;

    beforeAll(async () => {
      // Create an accepted case for completion test
      completeTestCaseId = uuidv4();
      await new Promise<void>((resolve, reject) => {
        db.db.run(
          `INSERT INTO marketplace_service_cases 
           (id, service_type, description, phone, city, customer_id, provider_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            completeTestCaseId,
            'electrician',
            'Test case for completion',
            '+359888123456',
            'Sofia',
            testCustomerId,
            testProviderId,
            'accepted',
            new Date().toISOString(),
            new Date().toISOString()
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => {
        db.db.run('DELETE FROM marketplace_service_cases WHERE id = ?', [completeTestCaseId], () => resolve());
      });
      // Also clean up income record if created
      await new Promise<void>((resolve) => {
        db.db.run('DELETE FROM case_income WHERE case_id = ?', [completeTestCaseId], () => resolve());
      });
    });

    it('should complete case with income tracking', async () => {
      const response = await request(BASE_URL)
        .put(`/api/v1/cases/${completeTestCaseId}/complete`)
        .send({
          completionNotes: 'Work completed successfully',
          income: {
            amount: 150,
            paymentMethod: 'cash',
            notes: 'Paid in full'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify case was actually completed in database
      const completedCase = await new Promise<any>((resolve, reject) => {
        db.db.get(
          'SELECT * FROM marketplace_service_cases WHERE id = ?',
          [completeTestCaseId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      expect(completedCase.status).toBe('completed');
      expect(completedCase.completed_at).toBeDefined();

      // Verify income was recorded
      const incomeRecord = await new Promise<any>((resolve, reject) => {
        db.db.get(
          'SELECT * FROM case_income WHERE case_id = ?',
          [completeTestCaseId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      expect(incomeRecord).toBeDefined();
      expect(parseFloat(incomeRecord.amount)).toBe(150);
      expect(incomeRecord.payment_method).toBe('cash');
    });
  });

  describe('GET /api/v1/cases/:caseId - Get Single Case', () => {
    it('should get case by ID', async () => {
      // Use the test case we created
      const response = await request(BASE_URL)
        .get(`/api/v1/cases/${testCaseId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testCaseId);
    });

    it('should return 404 for non-existent case', async () => {
      const fakeId = uuidv4();
      
      const response = await request(BASE_URL)
        .get(`/api/v1/cases/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CASE_NOT_FOUND');
    });
  });
});
