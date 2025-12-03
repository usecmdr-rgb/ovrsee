import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Card } from "@/components/Card";
import { StatusChip } from "@/components/StatusChip";
import { colors, theme } from "@/theme";
import { getTodayAgenda } from "@/api/agents/sync";
import { mockAgendaItems } from "@/data/mockData";
import { Ionicons } from "@expo/vector-icons";
import { AgendaItem } from "@/types";

export default function CalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [agenda, setAgenda] = useState<AgendaItem[]>(mockAgendaItems);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // In production, use actual API call
    // const res = await getTodayAgenda();
    setTimeout(() => setLoading(false), 500);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "meeting":
        return "people-outline";
      case "event":
        return "calendar-outline";
      case "task":
        return "checkbox-outline";
      default:
        return "ellipse-outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "meeting":
        return colors.brand.accent;
      case "event":
        return colors.agent.studio;
      case "task":
        return colors.agent.aloha;
      default:
        return colors.text.tertiary;
    }
  };

  // Group agenda items by time
  const groupedAgenda = agenda.reduce((acc, item) => {
    const time = item.time;
    if (!acc[time]) {
      acc[time] = [];
    }
    acc[time].push(item);
    return acc;
  }, {} as Record<string, AgendaItem[]>);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <Text style={styles.headerDate}>{formatDate(selectedDate)}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {Object.keys(groupedAgenda).length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No events scheduled for today</Text>
          </Card>
        ) : (
          Object.entries(groupedAgenda)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([time, items]) => (
              <View key={time} style={styles.timeGroup}>
                <View style={styles.timeHeader}>
                  <View style={styles.timeIndicator}>
                    <View style={styles.timeDot} />
                    <Text style={styles.timeText}>{formatTime(time)}</Text>
                  </View>
                </View>
                {items.map((item) => (
                  <Card key={item.id} style={styles.agendaCard}>
                    <View style={styles.agendaCardHeader}>
                      <View style={styles.agendaCardLeft}>
                        <Ionicons
                          name={getTypeIcon(item.type)}
                          size={24}
                          color={getTypeColor(item.type)}
                        />
                        <View style={styles.agendaCardContent}>
                          <Text style={styles.agendaTitle}>{item.title}</Text>
                          {item.description && (
                            <Text style={styles.agendaDescription}>{item.description}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.typeBadge}>
                        <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                          {item.type}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  headerDate: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  timeGroup: {
    marginBottom: theme.spacing.lg,
  },
  timeHeader: {
    marginBottom: theme.spacing.sm,
  },
  timeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  timeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.accent,
  },
  timeText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: "600",
    color: colors.brand.accent,
  },
  agendaCard: {
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.md,
    backgroundColor: colors.background.surface,
  },
  agendaCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  agendaCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    flex: 1,
  },
  agendaCardContent: {
    flex: 1,
  },
  agendaTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  agendaDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  typeBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: colors.background.card,
  },
  typeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyCard: {
    padding: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
});



