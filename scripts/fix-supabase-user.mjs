#!/usr/bin/env node
/**
 * Manually insert user into Supabase to fix broken state
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://smsfryilnilxilqrkfmy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtc2ZyeWlsbmlseGlscXJrZm15Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY3OTc4MCwiZXhwIjoyMTA5MjU1NzgwfQ.-KF5aVvPfH5OeZqt46r8vxQNDijBFASKI59Gkda_Uw0';

const WALLET_ADDRESS = '0xce86a572686f22e7d1b9f6763c7b695f79762854';
const API_KEY = 'unt_live_ce86_2edab26d236a';
const AGENT_SIGNER = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';

// 10 USDC deposit (10,000,000 micro-units)
const PRINCIPAL_USDC = 10_000000;
const BATTERY_USDC = 19200; // ~$0.0192 (5% APY * 14 days / 365)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixUser() {
  console.log('🔧 Manually inserting user into Supabase...\n');
  
  try {
    // Insert user
    const { data: userData, error: userError } = await supabase
      .from('untouched_users')
      .upsert({
        id: WALLET_ADDRESS.toLowerCase(),
        display_name: `User ${WALLET_ADDRESS.slice(0, 6)}`,
        wallet_address: WALLET_ADDRESS.toLowerCase(),
        agent_signer_eoa: AGENT_SIGNER,
        principal_usdc: PRINCIPAL_USDC,
        yield_battery_usdc: BATTERY_USDC,
        remaining_usdc: BATTERY_USDC,
        max_per_call_usdc: 5000,
      }, {
        onConflict: 'id'
      });
    
    if (userError) {
      console.error('❌ Error inserting user:', userError);
      throw userError;
    }
    
    console.log('✅ User inserted:', userData);
    
    // Insert API key
    const { data: keyData, error: keyError } = await supabase
      .from('untouched_api_keys')
      .upsert({
        key: API_KEY,
        user_id: WALLET_ADDRESS.toLowerCase(),
        name: 'Master Vault Key',
        status: 'active',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });
    
    if (keyError) {
      console.error('❌ Error inserting API key:', keyError);
      throw keyError;
    }
    
    console.log('✅ API key inserted:', keyData);
    
    console.log('\n✅ Done! User and API key now in Supabase.');
    console.log('\nNow refresh the dashboard - it should show:');
    console.log('  Principal: $10.00');
    console.log('  Battery: $0.0192');
    
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

fixUser();
