import { Modal, Pressable, Text, View } from "react-native";

import { useMemo } from "react";

import { useTheme } from "@/context/ThemeContext";

type Props = {
  onClose: () => void;
  onConfirm: (day: number) => void;
  selectedDay: number;
  title?: string;
  visible: boolean;
};

const DAY_OPTIONS = Array.from({ length: 31 }, (_value, index) => index + 1);

const formatOrdinal = (day: number) => {
  const tens = day % 100;

  if (tens >= 11 && tens <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

export default function SalaryDayPickerModal({
  onClose,
  onConfirm,
  selectedDay,
  title = "Pick Salary Day",
  visible,
}: Props) {
  const { theme } = useTheme();

  const selectedLabel = useMemo(
    () => formatOrdinal(Math.max(1, Math.min(31, selectedDay || 1))),
    [selectedDay],
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.44)",
          flex: 1,
          justifyContent: "center",
          padding: 20,
        }}
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
            This is the expected recurring day of the month, not a one-time calendar date.
          </Text>

          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.background,
              borderColor: theme.border,
              borderRadius: 18,
              borderWidth: 1,
              marginTop: 18,
              minHeight: 56,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: theme.primary,
                fontSize: 22,
                fontWeight: "900",
              }}
            >
              {selectedLabel}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 18,
            }}
          >
            {DAY_OPTIONS.map((day) => {
              const active = day === selectedDay;

              return (
                <Pressable
                  key={day}
                  onPress={() => onConfirm(day)}
                  style={{
                    alignItems: "center",
                    backgroundColor: active ? theme.primary : theme.background,
                    borderColor: active ? theme.primary : theme.border,
                    borderRadius: 14,
                    borderWidth: 1,
                    height: 42,
                    justifyContent: "center",
                    width: "14.28%",
                    minWidth: 42,
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#FFFFFF" : theme.text,
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={{
              alignItems: "center",
              backgroundColor: theme.border,
              borderRadius: 16,
              justifyContent: "center",
              marginTop: 20,
              minHeight: 48,
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 14,
                fontWeight: "800",
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
