import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, SafeAreaView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { colors, theme } from "@/theme";
import { Ionicons } from "@expo/vector-icons";

// External URL for Terms of Service
const TERMS_OF_SERVICE_URL = "https://ovrsee.dev/terms";

export default function TermsOfServiceScreen() {
  const handleOpenExternalLink = () => {
    Linking.openURL(TERMS_OF_SERVICE_URL).catch((err) =>
      console.error("Failed to open terms of service URL:", err)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Terms of Service" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.updatedText}>Last updated: {new Date().toLocaleDateString()}</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using OVRSEE, you accept and agree to be bound by the terms and provision of this agreement.
          </Text>

          <Text style={styles.sectionTitle}>2. Use License</Text>
          <Text style={styles.paragraph}>
            Permission is granted to use OVRSEE for personal and commercial purposes. This license does not include:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Reselling or sublicensing the service</Text>
            <Text style={styles.listItem}>• Using the service for any unlawful purpose</Text>
            <Text style={styles.listItem}>• Attempting to reverse engineer or extract source code</Text>
          </View>

          <Text style={styles.sectionTitle}>3. User Accounts</Text>
          <Text style={styles.paragraph}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </Text>

          <Text style={styles.sectionTitle}>4. Service Availability</Text>
          <Text style={styles.paragraph}>
            OVRSEE strives to maintain service availability but does not guarantee uninterrupted or error-free service. We reserve the right to modify or discontinue services at any time.
          </Text>

          <Text style={styles.sectionTitle}>5. Subscription and Payments</Text>
          <Text style={styles.paragraph}>
            Subscription fees are charged according to your selected plan. All fees are non-refundable unless otherwise stated. You may cancel your subscription at any time.
          </Text>

          <Text style={styles.sectionTitle}>6. Data and Privacy</Text>
          <Text style={styles.paragraph}>
            Your use of OVRSEE is also governed by our Privacy Policy. By using our service, you consent to the collection and use of information as outlined in the Privacy Policy.
          </Text>

          <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            OVRSEE shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
          </Text>

          <Text style={styles.sectionTitle}>8. Termination</Text>
          <Text style={styles.paragraph}>
            We reserve the right to terminate or suspend your account and access to the service immediately, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users.
          </Text>

          <Text style={styles.sectionTitle}>9. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            OVRSEE reserves the right to modify these terms at any time. We will notify users of significant changes. Continued use of the service after changes constitutes acceptance of the new terms.
          </Text>

          <Text style={styles.sectionTitle}>10. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have questions about these Terms of Service, please contact us at legal@ovrsee.dev
          </Text>

          {/* Link to full terms */}
          <TouchableOpacity
            style={styles.externalLinkButton}
            onPress={handleOpenExternalLink}
          >
            <Text style={styles.externalLinkText}>View Full Terms of Service Online</Text>
            <Ionicons name="open-outline" size={20} color={colors.brand.primaryBlue} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.background0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  updatedText: {
    fontSize: theme.typography.fontSize.sm,
    color: colors.text.textMuted,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: "600",
    color: colors.text.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  paragraph: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  list: {
    marginLeft: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  listItem: {
    fontSize: theme.typography.fontSize.base,
    color: colors.text.textSecondary,
    lineHeight: 22,
  },
  externalLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: colors.background.background1,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.brand.primaryBlue,
  },
  externalLinkText: {
    fontSize: theme.typography.fontSize.base,
    color: colors.brand.primaryBlue,
    fontWeight: "600",
  },
});




