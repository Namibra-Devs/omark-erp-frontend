// src/utils/monthlyCustomerRevenue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMonthlyCustomerRevenue,
  formatRevenueGHS,
} from './monthlyCustomerRevenue.ts';

test('Monthly Revenue: Currency formatter formats Ghanaian Cedis ₵ accurately', () => {
  assert.equal(formatRevenueGHS(8500000), '₵ 85,000.00');
  assert.equal(formatRevenueGHS(0), '₵ 0.00');
  assert.equal(formatRevenueGHS(125050), '₵ 1,250.50');
  assert.equal(formatRevenueGHS(35000000, false), '₵ 350,000');
});

test('Monthly Revenue: Groups new customer revenue by month and enforces folding rule', () => {
  const currentMonth = '2026-10';
  const pastMonth = '2026-09';
  const olderMonth = '2026-08';

  const mockCustomers = [
    {
      id: 'cust-1',
      firstName: 'Kwame',
      lastName: 'Mensah',
      phoneNumber: '+233241112233',
      address: 'East Legon, Accra',
      type: 'payment_plan',
      propertyId: 'prop-1',
      createdAt: '2026-10-05T10:00:00Z',
    },
    {
      id: 'cust-2',
      firstName: 'Akua',
      lastName: 'Asante',
      phoneNumber: '+233242223344',
      address: 'Ahodwo, Kumasi',
      type: 'outright',
      propertyId: 'prop-2',
      createdAt: '2026-10-12T14:30:00Z',
    },
    {
      id: 'cust-3',
      firstName: 'Yaw',
      lastName: 'Boateng',
      phoneNumber: '+233243334455',
      address: 'Ridge, Kumasi',
      type: 'payment_plan',
      propertyId: 'prop-3',
      createdAt: '2026-09-15T09:00:00Z',
    },
    {
      id: 'cust-4',
      firstName: 'Kofi',
      lastName: 'Osei',
      phoneNumber: '+233244445566',
      address: 'Airport Hills, Accra',
      type: 'payment_plan',
      propertyId: 'prop-4',
      createdAt: '2026-08-20T11:00:00Z',
    },
  ];

  const mockPlans = [
    {
      id: 'plan-1',
      customerId: 'cust-1',
      propertyId: 'prop-1',
      totalAmountMinor: 30000000, // ₵ 300,000
      downPaymentMinor: 6000000,  // ₵ 60,000
      balanceMinor: 24000000,
      monthlyAmountMinor: 4000000,
      status: 'active',
      numMonths: 6,
    },
    {
      id: 'plan-3',
      customerId: 'cust-3',
      propertyId: 'prop-3',
      totalAmountMinor: 25000000, // ₵ 250,000
      downPaymentMinor: 5000000,  // ₵ 50,000
      balanceMinor: 20000000,
      monthlyAmountMinor: 3333333,
      status: 'active',
      numMonths: 6,
    },
    {
      id: 'plan-4',
      customerId: 'cust-4',
      propertyId: 'prop-4',
      totalAmountMinor: 40000000, // ₵ 400,000
      downPaymentMinor: 8000000,  // ₵ 80,000
      balanceMinor: 32000000,
      monthlyAmountMinor: 5333333,
      status: 'active',
      numMonths: 6,
    },
  ];

  const mockProperties = [
    { id: 'prop-1', houseNumber: '12', offerNumber: 'OFF-01', priceMinor: 30000000, currency: 'GHS' },
    { id: 'prop-2', houseNumber: '4B', offerNumber: 'OFF-02', priceMinor: 15000000, currency: 'GHS' },
    { id: 'prop-3', houseNumber: '7', offerNumber: 'OFF-03', priceMinor: 25000000, currency: 'GHS' },
    { id: 'prop-4', houseNumber: '9', offerNumber: 'OFF-04', priceMinor: 40000000, currency: 'GHS' },
  ];

  const summary = computeMonthlyCustomerRevenue({
    customers: mockCustomers,
    paymentPlans: mockPlans,
    properties: mockProperties,
    overrides: {},
  });

  // Verify months structure
  assert.ok(summary.months.length >= 3, 'Should have at least 3 months represented');

  // Newest month first
  assert.equal(summary.months[0].monthKey, currentMonth);
  assert.equal(summary.months[1].monthKey, pastMonth);
  assert.equal(summary.months[2].monthKey, olderMonth);

  // Folding rule: Current month is unfolded (isClosedMonth = false), past months fold at end of month (isClosedMonth = true)
  assert.equal(summary.months[0].isCurrentMonth, true);
  assert.equal(summary.months[0].isClosedMonth, false, 'Current month should NOT be folded by default');
  assert.equal(summary.months[1].isCurrentMonth, false);
  assert.equal(summary.months[1].isClosedMonth, true, 'Past month 2026-09 should be folded at the end of month');
  assert.equal(summary.months[2].isClosedMonth, true, 'Past month 2026-08 should be folded at the end of month');

  // Current month revenue: cust-1 down payment (60,000) + cust-2 outright (150,000) = ₵ 210,000 (21,000,000 minor)
  const octGroup = summary.months.find((m) => m.monthKey === currentMonth);
  assert.ok(octGroup, 'October group must exist');
  assert.equal(octGroup.newCustomersCount, 2);
  assert.equal(octGroup.totalRevenueMinor, 21000000); // 6,000,000 + 15,000,000

  // Check nested customer records
  assert.equal(octGroup.newCustomers.length, 2);
  const kwame = octGroup.newCustomers.find((c) => c.customerName === 'Kwame Mensah');
  assert.ok(kwame);
  assert.equal(kwame.downPaymentMinor, 6000000);
  assert.equal(kwame.monthRevenueMinor, 6000000);
  assert.equal(kwame.transactions.length, 1);
  assert.equal(kwame.transactions[0].type, 'down_payment');

  const akua = octGroup.newCustomers.find((c) => c.customerName === 'Akua Asante');
  assert.ok(akua);
  assert.equal(akua.monthRevenueMinor, 15000000);
  assert.equal(akua.transactions[0].type, 'outright_purchase');

  // Verify all-time metrics
  assert.equal(summary.allTimeNewCustomersCount, 4);
  assert.equal(summary.allTimeNewCustomerRevenueMinor, 21000000 + 5000000 + 8000000);
  assert.equal(summary.currentMonthNewCustomersCount, 2);
  assert.equal(summary.currentMonthRevenueMinor, 21000000);
});

