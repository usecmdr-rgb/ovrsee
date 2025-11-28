/**
 * Script to update a user's subscription tier
 * Usage: node scripts/update-user-subscription.js <email> <tier> [status]
 * Example: node scripts/update-user-subscription.js test.basic@ovrsee.test basic active
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for scripts/update-user-subscription.js'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function updateUserSubscription(email, tier, status = 'active') {
  try {
    console.log(`Looking up user: ${email}...`);
    
    // Get all users and find by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      process.exit(1);
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.id}`);
    console.log(`Updating subscription to tier: ${tier}, status: ${status}...`);

    // First ensure columns exist
    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
            ) THEN
                ALTER TABLE profiles ADD COLUMN subscription_tier TEXT;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'profiles' AND column_name = 'subscription_status'
            ) THEN
                ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
            END IF;
        END $$;
      `
    });

    if (migrationError) {
      console.log('Note: Could not run migration via RPC, trying direct update...');
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        subscription_tier: tier,
        subscription_status: status,
      }, {
        onConflict: 'id'
      });

    if (updateError) {
      console.error('Error updating profile:', updateError);
      
      // Try with just subscription_tier if subscription_status fails
      if (updateError.message.includes('subscription_status')) {
        console.log('Retrying with subscription_tier only...');
        const { error: retryError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            subscription_tier: tier,
          }, {
            onConflict: 'id'
          });
        
        if (retryError) {
          console.error('Error on retry:', retryError);
          process.exit(1);
        } else {
          console.log('✓ Successfully updated subscription_tier');
        }
      } else {
        process.exit(1);
      }
    } else {
      console.log('✓ Successfully updated subscription');
    }

    // Verify the update
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .single();

    console.log('\nUpdated profile:');
    console.log(JSON.stringify(profile, null, 2));
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

const [,, email, tier, status] = process.argv;

if (!email || !tier) {
  console.error('Usage: node scripts/update-user-subscription.js <email> <tier> [status]');
  console.error('Example: node scripts/update-user-subscription.js test.basic@ovrsee.test basic active');
  process.exit(1);
}

if (!['basic', 'advanced', 'elite'].includes(tier)) {
  console.error('Tier must be one of: basic, advanced, elite');
  process.exit(1);
}

updateUserSubscription(email, tier, status || 'active');

