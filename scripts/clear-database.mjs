#!/usr/bin/env node

/**
 * clear-database.mjs
 * 
 * Clears all data from Supabase database
 * Use this to reset the database for testing
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Supabase credentials not found');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function clearDatabase() {
  console.log('🗑️  Clearing Supabase database...\n');

  try {
    // Clear pending approvals
    const { error: approvalsError } = await supabase
      .from('untouched_pending_approvals')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (approvalsError) {
      console.error('⚠️  Error clearing pending_approvals:', approvalsError.message);
    } else {
      console.log('✅ Cleared untouched_pending_approvals');
    }

    // Clear receipts
    const { error: receiptsError } = await supabase
      .from('untouched_receipts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (receiptsError) {
      console.error('⚠️  Error clearing receipts:', receiptsError.message);
    } else {
      console.log('✅ Cleared untouched_receipts');
    }

    // Clear API keys
    const { error: keysError } = await supabase
      .from('untouched_api_keys')
      .delete()
      .neq('key', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (keysError) {
      console.error('⚠️  Error clearing api_keys:', keysError.message);
    } else {
      console.log('✅ Cleared untouched_api_keys');
    }

    // Clear users
    const { error: usersError } = await supabase
      .from('untouched_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (usersError) {
      console.error('⚠️  Error clearing users:', usersError.message);
    } else {
      console.log('✅ Cleared untouched_users');
    }

    console.log('\n✅ Database cleared successfully!');
    console.log('\n📝 Important: Also clear the in-memory store by:');
    console.log('   1. Stop your dev server (Ctrl+C)');
    console.log('   2. Clear browser localStorage:');
    console.log('      - Open DevTools → Application → Local Storage');
    console.log('      - Delete all untouched_* keys');
    console.log('   3. Restart dev server: npm run dev');
    console.log('   4. Hard refresh browser (Ctrl+Shift+R)');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

clearDatabase();
