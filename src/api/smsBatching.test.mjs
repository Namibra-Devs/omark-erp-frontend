import test from 'node:test';
import assert from 'node:assert/strict';

// Logic mirroring src/api/notifications.ts
const SMS_BATCH_SIZE = 500;

function chunkArray(items, size = SMS_BATCH_SIZE) {
  if (!items || items.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function simulateBatchedBroadcastSMS(payload, apiDispatcher, onProgress) {
  const audience = payload.audience || 'custom';
  const msg = (payload.message || payload.messageText || '').trim().slice(0, 480);
  const rawPhones = payload.recipientPhoneNumbers || payload.phoneNumbers || payload.recipients || [];
  const recipientPhones = Array.from(new Set(rawPhones.map((p) => String(p).trim()))).filter((p) => p.length > 5);

  const progressCallback = onProgress || payload.onProgress;

  if (recipientPhones.length === 0) {
    progressCallback?.({
      currentBatch: 1,
      totalBatches: 1,
      processedRecipients: 0,
      totalRecipients: 0,
      percent: 50,
      isComplete: false,
      batchSize: 0,
      statusText: 'Broadcasting to audience...',
    });

    const body = {
      audience,
      message: msg,
      messageText: msg,
      recipientPhoneNumbers: [],
      senderId: payload.senderId || 'OMARK ESTATES',
    };

    const res = await apiDispatcher(body);

    progressCallback?.({
      currentBatch: 1,
      totalBatches: 1,
      processedRecipients: 0,
      totalRecipients: 0,
      percent: 100,
      isComplete: true,
      batchSize: 0,
      statusText: 'Broadcast completed',
    });

    return { totalSent: 0, totalBatches: 1, results: [res] };
  }

  const batches = chunkArray(recipientPhones, SMS_BATCH_SIZE);
  const totalBatches = batches.length;
  const totalRecipients = recipientPhones.length;
  const results = [];
  let processedRecipients = 0;

  for (let i = 0; i < totalBatches; i++) {
    const currentBatchNum = i + 1;
    const currentBatch = batches[i];
    const batchSize = currentBatch.length;

    progressCallback?.({
      currentBatch: currentBatchNum,
      totalBatches,
      processedRecipients,
      totalRecipients,
      percent: Math.round((processedRecipients / totalRecipients) * 100),
      isComplete: false,
      batchSize,
      statusText: `Sending batch ${currentBatchNum} of ${totalBatches} (${batchSize} messages)...`,
    });

    const body = {
      audience: 'custom',
      message: msg,
      messageText: msg,
      recipientPhoneNumbers: currentBatch,
      senderId: payload.senderId || 'OMARK ESTATES',
    };

    const res = await apiDispatcher(body);
    results.push(res);
    processedRecipients += batchSize;

    progressCallback?.({
      currentBatch: currentBatchNum,
      totalBatches,
      processedRecipients,
      totalRecipients,
      percent: Math.round((processedRecipients / totalRecipients) * 100),
      isComplete: currentBatchNum === totalBatches,
      batchSize,
      statusText:
        currentBatchNum === totalBatches
          ? `All ${totalBatches} batches successfully sent (${totalRecipients} recipients)`
          : `Batch ${currentBatchNum} of ${totalBatches} complete. Processing next batch...`,
    });
  }

  return {
    totalSent: totalRecipients,
    totalBatches,
    results,
  };
}

test('SMS Batching: chunkArray correctly divides recipients into batches of max 500', () => {
  // Empty
  assert.deepEqual(chunkArray([]), []);

  // Less than 500
  const list250 = Array.from({ length: 250 }, (_, i) => `0244000${i.toString().padStart(4, '0')}`);
  const chunks250 = chunkArray(list250, 500);
  assert.equal(chunks250.length, 1);
  assert.equal(chunks250[0].length, 250);

  // Exactly 500
  const list500 = Array.from({ length: 500 }, (_, i) => `0244000${i.toString().padStart(4, '0')}`);
  const chunks500 = chunkArray(list500, 500);
  assert.equal(chunks500.length, 1);
  assert.equal(chunks500[0].length, 500);

  // 501 recipients -> 2 batches (500 + 1)
  const list501 = Array.from({ length: 501 }, (_, i) => `0244000${i.toString().padStart(4, '0')}`);
  const chunks501 = chunkArray(list501, 500);
  assert.equal(chunks501.length, 2);
  assert.equal(chunks501[0].length, 500);
  assert.equal(chunks501[1].length, 1);

  // 1,250 recipients -> 3 batches (500 + 500 + 250)
  const list1250 = Array.from({ length: 1250 }, (_, i) => `0244000${i.toString().padStart(4, '0')}`);
  const chunks1250 = chunkArray(list1250, 500);
  assert.equal(chunks1250.length, 3);
  assert.equal(chunks1250[0].length, 500);
  assert.equal(chunks1250[1].length, 500);
  assert.equal(chunks1250[2].length, 250);
});

test('SMS Batching: sequential execution triggers subsequent batches automatically until all messages are delivered', async () => {
  const list1250 = Array.from({ length: 1250 }, (_, i) => `0244000${i.toString().padStart(4, '0')}`);
  const dispatchedBatches = [];
  const progressSnapshots = [];

  const mockDispatcher = async (body) => {
    dispatchedBatches.push({
      recipientCount: body.recipientPhoneNumbers.length,
      sampleFirst: body.recipientPhoneNumbers[0],
      sampleLast: body.recipientPhoneNumbers[body.recipientPhoneNumbers.length - 1],
    });
    return { success: true, sent: body.recipientPhoneNumbers.length };
  };

  const onProgress = (p) => {
    progressSnapshots.push({ ...p });
  };

  const result = await simulateBatchedBroadcastSMS(
    {
      audience: 'prospects',
      message: 'Exclusive site inspection this weekend!',
      recipientPhoneNumbers: list1250,
      senderId: 'OMARK ESTATES',
    },
    mockDispatcher,
    onProgress
  );

  // 1. All 1,250 recipients accounted for
  assert.equal(result.totalSent, 1250);
  assert.equal(result.totalBatches, 3);

  // 2. Dispatched in exactly 3 sequential batches of 500, 500, 250
  assert.equal(dispatchedBatches.length, 3);
  assert.equal(dispatchedBatches[0].recipientCount, 500);
  assert.equal(dispatchedBatches[1].recipientCount, 500);
  assert.equal(dispatchedBatches[2].recipientCount, 250);

  // 3. Sequential continuity: items match exact slices without gaps or duplicates
  assert.equal(dispatchedBatches[0].sampleFirst, list1250[0]);
  assert.equal(dispatchedBatches[0].sampleLast, list1250[499]);
  assert.equal(dispatchedBatches[1].sampleFirst, list1250[500]);
  assert.equal(dispatchedBatches[1].sampleLast, list1250[999]);
  assert.equal(dispatchedBatches[2].sampleFirst, list1250[1000]);
  assert.equal(dispatchedBatches[2].sampleLast, list1250[1249]);

  // 4. Progress loader signalling
  assert.ok(progressSnapshots.length >= 6); // at least start + finish per batch
  const finalSnapshot = progressSnapshots[progressSnapshots.length - 1];
  assert.equal(finalSnapshot.isComplete, true);
  assert.equal(finalSnapshot.percent, 100);
  assert.equal(finalSnapshot.processedRecipients, 1250);
  assert.equal(finalSnapshot.currentBatch, 3);
  assert.equal(finalSnapshot.totalBatches, 3);
});

test('SMS Batching: deduplicates phone numbers and skips invalid entries before batching', async () => {
  const rawList = [
    '0244111111',
    '0244111111', // duplicate
    '  0244111111  ', // duplicate with whitespace
    '0244222222',
    '123', // too short (< 6 digits)
    '',
    null,
    '0244333333',
  ];

  const dispatchedBodies = [];
  const mockDispatcher = async (body) => {
    dispatchedBodies.push(body);
    return { success: true };
  };

  const result = await simulateBatchedBroadcastSMS(
    {
      messageText: 'Test deduplication',
      phoneNumbers: rawList,
    },
    mockDispatcher
  );

  assert.equal(result.totalSent, 3);
  assert.equal(result.totalBatches, 1);
  assert.deepEqual(dispatchedBodies[0].recipientPhoneNumbers, [
    '0244111111',
    '0244222222',
    '0244333333',
  ]);
});
