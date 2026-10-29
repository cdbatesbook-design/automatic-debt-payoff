
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  calculateDebtTotals,
  simulatePayoff,
  type Debt,
  type Strategy,
} from "./src/debtCalculator";

type AccountType = "Checking" | "Savings" | "Cash";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
};

type TransactionType = "Deposit" | "Expense" | "Payment";

type Transaction = {
  id: string;
  accountId: string;
  description: string;
  type: TransactionType;
  amount: number;
  date: string;
};

type Screen =
  | "dashboard"
  | "debts"
  | "accounts"
  | "checkbook"
  | "agreement";

const DEBT_KEY = "debt-payoff-data-v1";
const URL_KEY = "debt-payoff-backend-url-v1";
const ACCOUNT_KEY = "finance-accounts-v1";
const TRANSACTION_KEY = "finance-transactions-v1";

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function newId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [warning, setWarning] = useState("");

  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimum, setMinimum] = useState("");
  const [extra, setExtra] = useState("0");
  const [strategy, setStrategy] = useState<Strategy>("avalanche");

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("Checking");
  const [openingBalance, setOpeningBalance] = useState("");

  const [transactionAccount, setTransactionAccount] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("Expense");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");

  const [apiUrl, setApiUrl] = useState("");
  const [agreement, setAgreement] = useState("");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [savedDebts, savedAccounts, savedTransactions, savedUrl] =
          await Promise.all([
            AsyncStorage.getItem(DEBT_KEY),
            AsyncStorage.getItem(ACCOUNT_KEY),
            AsyncStorage.getItem(TRANSACTION_KEY),
            AsyncStorage.getItem(URL_KEY),
          ]);

        if (savedDebts) {
          const parsed = JSON.parse(savedDebts);
          if (
            !Array.isArray(parsed) ||
            parsed.some(
              (d: any) =>
                typeof d?.id !== "string" ||
                typeof d?.name !== "string" ||
                !Number.isFinite(d?.balance) ||
                !Number.isFinite(d?.apr) ||
                !Number.isFinite(d?.minimumPayment)
            )
          ) {
            throw new Error("Saved debt data is invalid.");
          }
          setDebts(parsed);
        }

        if (savedAccounts) {
          const parsed = JSON.parse(savedAccounts);
          if (
            !Array.isArray(parsed) ||
            parsed.some(
              (a: any) =>
                typeof a?.id !== "string" ||
                typeof a?.name !== "string" ||
                !["Checking", "Savings", "Cash"].includes(a?.type) ||
                !Number.isFinite(a?.openingBalance)
            )
          ) {
            throw new Error("Saved account data is invalid.");
          }
          setAccounts(parsed);
        }

        if (savedTransactions) {
          const parsed = JSON.parse(savedTransactions);
          if (
            !Array.isArray(parsed) ||
            parsed.some(
              (t: any) =>
                typeof t?.id !== "string" ||
                typeof t?.accountId !== "string" ||
                typeof t?.description !== "string" ||
                !["Deposit", "Expense", "Payment"].includes(t?.type) ||
                !Number.isFinite(t?.amount) ||
                typeof t?.date !== "string"
            )
          ) {
            throw new Error("Saved transaction data is invalid.");
          }
          setTransactions(parsed);
        }

        if (savedUrl) setApiUrl(savedUrl);
      } catch {
        setWarning(
          "Some saved data could not be validated or loaded. Export or check your backup before making changes."
        );
      } finally {
        setLoaded(true);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!loaded || warning) return;
    AsyncStorage.setItem(DEBT_KEY, JSON.stringify(debts)).catch(() =>
      setWarning("Debt data could not be saved.")
    );
  }, [debts, loaded, warning]);

  useEffect(() => {
    if (!loaded || warning) return;
    AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts)).catch(() =>
      setWarning("Account data could not be saved.")
    );
  }, [accounts, loaded, warning]);

  useEffect(() => {
    if (!loaded || warning) return;
    AsyncStorage.setItem(
      TRANSACTION_KEY,
      JSON.stringify(transactions)
    ).catch(() => setWarning("Transaction data could not be saved."));
  }, [transactions, loaded, warning]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(URL_KEY, apiUrl.trim()).catch(() => {});
  }, [apiUrl, loaded]);

  const totals = calculateDebtTotals(debts);
  const result = simulatePayoff(debts, strategy, Number(extra));

  function accountBalance(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return 0;

    return transactions.reduce((total, transaction) => {
      if (transaction.accountId !== accountId) return total;
      return total +
        (transaction.type === "Deposit"
          ? transaction.amount
          : -transaction.amount);
    }, account.openingBalance);
  }

  const totalCash = accounts.reduce(
    (total, account) => total + accountBalance(account.id),
    0
  );

  function addDebt() {
    const b = Number(balance);
    const a = Number(apr);
    const m = Number(minimum);

    if (
      !name.trim() ||
      !Number.isFinite(b) ||
      b <= 0 ||
      !Number.isFinite(a) ||
      a < 0 ||
      !Number.isFinite(m) ||
      m <= 0
    ) {
      notify("Check your entries", "Enter a debt name, positive balance, non-negative APR, and positive minimum payment.");
      return;
    }

    setDebts((current) => [
      ...current,
      {
        id: newId(),
        name: name.trim(),
        balance: b,
        apr: a,
        minimumPayment: m,
      },
    ]);

    setName("");
    setBalance("");
    setApr("");
    setMinimum("");
    notify("Debt added", "Your debt has been added to the planner.");
  }

  function removeDebt(id: string) {
    const debt = debts.find((item) => item.id === id);
    if (!debt) return;

    const remove = () =>
      setDebts((current) => current.filter((item) => item.id !== id));

    if (Platform.OS === "web") {
      if (window.confirm(`Remove "${debt.name}" from your planner?`)) remove();
      return;
    }

    Alert.alert("Remove debt", `Remove "${debt.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: remove },
    ]);
  }

  function addAccount() {
    const opening = Number(openingBalance);

    if (!accountName.trim() || !Number.isFinite(opening) || opening < 0) {
      notify("Check your entries", "Enter an account name and a valid opening balance of zero or more.");
      return;
    }

    setAccounts((current) => [
      ...current,
      {
        id: newId(),
        name: accountName.trim(),
        type: accountType,
        openingBalance: opening,
      },
    ]);

    setAccountName("");
    setOpeningBalance("");
    notify("Account added", "Your account has been saved on this device.");
  }

  function addTransaction() {
    const amount = Number(transactionAmount);

    if (!transactionAccount || !accounts.some((a) => a.id === transactionAccount)) {
      notify("Choose an account", "Add an account first, then select it here.");
      return;
    }

    if (!transactionDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("Check your entries", "Enter a description and an amount greater than zero.");
      return;
    }

    const current = accountBalance(transactionAccount);

    if (transactionType !== "Deposit" && amount > current) {
      notify(
        "Insufficient recorded balance",
        "This transaction is larger than the account's recorded balance. Check your balance and entries before continuing."
      );
      return;
    }

    setTransactions((currentTransactions) => [
      {
        id: newId(),
        accountId: transactionAccount,
        description: transactionDescription.trim(),
        type: transactionType,
        amount,
        date: new Date().toISOString(),
      },
      ...currentTransactions,
    ]);

    setTransactionAmount("");
    setTransactionDescription("");
    notify("Transaction recorded", "The transaction was added to your checkbook.");
  }

  function exportBackup() {
    const data = JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        debts,
        accounts,
        transactions,
        extraPayment: Number(extra),
        strategy,
      },
      null,
      2
    );

    if (Platform.OS !== "web") {
      notify(
        "Backup",
        "JSON download is currently available in the web version. Keep a separate backup before uninstalling the app."
      );
      return;
    }

    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "automatic-debt-payoff-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function analyzeAgreement() {
    const base = apiUrl.trim().replace(/\/+$/, "");

    if (!base.startsWith("https://")) {
      notify("Backend URL required", "Enter your deployed HTTPS backend URL.");
      return;
    }

    if (agreement.trim().length < 100) {
      notify("Agreement text needed", "Paste at least 100 characters.");
      return;
    }

    if (!consent) {
      notify("Confirmation required", "Remove personal information and confirm before sending.");
      return;
    }

    setBusy(true);
    setAnalysis("");

    try {
      const response = await fetch(`${base}/api/analyze-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreement: agreement.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Analysis request failed.");
      }

      setAnalysis(data.analysis || "No analysis was returned.");
    } catch (error) {
      notify(
        "Analysis failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const field = (
    label: string,
    value: string,
    change: (value: string) => void,
    placeholder = "",
    numeric = true
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={change}
        placeholder={placeholder}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize={numeric ? "none" : "sentences"}
      />
    </View>
  );

  const navItems: { key: Screen; label: string }[] = [
    { key: "dashboard", label: "Home" },
    { key: "debts", label: "Debts" },
    { key: "accounts", label: "Accounts" },
    { key: "checkbook", label: "Checkbook" },
    { key: "agreement", label: "Loan Help" },
  ];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>YOUR MONEY, YOUR PLAN</Text>
      <Text style={styles.title}>Automatic Debt Payoff</Text>
      <Text style={styles.subtitle}>
        One place to track your money and plan your way forward.
      </Text>

      <View style={styles.nav}>
        {navItems.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.navItem, screen === item.key && styles.active]}
            onPress={() => setScreen(item.key)}
          >
            <Text style={[styles.navText, screen === item.key && styles.activeText]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {screen === "dashboard" && (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>MONEY IN YOUR ACCOUNTS</Text>
            <Text style={styles.heroAmount}>{money(totalCash)}</Text>
            <Text style={styles.heroNote}>
              Based on the opening balances and transactions you entered.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Your financial snapshot</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total tracked debt</Text>
              <Text style={styles.statValue}>{money(totals.balance)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Minimum debt payments</Text>
              <Text style={styles.statValue}>{money(totals.minimumPayments)}/mo</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Cash minus tracked debt</Text>
              <Text style={styles.statValue}>{money(totalCash - totals.balance)}</Text>
            </View>
            <Text style={styles.help}>
              This is a simple snapshot, not a full net-worth calculation.
              Only accounts and debts you enter are included.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Quick actions</Text>
            <Pressable style={styles.button} onPress={() => setScreen("accounts")}>
              <Text style={styles.buttonText}>+ Add an account</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setScreen("checkbook")}>
              <Text style={styles.secondaryText}>+ Record a transaction</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setScreen("debts")}>
              <Text style={styles.secondaryText}>View debt payoff plan</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Accounts at a glance</Text>
            {accounts.length === 0 ? (
              <Text style={styles.help}>
                You have not added accounts yet. Start with checking, savings, or cash.
              </Text>
            ) : (
              accounts.map((account) => (
                <View style={styles.listRow} key={account.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{account.name}</Text>
                    <Text style={styles.help}>{account.type}</Text>
                  </View>
                  <Text style={styles.statValue}>{money(accountBalance(account.id))}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {screen === "accounts" && (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>Add an account</Text>
            {field("Account nickname", accountName, setAccountName, "Everyday checking", false)}
            <Text style={styles.label}>Account type</Text>
            <View style={styles.row}>
              {(["Checking", "Savings", "Cash"] as AccountType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.tab, accountType === type && styles.active]}
                  onPress={() => setAccountType(type)}
                >
                  <Text>{type}</Text>
                </Pressable>
              ))}
            </View>
            {field("Opening balance ($)", openingBalance, setOpeningBalance, "500")}
            <Pressable style={styles.button} onPress={addAccount}>
              <Text style={styles.buttonText}>Save account</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Your accounts</Text>
            {accounts.length === 0 ? (
              <Text>No accounts yet.</Text>
            ) : (
              accounts.map((account) => (
                <View style={styles.listRow} key={account.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{account.name}</Text>
                    <Text style={styles.help}>{account.type}</Text>
                  </View>
                  <Text style={styles.statValue}>{money(accountBalance(account.id))}</Text>
                </View>
              ))
            )}
            <Text style={styles.help}>
              For this first version, accounts cannot yet be edited or deleted.
              Check your opening balance carefully.
            </Text>
          </View>
        </>
      )}

      {screen === "checkbook" && (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>Record a transaction</Text>

            {accounts.length === 0 ? (
              <>
                <Text style={styles.help}>
                  Add an account before recording transactions.
                </Text>
                <Pressable style={styles.button} onPress={() => setScreen("accounts")}>
                  <Text style={styles.buttonText}>Add account first</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Account</Text>
                {accounts.map((account) => (
                  <Pressable
                    key={account.id}
                    style={[
                      styles.choice,
                      transactionAccount === account.id && styles.choiceActive,
                    ]}
                    onPress={() => setTransactionAccount(account.id)}
                  >
                    <Text style={styles.itemTitle}>{account.name}</Text>
                    <Text>{money(accountBalance(account.id))}</Text>
                  </Pressable>
                ))}

                <Text style={styles.label}>Transaction type</Text>
                <View style={styles.row}>
                  {(["Deposit", "Expense", "Payment"] as TransactionType[]).map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.tab, transactionType === type && styles.active]}
                      onPress={() => setTransactionType(type)}
                    >
                      <Text>{type}</Text>
                    </Pressable>
                  ))}
                </View>

                {field("Amount ($)", transactionAmount, setTransactionAmount, "45.00")}
                {field(
                  "Description",
                  transactionDescription,
                  setTransactionDescription,
                  "Groceries, paycheck, or bill",
                  false
                )}

                <Text style={styles.help}>
                  Deposits increase the selected account. Expenses and payments
                  decrease it. Recording a payment here does not automatically
                  change a debt balance in the debt planner.
                </Text>

                <Pressable style={styles.button} onPress={addTransaction}>
                  <Text style={styles.buttonText}>Save transaction</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Transaction history</Text>
            {transactions.length === 0 ? (
              <Text>No transactions recorded yet.</Text>
            ) : (
              transactions.map((transaction) => {
                const account = accounts.find((a) => a.id === transaction.accountId);
                return (
                  <View style={styles.listRow} key={transaction.id}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{transaction.description}</Text>
                      <Text style={styles.help}>
                        {account?.name || "Account"} · {transaction.type}
                      </Text>
                      <Text style={styles.help}>
                        {new Date(transaction.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.statValue,
                        transaction.type === "Deposit" ? styles.positive : styles.negative,
                      ]}
                    >
                      {transaction.type === "Deposit" ? "+" : "-"}
                      {money(transaction.amount)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {screen === "debts" && (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>Debt overview</Text>
            <Text style={styles.bigNumber}>{money(totals.balance)}</Text>
            <Text>Minimum payments: {money(totals.minimumPayments)}/month</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Repayment strategy</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.tab, strategy === "avalanche" && styles.active]}
                onPress={() => setStrategy("avalanche")}
              >
                <Text>Avalanche</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, strategy === "snowball" && styles.active]}
                onPress={() => setStrategy("snowball")}
              >
                <Text>Snowball</Text>
              </Pressable>
            </View>
            <Text style={styles.help}>
              Avalanche targets the highest APR first. Snowball targets the
              smallest balance first.
            </Text>
            {field("Extra monthly payment ($)", extra, setExtra, "0")}
            <Text style={styles.metric}>
              Monthly budget: {money(result.monthlyBudget)}
            </Text>
            <Text style={styles.metric}>
              {result.months === null
                ? "Unable to estimate payoff"
                : `Estimated payoff: ${result.months} months`}
            </Text>
            <Text>Estimated interest: {money(result.totalInterest)}</Text>
            <Text style={styles.help}>{result.message}</Text>
            <Text style={styles.help}>
              Estimates may differ from lender calculations and payment-posting dates.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Add a debt</Text>
            {field("Debt name", name, setName, "Auto loan", false)}
            {field("Balance ($)", balance, setBalance, "12000")}
            {field("APR (%)", apr, setApr, "7.5")}
            {field("Minimum monthly payment ($)", minimum, setMinimum, "350")}
            <Pressable style={styles.button} onPress={addDebt}>
              <Text style={styles.buttonText}>Add debt</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Your debts</Text>
            {debts.length === 0 ? (
              <Text>No debts added yet.</Text>
            ) : (
              debts.map((debt) => (
                <View style={styles.listRow} key={debt.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{debt.name}</Text>
                    <Text>{money(debt.balance)} · {debt.apr}% APR</Text>
                    <Text style={styles.help}>
                      Minimum: {money(debt.minimumPayment)}/month
                    </Text>
                  </View>
                  <Pressable onPress={() => removeDebt(debt.id)}>
                    <Text style={styles.link}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {screen === "agreement" && (
        <View style={styles.card}>
          <Text style={styles.heading}>Understand My Loan Agreement</Text>
          <Text style={styles.help}>
            Examine extra-payment allocation, principal-only payments, interest,
            fees, and early payoff wording.
          </Text>

          <View style={styles.warning}>
            <Text>
              Remove account numbers, Social Security numbers, addresses,
              signatures, and other sensitive information. Your text will be sent
              to your configured backend for analysis.
            </Text>
          </View>

          {field("Backend HTTPS URL", apiUrl, setApiUrl, "https://your-service.onrender.com", false)}
          <View style={styles.field}>
            <Text style={styles.label}>Loan agreement text</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={agreement}
              onChangeText={setAgreement}
              multiline
              textAlignVertical="top"
              placeholder="Paste agreement wording here..."
            />
          </View>

          <Pressable
            style={styles.secondary}
            onPress={() => setConsent((value) => !value)}
          >
            <Text style={styles.secondaryText}>
              {consent ? "✓ Confirmed: send text for analysis" : "Confirm sending text for analysis"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, busy && styles.disabled]}
            onPress={analyzeAgreement}
            disabled={busy}
          >
            <Text style={styles.buttonText}>
              {busy ? "Analyzing..." : "Analyze agreement"}
            </Text>
          </Pressable>

          {!!analysis && (
            <View style={styles.analysis}>
              <Text style={styles.heading}>Analysis results</Text>
              <Text selectable>{analysis}</Text>
              <Text style={styles.help}>
                Educational information only, not legal advice. Confirm payment
                procedures with your lender.
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.heading}>Your data</Text>
        <Text style={styles.help}>
          Your entries are saved locally on this device. Export a backup before
          uninstalling or replacing the app. This version does not yet have a
          native Android backup/export workflow.
        </Text>
        <Pressable style={styles.secondary} onPress={exportBackup}>
          <Text style={styles.secondaryText}>Export JSON backup (web)</Text>
        </Pressable>
      </View>

      {!!warning && (
        <View style={styles.warning}>
          <Text>{warning}</Text>
          <Text style={styles.help}>
            Avoid making changes until you have checked whether your saved data
            is intact.
          </Text>
        </View>
      )}

      <Text style={styles.footer}>
        Estimates are not guarantees. This app does not move money or connect
        to your bank. Verify your balances and lender terms independently.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f2f5f9" },
  container: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 50,
  },
  eyebrow: {
    color: "#137653",
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 12,
  },
  title: {
    fontSize: 29,
    fontWeight: "900",
    color: "#152238",
    marginTop: 8,
  },
  subtitle: { fontSize: 15, marginVertical: 14, color: "#59677a" },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 16,
  },
  navItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
  },
  navText: { fontWeight: "700", color: "#334155", fontSize: 12 },
  active: { backgroundColor: "#c9ead9", borderColor: "#137653" },
  activeText: { color: "#105e42" },
  hero: {
    backgroundColor: "#123c32",
    padding: 22,
    borderRadius: 18,
    marginBottom: 16,
  },
  heroLabel: { color: "#c5f2dc", fontWeight: "800", fontSize: 12 },
  heroAmount: { color: "#fff", fontSize: 34, fontWeight: "900", marginTop: 8 },
  heroNote: { color: "#d9e9e3", marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 17,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heading: { fontSize: 19, fontWeight: "900", color: "#152238", marginBottom: 12 },
  bigNumber: { fontSize: 27, fontWeight: "900", marginBottom: 8, color: "#152238" },
  metric: { fontSize: 18, fontWeight: "800", marginTop: 12, marginBottom: 8 },
  label: { fontWeight: "700", marginBottom: 6, color: "#344054" },
  field: { marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    color: "#172033",
    fontSize: 16,
  },
  multiline: { minHeight: 180, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  tab: {
    flex: 1,
    minWidth: 85,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e7ebf1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  button: {
    backgroundColor: "#137653",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondary: {
    backgroundColor: "#e6f3ec",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: { color: "#126344", fontWeight: "800" },
  warning: {
    backgroundColor: "#fff4df",
    borderColor: "#efd49b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  help: { color: "#687386", lineHeight: 20, marginTop: 7, fontSize: 13 },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10, 18 
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f4",
    gap: 12,
  },
  statLabel: { color: "#536174", flex: 1 },
  statValue: { fontWeight: "800", color: "#172033", textAlign: "right" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e7ebf1",
    gap: 12,
  },
  itemTitle: { fontWeight: "800", color: "#172033", fontSize: 15 },
  choice: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginTop: 7,
    borderWidth: 1,
    borderColor: "#d6dce5",
    borderRadius: 10,
  },
  choiceActive: { backgroundColor: "#e6f3ec", borderColor: "#137653" },
  positive: { color: "#137653" },
  negative: { color: "#9b3434" },
  link: { color: "#137653", fontWeight: "800" },
  analysis: { marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: "#f3f8f5" },
  disabled: { opacity: 0.5 },
  footer: {
    color: "#687386",
    textAlign: "center",
    lineHeight: 20,
    marginVertical: 18,
    fontSize: 12,
  },
});
