/**
 * Script to create a test user with Basic tier subscription
 * Run with: node scripts/create-test-user.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nupxbdbychuqokubresi.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_SR5PYW41Fwh9aYqhrPXVpA_0xrhgcA9';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function createTestUser() {
  const email = 'test.basic@commanderx.test';
  const password = 'TestBasic123!';

  try {
    console.log('Creating user:', email);
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return;
    }

    if (!authData.user) {
      console.error('User creation failed');
      return;
    }

    const userId = authData.user.id;
    console.log('User created with ID:', userId);

    // Create profile with Basic tier subscription
    // Try to insert/update profile - handle case where columns might not exist yet
    let profileCreated = false;
    
    // Only add subscription fields if they exist (will be added via migration)
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          subscription_tier: 'basic',
          subscription_status: 'active',
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.warn('Profile update error (columns may not exist yet):', profileError.message);
        // Try just creating the profile with just the ID
        const { error: simpleError } = await supabase
          .from('profiles')
          .upsert({ id: userId }, { onConflict: 'id' });
        
        if (simpleError) {
          console.error('Error creating basic profile:', simpleError);
        } else {
          profileCreated = true;
          console.log('Basic profile created. Please run the migration to add subscription columns, then update manually:');
          console.log(`UPDATE profiles SET subscription_tier = 'basic', subscription_status = 'active' WHERE id = '${userId}';`);
        }
      } else {
        profileCreated = true;
        console.log('Profile created with subscription tier');
      }
    } catch (err) {
      console.warn('Could not set subscription tier. Profile created with ID only.');
      console.log('Please update manually in Supabase:');
      console.log(`UPDATE profiles SET subscription_tier = 'basic', subscription_status = 'active' WHERE id = '${userId}';`);
    }

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Try to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return;
    }

    console.log('\n✅ User created successfully!');
    console.log('\n📧 Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('\n📊 Subscription:');
    console.log('   Tier: Basic');
    console.log('   Status: Active');
    console.log('   Accessible Agents: Sync only');
    console.log('\n🔍 Preview Mode:');
    console.log('   This user will see preview mode for:');
    console.log('   - Aloha (requires Advanced tier)');
    console.log('   - Studio (requires Advanced tier)');
    console.log('   - Insight (requires Elite tier)');
    console.log('\n✨ Full access to:');
    console.log('   - Sync agent');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestUser();