test('Monthly Revenue: Handles empty datasets cleanly without crashing', () => {
  const summary = computeMonthlyCustomerRevenue({
    customers: [],
    paymentPlans: [],
    properties: [],
    overrides: {},
  });

  assert.ok(summary);
  assert.equal(summary.allTimeNewCustomersCount, 0);
  assert.equal(summary.currentMonthRevenueMinor, 0);
  assert.equal(summary.months.length, 1);
  assert.equal(summary.months[0].isCurrentMonth, true);
  assert.equal(summary.months[0].isClosedMonth, false);
});

test('Monthly Revenue: Incorporates paid installments recorded in overrides', () => {
  const currentMonth = '2026-10';

  const mockCustomers = [
    {
      id: 'cust-5',
      firstName: 'Abena',
      lastName: 'Mansah',
      phoneNumber: '+233245556677',
      address: 'Kumasi',
      type: 'payment_plan',
      propertyId: 'prop-5',
      createdAt: '2026-10-01T08:00:00Z',
    },
  ];

  const mockPlans = [
    {
      id: 'plan-5',
      customerId: 'cust-5',
      propertyId: 'prop-5',
      totalAmountMinor: 10000000,
      downPaymentMinor: 2000000, // ₵ 20,000
      balanceMinor: 8000000,
      monthlyAmountMinor: 2000000,
      status: 'active',
    },
  ];

  const mockOverrides = {
    'plan-5': {
      paidInstallments: {
        1: {
          paidAt: '2026-10-15T12:00:00Z',
          amountMinor: 2000000, // ₵ 20,000 installment paid in same month
          method: 'Mobile Money',
          reference: 'MOMO-9988',
        },
      },
    },
  };

  const summary = computeMonthlyCustomerRevenue({
    customers: mockCustomers,
    paymentPlans: mockPlans,
    overrides: mockOverrides,
  });

  const octGroup = summary.months.find((m) => m.monthKey === currentMonth);
  assert.ok(octGroup);
  // Down payment (20,000) + Installment 1 (20,000) = 40,000 (4,000,000 minor)
  assert.equal(octGroup.totalRevenueMinor, 4000000);
  assert.equal(octGroup.newCustomers[0].transactions.length, 2);
  assert.equal(octGroup.newCustomers[0].transactions[0].type, 'down_payment');
  assert.equal(octGroup.newCustomers[0].transactions[1].type, 'installment');
});

