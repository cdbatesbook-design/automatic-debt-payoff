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

const STORAGE_KEY = "debt-payoff-data-v1";
const URL_KEY = "debt-payoff-backend-url-v1";

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

export default function App() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [warning, setWarning] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimum, setMinimum] = useState("");
  const [extra, setExtra] = useState("0");
  const [strategy, setStrategy] =
    useState<Strategy>("avalanche");
  const [section, setSection] =
    useState<"debts" | "agreement">("debts");
  const [apiUrl, setApiUrl] = useState("");
  const [agreement, setAgreement] = useState("");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved =
          await AsyncStorage.getItem(STORAGE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved);

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
            setWarning(
              "Saved data could not be validated. Check your backup before continuing."
            );
          } else {
            setDebts(parsed);
          }
        }

        const savedUrl =
          await AsyncStorage.getItem(URL_KEY);

        if (savedUrl) {
          setApiUrl(savedUrl);
        }
      } catch {
        setWarning(
          "Saved data could not be read. Check your backup."
        );
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || warning) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(debts)
    ).catch(() => {
      setWarning(
        "The latest changes could not be saved."
      );
    });
  }, [debts, loaded, warning]);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(
        URL_KEY,
        apiUrl.trim()
      ).catch(() => {});
    }
  }, [apiUrl, loaded]);

  const totals = calculateDebtTotals(debts);

  const result = simulatePayoff(
    debts,
    strategy,
    Number(extra)
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
      notify(
        "Check your entries",
        "Enter a name, positive balance, non-negative APR, and positive minimum payment."
      );
      return;
    }

    setDebts((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
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
  }

  function exportBackup() {
    const data = JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        debts,
        extraPayment: Number(extra),
        strategy,
      },
      null,
      2
    );

    if (Platform.OS !== "web") {
      notify(
        "Backup",
        "Use the web version to download a JSON backup."
      );
      return;
    }

    const blob = new Blob([data], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "debt-payoff-backup.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  function removeDebt(id: string) {
    const selected = debts.find(
      (d) => d.id === id
    );

    if (!selected) return;

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Remove "${selected.name}" from your planner?`
        )
      ) {
        setDebts((current) =>
          current.filter((d) => d.id !== id)
        );
      }

      return;
    }

    Alert.alert(
      "Remove debt",
      `Remove "${selected.name}" from your planner?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            setDebts((current) =>
              current.filter((d) => d.id !== id)
            ),
        },
      ]
    );
  }

  async function analyzeAgreement() {
    const base = apiUrl.trim().replace(/\/+$/, "");

    if (!base.startsWith("https://")) {
      notify(
        "Backend URL required",
        "Enter your deployed HTTPS backend URL."
      );
      return;
    }

    if (agreement.trim().length < 100) {
      notify(
        "Agreement text needed",
        "Paste at least 100 characters."
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
      const response = await fetch(
        `${base}/api/analyze-agreement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agreement: agreement.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Analysis request failed."
        );
      }

      setAnalysis(
        data.analysis ||
          "No analysis was returned."
      );
    } catch (error) {
      notify(
        "Analysis failed",
        error instanceof Error
          ? error.message
          : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const input = (
    label: string,
    value: string,
    change: (value: string) => void,
    placeholder = ""
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={change}
        placeholder={placeholder}
        keyboardType="decimal-pad"
      />
    </View>
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.eyebrow}>
        YOUR MONEY, YOUR PLAN
      </Text>

      <Text style={styles.title}>
        Debt Payoff Planner
      </Text>

      <Text style={styles.subtitle}>
        Plan your payoff and understand your loan terms.
      </Text>

      <View style={styles.warning}>
        <Text style={styles.warningTitle}>
          Important payment warning
        </Text>

        <Text>
          Extra payments are not guaranteed to reduce
          principal as expected. Confirm your lender's
          payment-allocation procedure.
        </Text>
      </View>

      <View style={styles.row}>
        <Pressable
          style={[
            styles.tab,
            section === "debts" && styles.active,
          ]}
          onPress={() => setSection("debts")}
        >
          <Text>Debt Planner</Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,
            section === "agreement" && styles.active,
          ]}
          onPress={() => setSection("agreement")}
        >
          <Text>Understand My Loan</Text>
        </Pressable>
      </View>

      {section === "debts" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.heading}>
              Debt overview
            </Text>

            <Text>
              Total balance: {money(totals.balance)}
            </Text>

            <Text>
              Minimum payments:{" "}
              {money(totals.minimumPayments)}/month
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>
              Repayment strategy
            </Text>

            <View style={styles.row}>
              <Pressable
                style={[
                  styles.tab,
                  strategy === "avalanche" &&
                    styles.active,
                ]}
                onPress={() =>
                  setStrategy("avalanche")
                }
              >
                <Text>Avalanche</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.tab,
                  strategy === "snowball" &&
                    styles.active,
                ]}
                onPress={() =>
                  setStrategy("snowball")
                }
              >
                <Text>Snowball</Text>
              </Pressable>
            </View>

            <Text style={styles.help}>
              Avalanche targets the highest APR first.
              Snowball targets the smallest balance first.
            </Text>

            {input(
              "Extra monthly payment ($)",
              extra,
              setExtra,
              "0"
            )}

            <Text style={styles.metric}>
              Monthly budget:{" "}
              {money(result.monthlyBudget)}
            </Text>

            <Text style={styles.metric}>
              {result.months === null
                ? "Unable to estimate payoff"
                : `Estimated payoff: ${result.months} months`}
            </Text>

            <Text>
              Estimated interest:{" "}
              {money(result.totalInterest)}
            </Text>

            <Text style={styles.help}>
              {result.message}
            </Text>

            <Text style={styles.help}>
              This is a monthly-interest estimate. Actual
              lender calculations and payment-posting dates
              may differ.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>
              Add a debt
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>
                Debt name
              </Text>

              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Auto loan"
              />
            </View>

            {input(
              "Balance ($)",
              balance,
              setBalance,
              "12000"
            )}

            {input(
              "APR (%)",
              apr,
              setApr,
              "7.5"
            )}

            {input(
              "Minimum monthly payment ($)",
              minimum,
              setMinimum,
              "350"
            )}

            <Pressable
              style={styles.button}
              onPress={addDebt}
            >
              <Text style={styles.buttonText}>
                Add debt
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>
              Your debts
            </Text>

            {debts.length === 0 ? (
              <Text>No debts added yet.</Text>
            ) : (
              debts.map((debt) => (
                <View
                  key={debt.id}
                  style={styles.debtRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.debtName}>
                      {debt.name}
                    </Text>

                    <Text>
                      {money(debt.balance)} ·{" "}
                      {debt.apr}% APR
                    </Text>

                    <Text>
                      Minimum:{" "}
                      {money(debt.minimumPayment)}/month
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      removeDebt(debt.id)
                    }
                  >
                    <Text style={styles.link}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))
            )}

            <Pressable
              style={styles.secondary}
              onPress={exportBackup}
            >
              <Text style={styles.secondaryText}>
                Export JSON backup
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.heading}>
            Understand My Loan Agreement
          </Text>

          <Text style={styles.help}>
            Examine extra-payment allocation,
            principal-only payments, interest, fees,
            and early payoff wording.
          </Text>

          <View style={styles.warning}>
            <Text>
              Remove account numbers, Social Security
              numbers, addresses, signatures, and other
              sensitive information. Your text will be
              sent to your configured backend and AI
              provider for analysis.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Backend HTTPS URL
            </Text>

            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://your-service.onrender.com"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Loan agreement text
            </Text>

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
            onPress={() =>
              setConsent((value) => !value)
            }
          >
            <Text style={styles.secondaryText}>
              {consent
                ? "✓ Confirmed: send text for analysis"
                : "Tap to confirm sending text for analysis"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              busy && styles.disabled,
            ]}
            onPress={analyzeAgreement}
            disabled={busy}
          >
            <Text style={styles.buttonText}>
              {busy
                ? "Analyzing..."
                : "Analyze agreement"}
            </Text>
          </Pressable>

          {!!analysis && (
            <View style={styles.analysis}>
              <Text style={styles.heading}>
                Analysis results
              </Text>

              <Text selectable>{analysis}</Text>

              <Text style={styles.help}>
                Educational information only, not legal
                advice. Confirm payment procedures with
                your lender.
              </Text>
            </View>
          )}
        </View>
      )}

      {!!warning && (
        <View style={styles.warning}>
          <Text>{warning}</Text>
        </View>
      )}

      <Text style={styles.footer}>
        Estimates are not guarantees. Actual loan terms
        and lender payment-posting rules control.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f3f5f8",
  },
  container: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 50,
  },
  eyebrow: {
    color: "#176b4d",
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#172033",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    marginVertical: 14,
    color: "#586174",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e4e8ef",
  },
  heading: {
    fontSize: 20,
    fontWeight: "800",
    color: "#172033",
    marginBottom: 12,
  },
  metric: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 8,
  },
  label: {
    fontWeight: "700",
    marginBottom: 6,
    color: "#344054",
  },
  field: {
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d6dce5",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    color: "#172033",
    fontSize: 16,
  },
  multiline: {
    minHeight: 200,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e7ebf1",
    alignItems: "center",
    justifyContent: "center",
  },
  active: {
    backgroundColor: "#cce8d8",
  },
  button: {
    backgroundColor: "#176b4d",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  secondary: {
    backgroundColor: "#e8f2ed",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryText: {
    color: "#176b4d",
    fontWeight: "700",
  },
  warning: {
    backgroundColor: "#fff4df",
    borderColor: "#f0d59b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningTitle: {
    fontWeight: "800",
    marginBottom: 5,
    color: "#7b4b00",
  },
  help: {
    color: "#687386",
    lineHeight: 21,
    marginTop: 8,
    fontSize: 13,
  },
  debtRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e7ebf1",
    paddingVertical: 12,
    gap: 12,
  },
  debtName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#172033",
  },
  link: {
    color: "#176b4d",
    fontWeight: "700",
  },
  analysis: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f3f8f5",
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
