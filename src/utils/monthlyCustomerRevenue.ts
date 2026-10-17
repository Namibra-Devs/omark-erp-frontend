// src/utils/monthlyCustomerRevenue.ts
import dayjs from 'dayjs';

export interface LocalPlanInstallmentData {
  paidAt?: string;
  amountMinor?: number;
  method?: string;
  reference?: string;
  notes?: string;
}

export interface LocalPlanOverrideData {
  paidInstallments?: Record<number | string, LocalPlanInstallmentData>;
  transactions?: any[];
  balanceMinor?: number;
  updatedAt?: string;
}

export type OverridesMap = Record<string, LocalPlanOverrideData>;

export function getLocalPaymentOverrides(): OverridesMap {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem('omark_payment_plan_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface CustomerMonthRevenueTransaction {
  id: string;
  type: 'down_payment' | 'installment' | 'outright_purchase';
  label: string;
  amountMinor: number;
  paidOn: string;
  method: string;
  reference?: string;
  status: 'verified' | 'pending';
}

export interface NewCustomerRevenueRecord {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerType: string;
  customerCode?: string;
  propertyId: string;
  propertyName: string;
  propertyPriceMinor: number;
  downPaymentMinor: number;
  monthlyInstallmentMinor: number;
  totalPaidToDateMinor: number;
  balanceMinor: number;
  planStatus: string;
  progressPercent: number;
  joinedDate: string; // YYYY-MM-DD
  monthRevenueMinor: number; // Revenue credited in this specific month
  transactions: CustomerMonthRevenueTransaction[];
}

export interface MonthRevenueGroup {
  monthKey: string; // 'YYYY-MM' (e.g. '2026-10')
  monthLabel: string; // 'October 2026'
  isCurrentMonth: boolean; // true if this month is the current ongoing calendar month
  isClosedMonth: boolean; // true if this month has ended and is folded
  totalRevenueMinor: number; // Total new customer revenue collected in this month
  downPaymentTotalMinor: number; // Portioned from initial deposits
  installmentTotalMinor: number; // Portioned from installments
  newCustomersCount: number; // Count of new customers joined in this month
  newCustomers: NewCustomerRevenueRecord[];
  allCustomersRevenueMinor: number; // Grand total including repeat installments
}

export interface MonthlyCustomerRevenueSummary {
  currentMonthKey: string;
  currentMonthLabel: string;
  currentMonthRevenueMinor: number;
  currentMonthNewCustomersCount: number;
  allTimeNewCustomerRevenueMinor: number;
  allTimeNewCustomersCount: number;
  averageRevenuePerCustomerMinor: number;
  growthRatePercent: number; // Month-over-month growth compared to previous month
  months: MonthRevenueGroup[];
}

/**
 * Formats minor currency units into Ghanaian Cedis string (e.g. ₵ 85,000.00)
 */
export function formatRevenueGHS(minorAmount: number = 0, includeDecimals = true): string {
  const ghs = (minorAmount || 0) / 100;
  return `₵ ${ghs.toLocaleString('en-US', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  })}`;
}

export interface CustomerRevenueInput {
  id: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  type?: string;
  code?: string;
  propertyId?: string;
  createdAt?: string;
  updatedAt?: string;
  plan?: any;
}

export interface PaymentPlanRevenueInput {
  id?: string;
  customerId?: string;
  propertyId?: string;
  totalAmountMinor?: number;
  downPaymentMinor?: number;
  balanceMinor?: number;
  monthlyAmountMinor?: number;
  paidMinor?: number;
  numMonths?: number;
  currency?: string;
  status?: string;
  propertyName?: string;
  startDate?: string;
  createdAt?: string;
}

export interface PropertyRevenueInput {
  id: string;
  houseNumber?: string;
  offerNumber?: string;
  priceMinor?: number;
  currency?: string;
}

/**
 * Computes monthly customer revenue groups and metrics.
 * Follows the folding rule: The current ongoing month is unfolded, while
 * completed past months fold at the end of each month with nested customer accordions.
 */
export function computeMonthlyCustomerRevenue(params: {
  customers: CustomerRevenueInput[];
  paymentPlans?: PaymentPlanRevenueInput[];
  properties?: PropertyRevenueInput[];
  overrides?: OverridesMap;
}): MonthlyCustomerRevenueSummary {
  const { customers = [], paymentPlans = [], properties = [], overrides = getLocalPaymentOverrides() } = params;

  const now = dayjs();
  const currentMonthKey = now.format('YYYY-MM');
  const currentMonthLabel = now.format('MMMM YYYY');

  // Build property lookup map
  const propertyMap = new Map<string, PropertyRevenueInput>();
  properties.forEach((p) => {
    if (p && p.id) propertyMap.set(p.id, p);
  });

  // Build plan lookup map by customerId
  const planMap = new Map<string, PaymentPlanRevenueInput>();
  paymentPlans.forEach((plan) => {
    if (plan && plan.customerId) {
      planMap.set(plan.customerId, plan);
    }
  });

  // Group buckets by monthKey (YYYY-MM)
  const monthMap = new Map<string, MonthRevenueGroup>();

  // Ensure current month exists even if no customers yet
  monthMap.set(currentMonthKey, {
    monthKey: currentMonthKey,
    monthLabel: currentMonthLabel,
    isCurrentMonth: true,
    isClosedMonth: false,
    totalRevenueMinor: 0,
    downPaymentTotalMinor: 0,
    installmentTotalMinor: 0,
    newCustomersCount: 0,
    newCustomers: [],
    allCustomersRevenueMinor: 0,
  });

  // Process all customers
  customers.forEach((c) => {
    if (!c || !c.id) return;

    // Join date determines which month this customer is a "New Customer"
    const joinDateObj = c.createdAt ? dayjs(c.createdAt) : now;
    const joinMonthKey = joinDateObj.isValid() ? joinDateObj.format('YYYY-MM') : currentMonthKey;
    const joinDateFormatted = joinDateObj.isValid() ? joinDateObj.format('YYYY-MM-DD') : now.format('YYYY-MM-DD');

    // Retrieve or establish month group
    if (!monthMap.has(joinMonthKey)) {
      const monthDate = dayjs(`${joinMonthKey}-01`);
      const isCurr = joinMonthKey === currentMonthKey;
      monthMap.set(joinMonthKey, {
        monthKey: joinMonthKey,
        monthLabel: monthDate.isValid() ? monthDate.format('MMMM YYYY') : joinMonthKey,
        isCurrentMonth: isCurr,
        isClosedMonth: !isCurr, // Closed months fold at the end of each month
        totalRevenueMinor: 0,
        downPaymentTotalMinor: 0,
        installmentTotalMinor: 0,
        newCustomersCount: 0,
        newCustomers: [],
        allCustomersRevenueMinor: 0,
      });
    }

    const monthGroup = monthMap.get(joinMonthKey)!;

    // Resolve property and plan details
    const prop = c.propertyId ? propertyMap.get(c.propertyId) : undefined;
    const plan = planMap.get(c.id);
    const planOverride = plan?.id ? overrides[plan.id] : undefined;

    const propName = prop
      ? `House ${prop.houseNumber || ''} • Offer ${prop.offerNumber || ''}`.trim()
      : plan?.propertyName || 'Residential Plot / Property';

    const propPriceMinor = plan?.totalAmountMinor || prop?.priceMinor || 35000000;
    const downPaymentMinor = plan?.downPaymentMinor !== undefined
      ? plan.downPaymentMinor
      : Math.round(propPriceMinor * 0.2); // Default 20% down payment
    const monthlyInstallment = plan?.monthlyAmountMinor || Math.round((propPriceMinor - downPaymentMinor) / Math.max(plan?.numMonths || 6, 1));

    // Calculate revenue credited for this customer in this joining month
    const transactions: CustomerMonthRevenueTransaction[] = [];
    let customerMonthRevenueMinor = 0;

    // Initial Deposit / Down Payment occurred in the joining month
    if (c.type === 'outright') {
      const outrightAmount = propPriceMinor;
      customerMonthRevenueMinor += outrightAmount;
      transactions.push({
        id: `tx-outright-${c.id}`,
        type: 'outright_purchase',
        label: 'Outright Property Purchase',
        amountMinor: outrightAmount,
        paidOn: joinDateFormatted,
        method: 'Bank Wire / Cheque',
        reference: `OUT-${c.id.slice(0, 6).toUpperCase()}`,
        status: 'verified',
      });
    } else {
      // Payment plan customer: initial down payment deposit
      if (downPaymentMinor > 0) {
        customerMonthRevenueMinor += downPaymentMinor;
        transactions.push({
          id: `tx-down-${c.id}`,
          type: 'down_payment',
          label: 'Initial Down Payment Deposit',
          amountMinor: downPaymentMinor,
          paidOn: joinDateFormatted,
          method: 'Bank Transfer / MoMo',
          reference: `DP-${c.id.slice(0, 6).toUpperCase()}`,
          status: 'verified',
        });
      }

      // Check for any actual override transactions or paid installments in this month
      if (planOverride?.paidInstallments) {
        Object.entries(planOverride.paidInstallments).forEach(([seq, inst]) => {
          if (inst && inst.paidAt) {
            const instMonth = dayjs(inst.paidAt).format('YYYY-MM');
            if (instMonth === joinMonthKey) {
              const instAmt = inst.amountMinor || monthlyInstallment;
              customerMonthRevenueMinor += instAmt;
              transactions.push({
                id: `tx-inst-${c.id}-${seq}`,
                type: 'installment',
                label: `Installment #${seq} Collection`,
                amountMinor: instAmt,
                paidOn: dayjs(inst.paidAt).format('YYYY-MM-DD'),
                method: String(inst.method || 'Mobile Money'),
                reference: inst.reference || `INST-${seq}`,
                status: 'verified',
              });
            }
          }
        });
      }
    }

    const totalPaidToDate = plan?.paidMinor !== undefined
      ? plan.paidMinor
      : (c.type === 'outright' ? propPriceMinor : customerMonthRevenueMinor);

    const balanceRemaining = Math.max(0, propPriceMinor - totalPaidToDate);
    const progressPercent = propPriceMinor > 0
      ? Math.min(100, Math.round((totalPaidToDate / propPriceMinor) * 100))
      : 100;

    const record: NewCustomerRevenueRecord = {
      customerId: c.id,
      customerName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'New Buyer',
      customerPhone: c.phoneNumber || 'N/A',
      customerAddress: c.address || 'Kumasi, Ghana',
      customerType: c.type || 'payment_plan',
      customerCode: c.code || `CUST-${c.id.slice(0, 6).toUpperCase()}`,
      propertyId: c.propertyId || '',
      propertyName: propName,
      propertyPriceMinor: propPriceMinor,
      downPaymentMinor: downPaymentMinor,
      monthlyInstallmentMinor: monthlyInstallment,
      totalPaidToDateMinor: totalPaidToDate,
      balanceMinor: balanceRemaining,
      planStatus: c.type === 'outright' ? 'completed' : (plan?.status || 'active'),
      progressPercent: progressPercent,
      joinedDate: joinDateFormatted,
      monthRevenueMinor: customerMonthRevenueMinor,
      transactions: transactions,
    };

    // Add to month group
    monthGroup.newCustomers.push(record);
    monthGroup.newCustomersCount += 1;
    monthGroup.totalRevenueMinor += customerMonthRevenueMinor;
    if (c.type === 'outright') {
      monthGroup.downPaymentTotalMinor += propPriceMinor;
    } else {
      monthGroup.downPaymentTotalMinor += downPaymentMinor;
      monthGroup.installmentTotalMinor += (customerMonthRevenueMinor - downPaymentMinor);
    }
  });

  // Sort months descending (newest month first)
  const sortedMonths = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  // Compute overall summary numbers
  const currentMonthGroup = monthMap.get(currentMonthKey);
  const currentMonthRevenueMinor = currentMonthGroup ? currentMonthGroup.totalRevenueMinor : 0;
  const currentMonthNewCustomersCount = currentMonthGroup ? currentMonthGroup.newCustomersCount : 0;

  const allTimeNewCustomerRevenueMinor = sortedMonths.reduce((sum, m) => sum + m.totalRevenueMinor, 0);
  const allTimeNewCustomersCount = sortedMonths.reduce((sum, m) => sum + m.newCustomersCount, 0);
  const averageRevenuePerCustomerMinor = allTimeNewCustomersCount > 0
    ? Math.round(allTimeNewCustomerRevenueMinor / allTimeNewCustomersCount)
    : 0;

  // Month-over-month growth
  const previousMonthKey = now.subtract(1, 'month').format('YYYY-MM');
  const prevMonthGroup = monthMap.get(previousMonthKey);
  const prevMonthRev = prevMonthGroup ? prevMonthGroup.totalRevenueMinor : 0;
  let growthRatePercent = 0;
  if (prevMonthRev > 0) {
    growthRatePercent = Math.round(((currentMonthRevenueMinor - prevMonthRev) / prevMonthRev) * 100);
  } else if (currentMonthRevenueMinor > 0) {
    growthRatePercent = 100;
  }

  return {
    currentMonthKey,
    currentMonthLabel,
    currentMonthRevenueMinor,
    currentMonthNewCustomersCount,
    allTimeNewCustomerRevenueMinor,
    allTimeNewCustomersCount,
    averageRevenuePerCustomerMinor,
    growthRatePercent,
    months: sortedMonths,
  };
}
