import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Card } from "@/components/Card";
import { StatusChip } from "@/components/StatusChip";
import { colors, theme } from "@/theme";
import { RootStackParamList } from "@/navigation/types";

type RouteProps = RouteProp<RootStackParamList, "CallDetail">;

export default function CallDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;

  // In production, fetch actual data based on id
  const call = {
    id,
    contactName: "Sarah Johnson",
    contactNumber: "+1 (555) 123-4567",
    timestamp: "2024-01-15T09:30:00Z",
    summary: "Scheduled follow-up meeting for next week",
    status: "handled" as const,
    duration: 180,
    transcript: "Aloha: Hello, this is Aloha speaking for John Doe. How may I help you?\n\nSarah: Hi, I'd like to schedule a follow-up meeting.\n\nAloha: I can help with that. Let me check the calendar...",
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.name}>{call.contactName}</Text>
            <Text style={styles.number}>{call.contactNumber}</Text>
          </View>
          <StatusChip status={call.status} />
        </View>
        <Text style={styles.time}>{formatTime(call.timestamp)}</Text>
        {call.duration && (
          <Text style={styles.duration}>
            Duration: {Math.floor(call.duration / 60)}m {call.duration % 60}s
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.summary}>{call.summary}</Text>
      </Card>

      {call.transcript && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <Text style={styles.transcript}>{call.transcript}</Text>
        </Card>
      )}
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
  name: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  number: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
  time: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: theme.spacing.xs,
  },
  duration: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  summary: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  transcript: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    fontFamily: "monospace",
  },
});



