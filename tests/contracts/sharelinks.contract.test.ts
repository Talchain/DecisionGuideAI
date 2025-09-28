/**
 * Contract tests for Share Links API
 * Tests encoding/decoding with size limits and round-trip validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleEncodeRequest, handleDecodeRequest, testRoundTrip } from '../../src/lib/sharelinks-api';

describe('Share Links API Contract', () => {
  const validTemplate = {
    template: {
      template_name: 'Test Template',
      seed: 42,
      description: 'A test template for contract validation',
      scenario: {
        title: 'Test Decision',
        context: 'This is a test scenario for validation',
        stakeholders: ['Product', 'Engineering'],
        options: [
          {
            id: 'option_a',
            name: 'Option A',
            pros: ['Pro 1', 'Pro 2'],
            cons: ['Con 1']
          },
          {
            id: 'option_b',
            name: 'Option B',
            pros: ['Pro 1'],
            cons: ['Con 1', 'Con 2']
          }
        ],
        constraints: {
          budget: '£100k',
          timeline: '6 months'
        },
        success_metrics: ['Metric 1', 'Metric 2']
      }
    }
  };

  describe('POST /templates/encode', () => {
    it('should encode valid template successfully', async () => {
      const result = await handleEncodeRequest(validTemplate);

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        data: expect.any(String)
      });

      // Verify base64 format
      expect(result.body.data).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Check headers
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
    });

    it('should return BAD_INPUT for missing template', async () => {
      const result = await handleEncodeRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Template is required');
      expect(result.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return BAD_INPUT for template without scenario', async () => {
      const invalidTemplate = {
        template: {
          template_name: 'Invalid'
        }
      };

      const result = await handleEncodeRequest(invalidTemplate);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Template must contain a scenario');
    });

    it('should return BAD_INPUT for oversized template', async () => {
      // Create a template that will exceed the compressed size limit
      const oversizedTemplate = {
        template: {
          scenario: {
            title: 'Oversized Test',
            context: 'x'.repeat(10000), // Very large context
            options: Array.from({ length: 50 }, (_, i) => ({
              id: `option_${i}`,
              name: `Option ${i}`,
              description: 'x'.repeat(1000)
            }))
          }
        }
      };

      const result = await handleEncodeRequest(oversizedTemplate);

      expect(result.status).toBe(413);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Compressed payload exceeds');
    });

    it('should return BAD_INPUT for template exceeding node cap', async () => {
      const complexTemplate = {
        template: {
          scenario: {
            title: 'Complex Template',
            context: 'Too many nodes',
            options: Array.from({ length: 15 }, (_, i) => ({
              id: `option_${i}`,
              name: `Option ${i}`
            })),
            stakeholders: Array.from({ length: 5 }, (_, i) => `Stakeholder ${i}`),
            constraints: Object.fromEntries(
              Array.from({ length: 5 }, (_, i) => [`constraint_${i}`, `Value ${i}`])
            )
          }
        }
      };

      const result = await handleEncodeRequest(complexTemplate);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Scenario too large for pilot');
    });
  });

  describe('GET /templates/decode', () => {
    let encodedData: string;

    beforeEach(async () => {
      const encodeResult = await handleEncodeRequest(validTemplate);
      encodedData = encodeResult.body.data;
    });

    it('should decode valid data successfully', async () => {
      const result = await handleDecodeRequest({ data: encodedData });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        template: validTemplate.template
      });

      // Check headers
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      });
    });

    it('should return BAD_INPUT for missing data parameter', async () => {
      const result = await handleDecodeRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('data parameter is required');
    });

    it('should return BAD_INPUT for invalid base64 data', async () => {
      const result = await handleDecodeRequest({ data: 'invalid-base64!' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Invalid compressed data format');
    });

    it('should return BAD_INPUT for oversized data parameter', async () => {
      const oversizedData = 'x'.repeat(5000); // Exceeds size limit

      const result = await handleDecodeRequest({ data: oversizedData });

      expect(result.status).toBe(413);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Compressed payload exceeds size limit');
    });

    it('should return BAD_INPUT for data that decompresses to invalid template', async () => {
      // Create template with scenario but missing other required structure
      const templateWithoutScenario = { template: { title: 'test', options: [] } };
      const encodeResult = await handleEncodeRequest(templateWithoutScenario);

      // The encode should fail validation too
      expect(encodeResult.status).toBe(400);
      expect(encodeResult.body.type).toBe('BAD_INPUT');
      expect(encodeResult.body.message).toContain('Template must contain a scenario');
    });
  });

  describe('Round-trip validation', () => {
    it('should maintain data integrity through encode/decode cycle', async () => {
      const encodeResult = await handleEncodeRequest(validTemplate);
      expect(encodeResult.status).toBe(200);

      const decodeResult = await handleDecodeRequest({ data: encodeResult.body.data });
      expect(decodeResult.status).toBe(200);

      // Data should be identical after round-trip
      expect(decodeResult.body.template).toEqual(validTemplate.template);
    });

    it('should pass utility round-trip test', () => {
      const success = testRoundTrip(validTemplate.template);
      expect(success).toBe(true);
    });

    it('should handle complex nested structures', async () => {
      const complexTemplate = {
        template: {
          template_name: 'Complex Test',
          seed: 123,
          scenario: {
            title: 'Complex Decision',
            context: 'Complex scenario with nested data',
            options: [
              {
                id: 'complex_option',
                name: 'Complex Option',
                pros: ['Nested', 'Data'],
                cons: ['More', 'Complexity'],
                metadata: {
                  score: 0.85,
                  confidence: 'high',
                  tags: ['important', 'strategic']
                }
              }
            ],
            constraints: {
              nested: {
                budget: { min: 1000, max: 5000 },
                timeline: { start: '2024-01', end: '2024-12' }
              }
            }
          }
        }
      };

      const encodeResult = await handleEncodeRequest(complexTemplate);
      expect(encodeResult.status).toBe(200);

      const decodeResult = await handleDecodeRequest({ data: encodeResult.body.data });
      expect(decodeResult.status).toBe(200);

      expect(decodeResult.body.template).toEqual(complexTemplate.template);
    });
  });

  describe('Size limits enforcement', () => {
    it('should compress small templates efficiently', async () => {
      const smallTemplate = {
        template: {
          scenario: {
            title: 'Small',
            context: 'Brief',
            options: [
              { id: 'a', name: 'Option A' },
              { id: 'b', name: 'Option B' }
            ]
          }
        }
      };

      const result = await handleEncodeRequest(smallTemplate);
      expect(result.status).toBe(200);

      // Should be much smaller than the 2KB limit
      expect(result.body.data.length).toBeLessThan(500);
    });

    it('should handle templates near the complexity limit', async () => {
      const nearLimitTemplate = {
        template: {
          scenario: {
            title: 'Near Limit Template',
            context: 'Template with exactly the node limit',
            options: Array.from({ length: 10 }, (_, i) => ({
              id: `option_${i}`,
              name: `Option ${i}`
            })),
            stakeholders: ['Stakeholder 1', 'Stakeholder 2']
          }
        }
      };

      const result = await handleEncodeRequest(nearLimitTemplate);
      expect(result.status).toBe(200); // Should succeed with 12 nodes total
    });
  });
});