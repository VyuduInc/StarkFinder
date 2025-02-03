// Define fetch type for tests
import { jest } from '@jest/globals';

// Override the fetch type for tests
const mockFetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(new Response()));
global.fetch = mockFetch;
