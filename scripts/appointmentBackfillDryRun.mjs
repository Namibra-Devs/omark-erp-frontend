// scripts/appointmentBackfillDryRun.mjs
/**
 * Appointment Backfill Dry-Run Utility (Read-Only)
 * 
 * Classifies every appointment from server / local data into:
 * - Strong: verified createdBy or interaction loggedByUserId
 * - Weak: inferred from prospect/customer owner or staffId (requires confirmation)
 * - None: website booking or unlinked orphan
 * - Possible duplicates: same person, date and time
 * 
 * Generates:
 * - docs/appointment_backfill_dryrun.csv
 * - docs/appointment_backfill_dryrun.json
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://api.erp.omarkrealestate.com';
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.BEARER_TOKEN || '';

async function fetchJson(endpoint) {
  if (!AUTH_TOKEN) return null;
  return new Promise((resolve) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`);
    const req = https.get(url, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data?.items || parsed?.data || parsed?.items || parsed);
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
  });
}

import { classifyAppointments, generateBackfillCsv as generateCsv } from '../src/utils/appointmentBackfill.ts';
export { classifyAppointments, generateCsv };

// When executed directly via CLI
async function run() {
  console.log('--- Appointment Backfill Dry-Run Script ---');

  let serverAppointments = [];
  let users = [];
  let interactions = [];
  let prospects = [];
  let customers = [];
  let localAppointments = [];

  // Try reading local diagnostic backup or fixtures if present
  const backupPath = path.resolve('docs/omark-local-storage-backup.json');
  if (fs.existsSync(backupPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      localAppointments = raw.storedAppointments || [];
      interactions = raw.storedInteractions || [];
      console.log(`Loaded ${localAppointments.length} local appointments from backup file.`);
    } catch (_) {}
  }

  // If live token is provided, fetch live data
  if (AUTH_TOKEN) {
    console.log('Fetching live server data...');
    serverAppointments = (await fetchJson('/api/v1/appointments?pageSize=1000')) || [];
    users = (await fetchJson('/api/v1/users?pageSize=1000')) || [];
    interactions = (await fetchJson('/api/v1/interactions?pageSize=1000')) || interactions;
    prospects = (await fetchJson('/api/v1/prospects?pageSize=1000')) || [];
    customers = (await fetchJson('/api/v1/customers?pageSize=1000')) || [];
    console.log(`Live fetched: ${serverAppointments.length} appointments, ${users.length} users.`);
  } else {
    console.log('No AUTH_TOKEN provided. Running classification on offline snapshot & fixtures.');
    // Load standard known users for baseline classification
    users = [
      { id: 'usr-admin-1', firstName: 'Super', lastName: 'Admin', role: 'admin' },
      { id: 'usr-dir-1', firstName: 'Lawrencia', lastName: 'Adugyemfi', role: 'marketing_director' },
      { id: 'usr-staff-1', firstName: 'Cecilia', lastName: 'Donkor', role: 'marketing_staff' },
      { id: 'usr-staff-2', firstName: 'Daniel', lastName: 'Boateng', role: 'marketing_staff' },
      { id: 'usr-cs-1', firstName: 'Akua', lastName: 'Owusu', role: 'customer_service' },
      { id: 'usr-sec-1', firstName: 'Abena', lastName: 'Mansah', role: 'secretary' },
    ];
  }

  const result = classifyAppointments({
    serverAppointments,
    localAppointments,
    users,
    interactions,
    prospects,
    customers,
  });

  const csvContent = generateCsv(result.classified);
  fs.writeFileSync(path.resolve('docs/appointment_backfill_dryrun.csv'), csvContent, 'utf8');
  fs.writeFileSync(path.resolve('docs/appointment_backfill_dryrun.json'), JSON.stringify(result, null, 2), 'utf8');

  console.log('Dry-run complete!');
  console.log(`Total Appointments Analyzed: ${result.totalAppointments}`);
  console.log(`Tier Breakdown: Strong = ${result.tierCounts.strong}, Weak = ${result.tierCounts.weak}, None = ${result.tierCounts.none}`);
  console.log(`Possible Duplicates Flagged: ${result.duplicateCount}`);
  console.log(`Local records not on server by ID: ${result.localOnlyByIdCount}`);
  console.log(`Local records not on server by Slot: ${result.localOnlyBySlotCount}`);
  console.log('Files generated: docs/appointment_backfill_dryrun.csv and docs/appointment_backfill_dryrun.json');
}

if (process.argv[1] && process.argv[1].endsWith('appointmentBackfillDryRun.mjs')) {
  run().catch(console.error);
}
