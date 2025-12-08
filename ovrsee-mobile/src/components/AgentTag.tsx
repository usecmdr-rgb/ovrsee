import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AgentKey } from "@/types";
import { colors, theme } from "@/theme";

interface AgentTagProps {
  agentKey: AgentKey;
  agentName: string;
}

const agentColors: Record<AgentKey, string> = {
  sync: colors.agent.sync,
  aloha: colors.agent.aloha,
  studio: colors.agent.studio,
  insight: colors.agent.insight,
};

export const AgentTag: React.FC<AgentTagProps> = ({ agentKey, agentName }) => {
  return (
    <View style={[styles.tag, { backgroundColor: agentColors[agentKey] + "20" }]}>
      <View style={[styles.dot, { backgroundColor: agentColors[agentKey] }]} />
      <Text style={[styles.text, { color: agentColors[agentKey] }]}>{agentName}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
  },
});



