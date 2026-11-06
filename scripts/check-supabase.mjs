#!/usr/bin/env node
/**
 * Check what's actually in Supabase database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://smsfryilnilxilqrkfmy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtc2ZyeWlsbmlseGlscXJrZm15Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY3OTc4MCwiZXhwIjoyMTA5MjU1NzgwfQ.-KF5aVvPfH5OeZqt46r8vxQNDijBFASKI59Gkda_Uw0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDatabase() {
  console.log('🔍 Checking Supabase database...\n');
  
  try {
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('untouched_users')
      .select('*')
      .eq('wallet_address', '0xce86a572686f22e7d1b9f6763c7b695f79762854');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
    } else {
      console.log('👤 Users:', users);
    }
    
    // Check API keys table
    const { data: keys, error: keysError } = await supabase
      .from('untouched_api_keys')
      .select('*')
      .like('key', 'unt_live_ce86%');
    
    if (keysError) {
      console.error('❌ Error fetching keys:', keysError);
    } else {
      console.log('\n🔑 API Keys:', keys);
    }
    
    if (users && users.length > 0) {
      console.log('\n✅ User exists in Supabase!');
      console.log('Principal:', users[0].principal_usdc / 1_000000, 'USDC');
      console.log('Battery:', users[0].yield_battery_usdc / 1_000000, 'USDC');
    } else {
      console.log('\n❌ User NOT found in Supabase!');
    }
    
    if (keys && keys.length > 0) {
      console.log('\n✅ API key exists in Supabase!');
      keys.forEach(key => {
        console.log('  Key:', key.key);
        console.log('  User ID:', key.user_id);
        console.log('  Status:', key.status);
      });
    } else {
      console.log('\n❌ API key NOT found in Supabase!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabase();
