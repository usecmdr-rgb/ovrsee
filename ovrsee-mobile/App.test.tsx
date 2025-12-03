// Simple test component to verify basic rendering
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "./src/theme";

export default function TestApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>OVRSEE Mobile App</Text>
      <Text style={styles.subtext}>If you see this, basic rendering works!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text.primary,
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});


