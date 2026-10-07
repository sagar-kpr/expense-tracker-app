import MoneyText from "@/components/MoneyText";
import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { formatMoney } from "@/utils/money";

type Props = {
  title: string;
  label: string;
  percent: string;
  summary: string;
  rows: { label: string; amount: number; color: string }[];
  comparison: string;
  comparisonUp: boolean;
  comparisonFavorable?: boolean;
  comparisonNeutral?: boolean;
  children: ReactNode;
};

export default function FinancialOverview({
  title,
  label,
  percent,
  summary,
  rows,
  comparison,
  comparisonUp,
  comparisonFavorable = comparisonUp,
  comparisonNeutral = false,
  children,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 350;
  const stackedRows =
    fontScale > 1.3 || rows.some((row) => formatMoney(row.amount).length > 16);
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="pie-chart-outline" size={22} color="#DDD3F4" />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.hero, stacked && styles.stackedHero]}>
        <View style={styles.usage}>
          <Text style={styles.label}>{label}</Text>
          <Text
            style={styles.percent}
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.85}
          >
            {percent}
          </Text>
        </View>
        {children}
      </View>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.ledger}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={[styles.row, stackedRows && styles.stackedRow]}
          >
            <View style={styles.rowLabel}>
              <View style={[styles.dot, { backgroundColor: row.color }]} />
              <Text style={styles.rowText}>{row.label}</Text>
            </View>
            <MoneyText
              value={row.amount}
              style={[
                styles.amount,
                { width: "60%" },
                stackedRows && [styles.stackedAmount, { width: "100%" }],
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.comparison}>
        <Ionicons
          name={
            comparisonNeutral
              ? "remove"
              : comparisonUp
                ? "arrow-up"
                : "arrow-down"
          }
          size={20}
          color={
            comparisonNeutral
              ? "#DDD3F4"
              : comparisonFavorable
                ? "#34D399"
                : "#FF7474"
          }
        />
        <Text style={styles.comparisonText}>{comparison}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#371872", borderRadius: 24, padding: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#DDD3F4", fontSize: 16, fontWeight: "700", flex: 1 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 18,
  },
  stackedHero: { flexDirection: "column", alignItems: "stretch" },
  usage: { flex: 1, minWidth: 0 },
  label: { color: "#DDD3F4", fontSize: 14, fontWeight: "600" },
  percent: {
    color: "white",
    fontSize: 38,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  summary: {
    color: "#DDD3F4",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 16,
    fontVariant: ["tabular-nums"],
  },
  ledger: {
    borderTopWidth: 1,
    borderTopColor: "#654393",
    paddingTop: 8,
    marginTop: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  stackedRow: { flexDirection: "column", alignItems: "stretch", gap: 6 },
  rowLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rowText: { color: "#F2ECFF", fontSize: 13, flex: 1 },
  amount: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    flexShrink: 1,
    maxWidth: "60%",
  },
  stackedAmount: { maxWidth: "100%", textAlign: "left", paddingLeft: 18 },
  comparison: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: "#24104F",
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
    maxWidth: "100%",
  },
  comparisonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
});
