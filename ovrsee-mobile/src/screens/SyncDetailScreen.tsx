import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Card } from "@/components/Card";
import { colors, theme } from "@/theme";
import { RootStackParamList } from "@/navigation/types";

type RouteProps = RouteProp<RootStackParamList, "SyncDetail">;

export default function SyncDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  // In production, fetch actual data based on id
  const item = {
    id,
    title: "Team Standup",
    time: "10:00 AM",
    description: "Daily sync with engineering team",
    type: "meeting",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{item.time}</Text>
        <Text style={styles.type}>{item.type}</Text>
        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  content: {
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  time: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  type: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.tertiary,
    textTransform: "capitalize",
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
});



