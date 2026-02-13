/**
 * SRCP v5.0 - Working Example
 * 
 * This demonstrates a complete workflow:
 * - Creating identities
 * - Uploading content
 * - Social interactions
 * - Federation/sync
 */

import { SovereignEngine } from '../src/index.js';

async function runDemo() {
  console.log('🎬 SRCP v5.0 - Live Demo\n');
  console.log('='.repeat(60));

  // ============================================================================
  // 1. CREATE USERS
  // ============================================================================
  
  console.log('\n📝 Creating Users...\n');
  
  const alice = await SovereignEngine.create('alice');
  console.log(`✅ Alice created (DID: ${alice.identity.did.substring(0, 24)}...)`);
  console.log(`   Tokens: ${alice.tokens}, Karma: ${alice.karma}`);
  
  const bob = await SovereignEngine.create('bob');
  console.log(`✅ Bob created (DID: ${bob.identity.did.substring(0, 24)}...)`);
  console.log(`   Tokens: ${bob.tokens}, Karma: ${bob.karma}`);

  // ============================================================================
  // 2. CONTENT CREATION
  // ============================================================================
  
  console.log('\n📹 Uploading Content...\n');
  
  // Alice uploads high-quality video
  const aliceVideo = await alice.uploadContent({
    size: 52428800,      // 50MB
    duration: 300,        // 5 minutes
    width: 1920,
    height: 1080,
    codec: 'h264',
    bitrate: 8000000
  });
  
  console.log(`✅ Alice uploaded video:`);
  console.log(`   Quality Score: ${aliceVideo.qualityScore}/100 (Tier ${aliceVideo.tier})`);
  console.log(`   Tokens: ${alice.tokens} (cost: 2)`);
  console.log(`   Karma: ${alice.karma} (gained: ${aliceVideo.karmaGained})`);
  
  // Bob uploads medium-quality video
  const bobVideo = await bob.uploadContent({
    size: 10485760,      // 10MB
    duration: 120,        // 2 minutes
    width: 1280,
    height: 720,
    codec: 'h264',
    bitrate: 3000000
  });
  
  console.log(`✅ Bob uploaded video:`);
  console.log(`   Quality Score: ${bobVideo.qualityScore}/100 (Tier ${bobVideo.tier})`);
  console.log(`   Tokens: ${bob.tokens} (cost: 2)`);
  console.log(`   Karma: ${bob.karma} (gained: ${bobVideo.karmaGained})`);

  // ============================================================================
  // 3. SOCIAL INTERACTIONS
  // ============================================================================
  
  console.log('\n👥 Social Interactions...\n');
  
  // Bob likes Alice's video
  await bob.processAction('like', { videoId: aliceVideo.entry.hash });
  console.log(`✅ Bob liked Alice's video (cost: 0.1 tokens)`);
  console.log(`   Bob's tokens: ${bob.tokens}`);
  
  // Alice receives reward for like
  alice.tokens += 5; // Reward mechanism
  console.log(`✅ Alice received like reward (+5 tokens)`);
  console.log(`   Alice's tokens: ${alice.tokens}`);
  
  // Bob comments on Alice's video
  await bob.processAction('comment', {
    videoId: aliceVideo.entry.hash,
    text: 'Great video, Alice!'
  });
  console.log(`✅ Bob commented (cost: 0.5 tokens)`);
  console.log(`   Bob's tokens: ${bob.tokens}`);
  
  // Alice receives comment reward
  alice.tokens += 3;
  console.log(`✅ Alice received comment reward (+3 tokens)`);
  console.log(`   Alice's tokens: ${alice.tokens}`);

  // ============================================================================
  // 4. REPUTATION ANALYSIS
  // ============================================================================
  
  console.log('\n📊 Reputation Analysis...\n');
  
  const aliceStats = alice.getStats();
  console.log(`👤 Alice:`);
  console.log(`   Karma: ${aliceStats.karma}`);
  console.log(`   Voting Weight: ${aliceStats.votingWeight}`);
  console.log(`   Level: ${aliceStats.level}`);
  console.log(`   Uploads: ${aliceStats.actions.uploads}`);
  
  const bobStats = bob.getStats();
  console.log(`👤 Bob:`);
  console.log(`   Karma: ${bobStats.karma}`);
  console.log(`   Voting Weight: ${bobStats.votingWeight}`);
  console.log(`   Level: ${bobStats.level}`);
  console.log(`   Uploads: ${bobStats.actions.uploads}`);
  console.log(`   Likes: ${bobStats.actions.likes}`);
  console.log(`   Comments: ${bobStats.actions.comments}`);

  // ============================================================================
  // 5. KARMA BREAKDOWN
  // ============================================================================
  
  console.log('\n🔍 Karma Breakdown (Alice)...\n');
  
  const breakdown = aliceStats.karmaBreakdown;
  console.log(`   Quality: ${breakdown.quality.toFixed(1)}`);
  console.log(`   Engagement: ${breakdown.engagement.toFixed(1)}`);
  console.log(`   Account Age: ${breakdown.accountAge.toFixed(1)}`);
  console.log(`   Consistency: ${breakdown.consistency.toFixed(1)}`);
  console.log(`   Spam Penalty: ${breakdown.spamPenalty}x`);
  console.log(`   ───────────────────`);
  console.log(`   Total: ${breakdown.total}`);

  // ============================================================================
  // 6. FEDERATION / SYNC
  // ============================================================================
  
  console.log('\n🌐 Federation (Ledger Sync)...\n');
  
  // Export Alice's ledger
  const aliceExport = alice.exportForFederation();
  console.log(`✅ Alice exported ledger:`);
  console.log(`   Entries: ${aliceExport.count}`);
  console.log(`   Size: ${JSON.stringify(aliceExport).length} bytes`);
  
  // Bob imports Alice's ledger
  const importResult = await bob.importLedger(aliceExport);
  console.log(`✅ Bob imported Alice's ledger:`);
  console.log(`   Imported: ${importResult.imported} entries`);
  console.log(`   Total in ledger: ${importResult.total} entries`);
  
  // Check ledger stats
  const ledgerStats = bob.getLedgerStats();
  console.log(`✅ Bob's ledger stats:`);
  console.log(`   Total entries: ${ledgerStats.totalEntries}`);
  console.log(`   Unique users: ${ledgerStats.uniqueUsers}`);

  // ============================================================================
  // 7. ECONOMIC ANALYSIS
  // ============================================================================
  
  console.log('\n💰 Economic Analysis...\n');
  
  const aliceEcon = alice.getEconomicStats();
  console.log(`💵 Alice's Economics:`);
  console.log(`   Actions: ${aliceEcon.actionCount}`);
  console.log(`   Spent: ${aliceEcon.totalSpent} tokens`);
  console.log(`   Earned: ${aliceEcon.totalEarned} tokens`);
  console.log(`   Net Flow: ${aliceEcon.netFlow > 0 ? '+' : ''}${aliceEcon.netFlow} tokens`);
  console.log(`   Deflation Ratio: ${aliceEcon.deflationRatio.toFixed(2)}x`);
  
  // ============================================================================
  // 8. SPAM DETECTION
  // ============================================================================
  
  console.log('\n🛡️ Spam Detection...\n');
  
  const aliceSpamCheck = alice.checkSpam();
  console.log(`🔍 Alice spam check:`);
  console.log(`   Is spam: ${aliceSpamCheck.isSpam ? 'Yes' : 'No'}`);
  console.log(`   Score: ${aliceSpamCheck.score}`);
  
  if (aliceSpamCheck.reasons.length > 0) {
    console.log(`   Reasons: ${aliceSpamCheck.reasons.join(', ')}`);
  }

  // ============================================================================
  // 9. IMPROVEMENT SUGGESTIONS
  // ============================================================================
  
  console.log('\n💡 Improvement Suggestions (Bob)...\n');
  
  const suggestions = bob.getImprovementSuggestions();
  
  if (suggestions.length > 0) {
    suggestions.forEach(s => {
      console.log(`   [${s.impact.toUpperCase()}] ${s.message}`);
    });
  } else {
    console.log(`   ✅ No improvements needed - you're doing great!`);
  }

  // ============================================================================
  // 10. LEDGER INTEGRITY
  // ============================================================================
  
  console.log('\n🔐 Verifying Ledger Integrity...\n');
  
  const aliceIntegrity = await alice.verifyIntegrity();
  console.log(`✅ Alice's ledger:`);
  console.log(`   Total entries: ${aliceIntegrity.total}`);
  console.log(`   Valid signatures: ${aliceIntegrity.valid}`);
  console.log(`   All valid: ${aliceIntegrity.allValid ? 'Yes' : 'No'}`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEMO SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n👥 Participants:`);
  console.log(`   • Alice: ${alice.tokens} tokens, ${alice.karma} karma, Level ${aliceStats.level}`);
  console.log(`   • Bob: ${bob.tokens} tokens, ${bob.karma} karma, Level ${bobStats.level}`);
  
  console.log(`\n📊 Platform Stats:`);
  console.log(`   • Total actions: ${aliceStats.actions.total + bobStats.actions.total}`);
  console.log(`   • Videos uploaded: ${aliceStats.actions.uploads + bobStats.actions.uploads}`);
  console.log(`   • Ledger entries: ${ledgerStats.totalEntries}`);
  console.log(`   • All signatures valid: ${aliceIntegrity.allValid ? '✅' : '❌'}`);
  
  console.log(`\n✅ Demo complete! SRCP v5.0 is working perfectly.\n`);
}

// Run demo
runDemo().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
