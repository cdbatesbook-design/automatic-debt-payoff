import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateDebtTotals,
  orderDebts,
  simulatePayoff,
  validateDebts,
  type Debt,
} from "../src/debtCalculator";

const debt = (
  id: string,
  balance: number,
  apr: number,
  minimumPayment: number
): Debt => ({
  id,
  name: id,
  balance,
  apr,
  minimumPayment,
});

test("calculates total balances and minimums", () => {
  const debts = [
    debt("A", 1000, 12, 100),
    debt("B", 2000, 8, 150),
  ];

  assert.equal(
    calculateDebtTotals(debts).balance,
    3000
  );

  assert.equal(
    calculateDebtTotals(debts).minimumPayments,
    250
  );
});

test("avalanche prioritizes the highest APR", () => {
  const result = orderDebts(
    [
      debt("low", 100, 5, 20),
      debt("high", 500, 25, 30),
    ],
    "avalanche"
  );

  assert.equal(result[0].id, "high");
});

test("snowball prioritizes the smallest balance", () => {
  const result = orderDebts(
    [
      debt("large", 500, 25, 30),
      debt("small", 100, 5, 20),
    ],
    "snowball"
  );

  assert.equal(result[0].id, "small");
});

test("rejects invalid debt data", () => {
  assert.ok(
    validateDebts([
      debt("bad", -10, 5, 20),
    ]).length > 0
  );
});

test("pays off a zero-interest debt in 12 months", () => {
  const result = simulatePayoff(
    [debt("A", 1200, 0, 100)],
    "avalanche",
    0
  );

  assert.equal(result.status, "paid_off");
  assert.equal(result.months, 12);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalPaid, 1200);
});

test("extra payments reduce payoff time and interest", () => {
  const debts = [
    debt("A", 1200, 12, 100),
  ];

  const normal = simulatePayoff(
    debts,
    "avalanche",
    0
  );

  const extra = simulatePayoff(
    debts,
    "avalanche",
    100
  );

  assert.equal(normal.status, "paid_off");
  assert.equal(extra.status, "paid_off");

  if (
    normal.months === null ||
    extra.months === null
  ) {
    throw new Error(
      "Expected both payoff plans to have a finite duration."
    );
  }

  assert.ok(extra.months < normal.months);

  assert.ok(
    extra.totalInterest < normal.totalInterest
  );
});

test("rolls freed payment money into remaining debts", () => {
  const debts = [
    debt("small", 100, 0, 100),
    debt("large", 1000, 0, 50),
  ];

  const result = simulatePayoff(
    debts,
    "snowball",
    0
  );

  assert.equal(result.status, "paid_off");
  assert.equal(result.months, 8);
  assert.equal(result.totalPaid, 1100);
});

test("rejects negative extra payments", () => {
  const result = simulatePayoff(
    [debt("A", 1000, 10, 50)],
    "avalanche",
    -20
  );

  assert.equal(result.status, "invalid");
});

test("rejects an empty debt list", () => {
  assert.equal(
    simulatePayoff([], "avalanche", 0).status,
    "invalid"
  );
});

test("flags a payment plan that cannot reduce debt", () => {
  const result = simulatePayoff(
    [debt("A", 1000, 120, 50)],
    "avalanche",
    0
  );

  assert.equal(result.status, "unpayable");
  assert.equal(result.months, null);
});
