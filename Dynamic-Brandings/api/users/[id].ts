// Vercel Serverless Function for individual user operations (update/delete)
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

  // Get user ID from URL path
  const { id } = req.query;
  const userId = parseInt(id as string, 10);

  if (isNaN(userId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    // GET - Get single user
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = {
        id: data.id,
        idNumber: data.id_number,
        email: data.email,
        password: data.password,
        fullName: data.full_name,
        role: data.role,
        profilePicture: data.profile_picture,
        createdAt: data.created_at,
      };

      return res.status(200).json(user);
    }

    // PUT - Update user
    if (req.method === 'PUT') {
      const updates = req.body;

      // Get current user data first
      const { data: currentUser, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if ID number is being changed and already exists
      if (updates.idNumber && updates.idNumber !== currentUser.id_number) {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('id_number', updates.idNumber)
          .neq('id', userId)
          .single();

        if (existing) {
          return res.status(400).json({ message: 'ID Number already exists' });
        }
      }

      // Build update object (convert camelCase to snake_case)
      const dbUpdates: any = {};
      if (updates.idNumber !== undefined) dbUpdates.id_number = updates.idNumber;
      if (updates.email !== undefined) dbUpdates.email = updates.email?.toLowerCase();
      if (updates.password !== undefined) dbUpdates.password = updates.password;
      if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.profilePicture !== undefined) dbUpdates.profile_picture = updates.profilePicture;

      // Update users table
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update(dbUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Also update Supabase Auth if email or password changed
      if (currentUser.email) {
        try {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = authUsers?.users?.find(
            (u: any) => u.email?.toLowerCase() === currentUser.email.toLowerCase()
          );

          if (authUser) {
            const authUpdates: any = {};
            if (updates.email && updates.email.toLowerCase() !== currentUser.email.toLowerCase()) {
              authUpdates.email = updates.email.toLowerCase();
            }
            if (updates.password && updates.password !== currentUser.password) {
              authUpdates.password = updates.password;
            }
            if (updates.fullName) {
              authUpdates.user_metadata = { 
                ...authUser.user_metadata,
                full_name: updates.fullName 
              };
            }

            if (Object.keys(authUpdates).length > 0) {
              await supabaseAdmin.auth.admin.updateUserById(authUser.id, authUpdates);
              console.log(`✓ Updated auth user ${currentUser.email}`);
            }
          }
        } catch (authErr) {
          console.warn('Could not update Supabase Auth user:', authErr);
        }
      }

      // Map response to camelCase
      const user = {
        id: updatedUser.id,
        idNumber: updatedUser.id_number,
        email: updatedUser.email,
        password: updatedUser.password,
        fullName: updatedUser.full_name,
        role: updatedUser.role,
        profilePicture: updatedUser.profile_picture,
        createdAt: updatedUser.created_at,
      };

      return res.status(200).json(user);
    }

    // DELETE - Delete user
    if (req.method === 'DELETE') {
      // Get user data first (need email for Auth deletion)
      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete from users table
      const { error: deleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      // Also delete from Supabase Auth
      if (user.email) {
        try {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
          const authUser = authUsers?.users?.find(
            (u: any) => u.email?.toLowerCase() === user.email.toLowerCase()
          );

          if (authUser) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.id);
            console.log(`✓ Deleted auth user ${user.email}`);
          }
        } catch (authErr) {
          console.warn('Could not delete Supabase Auth user:', authErr);
        }
      }

      return res.status(204).end();
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
