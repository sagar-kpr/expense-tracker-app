import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";

type Props = {
  initialDate?: Date;
  maximumDate?: Date;
  minimumDate?: Date;
  onClose: () => void;
  onConfirm: (arrivedAtMs: number) => Promise<void>;
  saving?: boolean;
  title?: string;
  visible: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseArrivalDateTime = (dateValue: string, timeValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function SalaryArrivalModal({
  initialDate,
  maximumDate,
  minimumDate,
  onClose,
  onConfirm,
  saving = false,
  title = "Confirm Salary Arrival",
  visible,
}: Props) {
  const { theme } = useTheme();
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [error, setError] = useState("");
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const now = initialDate || new Date();
    setDateValue(toDateInput(now));
    setTimeValue(toTimeInput(now));
    setError("");
  }, [initialDate, visible]);

  const helperText = useMemo(
    () =>
      minimumDate && maximumDate
        ? `Pick the actual arrival date within the salary window: ${minimumDate.toLocaleDateString("en-IN")} to ${maximumDate.toLocaleDateString("en-IN")}.`
        : "Use the real date and time when salary actually arrived.",
    [maximumDate, minimumDate],
  );
  const parsedPreview = parseArrivalDateTime(dateValue, timeValue);
  const pickerValue = parsedPreview || new Date();

  const clampDate = (value: Date) => {
    if (minimumDate && value < minimumDate) {
      return new Date(minimumDate);
    }

    if (maximumDate && value > maximumDate) {
      return new Date(maximumDate);
    }

    return value;
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.42)",
          flex: 1,
          justifyContent: "center",
          padding: 20,
        }}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            width: "100%",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 24,
              borderWidth: 1,
              padding: 22,
              width: "100%",
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 21,
                fontWeight: "900",
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: theme.subText,
                fontSize: 14,
                lineHeight: 22,
                marginTop: 8,
              }}
            >
              {helperText}
            </Text>

            <View style={{ marginTop: 18 }}>
              <Text
                style={{
                  color: theme.subText,
                  fontSize: 13,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Arrival Date
              </Text>
              {Platform.OS === "web" ? (
                <View
                  style={{
                    backgroundColor: theme.background,
                    borderColor: error ? theme.danger : theme.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    minHeight: 52,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                  }}
                >
                  {createElement("input", {
                    disabled: saving,
                    onChange: (event: any) => {
                    setDateValue(event.target.value);
                    setError("");
                  },
                    style: {
                      backgroundColor: "transparent",
                      border: "none",
                      color: theme.text,
                      fontSize: "16px",
                      height: "42px",
                      outline: "none",
                      width: "100%",
                    },
                    type: "date",
                    max: maximumDate ? toDateInput(maximumDate) : undefined,
                    min: minimumDate ? toDateInput(minimumDate) : undefined,
                    value: dateValue,
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={saving}
                  onPress={() => setPickerMode("date")}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.background,
                    borderColor: error ? theme.danger : theme.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: 52,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {dateValue}
                  </Text>
                  <Text
                    style={{
                      color: theme.subText,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Calendar
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ marginTop: 14 }}>
              <Text
                style={{
                  color: theme.subText,
                  fontSize: 13,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Arrival Time
              </Text>
              {Platform.OS === "web" ? (
                <View
                  style={{
                    backgroundColor: theme.background,
                    borderColor: error ? theme.danger : theme.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    minHeight: 52,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                  }}
                >
                  {createElement("input", {
                    disabled: saving,
                    onChange: (event: any) => {
                    setTimeValue(event.target.value);
                    setError("");
                  },
                    style: {
                      backgroundColor: "transparent",
                      border: "none",
                      color: theme.text,
                      fontSize: "16px",
                      height: "42px",
                      outline: "none",
                      width: "100%",
                    },
                    type: "time",
                    value: timeValue,
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={saving}
                  onPress={() => setPickerMode("time")}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.background,
                    borderColor: error ? theme.danger : theme.border,
                    borderRadius: 16,
                    borderWidth: 1,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: 52,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {timeValue}
                  </Text>
                  <Text
                    style={{
                      color: theme.subText,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Clock
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text
              style={{
                color: theme.subText,
                fontSize: 12,
                marginTop: 10,
              }}
            >
              {parsedPreview
                ? parsedPreview.toLocaleString("en-IN")
                : "Choose a valid date and time."}
            </Text>

            {!!error && (
              <Text
                style={{
                  color: theme.danger,
                  fontSize: 13,
                  fontWeight: "700",
                  marginTop: 12,
                }}
              >
                {error}
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={saving}
                onPress={onClose}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.border,
                  borderRadius: 16,
                  flex: 1,
                  minHeight: 48,
                  justifyContent: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={saving}
                onPress={async () => {
                  const parsed = parseArrivalDateTime(dateValue, timeValue);

                  if (!parsed) {
                    setError("Enter a valid date and time.");
                    return;
                  }

                  await onConfirm(parsed.getTime());
                }}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.primary,
                  borderRadius: 16,
                  flex: 1,
                  minHeight: 48,
                  justifyContent: "center",
                  opacity: saving ? 0.75 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    Confirm
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {Platform.OS !== "web" && pickerMode && (
          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.18)",
              bottom: 0,
              justifyContent: "flex-end",
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          >
            <View
              style={{
                backgroundColor: theme.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderWidth: 1,
                borderColor: theme.border,
                paddingTop: 12,
                paddingBottom: 28,
                width: "100%",
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 18,
                  paddingBottom: 8,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setPickerMode(null)}
                  style={{
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      color: theme.subText,
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <Text
                  style={{
                    color: theme.text,
                    fontSize: 15,
                    fontWeight: "800",
                  }}
                >
                  {pickerMode === "date" ? "Select Date" : "Select Time"}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setPickerMode(null)}
                  style={{
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      color: theme.primary,
                      fontSize: 15,
                      fontWeight: "800",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                display="spinner"
                maximumDate={pickerMode === "date" ? maximumDate : undefined}
                minimumDate={pickerMode === "date" ? minimumDate : undefined}
                mode={pickerMode}
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  if (event.type === "dismissed") {
                    setPickerMode(null);
                    return;
                  }

                  const next = selectedDate || new Date();

                  if (pickerMode === "date") {
                    setDateValue(toDateInput(clampDate(next)));
                  } else {
                    setTimeValue(toTimeInput(next));
                  }

                  setError("");
                }}
                value={pickerValue}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
