// Vercel Serverless Function for logout

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // On Vercel, logout is handled client-side via localStorage
  return res.status(200).json({ message: 'Logged out successfully' });
}
