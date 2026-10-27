export type Debt = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
};

export type Strategy = "avalanche" | "snowball";

export type PayoffResult = {
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  monthlyBudget: number;
  status: "paid_off" | "unpayable" | "invalid";
  message: string;
};

export function validateDebts(debts: Debt[]): string[] {
  if (!Array.isArray(debts)) {
    return ["Invalid debt list."];
  }

  const errors: string[] = [];

  debts.forEach((debt, index) => {
    if (!debt || typeof debt !== "object") {
      errors.push(
        `Debt ${index + 1}: invalid debt record.`
      );
      return;
    }

    if (
      typeof debt.name !== "string" ||
      !debt.name.trim()
    ) {
      errors.push(
        `Debt ${index + 1}: name is required.`
      );
    }

    if (
      !Number.isFinite(debt.balance) ||
      debt.balance <= 0
    ) {
      errors.push(
        `Debt ${index + 1}: balance must be positive.`
      );
    }

    if (
      !Number.isFinite(debt.apr) ||
      debt.apr < 0 ||
      debt.apr > 1000
    ) {
      errors.push(
        `Debt ${index + 1}: invalid APR.`
      );
    }

    if (
      !Number.isFinite(debt.minimumPayment) ||
      debt.minimumPayment <= 0
    ) {
      errors.push(
        `Debt ${index + 1}: minimum payment must be positive.`
      );
    }
  });

  return errors;
}

export function calculateDebtTotals(debts: Debt[]) {
  return {
    balance: debts.reduce(
      (sum, debt) => sum + debt.balance,
      0
    ),
    minimumPayments: debts.reduce(
      (sum, debt) => sum + debt.minimumPayment,
      0
    ),
  };
}

export function orderDebts<T extends Debt>(
  debts: T[],
  strategy: Strategy
): T[] {
  return [...debts].sort((a, b) => {
    if (strategy === "avalanche") {
      return b.apr - a.apr || a.balance - b.balance;
    }

    return a.balance - b.balance || b.apr - a.apr;
  });
}

export function simulatePayoff(
  debts: Debt[],
  strategy: Strategy,
  extraPayment: number
): PayoffResult {
  const invalid = (message: string): PayoffResult => ({
    months: null,
    totalInterest: 0,
    totalPaid: 0,
    monthlyBudget: 0,
    status: "invalid",
    message,
  });

  if (!Array.isArray(debts) || debts.length === 0) {
    return invalid("Add at least one debt.");
  }

  const errors = validateDebts(debts);

  if (errors.length > 0) {
    return invalid(errors.join(" "));
  }

  if (
    !Number.isFinite(extraPayment) ||
    extraPayment < 0
  ) {
    return invalid(
      "Extra payment must be zero or greater."
    );
  }

  if (
    strategy !== "avalanche" &&
    strategy !== "snowball"
  ) {
    return invalid("Choose avalanche or snowball.");
  }

  const monthlyBudget =
    debts.reduce(
      (sum, debt) => sum + debt.minimumPayment,
      0
    ) + extraPayment;

  const active = debts.map((debt) => ({
    ...debt,
    remaining: debt.balance,
  }));

  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= 1200; month++) {
    const beforeMonth = active.reduce(
      (sum, debt) => sum + debt.remaining,
      0
    );

    if (beforeMonth <= 0.005) {
      return {
        months: month - 1,
        totalInterest,
        totalPaid,
        monthlyBudget,
        status: "paid_off",
        message:
          "All debts are paid off in this estimate.",
      };
    }

    for (const debt of active) {
      if (debt.remaining <= 0.005) continue;

      const interest =
        debt.remaining * (debt.apr / 1200);

      debt.remaining += interest;
      totalInterest += interest;
    }

    let available = monthlyBudget;

    // Pay the minimum due on each active debt first.
    for (const debt of active) {
      if (debt.remaining <= 0.005) continue;

      const payment = Math.min(
        debt.minimumPayment,
        debt.remaining,
        available
      );

      debt.remaining -= payment;
      available -= payment;
      totalPaid += payment;
    }

    // Direct remaining money to debts by the chosen strategy.
    const priority = orderDebts(
      active.filter(
        (debt) => debt.remaining > 0.005
      ),
      strategy
    );

    for (const debt of priority) {
      if (available <= 0.005) break;

      const payment = Math.min(
        debt.remaining,
        available
      );

      debt.remaining -= payment;
      available -= payment;
      totalPaid += payment;
    }

    for (const debt of active) {
      if (debt.remaining < 0.005) {
        debt.remaining = 0;
      }
    }

    const afterMonth = active.reduce(
      (sum, debt) => sum + debt.remaining,
      0
    );

    if (afterMonth <= 0.005) {
      return {
        months: month,
        totalInterest,
        totalPaid,
        monthlyBudget,
        status: "paid_off",
        message:
          "All debts are paid off in this estimate.",
      };
    }

    // Stop if the payment plan is not reducing the debt.
    if (afterMonth >= beforeMonth - 0.005) {
      return {
        months: null,
        totalInterest,
        totalPaid,
        monthlyBudget,
        status: "unpayable",
        message:
          "Your payment budget is not reducing the total debt. Increase payments or verify your loan terms.",
      };
    }
  }

  return {
    months: null,
    totalInterest,
    totalPaid,
    monthlyBudget,
    status: "unpayable",
    message:
      "The debts were not paid off within 100 years. Review the payment amounts and interest rates.",
  };
}