test('Monthly Revenue: Generates rich descriptions for Month accordions and Customer accordions', () => {
  const mockCustomers = [
    {
      id: 'cust-desc-1',
      firstName: 'Kojo',
      lastName: 'Appiah',
      phoneNumber: '+233249998877',
      address: 'Airport Hills, Accra',
      type: 'payment_plan',
      propertyId: 'prop-desc-1',
      createdAt: '2026-10-08T12:00:00Z',
    },
    {
      id: 'cust-desc-2',
      firstName: 'Ama',
      lastName: 'Serwaa',
      phoneNumber: '+233241113355',
      address: 'Cantonments, Accra',
      type: 'outright',
      propertyId: 'prop-desc-2',
      createdAt: '2026-10-14T15:00:00Z',
    },
  ];

  const mockPlans = [
    {
      id: 'plan-desc-1',
      customerId: 'cust-desc-1',
      propertyId: 'prop-desc-1',
      totalAmountMinor: 50000000, // ₵ 500,000
      downPaymentMinor: 10000000, // ₵ 100,000
      balanceMinor: 40000000,
      monthlyAmountMinor: 5000000,
      numMonths: 8,
      status: 'active',
    },
  ];

  const mockProperties = [
    {
      id: 'prop-desc-1',
      houseNumber: '15',
      offerNumber: 'OFF-15',
      priceMinor: 50000000,
      currency: 'GHS',
      description: '4-Bedroom Luxury Executive Villa',
    },
    {
      id: 'prop-desc-2',
      houseNumber: '22',
      offerNumber: 'OFF-22',
      priceMinor: 35000000,
      currency: 'GHS',
      description: '3-Bedroom Penthouse with Ocean View',
    },
  ];

  const summary = computeMonthlyCustomerRevenue({
    customers: mockCustomers,
    paymentPlans: mockPlans,
    properties: mockProperties,
  });

  const octGroup = summary.months.find((m) => m.monthKey === '2026-10');
  assert.ok(octGroup, 'October group should exist');

  // Month accordion description
  assert.ok(octGroup.description, 'Month group must have a narrative description');
  assert.ok(octGroup.description.includes('October 2026'), 'Month description includes month name');
  assert.ok(octGroup.description.includes('Logged 2 new customer acquisition'), 'Month description notes customer count');
  assert.ok(octGroup.description.includes('outright purchase'), 'Month description notes outright purchase');
  assert.ok(octGroup.description.includes('installment plan'), 'Month description notes installment plan');
  assert.ok(octGroup.description.includes('₵ 450,000.00'), 'Month description includes total credited revenue');

  // Customer accordion description
  const kojo = octGroup.newCustomers.find((c) => c.customerName === 'Kojo Appiah');
  assert.ok(kojo, 'Kojo record should exist');
  assert.ok(kojo.description, 'Customer must have an acquisition agreement description');
  assert.ok(kojo.description.includes('Structured purchase agreement'), 'Describes installment purchase');
  assert.ok(kojo.description.includes('House 15 • Offer OFF-15'), 'Describes property unit');
  assert.ok(kojo.description.includes('4-Bedroom Luxury Executive Villa'), 'Includes property description');
  assert.ok(kojo.description.includes('₵ 100,000.00'), 'Includes down payment amount');
  assert.ok(kojo.description.includes('8-month installment schedule'), 'Includes payment plan duration');

  // Transaction description
  assert.ok(kojo.transactions[0].description, 'Transaction must have a description');
  assert.ok(kojo.transactions[0].description.includes('Initial commitment deposit'), 'Transaction description clarifies memo');

  // Outright customer description
  const ama = octGroup.newCustomers.find((c) => c.customerName === 'Ama Serwaa');
  assert.ok(ama, 'Ama record should exist');
  assert.ok(ama.description.includes('Outright purchase agreement'), 'Describes outright purchase');
  assert.ok(ama.description.includes('3-Bedroom Penthouse with Ocean View'), 'Includes penthouse details');
  assert.ok(ama.description.includes('settled in full'), 'Mentions settled in full');
});

