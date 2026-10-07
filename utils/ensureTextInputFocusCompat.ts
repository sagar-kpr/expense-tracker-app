import { TextInput } from "react-native";

type TextInputStateCompat = {
  currentlyFocusedField?: () => unknown;
  currentlyFocusedInput?: () => unknown;
};

const textInputState = (TextInput as unknown as {
  State?: TextInputStateCompat;
}).State;

if (
  textInputState &&
  typeof textInputState.currentlyFocusedInput !== "function"
) {
  textInputState.currentlyFocusedInput = () => {
    if (typeof textInputState.currentlyFocusedField === "function") {
      return textInputState.currentlyFocusedField();
    }

    return null;
  };
}
