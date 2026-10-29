
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
type TransactionType = "Deposit" | "Expense" | "Payment";
type Screen = "dashboard" | "debts" | "accounts" | "checkbook" | "agreement";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
};

type Transaction = {
  id: string;
  accountId: string;
  description: string;
  type: TransactionType;
  amount: number;
  date: string;
};

const DEBT_KEY = "debt-payoff-data-v1";
const URL_KEY = "debt-payoff-backend-url-v1";
const ACCOUNT_KEY = "finance-accounts-v1";
const TRANSACTION_KEY = "finance-transactions-v1";

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    Alert.alert(title, message);
  } else {
    Alert.alert(title, message);
  }
}

function money(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return safeValue.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validDebtData(value: unknown): value is Debt[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.balance === "number" &&
        Number.isFinite(item.balance) &&
        item.balance >= 0 &&
        typeof item.apr === "number" &&
        Number.isFinite(item.apr) &&
        item.apr >= 0 &&
        typeof item.minimumPayment === "number" &&
        Number.isFinite(item.minimumPayment) &&
        item.minimumPayment > 0
    )
  );
}

function validAccountData(value: unknown): value is Account[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        ["Checking", "Savings", "Cash"].includes(String(item.type)) &&
        typeof item.openingBalance === "number" &&
        Number.isFinite(item.openingBalance) &&
        item.openingBalance >= 0
    )
  );
}