test('Monthly Revenue: Customer headers reconcile exactly with summary bar down to the cent', () => {
  const mockCustomers = [
    {
      id: 'cust-rec-1',
      firstName: 'Kofi',
      lastName: 'Agyemang',
      phoneNumber: '+233241000001',
      type: 'payment_plan',
      property: { houseNumber: '10A' },
      paymentPlan: {
        totalAmountMinor: 10000000,
        downPaymentMinor: 2000000, // ₵ 20,000
        monthlyAmountMinor: 1000000,
        status: 'active',
      },
      createdAt: '2026-10-02T10:00:00Z',
    },
    {
      id: 'cust-rec-2',
      firstName: '  Akosua  ',
      lastName: '  Darko  ',
      phoneNumber: '+233241000002',
      type: 'payment_plan',
      property: { houseNumber: 'House 12' },
      paymentPlan: {
        totalAmountMinor: 25000000,
        downPaymentMinor: 5000000, // ₵ 50,000
        monthlyAmountMinor: 2000000,
        status: 'active',
      },
      createdAt: '2026-10-05T10:00:00Z',
    },
    {
      id: 'cust-rec-3',
      firstName: '',
      lastName: '',
      phoneNumber: '+233241000003',
      type: 'payment_plan',
      property: { houseNumber: '33' },
      paymentPlan: {
        totalAmountMinor: 30000000,
        downPaymentMinor: 6300000, // ₵ 63,000
        monthlyAmountMinor: 3000000,
        status: 'active',
      },
      createdAt: '2026-10-08T10:00:00Z',
    },
  ];

  const summary = computeMonthlyCustomerRevenue({
    customers: mockCustomers,
  });

  const oct = summary.months.find((m) => m.monthKey === '2026-10');
  assert.ok(oct);
  assert.equal(oct.newCustomers.length, 3);

  // Sum of down payments = 20,000 + 50,000 + 63,000 = 133,000 GHS (13,300,000 minor)
  assert.equal(oct.downPaymentTotalMinor, 13300000);
  assert.equal(formatRevenueGHS(oct.downPaymentTotalMinor), '₵ 133,000.00');

  // Installments = 0
  assert.equal(oct.installmentTotalMinor, 0);
  assert.equal(formatRevenueGHS(oct.installmentTotalMinor), '₵ 0.00');

  // Verify each customer's downPaymentMinor matches and sums exactly to month total
  const customerDownPaymentsSum = oct.newCustomers.reduce((sum, c) => sum + c.downPaymentMinor, 0);
  assert.equal(customerDownPaymentsSum, oct.downPaymentTotalMinor);
  assert.equal(customerDownPaymentsSum, 13300000);

  const customerInstallmentsSum = oct.newCustomers.reduce((sum, c) => sum + c.installmentsMinor, 0);
  assert.equal(customerInstallmentsSum, oct.installmentTotalMinor);
  assert.equal(customerInstallmentsSum, 0);

  const customerTotalCollectedSum = oct.newCustomers.reduce((sum, c) => sum + c.monthRevenueMinor, 0);
  assert.equal(customerTotalCollectedSum, oct.totalRevenueMinor);
  assert.equal(customerTotalCollectedSum, 13300000);

  // Verify safe name and property formatting
  const cust1 = oct.newCustomers[0];
  assert.equal(cust1.customerName, 'Kofi Agyemang');
  assert.equal(cust1.propertyName, 'House 10A');

  const cust2 = oct.newCustomers[1];
  assert.equal(cust2.customerName, 'Akosua Darko');
  assert.equal(cust2.propertyName, 'House 12');

  const cust3 = oct.newCustomers[2];
  assert.equal(cust3.customerName, 'Unnamed customer'); // Safe fallback when firstName & lastName are empty
  assert.equal(cust3.propertyName, 'House 33');

  // Verify transaction receipt records contain required fields
  cust1.transactions.forEach((tx) => {
    assert.ok(tx.paidOn, 'Transaction must have paidOn date');
    assert.ok(tx.amountMinor > 0, 'Transaction must have amount');
    assert.ok(tx.method, 'Transaction must have method');
    assert.ok(tx.reference, 'Transaction must have reference');
    assert.ok(tx.installmentNumber, 'Transaction must have installmentNumber');
  });
});
