// Vercel Serverless Function for user CRUD operations
// Uses Supabase Admin API with service role key

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ message: 'Supabase admin not configured' });
  }

  try {
    // GET - List all users
    if (req.method === 'GET') {
      const { role } = req.query;
      
      let query = supabaseAdmin.from('users').select('*');
      if (role && typeof role === 'string') {
        query = query.eq('role', role);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Map snake_case to camelCase
      const users = data?.map((u: any) => ({
        id: u.id,
        idNumber: u.id_number,
        email: u.email,
        password: u.password,
        fullName: u.full_name,
        role: u.role,
        profilePicture: u.profile_picture,
        createdAt: u.created_at,
      }));
      
      return res.status(200).json(users);
    }

    // POST - Create new user
    if (req.method === 'POST') {
      const { idNumber, email, password, fullName, role, profilePicture } = req.body;

      // Check if ID number already exists
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id_number', idNumber)
        .single();

      if (existing) {
        return res.status(400).json({ message: 'ID Number already exists' });
      }

      // Insert into users table
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id_number: idNumber,
          email: email?.toLowerCase(),
          password,
          full_name: fullName,
          role,
          profile_picture: profilePicture,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Also create in Supabase Auth (for password reset functionality)
      if (email) {
        try {
          await supabaseAdmin.auth.admin.createUser({
            email: email.toLowerCase(),
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              id_number: idNumber,
            },
          });
          console.log(`✓ Created auth user for ${email}`);
        } catch (authErr) {
          console.warn('Could not create Supabase Auth user:', authErr);
        }
      }

      // Map response to camelCase
      const user = {
        id: newUser.id,
        idNumber: newUser.id_number,
        email: newUser.email,
        password: newUser.password,
        fullName: newUser.full_name,
        role: newUser.role,
        profilePicture: newUser.profile_picture,
        createdAt: newUser.created_at,
      };

      return res.status(201).json(user);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
