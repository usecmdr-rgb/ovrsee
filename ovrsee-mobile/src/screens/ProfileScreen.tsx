import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { StatusChip } from "@/components/StatusChip";
import { colors, theme } from "@/theme";
import { getCurrentUser } from "@/api/user";
import { Ionicons } from "@expo/vector-icons";

const mockUser = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
};

const mockIntegrations = {
  gmail: true,
  calendar: true,
  openai: true,
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(mockUser);
  const [integrations, setIntegrations] = useState(mockIntegrations);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // In production, use actual API call
    // const res = await getCurrentUser();
    setTimeout(() => setLoading(false), 500);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </Card>

        {/* Integration Status */}
        <Text style={styles.sectionHeader}>Integration Status</Text>
        <Card style={styles.integrationCard}>
          <View style={styles.integrationItem}>
            <View style={styles.integrationLeft}>
              <Ionicons name="mail" size={24} color={colors.text.primary} />
              <Text style={styles.integrationLabel}>Gmail</Text>
            </View>
            {integrations.gmail ? (
              <StatusChip status="healthy" label="Connected" />
            ) : (
              <StatusChip status="error" label="Not Connected" />
            )}
          </View>
          <View style={styles.integrationItem}>
            <View style={styles.integrationLeft}>
              <Ionicons name="calendar" size={24} color={colors.text.primary} />
              <Text style={styles.integrationLabel}>Calendar</Text>
            </View>
            {integrations.calendar ? (
              <StatusChip status="healthy" label="Connected" />
            ) : (
              <StatusChip status="error" label="Not Connected" />
            )}
          </View>
          <View style={styles.integrationItem}>
            <View style={styles.integrationLeft}>
              <Ionicons name="sparkles" size={24} color={colors.text.primary} />
              <Text style={styles.integrationLabel}>OpenAI</Text>
            </View>
            {integrations.openai ? (
              <StatusChip status="healthy" label="Connected" />
            ) : (
              <StatusChip status="error" label="Not Connected" />
            )}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.dark,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  avatarContainer: {
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brand.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  name: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  email: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.secondary,
  },
  sectionHeader: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  integrationCard: {
    marginTop: theme.spacing.sm,
  },
  integrationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  integrationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  integrationLabel: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: "500",
  },
});



