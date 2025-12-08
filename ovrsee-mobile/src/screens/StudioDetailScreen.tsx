import React from "react";
import { View, Text, ScrollView, StyleSheet, Image } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Card } from "@/components/Card";
import { StatusChip } from "@/components/StatusChip";
import { colors, theme } from "@/theme";
import { RootStackParamList } from "@/navigation/types";

type RouteProps = RouteProp<RootStackParamList, "StudioDetail">;

export default function StudioDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  // In production, fetch actual data based on id
  const item = {
    id,
    title: "Holiday Campaign Concept",
    status: "published" as const,
    description: "Q4 holiday marketing visuals and copy for social media channels",
    createdAt: "2024-01-10T08:00:00Z",
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.title}</Text>
          <StatusChip status={item.status} />
        </View>
        <Text style={styles.date}>Created {formatDate(item.createdAt)}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{item.description}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Preview</Text>
        <View style={styles.previewContainer}>
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewText}>Content preview</Text>
          </View>
        </View>
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
  card: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    marginRight: theme.spacing.sm,
  },
  date: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  previewContainer: {
    marginTop: theme.spacing.sm,
  },
  previewPlaceholder: {
    height: 200,
    backgroundColor: colors.background.surface,
    borderRadius: theme.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  previewText: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});



