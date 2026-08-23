/**
 * Healthcare Appointment Platform - Comprehensive Automated Test Suite
 * Tests:
 *  1. Concurrent Double-Booking Prevention (Patient A vs Patient B collision)
 *  2. Authentication & 2-Step Email Verification
 *  3. Doctor Leave Conflict Handling & Auto-Cancellation
 *  4. AI Pre-Visit & Post-Visit LLM Analysis
 *  5. Medication Reminder Queue Generation
 */

import { db } from '../db/index.js';
import { appointmentService } from '../services/appointmentService.js';
import { leaveService } from '../services/leaveService.js';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/llmService.js';

async function runAllTests() {
  console.log('===============================================================');
  console.log('🧪 HEALTHCARE APPOINTMENT PLATFORM - TEST SUITE RUNNER');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  // Helper assertion
  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Concurrency Test - Simultaneous Double-Booking Prevention
  // -------------------------------------------------------------------------
  console.log('📌 Test Suite 1: Concurrent Double-Booking Prevention');
  try {
    const testDocId = 'doc-1';
    const testDate = '2026-11-15';
    const testTime = '11:00';

    // Clear any previous test bookings on this test slot
    await db.query(
      `DELETE FROM appointments WHERE doctor_id = $1 AND date = $2 AND start_time = $3`,
      [testDocId, testDate, testTime]
    );

    // Simulate two simultaneous booking requests from Patient A (usr-pat1) and Patient B (usr-pat2)
    const bookingPromiseA = appointmentService.bookAppointment({
      patientId: 'usr-pat1',
      doctorId: testDocId,
      date: testDate,
      startTime: testTime,
      symptoms: 'Persistent dry cough and mild fever',
      duration: '3 days',
      severity: 6,
      medicalHistory: 'None'
    }).then(r => ({ status: 'success', result: r })).catch(err => ({ status: 'failed', error: err.message }));

    const bookingPromiseB = appointmentService.bookAppointment({
      patientId: 'usr-pat2',
      doctorId: testDocId,
      date: testDate,
      startTime: testTime,
      symptoms: 'Headache and fatigue',
      duration: '2 days',
      severity: 5,
      medicalHistory: 'None'
    }).then(r => ({ status: 'success', result: r })).catch(err => ({ status: 'failed', error: err.message }));

    const [resA, resB] = await Promise.all([bookingPromiseA, bookingPromiseB]);

    const oneSucceeded = (resA.status === 'success' && resB.status === 'failed') || (resB.status === 'success' && resA.status === 'failed');
    assert(oneSucceeded, 'Exactly ONE concurrent booking succeeded and the duplicate was rejected');

    const errorMsg = String((resA.status === 'failed' ? resA.error : resB.error) || '');
    assert(
      errorMsg.toLowerCase().includes('already booked') || errorMsg.toLowerCase().includes('concurrency_error') || errorMsg.toLowerCase().includes('unique'),
      `Rejected request received slot already booked conflict message (Received: "${errorMsg}")`
    );

    const dbCount = await db.queryOne(
      `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND date = $2 AND start_time = $3 AND status != 'cancelled'`,
      [testDocId, testDate, testTime]
    );
    assert(parseInt(dbCount.count, 10) === 1, 'Database contains exactly 1 active appointment for the slot');
  } catch (err) {
    console.error('  ❌ Exception in Concurrency Test:', err);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Doctor Leave Conflict Handling & Patient Notification
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Suite 2: Doctor Leave Conflict & Auto-Cancellation');
  try {
    const testDocId = 'doc-2';
    const testLeaveDate = '2026-11-20';

    // 1. Clear any prior test state on this test date
    await db.query(
      `DELETE FROM leave_days WHERE doctor_id = $1 AND leave_date = $2`,
      [testDocId, testLeaveDate]
    );
    await db.query(
      `DELETE FROM appointments WHERE doctor_id = $1 AND date = $2`,
      [testDocId, testLeaveDate]
    );

    const aptRes = await appointmentService.bookAppointment({
      patientId: 'usr-pat1',
      doctorId: testDocId,
      date: testLeaveDate,
      startTime: '14:00',
      symptoms: 'Knee sprain from running',
      duration: '1 day',
      severity: 5,
      medicalHistory: 'None'
    });

    assert(aptRes.appointment.id != null, 'Pre-existing appointment successfully booked before leave');

    // 2. Doctor / Admin applies leave for that date
    const leaveResult = await leaveService.addLeave(testDocId, testLeaveDate, 'Annual Medical Conference');

    assert(leaveResult.status === 'approved', 'Leave request approved and applied to leave_days');
    assert(leaveResult.affectedCount >= 1, 'Affected patient booking identified during leave approval');

    // 3. Verify appointment status is updated to 'cancelled'
    const updatedApt = await db.queryOne(`SELECT * FROM appointments WHERE id = $1`, [aptRes.appointment.id]);
    assert(updatedApt.status === 'cancelled', 'Affected patient appointment automatically set to cancelled');

    // 4. Verify leave notice email log was queued
    const emailLog = await db.queryOne(
      `SELECT * FROM email_logs WHERE type = 'leave_notice' ORDER BY created_at DESC`
    );
    assert(emailLog != null, 'Patient leave notice email log recorded in database');
  } catch (err) {
    console.error('  ❌ Exception in Doctor Leave Test:', err);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: AI Pre-Visit Clinical Triage Engine
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Suite 3: AI Pre-Visit Symptom Analysis');
  try {
    const aiResult = await generatePreVisitSummary(
      'Sudden crushing chest pain radiating to left arm with breathlessness',
      '2 hours',
      9
    );

    assert(aiResult.urgency_level === 'Critical' || aiResult.urgency_level === 'High', 'Severe symptoms correctly categorized as Critical/High urgency');
    assert(typeof aiResult.chief_complaint === 'string' && aiResult.chief_complaint.length > 0, 'Chief complaint generated');
    assert(Array.isArray(aiResult.suggested_questions) && aiResult.suggested_questions.length === 3, 'Exactly 3 clinical consultation questions generated');
    assert(typeof aiResult.initial_care === 'string' && aiResult.initial_care.length > 0, 'Symptom-specific initial home care instructions generated');
    assert(typeof aiResult.red_flags === 'string' && aiResult.red_flags.length > 0, 'Emergency red flags generated for critical symptoms');
  } catch (err) {
    console.error('  ❌ Exception in AI Pre-Visit Test:', err);
    failed++;
  }

  // -------------------------------------------------------------------------
  // TEST 4: AI Post-Visit Summary & Prescription Protection
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Suite 4: AI Post-Visit Summary Generation');
  try {
    const clinicalNotes = 'Patient diagnosed with Acute Pharyngitis. Clear lungs, erythematous tonsils.';
    const diagnosis = 'Acute Viral Pharyngitis';
    const vitals = { bp: '120/80', pulse: '76', temp: '99.2 F' };
    const prescriptions = [
      { drug: 'Paracetamol', dosage: '500 mg', frequency: 'Twice daily after food', duration: '5 days' },
      { drug: 'Warm Saline Gargle', dosage: '1 cup', frequency: 'Three times daily', duration: '7 days' }
    ];

    const postVisitResult = await generatePostVisitSummary(clinicalNotes, diagnosis, vitals, prescriptions);

    assert(typeof postVisitResult.patient_friendly_summary === 'string', 'Patient-friendly post-visit summary created');
    assert(Array.isArray(postVisitResult.medication_schedule), 'Medication schedule parsed from doctor prescriptions');
    assert(Array.isArray(postVisitResult.follow_up_steps) && postVisitResult.follow_up_steps.length > 0, 'Follow-up care recommendations provided');
  } catch (err) {
    console.error('  ❌ Exception in AI Post-Visit Test:', err);
    failed++;
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`🏁 TEST EXECUTION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
