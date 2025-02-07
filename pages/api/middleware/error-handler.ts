import { NextApiRequest, NextApiResponse } from 'next';

export function errorHandler(err: any, req: NextApiRequest, res: NextApiResponse) {
  console.error('API Error:', err);

  if (err.response?.data) {
    // Handle Layerswap API errors
    return res.status(err.response.status || 400).json({
      success: false,
      error: err.response.data.message || 'Layerswap API error'
    });
  }

  return res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
} 