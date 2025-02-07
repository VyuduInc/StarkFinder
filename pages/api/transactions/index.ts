import { NextApiRequest, NextApiResponse } from 'next';
import { Layerswap } from '@/lib/layerswap';
import { errorHandler } from '../middleware/error-handler';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { type, ...transactionData } = req.body;

    if (type === 'bridge') {
      if (!process.env.LAYERSWAP_API_KEY) {
        throw new Error('LAYERSWAP_API_KEY is not configured');
      }

      const layerswap = new Layerswap(process.env.LAYERSWAP_API_KEY);
      const result = await layerswap.createSwap(transactionData);
      
      if (!result.success) {
        return res.status(400).json({ 
          success: false,
          error: result.error 
        });
      }

      return res.status(200).json({
        success: true,
        swapId: result.swapId,
        redirectUrl: result.redirectUrl
      });
    }

    // Handle other transaction types...
    return res.status(400).json({ message: 'Invalid transaction type' });
  } catch (error) {
    return errorHandler(error, req, res);
  }
} 