function validTransactionData(value: unknown): value is Transaction[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.accountId === "string" &&
        typeof item.description === "string" &&
        ["Deposit", "Expense", "Payment"].includes(String(item.type)) &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount > 0 &&
        typeof item.date === "string" &&
        !Number.isNaN(Date.parse(item.date))
    )
  );
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
  const [accountType, setAccountType] =
    useState<AccountType>("Checking");
  const [openingBalance, setOpeningBalance] = useState("");

  const [transactionAccount, setTransactionAccount] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("Expense");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] =
    useState("");

  const [apiUrl, setApiUrl] = useState("");
  const [agreement, setAgreement] = useState("");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [savedDebts, savedAccounts, savedTransactions, savedUrl] =
          await Promise.all([
            AsyncStorage.getItem(DEBT_KEY),
            AsyncStorage.getItem(ACCOUNT_KEY),
            AsyncStorage.getItem(TRANSACTION_KEY),
            AsyncStorage.getItem(URL_KEY),
          ]);

        if (!active) return;

        if (savedDebts !== null) {
          const parsed: unknown = JSON.parse(savedDebts);

          if (!validDebtData(parsed)) {
            throw new Error("Saved debt data is invalid.");
          }

          setDebts(parsed);
        }

        if (savedAccounts !== null) {
          const parsed: unknown = JSON.parse(savedAccounts);

          if (!validAccountData(parsed)) {
            throw new Error("Saved account data is invalid.");
          }

          setAccounts(parsed);
        }

        if (savedTransactions !== null) {
          const parsed: unknown = JSON.parse(savedTransactions);

          if (!validTransactionData(parsed)) {
            throw new Error("Saved transaction data is invalid.");
          }

          setTransactions(parsed);
        }

        if (savedUrl !== null) {
          setApiUrl(savedUrl);
        }
      } catch {
        if (active) {
          setWarning(
            "Some saved data could not be validated or loaded. Check your backup before making changes."
          );
        }
      } finally {
        if (active) setLoaded(true);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || warning) return;

    AsyncStorage.setItem(DEBT_KEY, JSON.stringify(debts)).catch(() => {
      setWarning("Debt data could not be saved. Check your backup.");
    });
  }, [debts, loaded, warning]);

  useEffect(() => {
    if (!loaded || warning) return;

    AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts)).catch(() => {
      setWarning("Account data could not be saved. Check your backup.");
    });
  }, [accounts, loaded, warning]);

  useEffect(() => {
    if (!loaded || warning) return;

    AsyncStorage.setItem(
      TRANSACTION_KEY,
      JSON.stringify(transactions)
    ).catch(() => {
      setWarning("Transaction data could not be saved. Check your backup.");
    });
  }, [transactions, loaded, warning]);

  useEffect(() => {
    if (!loaded) return;

    AsyncStorage.setItem(URL_KEY, apiUrl.trim()).catch(() => {
      setWarning("Your backend URL could not be saved.");
    });
  }, [apiUrl, loaded]);

  const totals = calculateDebtTotals(debts);

  const parsedExtra = Number(extra);
  const safeExtra =
    Number.isFinite(parsedExtra) && parsedExtra >= 0 ? parsedExtra : 0;

  const result = simulatePayoff(debts, strategy, safeExtra);

  function accountBalance(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);

    if (!account) return 0;

    return transactions.reduce((total, transaction) => {
      if (transaction.accountId !== accountId) return total;

      return (
        total +
        (transaction.type === "Deposit"
          ? transaction.amount
          : -transaction.amount)
      );
    }, account.openingBalance);
  }

  const totalCash = accounts.reduce(
    (total, account) => total + accountBalance(account.id),
    0
  );

  function addDebt() {
    const debtBalance = Number(balance);
    const debtApr = Number(apr);
    const minPayment = Number(minimum);

    if (
      !name.trim() ||
      balance.trim() === "" ||
      apr.trim() === "" ||
      minimum.trim() === "" ||
      !Number.isFinite(debtBalance) ||
      debtBalance <= 0 ||
      !Number.isFinite(debtApr) ||
      debtApr < 0 ||
      !Number.isFinite(minPayment) ||
      minPayment <= 0
    ) {
      notify(
        "Check your entries",
        "Enter a debt name, positive balance, non-negative APR, and positive minimum payment."
      );
      return;
    }

    if (debtApr > 100) {
      notify("Check APR", "Enter the APR as a percentage, such as 7.5.");
      return;
    }

    setDebts((current) => [
      ...current,
      {
        id: newId(),
        name: name.trim(),
        balance: debtBalance,
        apr: debtApr,
        minimumPayment: minPayment,
      },
    ]);

    setName("");
    setBalance("");
    setApr("");
    setMinimum("");

    notify("Debt added", "Your debt was added to the payoff planner.");
  }

  function removeDebt(id: string) {
    const debt = debts.find((item) => item.id === id);
    if (!debt) return;

    const remove = () => {
      setDebts((current) => current.filter((item) => item.id !== id));
    };

    Alert.alert("Remove debt", `Remove "${debt.name}" from your planner?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: remove },
    ]);
  }

  function addAccount() {
    const opening = Number(openingBalance);

    if (
      !accountName.trim() ||
      openingBalance.trim() === "" ||
      !Number.isFinite(opening) ||
      opening < 0
    ) {
      notify(
        "Check your entries",
        "Enter an account name and an opening balance of zero or more."
      );
      return;
    }

    const account: Account = {
      id: newId(),
      name: accountName.trim(),
      type: accountType,
      openingBalance: opening,
    };

    setAccounts((current) => [...current, account]);
    setTransactionAccount(account.id);
    setAccountName("");
    setOpeningBalance("");

    notify("Account added", "Your account was saved on this device.");
  }

  function addTransaction() {
    const amount = Number(transactionAmount);

    if (
      !transactionAccount ||
      !accounts.some((account) => account.id === transactionAccount)
    ) {
      notify("Choose an account", "Select an account before continuing.");
      return;
    }

    if (
      !transactionDescription.trim() ||
      transactionAmount.trim() === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      notify(
        "Check your entries",
        "Enter a description and an amount greater than zero."
      );
      return;
    }

    const current = accountBalance(transactionAccount);

    if (transactionType !== "Deposit" && amount > current) {
      notify(
        "Insufficient recorded balance",
        "This transaction exceeds the account's recorded balance. Check your entries first."
      );
      return;
    }

    const transaction: Transaction = {
      id: newId(),
      accountId: transactionAccount,
      description: transactionDescription.trim(),
      type: transactionType,
      amount,
      date: new Date().toISOString(),
    };

    setTransactions((currentTransactions) => [
      transaction,
      ...currentTransactions,
    ]);

    setTransactionAmount("");
    setTransactionDescription("");

    notify("Transaction recorded", "Your transaction was saved.");
  }

  function deleteTransaction(id: string) {
    Alert.alert(
      "Delete transaction",
      "This will remove the transaction and recalculate the recorded account balance.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            setTransactions((current) =>
              current.filter((item) => item.id !== id)
            ),
        },
      ]
    );
  }

  function exportBackup() {
    const data = JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        debts,
        accounts,
        transactions,
        extraPayment: safeExtra,
        strategy,
      },
      null,
      2
    );

    if (Platform.OS !== "web") {
      notify(
        "Backup",
        "Use the web version's Export JSON backup option to download a backup. Keep a separate copy before uninstalling the Android app."
      );
      return;
    }

    try {
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "automatic-debt-payoff-backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notify("Backup failed", "Your backup could not be downloaded.");
    }
  }

  async function analyzeAgreement() {
    const base = apiUrl.trim().replace(/\/+$/, "");

    if (!/^https:\/\/[^/\s]+/i.test(base)) {
      notify(
        "Backend URL required",
        "Enter the HTTPS URL of your deployed backend."
      );
      return;
    }

    if (agreement.trim().length < 100) {
      notify(
        "Agreement text needed",
        "Paste at least 100 characters of agreement wording."
      );
      return;
    }

    if (!consent) {
      notify(
        "Confirmation required",
        "Remove personal information and confirm before sending."
      );
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

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : `Analysis failed (HTTP ${response.status}).`;

        throw new Error(message);
      }

      if (
        !isRecord(data) ||
        typeof data.analysis !== "string" ||
        !data.analysis.trim()
      ) {
        throw new Error("The backend returned no usable analysis.");
      }

      setAnalysis(data.analysis);
    } catch (error) {
      notify(
        "Analysis failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function field(
    label: string,
    value: string,
    change: (value: string) => void,
    placeholder = "",
    numeric = true
  ) {
    return (
      <View style={styles.field} key={label}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={change}
          placeholder={placeholder}
          placeholderTextColor="#8b96a7"
          keyboardType={numeric ? "decimal-pad" : "default"}
          autoCapitalize={numeric ? "none" : "sentences"}
          autoCorrect={!numeric}
          editable={!busy}
        />
      </View>
    );
  }

  const navItems: { key: Screen; label: string }[] = [
    { key: "dashboard", label: "Home" },
    { key: "debts", label: "Debts" },
    { key: "accounts", label: "Accounts" },
    { key: "checkbook", label: "Checkbook" },
    { key: "agreement", label: "Loan Help" },
  ];

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <Text style={styles.brand}>AUTOMATIC DEBT PAYOFF</Text>
        <Text style={styles.help}>Loading your saved information...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR MONEY, YOUR PLAN</Text>
          <Text style={styles.title}>Automatic Debt Payoff</Text>
          <Text style={styles.subtitle}>
            Track your money. Plan your payoff. Move forward.
          </Text>
        </View>

        <View style={styles.nav}>
          {navItems.map((item) => (
            <Pressable
              key={item.key}
              style={[
                styles.navItem,
                screen === item.key && styles.navItemActive,
              ]}
              onPress={() => setScreen(item.key)}
            >
              <Text
                style={[
                  styles.navText,
                  screen === item.key && styles.navTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {!!warning && (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Data warning</Text>
            <Text style={styles.help}>{warning}</Text>
            <Text style={styles.help}>
              Saving is paused for validated financial records until you
              investigate this warning. Do not uninstall the app or clear its
              storage before checking your backup.
            </Text>
          </View>
        )}

        {screen === "dashboard" && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>TOTAL RECORDED CASH</Text>
              <Text style={styles.heroAmount}>{money(totalCash)}</Text>
              <Text style={styles.heroNote}>
                Calculated from the opening balances and transactions you
                recorded.
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Tracked debt</Text>
                <Text style={styles.statValue}>{money(totals.balance)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Minimum payments</Text>
                <Text style={styles.statValue}>
                  {money(totals.minimumPayments)}
                </Text>
                <Text style={styles.help}>Per month</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Cash minus debt</Text>
                <Text style={styles.statValue}>
                  {money(totalCash - totals.balance)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Accounts</Text>
                <Text style={styles.statValue}>{accounts.length}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Quick actions</Text>
              <Pressable
                style={styles.button}
                onPress={() => setScreen("debts")}
              >
                <Text style={styles.buttonText}>View payoff plan</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() => setScreen("accounts")}
              >
                <Text style={styles.secondaryText}>+ Add an account</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() => setScreen("checkbook")}
              >
                <Text style={styles.secondaryText}>+ Record a transaction</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Accounts at a glance</Text>
              {accounts.length === 0 ? (
                <Text style={styles.help}>
                  No accounts yet. Add checking, savings, or cash to get
                  started.
                </Text>
              ) : (
                accounts.map((account) => (
                  <View style={styles.listRow} key={account.id}>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>{account.name}</Text>
                      <Text style={styles.help}>{account.type}</Text>
                    </View>
                    <Text style={styles.statValue}>
                      {money(accountBalance(account.id))}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Your payoff strategy</Text>
              <Text style={styles.metric}>
                {strategy === "avalanche" ? "Debt avalanche" : "Debt snowball"}
              </Text>
              <Text style={styles.help}>
                {result.months === null
                  ? "Add your debts to estimate your payoff timeline."
                  : `Estimated payoff: ${result.months} months`}
              </Text>
              <Text style={styles.help}>
                Estimates depend on the balances, APRs, and minimum payments
                you enter. They are not a guarantee.
              </Text>
            </View>
          </>
        )}

        {screen === "accounts" && (
          <>
            <View style={styles.card}>
              <Text style={styles.heading}>Add an account</Text>
              {field(
                "Account nickname",
                accountName,
                setAccountName,
                "Everyday checking",
                false
              )}

              <Text style={styles.label}>Account type</Text>
              <View style={styles.row}>
                {(["Checking", "Savings", "Cash"] as AccountType[]).map(
                  (type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.tab,
                        accountType === type && styles.tabActive,
                      ]}
                      onPress={() => setAccountType(type)}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          accountType === type && styles.tabTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              {field(
                "Opening balance ($)",
                openingBalance,
                setOpeningBalance,
                "500.00"
              )}

              <Pressable style={styles.button} onPress={addAccount}>
                <Text style={styles.buttonText}>Save account</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Your accounts</Text>
              {accounts.length === 0 ? (
                <Text style={styles.help}>No accounts have been added.</Text>
              ) : (
                accounts.map((account) => (
                  <View style={styles.listRow} key={account.id}>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>{account.name}</Text>
                      <Text style={styles.help}>{account.type}</Text>
                    </View>
                    <Text style={styles.statValue}>
                      {money(accountBalance(account.id))}
                    </Text>
                  </View>
                ))
              )}
              <Text style={styles.help}>
                Account balances are estimates based on your entries. They are
                not live bank balances.
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
                  <Pressable
                    style={styles.button}
                    onPress={() => setScreen("accounts")}
                  >
                    <Text style={styles.buttonText}>Add account first</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Select account</Text>
                  {accounts.map((account) => (
                    <Pressable
                      key={account.id}
                      style={[
                        styles.choice,
                        transactionAccount === account.id &&
                          styles.choiceActive,
                      ]}
                      onPress={() => setTransactionAccount(account.id)}
                    >
                      <View style={styles.flex}>
                        <Text style={styles.itemTitle}>{account.name}</Text>
                        <Text style={styles.help}>{account.type}</Text>
                      </View>
                      <Text style={styles.statValue}>
                        {money(accountBalance(account.id))}
                      </Text>
                    </Pressable>
                  ))}

                  <Text style={[styles.label, styles.spacedLabel]}>
                    Transaction type
                  </Text>
                  <View style={styles.row}>
                    {(
                      ["Deposit", "Expense", "Payment"] as TransactionType[]
                    ).map((type) => (
                      <Pressable
                        key={type}
                        style={[
                          styles.tab,
                          transactionType === type && styles.tabActive,
                        ]}
                        onPress={() => setTransactionType(type)}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            transactionType === type && styles.tabTextActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {field(
                    "Amount ($)",
                    transactionAmount,
                    setTransactionAmount,
                    "45.00"
                  )}
                  {field(
                    "Description",
                    transactionDescription,
                    setTransactionDescription,
                    "Groceries, paycheck, or bill",
                    false
                  )}

                  <Text style={styles.help}>
                    Deposits increase your recorded balance. Expenses and
                    payments decrease it. Recording a payment does not
                    automatically change the debt planner balance.
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
                <Text style={styles.help}>No transactions recorded yet.</Text>
              ) : (
                transactions.map((transaction) => {
                  const account = accounts.find(
                    (item) => item.id === transaction.accountId
                  );

                  return (
                    <View style={styles.listRow} key={transaction.id}>
                      <View style={styles.flex}>
                        <Text style={styles.itemTitle}>
                          {transaction.description}
                        </Text>
                        <Text style={styles.help}>
                          {account?.name ?? "Account"} · {transaction.type}
                        </Text>
                        <Text style={styles.help}>
                          {new Date(transaction.date).toLocaleDateString()}
                        </Text>
                        <Pressable
                          onPress={() => deleteTransaction(transaction.id)}
                          style={styles.deleteAction}
                        >
                          <Text style={styles.deleteText}>Delete transaction</Text>
                        </Pressable>
                      </View>
                      <Text
                        style={[
                          styles.statValue,
                          transaction.type === "Deposit"
                            ? styles.positive
                            : styles.negative,
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
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>TOTAL TRACKED DEBT</Text>
              <Text style={styles.heroAmount}>{money(totals.balance)}</Text>
              <Text style={styles.heroNote}>
                Minimum payments: {money(totals.minimumPayments)} per month
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Repayment strategy</Text>
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.tab,
                    strategy === "avalanche" && styles.tabActive,
                  ]}
                  onPress={() => setStrategy("avalanche")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      strategy === "avalanche" && styles.tabTextActive,
                    ]}
                  >
                    Avalanche
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tab,
                    strategy === "snowball" && styles.tabActive,
                  ]}
                  onPress={() => setStrategy("snowball")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      strategy === "snowball" && styles.tabTextActive,
                    ]}
                  >
                    Snowball
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.help}>
                Avalanche prioritizes the highest APR. Snowball prioritizes the
                smallest balance. Both approaches assume you keep making
                required minimum payments.
              </Text>

              {field(
                "Extra monthly payment ($)",
                extra,
                setExtra,
                "0.00"
              )}

              {extra.trim() !== "" &&
                (!Number.isFinite(Number(extra)) || Number(extra) < 0) && (
                  <Text style={styles.errorText}>
                    Enter zero or a positive extra payment.
                  </Text>
                )}

              <View style={styles.resultPanel}>
                <Text style={styles.statLabel}>Estimated monthly budget</Text>
                <Text style={styles.resultNumber}>
                  {money(result.monthlyBudget)}
                </Text>

                <Text style={styles.statLabel}>Estimated payoff</Text>
                <Text style={styles.resultNumber}>
                  {result.months === null
                    ? "Unable to estimate"
                    : `${result.months} months`}
                </Text>

                <Text style={styles.statLabel}>Estimated total interest</Text>
                <Text style={styles.resultNumber}>
                  {money(result.totalInterest)}
                </Text>
              </View>

              <Text style={styles.help}>{result.message}</Text>
              <Text style={styles.help}>
                These are estimates, not lender quotes. Actual interest and
                payoff dates can differ.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Add a debt</Text>
              {field("Debt name", name, setName, "Auto loan", false)}
              {field("Current balance ($)", balance, setBalance, "12000.00")}
              {field("APR (%)", apr, setApr, "7.5")}
              {field(
                "Minimum monthly payment ($)",
                minimum,
                setMinimum,
                "350.00"
              )}

              <Pressable style={styles.button} onPress={addDebt}>
                <Text style={styles.buttonText}>Add debt</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Your debts</Text>
              {debts.length === 0 ? (
                <Text style={styles.help}>
                  No debts yet. Add a debt to see your estimated payoff plan.
                </Text>
              ) : (
                debts.map((debt) => (
                  <View style={styles.listRow} key={debt.id}>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>{debt.name}</Text>
                      <Text style={styles.debtBalance}>
                        {money(debt.balance)}
                      </Text>
                      <Text style={styles.help}>
                        APR: {debt.apr}% · Minimum:{" "}
                        {money(debt.minimumPayment)}/mo
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeDebt(debt.id)}
                      style={styles.deleteAction}
                    >
                      <Text style={styles.deleteText}>Remove</Text>
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
              Review wording about extra payments, principal-only payments,
              interest, fees, and early payoff.
            </Text>

            <View style={styles.warning}>
              <Text style={styles.warningTitle}>Protect your information</Text>
              <Text style={styles.help}>
                Remove account numbers, Social Security numbers, addresses,
                signatures, and other sensitive information before sending.
                Agreement text will be transmitted to your configured backend.
              </Text>
            </View>

            {field(
              "Backend HTTPS URL",
              apiUrl,
              setApiUrl,
              "https://your-service.onrender.com",
              false
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Loan agreement text</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={agreement}
                onChangeText={setAgreement}
                multiline
                textAlignVertical="top"
                placeholder="Paste agreement wording here..."
                placeholderTextColor="#8b96a7"
                editable={!busy}
              />
            </View>

            <Pressable
              style={[styles.secondary, consent && styles.consentActive]}
              onPress={() => setConsent((current) => !current)}
              disabled={busy}
            >
              <Text style={styles.secondaryText}>
                {consent
                  ? "✓ Confirmed: send text for analysis"
                  : "Confirm sending text for analysis"}
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
                <Text selectable style={styles.analysisText}>
                  {analysis}
                </Text>
                <Text style={styles.help}>
                  Educational information only, not legal advice. Confirm
                  payment procedures and loan terms with your lender.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.heading}>Your data and backups</Text>
          <Text style={styles.help}>
            Your financial records are stored locally on this device. Export
            a backup using the web version before uninstalling or replacing
            the app. This version does not automatically sync to a bank or
            another device.
          </Text>
          <Pressable style={styles.secondary} onPress={exportBackup}>
            <Text style={styles.secondaryText}>Export JSON backup (web)</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Estimates are not guarantees. This app does not move money or connect
          to your bank. Verify balances, APRs, and lender terms independently.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  scroll: {
    flex: 1,
  },
  container: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 48,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f1f5f9",
  },
  header: {
    marginTop: 12,
    marginBottom: 16,
  },
  brand: {
    fontWeight: "900",
    color: "#137653",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  eyebrow: {
    color: "#137653",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 11,
  },
  title: {
    fontSize: 29,
    fontWeight: "900",
    color: "#152238",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    color: "#59677a",
    lineHeight: 22,
  },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 16,
  },
  navItem: {
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  navItemActive: {
    backgroundColor: "#c9ead9",
    borderColor: "#137653",
  },
  navText: {
    fontWeight: "800",
    color: "#334155",
    fontSize: 12,
  },
  navTextActive: {
    color: "#105e42",
  },
  hero: {
    backgroundColor: "#123c32",
    padding: 22,
    borderRadius: 18,
    marginBottom: 16,
  },
  heroLabel: {
    color: "#c5f2dc",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  heroAmount: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },
  heroNote: {
    color: "#d9e9e3",
    marginTop: 8,
    lineHeight: 21,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
  },
  statLabel: {
    color: "#536174",
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    fontWeight: "900",
    color: "#172033",
    textAlign: "right",
    fontSize: 15,
    flexShrink: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 17,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heading: {
    fontSize: 19,
    fontWeight: "900",
    color: "#152238",
    marginBottom: 12,
  },
  label: {
    fontWeight: "800",
    marginBottom: 6,
    color: "#344054",
  },
  field: {
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#ffffff",
    color: "#172033",
    fontSize: 16,
  },
  multiline: {
    minHeight: 180,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 10,
  },
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
  tabActive: {
    backgroundColor: "#c9ead9",
    borderColor: "#137653",
  },
  tabText: {
    fontWeight: "800",
    color: "#334155",
  },
  tabTextActive: {
    color: "#105e42",
  },
  button: {
    backgroundColor: "#137653",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },
  secondary: {
    backgroundColor: "#e6f3ec",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: {
    color: "#126344",
    fontWeight: "900",
    textAlign: "center",
  },
  help: {
    color: "#687386",
    lineHeight: 20,
    marginTop: 7,
    fontSize: 13,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e7ebf1",
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontWeight: "800",
    color: "#172033",
    fontSize: 15,
  },
  debtBalance: {
    color: "#152238",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 5,
  },
  choice: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    marginTop: 7,
    borderWidth: 1,
    borderColor: "#d6dce5",
    borderRadius: 10,
    gap: 12,
  },
  choiceActive: {
    backgroundColor: "#e6f3ec",
    borderColor: "#137653",
  },
  spacedLabel: {
    marginTop: 14,
  },
  metric: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 8,
    color: "#152238",
  },
  resultPanel: {
    backgroundColor: "#f1f7f3",
    padding: 15,
    borderRadius: 12,
    marginTop: 14,
    gap: 6,
  },
  resultNumber: {
    color: "#105e42",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 10,
  },
  positive: {
    color: "#137653",
  },
  negative: {
    color: "#9b3434",
  },
  deleteAction: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  deleteText: {
    color: "#a12b2b",
    fontWeight: "800",
    fontSize: 12,
  },
  warning: {
    backgroundColor: "#fff4df",
    borderColor: "#efd49b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningTitle: {
    color: "#80551b",
    fontWeight: "900",
    fontSize: 15,
  },
  errorText: {
    color: "#a12b2b",
    marginTop: 5,
    fontSize: 13,
    fontWeight: "700",
  },
  consentActive: {
    backgroundColor: "#c9ead9",
  },
  analysis: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f3f8f5",
  },
  analysisText: {
    color: "#243044",
    lineHeight: 22,
  },
  disabled: {
    opacity: 0.5,
  },
  footer: {
    color: "#687386",
    textAlign: "center",
    lineHeight: 20,
    marginVertical: 18,
    fontSize: 12,
  },
});
